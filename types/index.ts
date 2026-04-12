// ─── Core data record ────────────────────────────────────────────────────────

export type SalesRecord = {
  postingDate: string        // ISO date string yyyy-MM-dd
  documentDate?: string
  orderDate?: string
  year: number
  quarter: string            // "Q1" | "Q2" | "Q3" | "Q4"
  month: string              // "January" … "December"
  monthNumber: number        // 1–12
  day?: number

  branchCode: string         // Shortcut Dimension 1 Code (BK, CM, CS, …)
  locationCode?: string      // Shortcut Dimension 2 Code

  documentNo?: string
  documentType?: string      // SalesInvioce, CreditMemo, …

  customerNo?: string
  customerCode?: string
  customerName?: string
  customerGroupCode?: string
  customerGroupName?: string

  salespersonCode?: string
  salespersonName: string

  productCode?: string
  productDescription?: string
  testCode?: string
  description?: string

  quantity?: number
  unitPrice?: number
  totalUnitPrice?: number
  lineAmount?: number
  discountAmount?: number    // LineDiscountAmount / InvDiscountAmount
  netAmount: number          // Amount  ← primary KPI
  grossAmount?: number       // AmountIncludingVAT
}

// ─── Revenue metric selector ─────────────────────────────────────────────────

export type RevenueMetric = 'netAmount' | 'grossAmount' | 'lineAmount'

// ─── Filter state ─────────────────────────────────────────────────────────────

export type DashboardFilters = {
  years: number[]
  quarters: string[]
  months: number[]
  branches: string[]
  salespersons: string[]
  documentTypes: string[]
  customerGroups: string[]
  revenueMetric: RevenueMetric
}

// ─── Available filter options (derived from loaded data) ─────────────────────

export type FilterOptions = {
  years: number[]
  quarters: string[]
  months: { number: number; name: string }[]
  branches: string[]
  salespersons: string[]
  documentTypes: string[]
  customerGroups: string[]
}

// ─── KPI shapes ──────────────────────────────────────────────────────────────

export type KPISummary = {
  totalRevenue: number
  yoyGrowth: number | null       // percentage, null if no prior year
  qoqGrowth: number | null
  momGrowth: number | null
  activeBranches: number
  activeSalespersons: number
  bestBranch: string
  bestSalesperson: string
  worstBranch: string
  worstSalesperson: string
}

// ─── Aggregated series ────────────────────────────────────────────────────────

export type TimePoint = {
  label: string     // "2025-01", "Q3 2025", "2024", …
  revenue: number
  count: number
}

export type EntityRevenue = {
  name: string
  revenue: number
  share: number     // percentage of total in current filter
  count: number
}

// ─── Insights ────────────────────────────────────────────────────────────────

export type Insight = {
  type: 'positive' | 'negative' | 'neutral' | 'warning'
  title: string
  body: string
}

// ─── Raw parsed row (before transformation) ──────────────────────────────────

export type RawRow = Record<string, string>
