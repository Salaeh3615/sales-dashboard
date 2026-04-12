# CLT Sales & Marketing Dashboard

Modern interactive sales performance dashboard built with Next.js 14, React, TypeScript, Tailwind CSS, and Recharts.

Reads real CSV and Excel exports directly in the browser — no server-side processing needed.

---

## Quick start

### 1. Install Node.js

Download and install from https://nodejs.org (choose the LTS version — 20.x or 22.x).

Verify installation:
```
node --version
npm --version
```

### 2. Install dependencies

```bash
cd "C:\Users\DELL\OneDrive - Thammasat University (1)\ลูกค้า CLT\sales-dashboard"
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Loading your data

1. Open the dashboard in your browser.
2. Drag-and-drop one or more CSV or Excel files onto the upload zone, or click to select them.
3. You can add multiple files at once — they will be merged automatically.

**Supported files:**
- `CLT 2022_Q4.csv`
- `CLT 2023.csv`
- `CLT 2024.csv`
- `CLT 2025.csv`
- `CLT 2026_Q1.csv`
- Any future year export in the same format
- `.xlsx` files with the same column structure

The parser automatically detects the header row (skipping the Thai title row and the blank row above the real headers). No manual configuration needed.

---

## Dashboard sections

| Section | What it shows |
|---|---|
| **Overview** | Monthly, quarterly, and annual revenue trend charts |
| **Branch** | Branch ranking, comparison bar, pie share, trend over time |
| **Salesperson** | Salesperson ranking, top-N bar chart, pie share |
| **Comparison** | Year vs Year, Quarter vs Quarter, Month vs Month grouped bars |
| **Insights** | Auto-generated business insight cards |

---

## Filters (left sidebar)

- **Revenue Metric** — switch between Net (Amount), Gross (AmountIncludingVAT), or Line (LineAmount)
- **Year / Quarter / Month** — multi-select period filters
- **Branch / Salesperson** — multi-select scope filters
- **Document Type / Customer Group** — advanced filters (hidden if no data)

All filters are multi-select pill buttons. "All" = no filter applied.

---

## KPI cards (always visible)

| Card | Calculation |
|---|---|
| Total Revenue | Sum of selected metric for filtered records |
| YoY Growth | vs same period in prior year(s) |
| QoQ Growth | vs previous quarter (only when 1 quarter selected) |
| MoM Growth | vs previous month (only when 1 month selected) |
| Active Branches | Count of unique branches in filtered set |
| Active Salespeople | Count of unique salesperson names |
| Best Branch | Highest revenue branch |
| Best Salesperson | Highest revenue individual |

---

## Adding new data later

**Option A — Upload in the browser**
Just add a new year's CSV/Excel file via the "Add file" button. The dashboard merges it automatically. New years, branches, and salespersons appear without any code changes.

**Option B — Replace files on disk**
If you want the same files loaded every session, you can place them in `public/data/` and write a loader route (optional enhancement). For now, browser upload is the simplest approach.

---

## Project structure

```
app/                   Next.js App Router
  layout.tsx
  page.tsx             Main dashboard page
  globals.css

components/
  dashboard/
    KPICards.tsx       8-card KPI summary
    InsightCard.tsx    Insight cards + panel
  filters/
    FilterPanel.tsx    Left sidebar with all filters
  charts/
    RevenueChart.tsx   Monthly/quarterly/annual area charts
    BranchChart.tsx    Bar, pie, and trend line charts
    SalespersonChart.tsx  Bar and pie charts
    ComparisonChart.tsx  Year/Quarter/Month grouped bars
  tables/
    RankingTable.tsx   Sortable ranking table with share bar

lib/
  data-loader/
    fileLoader.ts      Dispatches to csv or excel loader, merges files
    csvLoader.ts       PapaParse-based CSV parser
    excelLoader.ts     xlsx-based Excel parser
  transformers/
    headerDetector.ts  Finds the real header row (skips title rows)
    recordTransformer.ts  Maps raw columns → SalesRecord
  calculations/
    filterUtils.ts     Applies DashboardFilters to records
    aggregations.ts    Monthly/quarterly/annual/branch/person aggregations
    kpiCalculations.ts Computes KPISummary including growth %
  insights/
    insightGenerator.ts  Generates Insight[] from filtered data

types/
  index.ts             All TypeScript types
```

---

## Revenue metric reference

| Metric | Column in file | When to use |
|---|---|---|
| Net Amount | `Amount` | Default — net revenue |
| Gross Amount | `AmountIncludingVAT` | Revenue including 7% VAT |
| Line Amount | `LineAmount` | Before invoice-level discount |

---

## Column mapping reference

| Dashboard field | CSV/Excel column(s) |
|---|---|
| branchCode | Shortcut Dimension 1 Code |
| locationCode | Shortcut Dimension 2 Code |
| postingDate | Posting Date |
| salespersonCode | Salesperson Code |
| salespersonName | Sale Person Name |
| customerName | Bill-to Name |
| netAmount | Amount |
| grossAmount | AmountIncludingVAT |
| discountAmount | LineDiscountAmount OR InvDiscountAmount |
| year / month / day | Year, Month, Day columns (derived from Posting Date if absent) |

The parser handles both `LineDiscountAmount` (2022–2025 files) and `InvDiscountAmount` (2026 file) automatically.

---

## Build for production

```bash
npm run build
npm start
```

Or deploy to Vercel:
```bash
npx vercel
```
