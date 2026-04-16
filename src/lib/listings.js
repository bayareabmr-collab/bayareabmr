/**
 * Shared data loader for Bay Area BMR listings.
 * Single source of truth — both homepage and detail pages import from here.
 * Reads from data/processed/listings.json at build time.
 */

import fs from 'fs';
import path from 'path';

// Read listings at build time (Astro SSG runs at build)
const listingsPath = path.join(process.cwd(), 'data', 'processed', 'listings.json');
const raw = fs.readFileSync(listingsPath, 'utf8');
const allListings = JSON.parse(raw);

/** Get all listings */
export function getListings() {
  return allListings;
}

/** Get a single listing by ID */
export function getListingById(id) {
  return allListings.find(l => l.id === id) || null;
}

/** Get unique cities from listings */
export function getCities() {
  const cities = [...new Set(allListings.map(l => l.city).filter(Boolean))];
  return cities.sort();
}

/** Get all listing IDs (for getStaticPaths) */
export function getListingIds() {
  return allListings.map(l => l.id).filter(Boolean);
}
