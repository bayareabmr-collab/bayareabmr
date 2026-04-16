#!/usr/bin/env node
/**
 * validate.js — Bay Area BMR Data Validation
 *
 * Checks listings.json against the JSON schema and runs additional
 * business logic checks. Used in CI/CD — if this fails, the build fails.
 *
 * Usage:
 *   node scripts/validate.js
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = validation errors found
 */

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const LISTINGS_PATH = path.resolve(__dirname, '../data/processed/listings.json');
const SCHEMA_PATH = path.resolve(__dirname, '../data/schema/listing.schema.json');

// Bay Area bounding box for coordinate validation
const BAY_AREA_BOUNDS = {
  latMin: 37.1, latMax: 37.9,
  lngMin: -122.6, lngMax: -121.5,
};

const VALID_CITIES = [
  'San Jose', 'Fremont', 'Milpitas', 'Sunnyvale',
  'Santa Clara', 'Mountain View', 'Cupertino', 'Palo Alto', 'Oakland',
];

function main() {
  console.log('\n🔎 Bay Area BMR — Data Validation\n');

  // Load files
  if (!fs.existsSync(LISTINGS_PATH)) {
    console.log('⚠️  No listings.json found. Skipping validation (empty dataset is OK).');
    process.exit(0);
  }

  let listings;
  try {
    listings = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf-8'));
  } catch (err) {
    console.error('❌ listings.json is not valid JSON:', err.message);
    process.exit(1);
  }

  // Empty array is valid (no listings yet)
  if (!Array.isArray(listings)) {
    console.error('❌ listings.json must be an array.');
    process.exit(1);
  }

  if (listings.length === 0) {
    console.log('✅ listings.json is a valid empty array. No listings to validate.');
    process.exit(0);
  }

  console.log(`Validating ${listings.length} listings...\n`);

  // Load schema and create validator
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, verbose: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const errors = [];
  const warnings = [];

  listings.forEach((listing, index) => {
    const prefix = `[${index}] ${listing.name || listing.id || 'unnamed'}`;

    // ── Schema Validation ─────────────────────────────────────────────
    const valid = validate(listing);
    if (!valid) {
      for (const err of validate.errors) {
        errors.push(`${prefix}: ${err.instancePath || '(root)'} ${err.message}`);
      }
    }

    // ── Required Field Checks ─────────────────────────────────────────
    if (!listing.name) {
      errors.push(`${prefix}: Missing required field "name".`);
    }
    if (!listing.address) {
      errors.push(`${prefix}: Missing required field "address".`);
    }
    if (!listing.city) {
      errors.push(`${prefix}: Missing required field "city".`);
    }

    // ── City Validation ───────────────────────────────────────────────
    if (listing.city && !VALID_CITIES.includes(listing.city)) {
      errors.push(`${prefix}: Invalid city "${listing.city}". Must be one of: ${VALID_CITIES.join(', ')}`);
    }

    // ── Coordinate Bounds Check ───────────────────────────────────────
    if (listing.coordinates) {
      const { lat, lng } = listing.coordinates;
      if (lat < BAY_AREA_BOUNDS.latMin || lat > BAY_AREA_BOUNDS.latMax) {
        errors.push(`${prefix}: Latitude ${lat} is outside Bay Area bounds (${BAY_AREA_BOUNDS.latMin}–${BAY_AREA_BOUNDS.latMax}).`);
      }
      if (lng < BAY_AREA_BOUNDS.lngMin || lng > BAY_AREA_BOUNDS.lngMax) {
        errors.push(`${prefix}: Longitude ${lng} is outside Bay Area bounds (${BAY_AREA_BOUNDS.lngMin}–${BAY_AREA_BOUNDS.lngMax}).`);
      }
    }

    // ── Date Checks ───────────────────────────────────────────────────
    if (listing.applicationClose) {
      const closeDate = new Date(listing.applicationClose);
      if (isNaN(closeDate.getTime())) {
        errors.push(`${prefix}: Invalid applicationClose date "${listing.applicationClose}".`);
      }
    }

    if (listing.applicationOpen && listing.applicationClose) {
      if (new Date(listing.applicationOpen) > new Date(listing.applicationClose)) {
        errors.push(`${prefix}: applicationOpen (${listing.applicationOpen}) is after applicationClose (${listing.applicationClose}).`);
      }
    }

    // ── AMI Checks ────────────────────────────────────────────────────
    if (listing.ami) {
      for (const level of listing.ami) {
        if (level < 0 || level > 200) {
          warnings.push(`${prefix}: Unusual AMI level ${level}. Expected 0–200.`);
        }
      }
    }

    // ── Duplicate Detection ───────────────────────────────────────────
    const dupes = listings.filter((other, otherIdx) =>
      otherIdx !== index &&
      other.name === listing.name &&
      other.city === listing.city
    );
    if (dupes.length > 0) {
      warnings.push(`${prefix}: Possible duplicate — same name and city appears ${dupes.length + 1} times.`);
    }

    // ── Warnings (non-blocking) ───────────────────────────────────────
    if (!listing.applicationUrl) {
      warnings.push(`${prefix}: No applicationUrl — users won't be able to apply directly.`);
    }
    if (!listing.coordinates) {
      warnings.push(`${prefix}: No coordinates — map display won't work for this listing.`);
    }
    if (!listing.ami || listing.ami.length === 0) {
      warnings.push(`${prefix}: No AMI levels specified.`);
    }
  });

  // ── Report ──────────────────────────────────────────────────────────
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warning(s):\n`);
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`❌ ${errors.length} error(s):\n`);
    errors.forEach(e => console.log(`  ✗ ${e}`));
    console.log('\n❌ Validation FAILED. Fix errors before deploying.\n');
    process.exit(1);
  }

  console.log(`✅ All ${listings.length} listings passed validation.`);
  if (warnings.length > 0) {
    console.log(`   (${warnings.length} warnings — non-blocking but worth reviewing)`);
  }
  console.log('');
  process.exit(0);
}

main();
