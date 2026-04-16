#!/usr/bin/env node
/**
 * geocode.js — Add coordinates to listings using OpenStreetMap Nominatim (free, no API key)
 * 
 * Rate limit: 1 request per second (Nominatim usage policy)
 * Usage: node scripts/geocode.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const LISTINGS_PATH = path.resolve(__dirname, '../data/processed/listings.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function geocode(address) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us`;
    
    const options = {
      headers: {
        'User-Agent': 'BayAreaBMR/1.0 (bayareabmr@gmail.com)'  // Required by Nominatim
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon),
              displayName: results[0].display_name
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('\n🌍 Bay Area BMR — Geocoding\n');

  const listings = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf-8'));
  
  const needsGeocode = listings.filter(l => !l.coordinates?.lat && l.address);
  console.log(`${listings.length} total listings`);
  console.log(`${needsGeocode.length} need geocoding\n`);

  if (needsGeocode.length === 0) {
    console.log('All listings already have coordinates. Nothing to do.\n');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needsGeocode.length; i++) {
    const listing = needsGeocode[i];
    const progress = `[${i + 1}/${needsGeocode.length}]`;
    
    try {
      const result = await geocode(listing.address);
      
      if (result) {
        // Sanity check: coordinates should be in the Bay Area roughly
        if (result.lat > 36.5 && result.lat < 38.5 && result.lng > -123 && result.lng < -121) {
          listing.coordinates = { lat: result.lat, lng: result.lng };
          console.log(`  ✓ ${progress} ${listing.name}: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
          success++;
        } else {
          console.log(`  ⚠ ${progress} ${listing.name}: Outside Bay Area (${result.lat.toFixed(2)}, ${result.lng.toFixed(2)}) — skipping`);
          failed++;
        }
      } else {
        console.log(`  ✗ ${progress} ${listing.name}: No results for "${listing.address}"`);
        failed++;
      }
    } catch (err) {
      console.log(`  ✗ ${progress} ${listing.name}: Error — ${err.message}`);
      failed++;
    }

    // Rate limit: 1 request per second
    await sleep(1100);
  }

  // Save
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(listings, null, 2));
  console.log(`\n✅ Geocoding complete.`);
  console.log(`   ${success} geocoded, ${failed} failed`);
  console.log(`   Saved to ${LISTINGS_PATH}\n`);
}

main().catch(err => {
  console.error('❌ Geocoding failed:', err.message);
  process.exit(1);
});
