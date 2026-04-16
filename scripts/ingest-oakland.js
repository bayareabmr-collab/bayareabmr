#!/usr/bin/env node
/**
 * ingest-oakland.js — Transform Oakland HCD Portfolio XLSX into listings.json entries
 * 
 * Oakland's data is a portfolio inventory (not per-listing CPRA), so it requires
 * custom handling: unit counts by income tier → AMI levels, no application dates,
 * all properties are "Completed" (existing buildings).
 * 
 * Usage: node scripts/ingest-oakland.js <path-to-xlsx>
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Usage: node scripts/ingest-oakland.js <path-to-xlsx>');
  process.exit(1);
}

// Read XLSX
const workbook = XLSX.readFile(inputFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`Read ${rows.length} rows from ${inputFile}`);

// Deduplicate by name + address
const seen = new Set();
const unique = rows.filter(r => {
  const key = `${(r.ProjName || '').trim()}|${(r.Address || '').trim()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`After dedup: ${unique.length}`);

function makeId(name) {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const hash = crypto.createHash('md5').update(name).digest('hex').slice(0, 6);
  return `oakland-${slug}-${hash}`;
}

function appendOaklandCA(addr) {
  addr = addr.trim();
  if (!addr) return '';
  // Add Oakland, CA if not already present
  if (!/oakland/i.test(addr) && !/\bCA\b/.test(addr)) {
    return `${addr}, Oakland, CA`;
  }
  if (!/\bCA\b/.test(addr)) {
    return `${addr}, CA`;
  }
  return addr;
}

const listings = [];

for (const row of unique) {
  const name = (row.ProjName || '').trim();
  const address = (row.Address || '').trim();
  const totalUnits = parseInt(row.TotalUnits) || 0;
  const affordableUnits = parseInt(row.AffordableUnits) || 0;
  
  // Skip entries with no name, scattered sites, or tiny projects
  if (!name) continue;
  if (/scattered/i.test(address)) continue;
  if (affordableUnits < 3) continue;

  const incomeEL = parseInt(row['Income-EL']) || 0;   // ~30% AMI
  const incomeVL = parseInt(row['Income-VL']) || 0;    // ~50% AMI
  const incomeL = parseInt(row['Income-L']) || 0;      // ~80% AMI
  const incomeMod = parseInt(row['Income-Mod']) || 0;  // ~120% AMI
  const mktRate = parseInt(row.MktRate) || 0;

  // Build units array from income tiers
  const units = [];
  const ami = [];
  
  if (incomeEL > 0) {
    units.push({ type: 'BMR', count: incomeEL, amiLevel: 30 });
    if (!ami.includes(30)) ami.push(30);
  }
  if (incomeVL > 0) {
    units.push({ type: 'BMR', count: incomeVL, amiLevel: 50 });
    if (!ami.includes(50)) ami.push(50);
  }
  if (incomeL > 0) {
    units.push({ type: 'BMR', count: incomeL, amiLevel: 80 });
    if (!ami.includes(80)) ami.push(80);
  }
  if (incomeMod > 0) {
    units.push({ type: 'BMR', count: incomeMod, amiLevel: 120 });
    if (!ami.includes(120)) ami.push(120);
  }

  if (units.length === 0) continue;

  const listing = {
    city: 'Oakland',
    dataSource: 'Oakland HCD',
    sourceFormat: 'portfolio',
    lastVerified: '2026-04-14',
    // All Oakland data is "completed" — existing buildings with affordable units
    // We mark them as "open" since they are operating BMR properties
    status: 'open',
    ami: ami.sort((a, b) => a - b),
    units,
    name,
    address: appendOaklandCA(address),
    totalUnits,
    affordableUnits,
    projectType: (row.Type || '').trim(),
    notes: `${(row.Type || '').trim()} — ${affordableUnits} of ${totalUnits} total units are affordable`,
    id: makeId(name),
    enrichment: {
      lastEnriched: null,
      sources: []
    }
  };

  listings.push(listing);
}

console.log(`Generated ${listings.length} Oakland listings`);

// Read existing listings.json
const outputPath = path.join(__dirname, '..', 'data', 'processed', 'listings.json');
let existing = [];
try {
  existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  // Remove any existing Oakland listings (re-ingest)
  const before = existing.length;
  existing = existing.filter(l => l.city !== 'Oakland');
  console.log(`Removed ${before - existing.length} previous Oakland listings`);
} catch (e) {
  console.log('No existing listings.json, creating fresh');
}

// Merge
const merged = [...existing, ...listings];
fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
console.log(`Wrote ${merged.length} total listings to ${outputPath}`);
console.log(`  - Oakland: ${listings.length}`);
console.log(`  - Other cities: ${existing.length}`);
