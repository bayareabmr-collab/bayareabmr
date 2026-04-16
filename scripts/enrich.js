#!/usr/bin/env node
require('dotenv').config();
/**
 * enrich.js — Bay Area BMR Enrichment Pipeline
 *
 * Uses Apify's Google Maps Scraper to find property photos, ratings, descriptions.
 * BMR properties are affordable housing — they're on Google Maps but NOT on Zillow.
 *
 * Usage:
 *   node scripts/enrich.js                           # Enrich unenriched listings
 *   node scripts/enrich.js --property "Casa Sueños"  # Enrich one property
 *   node scripts/enrich.js --force                    # Re-enrich all
 *   node scripts/enrich.js --limit 5                  # Only first 5
 *   node scripts/enrich.js --city Oakland             # Only Oakland
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const LISTINGS_PATH = path.resolve(__dirname, '../data/processed/listings.json');
const CACHE_DAYS = 90;

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
    flags[args[i].slice(2)] = args[i + 1]; i++;
  } else if (args[i].startsWith('--')) {
    flags[args[i].slice(2)] = true;
  }
}

function needsEnrichment(listing, force) {
  if (force) return true;
  const sources = listing.enrichment?.sources || [];
  if (sources.length === 0) return true;
  if (!listing.enrichment?.lastEnriched) return true;
  return (Date.now() - new Date(listing.enrichment.lastEnriched).getTime()) / 86400000 > CACHE_DAYS;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      timeout: 180000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE MAPS via Apify — compass/crawler-google-places
// ═══════════════════════════════════════════════════════════════════════════
async function adapterGoogleMaps(listing) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { _skipped: true, _reason: 'APIFY_TOKEN not set' };

  // Search for the property by name + city
  const searchQuery = `${listing.name} apartments ${listing.city} CA`;
  console.log(`    [gmaps] Searching: "${searchQuery}"`);

  try {
    const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}&timeout=120`;

    const response = await httpRequest(runUrl, {
      method: 'POST',
      body: JSON.stringify({
        searchStringsArray: [searchQuery],
        maxCrawledPlacesPerSearch: 1,
        language: "en",
        maxImages: 8,
        includeWebResults: false,
        onlyDataFromSearchPage: false,
        deeperCityScrape: false,
        scrapeDirectories: false,
        scrapeTableReservationProvider: false
      })
    });

    if (response.status !== 200 && response.status !== 201) {
      console.log(`    [gmaps] API status ${response.status}`);
      return { _skipped: true, _reason: `Status ${response.status}` };
    }

    const items = Array.isArray(response.data) ? response.data : [];
    if (items.length === 0) {
      console.log(`    [gmaps] No results`);
      return { _skipped: true, _reason: 'No results' };
    }

    const place = items[0];
    const result = {};

    // Photos
    if (place.imageUrls && place.imageUrls.length > 0) {
      result.photos = place.imageUrls.slice(0, 8).map(url => ({
        url: url.replace(/=w\d+.*/, '=w800-h600'),  // Request reasonable size
        source: 'google_maps'
      }));
    } else if (place.imageUrl) {
      result.photos = [{ url: place.imageUrl, source: 'google_maps' }];
    }

    // Description
    if (place.description && place.description.length > 10) {
      result.buildingDescription = place.description.slice(0, 500);
    } else if (place.additionalInfo?.Summary) {
      result.buildingDescription = place.additionalInfo.Summary.slice(0, 500);
    }

    // Rating
    if (place.totalScore) result.rating = place.totalScore;

    // Website
    if (place.website) result.website = place.website;

    // Categories as amenity hints
    if (place.categoryName) result.propertyType = place.categoryName;

    // Coordinates (backup if geocoding missed this one)
    if (place.location?.lat && place.location?.lng && !listing.coordinates?.lat) {
      result._coordinates = { lat: place.location.lat, lng: place.location.lng };
    }

    const dataKeys = Object.keys(result).filter(k => !k.startsWith('_'));
    if (dataKeys.length > 0 || result._coordinates) {
      const photoCount = result.photos?.length || 0;
      console.log(`    [gmaps] ✓ ${photoCount} photos${result.rating ? ', rating ' + result.rating : ''}${result.buildingDescription ? ', has description' : ''}`);
      return result;
    }

    console.log(`    [gmaps] No usable data`);
    return { _skipped: true, _reason: 'No usable data' };

  } catch (err) {
    console.log(`    [gmaps] Error: ${err.message}`);
    return { _skipped: true, _reason: err.message };
  }
}

// ── Merge ────────────────────────────────────────────────────────────────
function mergeEnrichment(existing, results) {
  const merged = { ...(existing || {}) };
  for (const result of results) {
    if (result._skipped) continue;

    // Photos — deduplicate by URL
    if (result.photos) {
      const urls = new Set((merged.photos || []).map(p => p.url));
      merged.photos = [...(merged.photos || []), ...result.photos.filter(p => !urls.has(p.url))].slice(0, 10);
    }
    if (result.amenities) merged.amenities = [...new Set([...(merged.amenities || []), ...result.amenities])];
    if (result.marketRent) merged.marketRent = { ...(merged.marketRent || {}), ...result.marketRent };

    for (const k of ['walkScore','transitScore','bikeScore','yearBuilt','buildingDescription','rating','website','propertyType']) {
      if (result[k] !== undefined) merged[k] = result[k];
    }

    // Backfill coordinates if we got them from Google Maps
    if (result._coordinates) {
      // Don't store in enrichment — store on the listing itself (handled in main)
    }

    merged.sources = [...new Set([...(merged.sources || []), ...(result.sources || [])])];
  }
  merged.lastEnriched = new Date().toISOString().split('T')[0];
  return merged;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 Bay Area BMR — Enrichment Pipeline\n');
  const listings = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf-8'));
  const force = !!flags.force;

  let toEnrich = listings;
  if (flags.property) {
    toEnrich = listings.filter(l => l.name?.toLowerCase().includes(flags.property.toLowerCase()));
    if (toEnrich.length === 0) { console.error(`❌ No match for "${flags.property}"`); process.exit(1); }
  }
  if (flags.city) toEnrich = toEnrich.filter(l => l.city?.toLowerCase() === flags.city.toLowerCase());
  toEnrich = toEnrich.filter(l => needsEnrichment(l, force));
  if (flags.limit) toEnrich = toEnrich.slice(0, parseInt(flags.limit));

  console.log(`Total: ${listings.length} | Enriching: ${toEnrich.length}\n`);
  console.log(`  ${process.env.APIFY_TOKEN ? '✅' : '⬚'}  Google Maps (via Apify)\n`);

  let enriched = 0;
  for (let i = 0; i < toEnrich.length; i++) {
    const listing = toEnrich[i];
    console.log(`[${i+1}/${toEnrich.length}] 📍 ${listing.name} (${listing.city})`);

    try {
      const result = await adapterGoogleMaps(listing);
      if (!result._skipped) {
        result.sources = ['google_maps'];
        listing.enrichment = mergeEnrichment(listing.enrichment, [result]);

        // Backfill coordinates
        if (result._coordinates && !listing.coordinates?.lat) {
          listing.coordinates = result._coordinates;
          console.log(`    [gmaps] + Backfilled coordinates: ${result._coordinates.lat.toFixed(4)}, ${result._coordinates.lng.toFixed(4)}`);
        }
        enriched++;
      }
    } catch (err) {
      console.warn(`    ⚠ Error: ${err.message}`);
    }

    // Wait between requests to be polite to Apify
    if (i < toEnrich.length - 1) {
      await sleep(3000);
    }
  }

  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
  console.log(`\n✅ Done. ${enriched}/${toEnrich.length} enriched. Saved to listings.json\n`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
