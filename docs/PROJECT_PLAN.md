# BAY AREA BMR — Master Project Plan

**Last updated:** April 10, 2026
**Paste this + CLAUDE_CONTEXT.md at the start of every new Claude session.**

This document tracks every phase, what's been built, what decisions were made, and what's next. It ensures any Claude session can pick up exactly where the last one left off without re-explaining anything.

---

## PROJECT OVERVIEW

Bay Area BMR (bayareabmr.org) is a free, open-source platform aggregating Below Market Rate housing listings across Bay Area cities. The founder is non-technical and builds with AI assistance (Claude). The long-term vision is expansion to the top 10 most expensive US housing markets as a national platform.

**Live site:** bayareabmr.org (GitHub Pages)
**Repo:** github.com/bayareabmr-collab/bayareabmr
**Deployment:** GitHub Actions → validates data → builds Astro → deploys to GitHub Pages
**Node version in CI:** 22 (Astro requires >=22.12.0)

---

## PHASE 0: Architecture & Cleanup ✅ COMPLETE

**Status:** Deployed to production.

**What was built:**
- Astro static site generator project scaffold
- Custom design system (global.css): warm teal/green palette, Fraunces serif headlines, DM Sans body, WCAG AA compliant
- Shared layout (Base.astro): sticky header with nav, footer, mobile hamburger menu
- 4 pages migrated: index (homepage), tips (how to apply), ami (AMI calculator with working JS), about
- Data architecture: two-layer schema (core CPRA + enrichment), single listings.json output file
- Per-city config system in data/configs/ for column mapping
- Ingestion script (scripts/ingest.js): handles CSV, XLSX, JSON, PDF, images with per-city column mapping
- Enrichment script (scripts/enrich.js): 6 modular adapters (Zillow/Apify, PM company sites, Google Places, RentCast, Walk Score, OpenStreetMap) — all scaffolded with clear interfaces, activate by setting env vars
- Validation script (scripts/validate.js): JSON schema validation, coordinate bounds checking, date logic, duplicate detection
- GitHub Actions CI/CD: validate → build → deploy, bad data blocks deploy
- README with founder honesty note ("I'm not technical, tell me if something is wrong")
- CLAUDE_CONTEXT.md (engineering brain for future sessions)
- DATA_GUIDE.md (how to add/update listings, step by step)
- Sample San Jose city config and test CSV that proves pipeline end-to-end

**Key decisions made:**
- Astro over React (content-first, zero JS by default, GitHub Pages compatible)
- Single JSON file architecture (site reads from one file, everything upstream can change)
- Custom CSS over Tailwind (intentional design, not a template)
- No CONTRIBUTING.md yet (not soliciting contributions)
- Per-city configs so format changes don't require code changes

---

## PHASE 1: UI/UX, Map, Components, Translations ✅ COMPLETE

**Status:** Deployed to production.

**What was built:**
- ListingCard.astro: reusable card with photo support, savings badge, amenity tags, walk score, deadline color coding
- FilterBar.astro: search input + city chips + status/bedroom/sort dropdowns, instant client-side filtering
- Map.astro: Leaflet.js interactive map with colored markers by status, popups with pricing, lazy-loads on click (zero performance cost until used)
- LanguagePicker.astro: globe icon dropdown in header, saves to localStorage, reloads page
- 10 translation files (en, es, zh, vi, tl, hi, ko, ja, fa, pa) in src/i18n/ with shared key structure
- i18n helper (src/i18n/index.js) with getLanguage, setLanguage, t() functions
- Dynamic detail pages (listing/[id].astro): one file generates a page per listing with full property view — photo area, building description, unit pricing table with market-rate comparison and strikethrough pricing, annual savings callout, amenities grid, walk score, sticky sidebar with apply button, responsive layout
- 6 sample listings across 5 cities with coordinates (Sunnyvale, Fremont, Mountain View, San Jose, Milpitas, Santa Clara)
- Header updated with language picker and site-header__actions container
- Homepage rebuilt to use ListingCard, FilterBar, Map components
- Data attributes on listing cards for client-side filtering

**What's NOT wired yet:**
- Translation keys are NOT connected to the DOM. The language picker saves preference and reloads, but pages still show hardcoded English text. Phase 3 will add a client-side script to Base.astro that reads the selected language and swaps text content using data-i18n attributes.
- Listings are hardcoded sample data in index.astro and [id].astro, not reading from listings.json yet. Phase 2 connects them.

**Key decisions made:**
- Leaflet.js over Google Maps (free, no API key for basic tiles, open source)
- Client-side filtering over server-side (static site, no backend)
- Lazy-load map (only loads Leaflet JS/CSS when user clicks "Show Map")
- No user accounts or authentication anywhere
- Application tracker feature was rejected (security risk from stored personal data)
- 10 languages chosen based on Bay Area census data: English, Spanish, Chinese, Vietnamese, Tagalog, Hindi, Korean, Japanese, Persian (RTL support), Punjabi

---

## PHASE 2: Real Data & Core Features 🔲 NOT STARTED

**Trigger:** Founder receives first CPRA response from any city.

**What to build:**

### 2a. Connect site to listings.json
- Refactor index.astro to import from data/processed/listings.json instead of hardcoded sample data
- Refactor listing/[id].astro getStaticPaths to read from listings.json
- Remove all hardcoded sample listing data from page files
- Create a shared data loader (src/lib/listings.js) that both pages import from

### 2b. First city data ingestion
- Receive CPRA response file (CSV/XLSX/PDF)
- Create or update the city config in data/configs/
- Run ingest.js to normalize into listings.json
- Review output, fix any mapping issues
- Run validate.js
- Commit, push, deploy — real listings go live

### 2c. Enrichment pipeline activation
- Sign up for free API keys: Apify (apify.com), Google Places (console.cloud.google.com), RentCast (rentcast.io), Walk Score (walkscore.com/professional/api.php)
- Set environment variables
- Run enrich.js — photos, market rents, amenities, walk scores flow into listings
- Geocode addresses to lat/lng via OpenStreetMap Nominatim (free, no key)

### 2d. Savings life impact calculator
- Expand the detail page pricing section
- Show: monthly savings, annual savings, 5-year savings ("That's a down payment on a home")
- Pure client-side math, no user data stored

### 2e. "What can I afford" reverse search
- Add income + household size inputs to homepage (above the filter bar)
- Client-side: filters listings to only those user qualifies for, sorted by savings
- Income number never leaves the browser — no API calls, no storage
- This is the killer feature Doorway doesn't have

### 2f. Commute calculator
- On detail page: user types work address, sees drive/transit/bike commute time
- Google Directions API free tier
- No data stored — one-time browser-side API call

### 2g. SEO enhancements
- Unique meta title + description per listing page optimized for search ("2BR from $1,890/mo at The Villas at Sunnyvale — BMR Housing")
- JSON-LD structured data (schema.org ApartmentComplex + Offer) on every listing page
- City landing pages: one Astro file generates /san-jose, /fremont, /milpitas, etc. — each a static page Google can index
- Open Graph tags for social sharing previews
- robots.txt and canonical URLs
- Submit sitemap to Google Search Console after deploy

---

## PHASE 3: Multilingual, Notifications, Comparison 🔲 NOT STARTED

**What to build:**

### 3a. Wire translations to DOM
- Add data-i18n="key" attributes to all translatable elements across all pages
- Add a client-side script to Base.astro that runs on page load: reads language from localStorage, looks up all data-i18n elements, replaces textContent with translated value
- Handle RTL for Persian (fa): set dir="rtl" on html element
- Test all 10 languages for layout issues (text expansion in German-style languages, character rendering for CJK)

### 3b. Side-by-side comparison
- Checkbox on each listing card: "Compare"
- When 2-3 are selected, a comparison bar appears at bottom of screen
- Click "Compare" → comparison page showing listings in columns
- All client-side using URL parameters (e.g., /compare?ids=abc,def,ghi)
- Users can share comparison links
- No data stored

### 3c. Deadline alerts (email notifications)
- "Notify me" email signup on homepage and detail pages
- User provides: email + preferred cities (checkboxes)
- Backend: Buttondown or Mailchimp free tier (500 subscribers)
- Bimonthly digest email when new listings open in their cities
- Only personal data held: email + city preferences (managed by Mailchimp, not us)

### 3d. Professional translation review
- Have native speakers review machine-generated translation files
- Prioritize Spanish and Chinese (largest non-English populations)
- Budget: $2K-$5K if grant funded

---

## PHASE 4: Content, Reporting & Growth 🔲 NOT STARTED

**What to build:**

### 4a. BMR success stories
- Static content page with 3-5 profiles of current BMR residents
- Requires outreach: contact property management companies, housing counselors, community orgs to find willing participants
- Written interviews, photos with permission
- No tech — just content on an Astro page

### 4b. "State of BMR Housing" annual report
- Auto-generated from listings.json data
- Metrics: total units across all cities, average savings, city-by-city breakdown, most common AMI levels, average time listings stay open
- One page on the site that updates when data updates
- Export as PDF for grant applications and press pitches
- This becomes the annual media pitch

### 4c. City expansion research
- Research public records laws in LA, NYC, Boston, Seattle, Miami, DC, San Diego, Denver
- Identify equivalent of CPRA in each state (FOIL in NY, PRA in WA, etc.)
- Draft template public records requests for each jurisdiction
- Assess which cities have existing portals to differentiate against

---

## PHASE 5: Grant Readiness & Organizational Structure 🔲 NOT STARTED

**What to build:**

### 5a. Impact dashboard
- Page showing: cities covered, total listings, unique monthly visitors (via Plausible/Umami analytics), notification subscribers, click-throughs to city application portals
- This is the grant application centerpiece

### 5b. Analytics integration
- Plausible Analytics (privacy-respecting, open source) or Umami
- Self-hosted on free tier (Vercel/Railway) or Plausible community edition
- Track: page views, listing clicks, filter usage, language selection, map opens
- Essential for grant applications — "5,000 monthly visitors" vs. "we think people use it"

### 5c. Fiscal sponsorship or 501(c)(3)
- Best option identified: SF Civic Tech (501c3, Bay Area civic tech org)
- Backup: Open Source Collective (501c6, for open source projects)
- For national scale: form own 501(c)(3) by Year 2

### 5d. Grant applications
- Grant letter template already drafted (Word doc created in early session)
- Target funders by tier:
  - Year 1: Knight Foundation ($25K-$150K), Mozilla Foundation ($10K-$50K), Silicon Valley Community Foundation ($10K-$50K)
  - Year 2: Ford Foundation ($250K-$1M), Enterprise Community Partners ($100K-$500K), corporate foundations (Wells Fargo, JPMorgan Chase)
  - Year 3: MacArthur Foundation ($500K-$2M), federal sub-grants through established partners
- Federal funding (HUD) not recommended until Year 3+ with organizational infrastructure

### 5e. National expansion brand
- "Bay Area BMR" doesn't scale nationally
- Need parent brand (e.g., "OpenHousing," "HousingFinder") with Bay Area as first market
- Decision needed before expanding to second city

---

## KEY DECISIONS LOG

| Decision | Chosen | Why | Date |
|----------|--------|-----|------|
| Framework | Astro | Static output, zero JS, GitHub Pages, perfect Lighthouse | Apr 2026 |
| Styling | Custom CSS | Not a template — intentional design | Apr 2026 |
| Data architecture | Single JSON file | Decouples site from pipeline | Apr 2026 |
| Map library | Leaflet.js | Free, no API key, open source | Apr 2026 |
| User accounts | None — rejected | Security risk, not needed for core mission | Apr 2026 |
| Application tracker | Rejected | Requires stored personal data, attack surface | Apr 2026 |
| Translation approach | Build-time JSON files, client-side swap | Zero cost, no runtime API dependency | Apr 2026 |
| Languages | 10 (en, es, zh, vi, tl, hi, ko, ja, fa, pa) | Bay Area census top non-English languages | Apr 2026 |
| Federal funding | Defer to Year 3+ | Too much compliance overhead for solo founder | Apr 2026 |
| Fiscal sponsor | SF Civic Tech (primary), OSC (backup) | Mission-aligned, Bay Area, 501c3 | Apr 2026 |
| CI Node version | 22 | Astro requires >=22.12.0 | Apr 2026 |

---

## COMPETITIVE LANDSCAPE

### Doorway (housingbayarea.mtc.ca.gov)
- **Backed by:** $36M Google.org + $20M state funding + Google Fellows + Exygy
- **Built on:** Bloom Housing (React, open source)
- **Strengths:** Common application, property manager uploads, 5 languages, government authority
- **Weaknesses:** No interior photos, no market-rate comparison, no neighborhood context, no walk scores, government-speed updates, JavaScript-heavy (bad for SEO), depends on voluntary PM uploads, only 5 languages
- **Our advantages over Doorway:** Interior photos via enrichment pipeline, market-rate savings comparison, 10 languages, walk/transit scores, neighborhood context, pure HTML (SEO advantage), CPRA-sourced data (not dependent on voluntary uploads), commute calculator, "what can I afford" reverse search, side-by-side comparison, faster shipping speed

### DAHLIA (housing.sfgov.org)
- **Backed by:** City of San Francisco, built by Exygy
- **Built on:** Rails + AngularJS → React migration, Salesforce backend
- **Scope:** SF only
- **Open source:** Yes (GPL-3.0), but heavy stack unsuitable for our use
- **Relevance:** UX patterns and design decisions are useful reference. Their pattern library informed our component design.

---

## FUNDING TRAJECTORY

| Year | Sources | Realistic Range |
|------|---------|----------------|
| 1 | Knight, Mozilla, SVCF, local | $50K–$150K |
| 2 | Ford, Enterprise, corporate | $200K–$500K |
| 3 | MacArthur, federal sub-grants | $500K–$2M |

**Budget template for $100K grant:**
- Founder compensation (Project Director): $50,000
- Fiscal sponsor fee (8%): $8,000
- Data operations (API keys, hosting): $3,000
- Community outreach & partnerships: $10,000
- Professional translation review: $5,000
- Legal / 501(c)(3) formation: $4,000
- City expansion research: $10,000
- Operating reserve: $10,000

---

## LEGAL CONTEXT

- California CPRA guarantees access to BMR listing data from cities
- Local inclusionary housing ordinances require developers to submit BMR marketing plans to cities
- Federal AFHM requirements mandate public accessibility of housing marketing plans (though HUD has proposed rescinding these)
- AB 2663 (effective 2025) requires cities to publicly disclose inclusionary housing fee collection and usage
- Enforcement path: CPRA requests → city housing coordinators → HCD Housing Accountability Unit if cities are non-responsive

---

## MARKETING CHANNELS (in priority order)

1. Email 8 city housing coordinators (friendly intro, not CPRA)
2. Email 3-5 housing nonprofits (Silicon Valley at Home, Housing Trust SV, etc.)
3. Reddit: r/bayarea, r/SanJose, r/fremont, r/SiliconValley
4. LinkedIn post (non-engineer builds civic tech with AI angle)
5. Nextdoor local communities
6. Local press: Mercury News, SF Chronicle, San Jose Spotlight, The Six Fifty
7. Code for America Summit (May 7-8, 2026, Chicago) — networking
8. After data is live: Google Search Console, SEO, multilingual community outreach
9. After notifications: email list as direct channel

---

## HOW TO START A NEW CLAUDE SESSION

1. Upload CLAUDE_CONTEXT.md (tech stack, file structure, coding conventions)
2. Upload this file (PROJECT_PLAN.md — phases, status, decisions)
3. State what you want to do: "Continue Phase X" or "Build [specific feature]"
4. If you have files (CPRA data, screenshots, error messages), upload them

This gives Claude full context in one message instead of 10.
