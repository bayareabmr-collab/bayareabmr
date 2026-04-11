#!/usr/bin/env node
require('dotenv').config();
/**
 * ingest.js — Bay Area BMR Data Ingestion Pipeline
 *
 * Takes raw city data in any format and normalizes it into our listing schema.
 * Each city has a config file in data/configs/ that maps their columns to ours.
 *
 * Usage:
 *   node scripts/ingest.js --city sanjose --file data/raw/sanjose_apr2026.csv
 *   node scripts/ingest.js --city fremont --file data/raw/fremont_apr2026.xlsx
 *   node scripts/ingest.js --city milpitas --file data/raw/milpitas.json
 *   node scripts/ingest.js --manual  (opens guided manual entry)
 *
 * What happens:
 *   1. Detects file type (CSV, XLSX, JSON, PDF, image)
 *   2. Loads the city's column-mapping config
 *   3. Parses and normalizes each row into our schema
 *   4. Merges with existing listings.json (updates existing, adds new)
 *   5. Outputs to data/processed/listings.json
 */

const fs = require('fs');
const path = require('path');

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

const LISTINGS_PATH = path.resolve(__dirname, '../data/processed/listings.json');
const CONFIGS_DIR = path.resolve(__dirname, '../data/configs');

// ── File Type Detection ─────────────────────────────────────────────────────
function detectFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    '.csv': 'csv', '.tsv': 'csv',
    '.xlsx': 'xlsx', '.xls': 'xlsx',
    '.json': 'json',
    '.pdf': 'pdf',
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image',
  };
  return typeMap[ext] || 'unknown';
}

// ── CSV Handler ─────────────────────────────────────────────────────────────
async function parseCSV(filePath) {
  const { parse } = require('csv-parse/sync');
  const content = fs.readFileSync(filePath, 'utf-8');

  // Auto-detect delimiter
  const firstLine = content.split('\n')[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
  });
}

// ── XLSX Handler ────────────────────────────────────────────────────────────
async function parseXLSX(filePath) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

// ── JSON Handler ────────────────────────────────────────────────────────────
async function parseJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

// ── PDF Handler (flags for manual review) ───────────────────────────────────
async function parsePDF(filePath) {
  console.log('\n⚠️  PDF detected. Automatic extraction is limited.');
  console.log(`   File: ${filePath}`);
  console.log('   → Save any extracted data manually using: node scripts/ingest.js --manual');
  console.log('   → Or convert the PDF to CSV/XLSX first, then re-run ingestion.\n');
  return [];
}

// ── Image Handler (flags for manual entry) ──────────────────────────────────
async function parseImage(filePath) {
  console.log('\n⚠️  Image file detected. Cannot extract data automatically.');
  console.log(`   File: ${filePath}`);
  console.log('   → Enter this data manually using: node scripts/ingest.js --manual');
  console.log('   → Tip: You can use Claude to read the image and generate JSON.\n');
  return [];
}

// ── Column Mapping ──────────────────────────────────────────────────────────
function loadCityConfig(citySlug) {
  const configPath = path.join(CONFIGS_DIR, `${citySlug}.json`);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function mapRowToSchema(row, config) {
  const mapping = config.columnMap;
  const listing = {
    city: config.city,
    dataSource: config.city,
    sourceFormat: 'auto',
    lastVerified: new Date().toISOString().split('T')[0],
    status: 'open', // default — can be overridden by data
    ami: [],
    units: [],
  };

  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    const value = row[sourceCol];
    if (value === undefined || value === '') continue;

    // Handle nested fields (e.g., "units.type", "units.bmrRent")
    if (targetField.startsWith('units.')) {
      const subField = targetField.split('.')[1];
      if (listing.units.length === 0) listing.units.push({});
      const lastUnit = listing.units[listing.units.length - 1];
      if (subField === 'bmrRent' || subField === 'count' || subField === 'amiLevel') {
        lastUnit[subField] = parseFloat(String(value).replace(/[,$]/g, ''));
      } else {
        lastUnit[subField] = String(value).trim();
      }
    } else if (targetField === 'ami') {
      // AMI can be a single number or comma-separated
      const parsed = String(value).split(/[,;\/]/).map(v => parseFloat(v.trim().replace('%', ''))).filter(n => !isNaN(n));
      listing.ami = [...new Set([...listing.ami, ...parsed])];
    } else if (targetField === 'name' || targetField === 'address' || targetField === 'notes') {
      listing[targetField] = String(value).trim();
    } else if (targetField === 'applicationOpen' || targetField === 'applicationClose') {
      listing[targetField] = parseDate(value, config.dateFormat);
    } else if (targetField === 'applicationUrl') {
      listing[targetField] = String(value).trim();
    } else {
      listing[targetField] = String(value).trim();
    }
  }

  // Generate ID if not present
  if (!listing.id) {
    const slug = config.city.toLowerCase().replace(/\s+/g, '');
    const namePart = (listing.name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    listing.id = `${slug}-${namePart}-${Date.now().toString(36)}`;
  }

  return listing;
}

// ── Date Parsing ────────────────────────────────────────────────────────────
function parseDate(value, format) {
  if (!value) return undefined;
  const str = String(value).trim();

  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // MM/DD/YYYY or M/D/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Excel serial date number
  if (/^\d{5}$/.test(str)) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
    return date.toISOString().split('T')[0];
  }

  console.warn(`  ⚠ Could not parse date: "${str}"`);
  return str; // return as-is, validation will catch it
}

// ── Merge Logic ─────────────────────────────────────────────────────────────
function mergeListings(existing, incoming) {
  const byId = new Map(existing.map(l => [l.id, l]));

  for (const listing of incoming) {
    // Try to match by name + city (more reliable than generated IDs)
    const match = existing.find(e =>
      e.city === listing.city &&
      e.name && listing.name &&
      e.name.toLowerCase() === listing.name.toLowerCase()
    );

    if (match) {
      // Update existing — keep enrichment data, update core fields
      const enrichment = match.enrichment;
      Object.assign(match, listing);
      if (enrichment) match.enrichment = enrichment;
      console.log(`  ↻ Updated: ${listing.name} (${listing.city})`);
    } else {
      byId.set(listing.id, listing);
      console.log(`  + Added: ${listing.name || listing.id} (${listing.city})`);
    }
  }

  return Array.from(byId.values());
}

// ── Manual Entry Mode ───────────────────────────────────────────────────────
function showManualTemplate() {
  console.log('\n📝 Manual Entry Template');
  console.log('Copy this JSON, fill in the fields, and add it to data/processed/listings.json:\n');
  const template = {
    id: 'CITY-PROPERTY-XXXX',
    name: 'Property Name',
    address: '123 Main St, City, CA',
    city: 'San Jose',
    status: 'open',
    ami: [80],
    units: [{ type: '1BR', count: 2, bmrRent: 1800, amiLevel: 80 }],
    applicationClose: '2026-06-30',
    applicationUrl: 'https://...',
    propertyManagement: { company: 'PM Company Name', phone: '408-555-0000' },
    dataSource: 'San Jose',
    sourceFormat: 'manual',
    lastVerified: new Date().toISOString().split('T')[0],
  };
  console.log(JSON.stringify(template, null, 2));
  console.log('\nThen run: node scripts/validate.js');
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏠 Bay Area BMR — Data Ingestion\n');

  // Manual entry mode
  if (flags.manual) {
    showManualTemplate();
    return;
  }

  // Validate arguments
  if (!flags.city || !flags.file) {
    console.log('Usage: node scripts/ingest.js --city <cityslug> --file <path>');
    console.log('       node scripts/ingest.js --manual\n');
    console.log('Available city slugs: sanjose, fremont, milpitas, sunnyvale, santaclara, mountainview, cupertino, paloalto\n');
    console.log('Examples:');
    console.log('  node scripts/ingest.js --city sanjose --file data/raw/sanjose_apr2026.csv');
    console.log('  node scripts/ingest.js --city fremont --file data/raw/fremont.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(flags.file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  // Load city config
  const config = loadCityConfig(flags.city);
  if (!config) {
    console.error(`❌ No config found for city "${flags.city}".`);
    console.log(`   Create one at: data/configs/${flags.city}.json`);
    console.log('   See docs/DATA_GUIDE.md for the config format.\n');
    process.exit(1);
  }

  console.log(`City:   ${config.city}`);
  console.log(`File:   ${filePath}`);

  // Detect and parse file
  const fileType = detectFileType(filePath);
  console.log(`Format: ${fileType}\n`);

  let rows;
  switch (fileType) {
    case 'csv':   rows = await parseCSV(filePath); break;
    case 'xlsx':  rows = await parseXLSX(filePath); break;
    case 'json':  rows = await parseJSON(filePath); break;
    case 'pdf':   rows = await parsePDF(filePath); return;
    case 'image': rows = await parseImage(filePath); return;
    default:
      console.error(`❌ Unsupported file type: ${path.extname(filePath)}`);
      process.exit(1);
  }

  console.log(`Parsed ${rows.length} rows.\n`);

  if (rows.length === 0) {
    console.log('No data to process.');
    return;
  }

  // Map to schema
  const incoming = rows.map(row => mapRowToSchema(row, config));
  console.log(`\nMapped ${incoming.length} listings.\n`);

  // Load existing and merge
  let existing = [];
  if (fs.existsSync(LISTINGS_PATH)) {
    existing = JSON.parse(fs.readFileSync(LISTINGS_PATH, 'utf-8'));
  }

  const merged = mergeListings(existing, incoming);

  // Write output
  fs.writeFileSync(LISTINGS_PATH, JSON.stringify(merged, null, 2));
  console.log(`\n✅ Written ${merged.length} total listings to ${LISTINGS_PATH}`);
  console.log('   Run: node scripts/validate.js to check for errors.\n');
}

main().catch(err => {
  console.error('❌ Ingestion failed:', err.message);
  process.exit(1);
});
