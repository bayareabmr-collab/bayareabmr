# CLAUDE_CONTEXT.md — Bay Area BMR Project Context

**Paste this at the start of any new Claude session about this project.**

## What is this project?

Bay Area BMR (bayareabmr.org) is a free, open-source website that aggregates Below Market Rate housing listings across 8 Bay Area cities. The founder is non-technical and builds with AI assistance.

## Tech Stack

- **Framework:** Astro (static site generation)
- **Hosting:** GitHub Pages
- **CI/CD:** GitHub Actions
- **Data:** Single JSON file (`data/processed/listings.json`)
- **Styling:** Custom CSS with CSS custom properties (no Tailwind, no framework)
- **Fonts:** Fraunces (display/headlines), DM Sans (body)
- **Maps:** Leaflet.js (planned, not yet implemented)

## Architecture Decisions

1. **Astro over React:** The site is content-first, not an app. Astro outputs static HTML with zero JS unless explicitly needed. This gives us perfect Lighthouse scores and GitHub Pages compatibility.

2. **Single JSON file:** The site reads from `data/processed/listings.json` only. All upstream complexity (ingestion, enrichment, validation) happens before this file is generated. This decouples the site from the data pipeline.

3. **Two-layer data model:** Each listing has `core` fields (from CPRA requests — authoritative) and `enrichment` fields (from Zillow, Google Places, property management sites — supplementary). These are never mixed.

4. **Per-city configs:** Each city sends data in a different format. Rather than hardcoding column mappings, we use config files in `data/configs/` that map each city's column names to our schema.

5. **Custom CSS over Tailwind:** The design is intentionally custom — warm teal/green palette, Fraunces serif for headlines, DM Sans for body. Not a template. CSS custom properties make the system consistent and changeable.

## File Structure

```
src/layouts/Base.astro      — Shared layout (header, nav, footer, mobile menu)
src/styles/global.css       — Design system (colors, typography, components)
src/pages/index.astro       — Homepage with listings, search, filters
src/pages/tips.astro        — How to apply guide
src/pages/ami.astro         — AMI calculator
src/pages/about.astro       — About, data sources, contact
data/schema/listing.schema.json — Canonical listing schema
data/processed/listings.json    — THE file the site reads
data/configs/               — Per-city column mappings
data/enrichment-configs/    — Per-PM-company scraper configs
```

## Design System

- **Primary:** #1a7a6d (warm teal)
- **Accent:** #e8763a (warm orange — used for CTAs)
- **Text:** #1c2b2a (near-black with warmth)
- **Surface:** white with warm gray undertones
- **Badges:** green=open, yellow=closing, gray=closed, teal=upcoming
- **Cards:** white with subtle shadow, hover lifts

## Data Pipeline (scaffolded, not all connected yet)

1. **Ingest:** `ingest.js` — accepts CSV/XLSX/PDF/JSON/images, normalizes to schema
2. **Validate:** checks against JSON schema, rejects bad data
3. **Enrich:** `enrich.js` — adds photos, market rent, amenities, walk scores from external APIs
4. **Output:** merged `listings.json`

## Enrichment Sources

| Source | What it provides | Cost |
|--------|-----------------|------|
| Property management websites | Amenities, photos, floor plans | Free |
| Zillow/Apartments.com (Apify) | Interior photos, market rent, sqft | ~$1/1000 results |
| Google Places API | User photos, ratings | 5,000 free/month |
| RentCast API | Market rent estimates, features | 50 free calls/month |
| Walk Score API | Walk/transit/bike scores | Free for non-commercial |
| OpenStreetMap Overpass | Nearby schools, transit, grocery | Free |

## Coding Conventions

- Astro components use scoped `<style>` tags
- Global styles go in `src/styles/global.css`
- Use CSS custom properties for all colors, spacing, typography
- Mobile-first responsive design (base styles = phone, `@media` for larger)
- WCAG AA compliance: contrast ratios, focus states, aria labels, semantic HTML
- No `!important` unless overriding third-party CSS

## What's NOT built yet

- Interactive map (Leaflet) — Phase 1
- Multilingual support — Phase 3
- Email notifications — Phase 3
- Analytics dashboard — Phase 5
- The ingestion and enrichment scripts are scaffolded but not connected to real data yet

## Important Context

- The founder is a Senior Consultant in International Tax at Deloitte, not an engineer
- Budget is near-zero — free tiers and open source only
- The project is a civic tool, not a business — positioning for grant funding
- Doorway (backed by $36M from MTC) is the closest competitor but has weaker UX
- SF's DAHLIA portal (open source on GitHub) is a design reference but uses a heavy Rails+Salesforce stack
