#!/usr/bin/env node
/**
 * enrich.js — Bay Area BMR Enrichment Pipeline
 *
 * Adds photos, market rents, amenities, walk scores, and neighborhood data
 * to listings from external APIs. Enrichment data is stored in the "enrichment"
 * key of each listing, separate from authoritative CPRA data.
 *
 * Usage:
 *   node scripts/enrich.js --all                    # Enrich all unenriched listings
 *   node scripts/enrich.js --property "The Parkside" # Enrich one property by name
 *   node scripts/enrich.js --force                   # Re-enrich even if recently done
 *   node scripts/enrich.js --source zillow           # Run only one adapter
 *
 * Each adapter is independent — if one fails, the rest still run.
 * Results are cached for 90 days unless --force is used.
 */

const fs = require('fs');
const path = require('path');

const LISTINGS_PATH = path.resolve(__dirname, '../data/processed/listings.json');
const CACHE_DAYS = 90;

// ── Argument Parsing ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--') && args[i + 1] && !args[i + 1].startsWith('--')) {
    flags[args[i].slice(2)] = args[i + 1];
    i++;
  } else if (args[i].startsWith('--')) {
    flags[args[i].slice(2)] = true;
  }
}

// ── Helper: Check if enrichment is stale ────────────────────────────────────
function needsEnrichment(listing, force) {
  if (force) return true;
  if (!listing.enrichment?.lastEnriched) return true;

  const lastEnriched = new Date(listing.enrichment.lastEnriched);
  const daysSince = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > CACHE_DAYS;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTERS — each returns a partial enrichment object
// All adapters follow the same interface:
//   async function(listing) → { photos?, marketRent?, amenities?, ... }
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Zillow/Apartments.com Adapter (via Apify)
 *
 * To activate: sign up at apify.com, get an API token, set APIFY_TOKEN env var.
 * Free tier: enough for ~500 properties.
 *
 * What it provides: interior photos, market rent, sqft, year built, description
 */
async function adapterZillow(listing) {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return { _skipped: true, _reason: 'APIFY_TOKEN not set. Sign up at apify.com for free.' };
  }

  // TODO: When ready to connect, use Apify's Zillow scraper:
  // 1. Search by address: listing.address
  // 2. Extract: photos, price (market rent), sqft, yearBuilt, description
  // 3. Return normalized enrichment object

  console.log(`    [zillow] Would search: "${listing.address}"`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. Connect when property list is available.',
  };
}

/**
 * Property Management Company Adapter
 *
 * Scrapes the PM company's marketing website for amenities, photos, and details.
 * Uses per-company configs in data/enrichment-configs/.
 *
 * What it provides: amenities, community photos, virtual tours, floor plans
 */
async function adapterPropertyManagement(listing) {
  const pmCompany = listing.propertyManagement?.company;
  if (!pmCompany) {
    return { _skipped: true, _reason: 'No property management company listed.' };
  }

  // TODO: Load company-specific config from data/enrichment-configs/
  // Each config specifies: website URL pattern, CSS selectors for amenities/photos
  // Common PM companies in Bay Area BMR:
  //   - Prometheus Real Estate Group
  //   - Essex Property Trust
  //   - Greystar
  //   - Eden Housing
  //   - MidPen Housing
  //   - Charities Housing

  console.log(`    [pm-site] Would scrape: ${pmCompany} website for "${listing.name}"`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. Add PM company configs to data/enrichment-configs/',
  };
}

/**
 * Google Places Adapter
 *
 * To activate: get a Google Cloud API key with Places API enabled.
 * Set GOOGLE_PLACES_KEY env var.
 * Free tier: 5,000 requests/month for Pro SKU (photos).
 *
 * What it provides: user-uploaded photos, ratings, reviews
 */
async function adapterGooglePlaces(listing) {
  const apiKey = process.env.GOOGLE_PLACES_KEY;
  if (!apiKey) {
    return { _skipped: true, _reason: 'GOOGLE_PLACES_KEY not set. Get one at console.cloud.google.com.' };
  }

  // TODO: When ready to connect:
  // 1. Text Search for: listing.name + " " + listing.city + " apartments"
  // 2. Get Place ID from first result
  // 3. Place Details with fields: photos, rating, reviews
  // 4. Photo requests for up to 5 photos

  console.log(`    [google] Would search: "${listing.name} ${listing.city} apartments"`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. Set GOOGLE_PLACES_KEY to activate.',
  };
}

/**
 * RentCast Adapter
 *
 * To activate: sign up at rentcast.io, get an API key. Set RENTCAST_KEY env var.
 * Free tier: 50 calls/month.
 *
 * What it provides: market rent estimates, property features, tax data
 */
async function adapterRentCast(listing) {
  const apiKey = process.env.RENTCAST_KEY;
  if (!apiKey) {
    return { _skipped: true, _reason: 'RENTCAST_KEY not set. Sign up at rentcast.io (50 free/month).' };
  }

  // TODO: When ready to connect:
  // 1. GET /v1/listings/rental-long-term?address={listing.address}
  // 2. Extract: price by unit type, property features, sqft
  // 3. Also: GET /v1/avm/rent-estimate?address={address} for market comparison

  console.log(`    [rentcast] Would query: "${listing.address}"`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. Set RENTCAST_KEY to activate.',
  };
}

/**
 * Walk Score Adapter
 *
 * To activate: sign up at walkscore.com/professional/api.php
 * Set WALKSCORE_KEY env var. Free for non-commercial use.
 *
 * What it provides: walk score, transit score, bike score
 */
async function adapterWalkScore(listing) {
  const apiKey = process.env.WALKSCORE_KEY;
  if (!apiKey) {
    return { _skipped: true, _reason: 'WALKSCORE_KEY not set. Free at walkscore.com/professional/api.php.' };
  }

  if (!listing.coordinates?.lat || !listing.coordinates?.lng) {
    return { _skipped: true, _reason: 'No coordinates available for this listing.' };
  }

  // TODO: When ready to connect:
  // GET http://api.walkscore.com/score?format=json&address={address}&lat={lat}&lon={lng}&wsapikey={key}&transit=1&bike=1

  console.log(`    [walkscore] Would query: ${listing.coordinates.lat}, ${listing.coordinates.lng}`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. Set WALKSCORE_KEY to activate.',
  };
}

/**
 * Neighborhood Adapter (OpenStreetMap Overpass — free, no key needed)
 *
 * What it provides: nearby schools, transit stops, grocery stores, parks
 */
async function adapterNeighborhood(listing) {
  if (!listing.coordinates?.lat || !listing.coordinates?.lng) {
    return { _skipped: true, _reason: 'No coordinates available for this listing.' };
  }

  // TODO: When ready to connect:
  // Overpass API query for amenities within 1km radius:
  // - amenity=school
  // - railway=station OR highway=bus_stop
  // - shop=supermarket OR shop=grocery
  // - leisure=park

  console.log(`    [osm] Would query nearby amenities for: ${listing.coordinates.lat}, ${listing.coordinates.lng}`);
  return {
    _skipped: true,
    _reason: 'Adapter scaffolded. No API key needed — connect when coordinates are available.',
  };
}

// ── Adapter Registry ────────────────────────────────────────────────────────
const ALL_ADAPTERS = {
  zillow: { fn: adapterZillow, label: 'Zillow/Apartments.com' },
  pm: { fn: adapterPropertyManagement, label: 'Property Management Sites' },
  google: { fn: adapterGooglePlaces, label: 'Google Places' },
  rentcast: { fn: adapterRentCast, label: 'RentCast' },
  walkscore: { fn: adapterWalkScore, label: 'Walk Score' },
  neighborhood: { fn: adapterNeighborhood, label: 'Neighborhood (OSM)' },
};

// ── Merge Enrichment ────────────────────────────────────────────────────────
function mergeEnrichment(existing, results) {
  const merged = { ...(existing || {}) };

  for (const result of results) {
    if (result._skipped) continue;

    // Merge arrays (photos, amenities, sources) — deduplicate
    for (const key of ['photos', 'amenities', 'sources']) {
      if (result[key]) {
        merged[key] = [...new Set([...(merged[key] || []), ...result[key]])];
      }
    }

    // Merge objects (marketRent, sqft, nearby) — shallow merge
    for (const key of ['marketRent', 'sqft', 'nearby']) {
      if (result[key]) {
        merged[key] = { ...(merged[key] || {}), ...result[key] };
      }
    }

    // Scalar overwrites (walkScore, transitScore, etc.)
    for (const key of ['walkScore', 'transitScore', 'bikeScore', 'yearBuilt', 'petPolicy', 'buildingDescription']) {
      if (result[key] !== undefined) {
        merged[key] = result[key];
      }
    }
  }

  merged.lastEnriched = new Date().toISOString().split('T')[0];
  return merged;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 Bay Area BMR — Enrichment Pipeline\n');

  if (!fs.existsSync(LISTINGS_PATH)) {
    console.error('❌ No listings.json found. Run ingestion first.');
    process.exit(1);
  }

  const listings = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf-8'));

  if (listings.length === 0) {
    console.log('No listings to enrich. Add listings first with ingest.js.\n');
    return;
  }

  // Filter listings to enrich
  let toEnrich = listings;
  if (flags.property) {
    toEnrich = listings.filter(l =>
      l.name && l.name.toLowerCase().includes(flags.property.toLowerCase())
    );
    if (toEnrich.length === 0) {
      console.error(`❌ No listing found matching "${flags.property}"`);
      process.exit(1);
    }
  }

  const force = !!flags.force;
  toEnrich = toEnrich.filter(l => needsEnrichment(l, force));

  console.log(`Found ${listings.length} total listings.`);
  console.log(`Enriching ${toEnrich.length} listings${force ? ' (forced)' : ''}.\n`);

  // Select adapters
  let adaptersToRun = Object.entries(ALL_ADAPTERS);
  if (flags.source && ALL_ADAPTERS[flags.source]) {
    adaptersToRun = [[flags.source, ALL_ADAPTERS[flags.source]]];
  }

  // Run enrichment
  let enriched = 0;
  for (const listing of toEnrich) {
    console.log(`\n📍 ${listing.name || listing.id} (${listing.city})`);

    const results = [];
    for (const [key, adapter] of adaptersToRun) {
      try {
        const result = await adapter.fn(listing);
        if (result._skipped) {
          // Silently skip — too noisy to log every skip
        } else {
          result.sources = [key];
          results.push(result);
        }
      } catch (err) {
        console.warn(`    ⚠ [${key}] Failed: ${err.message}`);
      }
    }

    if (results.length > 0) {
      listing.enrichment = mergeEnrichment(listing.enrichment, results);
      enriched++;
    } else {
      // Still mark as attempted so we don't retry every run
      if (!listing.enrichment) listing.enrichment = {};
      listing.enrichment.lastEnriched = new Date().toISOString().split('T')[0];
      listing.enrichment.sources = listing.enrichment.sources || [];
    }
  }

  // Save
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
  console.log(`\n✅ Enrichment complete. ${enriched} listings updated.`);
  console.log(`   Written to ${LISTINGS_PATH}\n`);

  // Show adapter status summary
  console.log('Adapter Status:');
  for (const [key, adapter] of Object.entries(ALL_ADAPTERS)) {
    const envVars = {
      zillow: 'APIFY_TOKEN', google: 'GOOGLE_PLACES_KEY',
      rentcast: 'RENTCAST_KEY', walkscore: 'WALKSCORE_KEY',
      pm: '(config files)', neighborhood: '(no key needed)',
    };
    const status = process.env[envVars[key]] ? '✅ Connected' : '⬚ Not configured';
    console.log(`  ${status}  ${adapter.label} (${envVars[key]})`);
  }
  console.log('');
}

main().catch(err => {
  console.error('❌ Enrichment failed:', err.message);
  process.exit(1);
});
