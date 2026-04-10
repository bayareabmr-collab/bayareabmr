# DATA_GUIDE.md — How to Add and Update Listings

This guide explains how listing data flows from city governments to the live site.

## The big picture

```
City sends data (CSV/XLSX/PDF) 
  → You save it in data/raw/
  → Run the ingestion script to normalize it
  → Enrichment script adds photos, amenities, scores
  → Validation checks for errors
  → Merged into data/processed/listings.json
  → Push to GitHub → site auto-deploys
```

## Step 1: Receive data from a city

You file CPRA requests bimonthly. Cities respond with data in various formats:
- **CSV/XLSX:** Most common. Save as-is in `data/raw/[city]_[date].[ext]`
- **PDF:** Some cities send PDFs. Save in `data/raw/` — the ingestion script will extract what it can and flag the rest for manual entry.
- **Images/Flyers:** Occasionally a city sends a JPEG of a flyer. Save in `data/raw/` — you'll need to enter this data manually.

**Example:** San Jose sends a CSV in April 2026 → save as `data/raw/sanjose_apr2026.csv`

## Step 2: Check the city config

Each city has a config file in `data/configs/` that maps their column names to our schema. For example:

```json
// data/configs/sanjose.json
{
  "city": "San Jose",
  "columnMap": {
    "Property Name": "name",
    "Street Address": "address",
    "Income Level (% AMI)": "ami",
    "Unit Type": "units.type",
    "Monthly Rent": "units.bmrRent",
    "Application Deadline": "applicationClose"
  },
  "dateFormat": "MM/DD/YYYY"
}
```

If the city changes their column names, update this config file — don't change the ingestion code.

## Step 3: Run ingestion

```bash
node scripts/ingest.js --city sanjose --file data/raw/sanjose_apr2026.csv
```

This outputs normalized JSON matching our schema. Review the output for any warnings (missing fields, unparseable dates, etc.).

## Step 4: Run enrichment (optional)

```bash
node scripts/enrich.js --all
```

This adds photos, market rents, amenities, and walk scores from external APIs. It only enriches properties that haven't been enriched in the last 90 days.

## Step 5: Validate and deploy

```bash
node scripts/validate.js
```

If validation passes, commit and push:

```bash
git add .
git commit -m "Update listings: [city] [month] [year]"
git push
```

GitHub Actions automatically builds the site and deploys to bayareabmr.org.

## Adding a new city

1. Create a config file: `data/configs/[cityname].json`
2. Map their column names to our schema fields
3. Run ingestion with the new city flag
4. Add the city to the filter list in `src/pages/index.astro`

## Manual data entry

For PDFs and images that can't be automatically parsed:

1. Open `data/processed/listings.json`
2. Add a new listing object following the schema in `data/schema/listing.schema.json`
3. Set `sourceFormat` to `"manual"` so we know it was hand-entered
4. Run validation, commit, push
