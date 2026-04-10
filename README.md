# Bay Area BMR

**Free, open-source affordable housing data for the Bay Area.**

Bay Area BMR aggregates every Below Market Rate housing listing across 8 Bay Area cities into one searchable platform — with photos, amenities, market-rate comparisons, and application deadlines.

**Live at:** [bayareabmr.org](https://bayareabmr.org)

---

## A note from the founder

I'm not a software engineer. I built this project using AI-assisted development (primarily Claude by Anthropic) because I believe the Bay Area needs a better way to find affordable housing, and I wasn't willing to wait for someone technical to build it.

**If you see something architecturally wrong, a security issue, or a better way to do something — please open an issue.** I want to learn, and more importantly, I want this tool built right for the people who depend on it. Constructive feedback is always welcome. You don't need to be polite about it, just be specific.

---

## What this project does

- Aggregates BMR listings from San Jose, Fremont, Milpitas, Sunnyvale, Santa Clara, Mountain View, Cupertino, and Palo Alto
- Shows interior photos, amenities, and market-rate rent comparisons so applicants can see what they're actually getting
- Tracks application deadlines with clear open/closing/closed status
- Provides an AMI calculator so users can quickly check eligibility
- Sources data via California Public Records Act (CPRA) requests filed bimonthly with each city's housing department

## How the data works

All listing data originates from CPRA requests to city housing departments. This is the authoritative source.

On top of that, we enrich listings with photos and amenities from publicly available sources (property management websites, Zillow, Apartments.com, Google Places). Enrichment data is always kept separate from CPRA data in the schema — so you can always tell what came from the city vs. what came from a third-party source.

The site reads from one file: `data/processed/listings.json`. Everything upstream of that file (ingestion scripts, raw city data, enrichment pipeline) can change without touching the site code.

## Project structure

```
bayareabmr/
├── src/                    # Website source code (Astro)
│   ├── layouts/            # Shared page layout (header, footer, nav)
│   ├── components/         # Reusable UI pieces
│   ├── pages/              # Each page of the site
│   └── styles/             # Design system (colors, typography, spacing)
├── data/
│   ├── raw/                # Untouched files from cities (CSV, XLSX, PDF)
│   ├── processed/          # listings.json — the single file the site reads
│   ├── schema/             # Data validation rules
│   ├── configs/            # Per-city column mapping (so each city's format works)
│   └── enrichment-configs/ # Per-property-management-company scraper configs
├── public/                 # Static files (favicon, images)
├── .github/workflows/      # Automated build & deploy
└── docs/
    ├── CLAUDE_CONTEXT.md   # Full project context for AI-assisted development
    └── DATA_GUIDE.md       # How to add/update listings
```

## Running locally

You need Node.js 18+ installed.

```bash
npm install
npm run dev
```

The site runs at `http://localhost:4321`.

## Tech stack

- **Astro** — static site generator. Outputs plain HTML with zero JavaScript unless a page specifically needs it.
- **GitHub Pages** — free hosting with HTTPS.
- **GitHub Actions** — automated build and deploy on every push to main.
- **No database** — all data lives in a JSON file. Simple, portable, easy to inspect.

## Not affiliated with any government agency

Bay Area BMR is an independent civic project. We are not endorsed by or connected to any city, housing authority, or property management company. Always verify listing details directly with the property or city before applying.

## License

MIT
