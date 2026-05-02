/**
 * queries.ts — SQL-backed aggregations for the dashboard route.
 *
 * Replaces the JS in-memory loops in `lib/calculations/aggregations.ts` and
 * `lib/calculations/insights.ts` with `GROUP BY` queries against SQLite.
 * This avoids materialising all 1.29M records in JS heap.
 *
 * The function shapes mirror the JS versions so the route can swap them in
 * without touching the rest of the pipeline.
 */

import { getDb } from './store'
import type { DashboardFilters, RevenueMetric } from '@/types'
import type { TimePoint, EntityRevenue } from '@/types'
import type { DocTypeBreakdown } from '@/lib/calculations/aggregations'
import type { DailyPoint, RunRateResult } from '@/lib/calculations/insights'

// ─── Filter → WHERE clause ────────────────────────────────────────────────────

type WherePiece = { sql: string; params: (string | number)[] }

function buildWhere(f: DashboardFilters, override: Partial<DashboardFilters> = {}): WherePiece {
  const filters = { ...f, ...override }
  const conds: string[] = []
  const params: (string | number)[] = []

  if (filters.years.length) {
    conds.push(`year IN (${filters.years.map(() => '?').join(',')})`)
    params.push(...filters.years)
  }
  if (filters.quarters.length) {
    conds.push(`quarter IN (${filters.quarters.map(() => '?').join(',')})`)
    params.push(...filters.quarters)
  }
  if (filters.months.length) {
    conds.push(`monthNumber IN (${filters.months.map(() => '?').join(',')})`)
    params.push(...filters.months)
  }
  if (filters.branches.length) {
    conds.push(`branchCode IN (${filters.branches.map(() => '?').join(',')})`)
    params.push(...filters.branches)
  }
  if (filters.salespersons.length) {
    conds.push(`salespersonName IN (${filters.salespersons.map(() => '?').join(',')})`)
    params.push(...filters.salespersons)
  }
  // The JS version only applies these when the column is non-null; mirror that.
  if (filters.documentTypes.length) {
    conds.push(`(documentType IS NULL OR documentType IN (${filters.documentTypes.map(() => '?').join(',')}))`)
    params.push(...filters.documentTypes)
  }
  if (filters.customerGroups.length) {
    conds.push(`(customerGroupName IS NULL OR customerGroupName IN (${filters.customerGroups.map(() => '?').join(',')}))`)
    params.push(...filters.customerGroups)
  }

  return { sql: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params }
}

/** SQL expression for the active revenue metric. */
function revenueExpr(m: RevenueMetric): string {
  switch (m) {
    case 'grossAmount': return 'COALESCE(grossAmount, netAmount)'
    case 'lineAmount':  return 'COALESCE(lineAmount, netAmount)'
    default:            return 'netAmount'
  }
}

// ─── Counts ───────────────────────────────────────────────────────────────────

export function sqlRecordCount(filters: DashboardFilters): number {
  const { sql: where, params } = buildWhere(filters)
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM records ${where}`).get(...params) as { n: number }
  return row.n
}

export function sqlTotalRecords(): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM records').get() as { n: number }
  return row.n
}

export function sqlAllYears(): number[] {
  const rows = getDb().prepare('SELECT DISTINCT year FROM records ORDER BY year').all() as { year: number }[]
  return rows.map((r) => r.year)
}

export function sqlFilteredYears(filters: DashboardFilters): number[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`SELECT DISTINCT year FROM records ${where} ORDER BY year`).all(...params) as { year: number }[]
  return rows.map((r) => r.year)
}

// ─── Totals & growth ──────────────────────────────────────────────────────────

export function sqlTotalRevenue(filters: DashboardFilters, metric: RevenueMetric): number {
  const { sql: where, params } = buildWhere(filters)
  const row = getDb()
    .prepare(`SELECT COALESCE(SUM(${revenueExpr(metric)}), 0) AS s FROM records ${where}`)
    .get(...params) as { s: number }
  return row.s
}

// ─── Time series ──────────────────────────────────────────────────────────────

export function sqlMonthlyTrend(filters: DashboardFilters, metric: RevenueMetric): TimePoint[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      year || '-' || printf('%02d', monthNumber) AS label,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    GROUP BY year, monthNumber
    ORDER BY year, monthNumber
  `).all(...params) as TimePoint[]
  return rows
}

export function sqlQuarterlyTrend(filters: DashboardFilters, metric: RevenueMetric): TimePoint[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      year || ' ' || quarter AS label,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    GROUP BY year, quarter
    ORDER BY year, quarter
  `).all(...params) as TimePoint[]
  return rows
}

export function sqlYearlyTrend(filters: DashboardFilters, metric: RevenueMetric): TimePoint[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      CAST(year AS TEXT) AS label,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    GROUP BY year
    ORDER BY year
  `).all(...params) as TimePoint[]
  return rows
}

export function sqlDailyRevenue(filters: DashboardFilters, metric: RevenueMetric): DailyPoint[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      substr(postingDate, 1, 10) AS date,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    ${where ? 'AND' : 'WHERE'} postingDate IS NOT NULL
    GROUP BY date
    ORDER BY date
  `).all(...params) as DailyPoint[]
  return rows
}

// ─── Entity rankings ──────────────────────────────────────────────────────────

function entityRanking(
  filters: DashboardFilters,
  metric: RevenueMetric,
  groupExpr: string,
): EntityRevenue[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      ${groupExpr} AS name,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    GROUP BY name
    ORDER BY revenue DESC
  `).all(...params) as { name: string; revenue: number; count: number }[]

  const total = rows.reduce((s, r) => s + r.revenue, 0)
  return rows.map((r) => ({
    name:    r.name,
    revenue: r.revenue,
    count:   r.count,
    share:   total !== 0 ? (r.revenue / total) * 100 : 0,
  }))
}

export function sqlBranchRanking(filters: DashboardFilters, metric: RevenueMetric): EntityRevenue[] {
  return entityRanking(filters, metric, 'branchCode')
}

export function sqlSalespersonRanking(filters: DashboardFilters, metric: RevenueMetric): EntityRevenue[] {
  return entityRanking(filters, metric, 'salespersonName')
}

export function sqlCustomerGroupRanking(filters: DashboardFilters, metric: RevenueMetric): EntityRevenue[] {
  // Mirror JS fallback: name → code → '(no group)'
  return entityRanking(
    filters,
    metric,
    `COALESCE(NULLIF(TRIM(customerGroupName), ''), NULLIF(TRIM(customerGroupCode), ''), '(no group)')`,
  )
}

export function sqlDocumentTypeBreakdown(filters: DashboardFilters, metric: RevenueMetric): DocTypeBreakdown[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT
      COALESCE(NULLIF(TRIM(documentType), ''), '(unknown)') AS type,
      SUM(${revenueExpr(metric)}) AS revenue,
      COUNT(*) AS count
    FROM records
    ${where}
    GROUP BY type
  `).all(...params) as { type: string; revenue: number; count: number }[]

  // share is computed against absolute-value gross (matches the JS version)
  const total = rows.reduce((s, r) => s + Math.abs(r.revenue), 0)
  return rows
    .map((r) => ({
      type:    r.type,
      revenue: r.revenue,
      count:   r.count,
      share:   total !== 0 ? (Math.abs(r.revenue) / total) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.revenue) - Math.abs(a.revenue))
}

// ─── Trend over time, grouped by top-N entities ───────────────────────────────

function entityMonthlyTrend(
  filters: DashboardFilters,
  metric: RevenueMetric,
  groupExpr: string,
  topN: number,
): { label: string; [key: string]: number | string }[] {
  const ranking = entityRanking(filters, metric, groupExpr).slice(0, topN)
  if (ranking.length === 0) return []
  const topNames = ranking.map((r) => r.name)

  const { sql: where, params } = buildWhere(filters)
  const inClause = topNames.map(() => '?').join(',')

  const rows = getDb().prepare(`
    SELECT
      year || '-' || printf('%02d', monthNumber) AS label,
      ${groupExpr} AS name,
      SUM(${revenueExpr(metric)}) AS revenue
    FROM records
    ${where}
    ${where ? 'AND' : 'WHERE'} ${groupExpr} IN (${inClause})
    GROUP BY label, name
    ORDER BY label
  `).all(...params, ...topNames) as { label: string; name: string; revenue: number }[]

  // Pivot to wide format: { label, [name1]: rev, [name2]: rev, ... }
  const byLabel = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const cur = byLabel.get(r.label) ?? {}
    cur[r.name] = r.revenue
    byLabel.set(r.label, cur)
  }
  return [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, vals]) => ({ label, ...vals }))
}

export function sqlBranchMonthlyTrend(filters: DashboardFilters, metric: RevenueMetric, topN = 6) {
  return entityMonthlyTrend(filters, metric, 'branchCode', topN)
}

export function sqlCustomerGroupMonthlyTrend(filters: DashboardFilters, metric: RevenueMetric, topN = 6) {
  return entityMonthlyTrend(
    filters,
    metric,
    `COALESCE(NULLIF(TRIM(customerGroupName), ''), NULLIF(TRIM(customerGroupCode), ''), '(no group)')`,
    topN,
  )
}

// ─── YoY / QoQ / MoM comparison charts ────────────────────────────────────────

export function sqlYearComparison(filters: DashboardFilters, metric: RevenueMetric): { year: number; revenue: number }[] {
  return sqlYearlyTrend(filters, metric).map((p) => ({
    year:    parseInt(p.label, 10),
    revenue: p.revenue,
  }))
}

export function sqlQuarterComparison(filters: DashboardFilters, metric: RevenueMetric): { quarter: string; [year: string]: number | string }[] {
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT quarter, year, SUM(${revenueExpr(metric)}) AS revenue
    FROM records
    ${where}
    GROUP BY quarter, year
  `).all(...params) as { quarter: string; year: number; revenue: number }[]

  const byQuarter = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const cur = byQuarter.get(r.quarter) ?? {}
    cur[String(r.year)] = r.revenue
    byQuarter.set(r.quarter, cur)
  }
  return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ quarter: q, ...(byQuarter.get(q) ?? {}) }))
}

export function sqlMonthComparison(filters: DashboardFilters, metric: RevenueMetric): { month: string; monthNumber: number; [year: string]: number | string }[] {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const { sql: where, params } = buildWhere(filters)
  const rows = getDb().prepare(`
    SELECT monthNumber, year, SUM(${revenueExpr(metric)}) AS revenue
    FROM records
    ${where}
    GROUP BY monthNumber, year
  `).all(...params) as { monthNumber: number; year: number; revenue: number }[]

  const byMonth = new Map<number, Record<string, number>>()
  for (const r of rows) {
    const cur = byMonth.get(r.monthNumber) ?? {}
    cur[String(r.year)] = r.revenue
    byMonth.set(r.monthNumber, cur)
  }
  return Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS[i],
    monthNumber: i + 1,
    ...(byMonth.get(i + 1) ?? {}),
  }))
}

// ─── Prior-period revenue (for YoY / QoQ / MoM growth %) ──────────────────────

function shiftYear(filters: DashboardFilters, deltaYears: number): DashboardFilters {
  return { ...filters, years: filters.years.map((y) => y + deltaYears) }
}

function shiftToPrevQuarter(filters: DashboardFilters): DashboardFilters | null {
  if (filters.quarters.length !== 1) return null
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
  const qi = QUARTERS.indexOf(filters.quarters[0])
  if (qi < 0) return null
  const prevQ = qi > 0 ? QUARTERS[qi - 1] : 'Q4'
  const years = qi > 0 ? filters.years : filters.years.map((y) => y - 1)
  return { ...filters, quarters: [prevQ], years }
}

function shiftToPrevMonth(filters: DashboardFilters): DashboardFilters | null {
  if (filters.months.length !== 1 || filters.years.length === 0) return null
  const m = filters.months[0]
  const prevM = m > 1 ? m - 1 : 12
  const years = m > 1 ? filters.years : filters.years.map((y) => y - 1)
  return { ...filters, months: [prevM], years }
}

export function sqlPriorPeriodGrowth(
  filters: DashboardFilters,
  metric: RevenueMetric,
): { yoy: number | null; qoq: number | null; mom: number | null } {
  const growthPct = (curr: number, prior: number): number | null =>
    prior === 0 ? null : ((curr - prior) / Math.abs(prior)) * 100

  // ── YoY ──
  let yoy: number | null = null
  if (filters.years.length) {
    const prior = sqlTotalRevenue(shiftYear(filters, -1), metric)
    if (prior !== 0) {
      const curr = sqlTotalRevenue(filters, metric)
      yoy = growthPct(curr, prior)
    }
  }

  // ── QoQ ──
  let qoq: number | null = null
  const prevQFilter = shiftToPrevQuarter(filters)
  if (prevQFilter) {
    const prior = sqlTotalRevenue(prevQFilter, metric)
    if (prior !== 0) {
      const curr = sqlTotalRevenue(filters, metric)
      qoq = growthPct(curr, prior)
    }
  }

  // ── MoM ──
  let mom: number | null = null
  const prevMFilter = shiftToPrevMonth(filters)
  if (prevMFilter) {
    const prior = sqlTotalRevenue(prevMFilter, metric)
    if (prior !== 0) {
      const curr = sqlTotalRevenue(filters, metric)
      mom = growthPct(curr, prior)
    }
  }

  return { yoy, qoq, mom }
}

// ─── Per-customer year aggregates (for KPI customer counts) ──────────────────

/**
 * Returns one row per unique (customerNo, customerCode, customerName) tuple,
 * with the years they were active and target/prior-year revenue.
 *
 * Used by the dashboard route to compute customer-movement KPIs without
 * materialising the full 1.29M record array in JS heap.
 *
 * Note: uses ALL records (no filters) because customer history must be
 * computed across the full dataset — filter-based classification distorts it.
 */
export type CustomerAgg = {
  customerNo: string | null
  customerCode: string | null
  customerName: string | null
  years: number[]            // distinct years active
  revTarget: number          // sum of netAmount in targetYear
  revPrior: number           // sum of netAmount in targetYear - 1
}

export function sqlCustomerAggregates(targetYear: number): CustomerAgg[] {
  const rows = getDb().prepare(`
    SELECT
      customerNo, customerCode, customerName,
      year,
      SUM(netAmount) AS rev
    FROM records
    GROUP BY customerNo, customerCode, customerName, year
  `).all() as { customerNo: string | null; customerCode: string | null; customerName: string | null; year: number; rev: number }[]

  // Group by (customerNo, customerCode, customerName) → years[] + revTarget + revPrior
  const map = new Map<string, CustomerAgg>()
  for (const r of rows) {
    // Composite key separates JS-side, then customerKey is computed downstream
    const k = `${r.customerNo ?? ''}|${r.customerCode ?? ''}|${r.customerName ?? ''}`
    let agg = map.get(k)
    if (!agg) {
      agg = {
        customerNo:   r.customerNo,
        customerCode: r.customerCode,
        customerName: r.customerName,
        years:        [],
        revTarget:    0,
        revPrior:     0,
      }
      map.set(k, agg)
    }
    if (!agg.years.includes(r.year)) agg.years.push(r.year)
    if (r.year === targetYear)     agg.revTarget += r.rev
    if (r.year === targetYear - 1) agg.revPrior  += r.rev
  }
  return [...map.values()]
}

// ─── Customer counts (KPI breakdown) ─────────────────────────────────────────

import { customerKey, classifyForYear } from '@/lib/calculations/customerClassification'
import type { SalesRecord } from '@/types'

/**
 * Returns total + new/existing/lost/returning customer counts for `targetYear`.
 * Uses the FULL dataset (filters don't apply — classification needs full
 * customer history, mirroring the original JS behaviour).
 */
export function sqlCustomerCounts(targetYear: number): {
  total: number
  new: number
  existing: number
  returning: number
  lost: number
} {
  const aggs = sqlCustomerAggregates(targetYear)

  // Reuse customerKey() so two SalesRecord rows with different
  // capitalisations of customerName collapse onto the same customer.
  const yearsByKey = new Map<string, Set<number>>()
  for (const a of aggs) {
    const key = customerKey({
      customerNo:   a.customerNo   ?? undefined,
      customerCode: a.customerCode ?? undefined,
      customerName: a.customerName ?? undefined,
    } as unknown as SalesRecord)
    let set = yearsByKey.get(key)
    if (!set) { set = new Set(); yearsByKey.set(key, set) }
    for (const y of a.years) set.add(y)
  }

  let nw = 0, ex = 0, ret = 0, lost = 0
  for (const years of yearsByKey.values()) {
    const status = classifyForYear(years, targetYear)
    if (!status) continue
    if (status === 'new') nw++
    else if (status === 'returning') { ret++; ex++ }
    else if (status === 'existing') ex++
    else if (status === 'lost') lost++
  }
  return { total: yearsByKey.size, new: nw, existing: ex, returning: ret, lost }
}

// ─── Filtered records (for code paths that still need row-level data) ───────

/**
 * Returns the filtered subset as SalesRecord[]. Use only when row-level data
 * is unavoidable (e.g. the legacy `generateInsights` pipeline). This bypasses
 * the in-memory `getAllRecords()` cache so the full dataset never lives in
 * heap unless explicitly requested elsewhere.
 */
export function sqlFilteredRecords(filters: DashboardFilters): SalesRecord[] {
  const { sql: where, params } = buildWhere(filters)
  return getDb().prepare(`SELECT * FROM records ${where}`).all(...params) as unknown as SalesRecord[]
}

// ─── Run-rate (current-month projection) ──────────────────────────────────────

/**
 * Compute run-rate for the most recent month present in the filtered set.
 * Returns null when there isn't enough data to project.
 */
export function sqlRunRate(filters: DashboardFilters, metric: RevenueMetric): RunRateResult | null {
  // Pick the most recent (year, monthNumber) in the filtered set.
  const { sql: where, params } = buildWhere(filters)
  const head = getDb().prepare(`
    SELECT year, monthNumber
    FROM records
    ${where}
    ORDER BY year DESC, monthNumber DESC
    LIMIT 1
  `).get(...params) as { year: number; monthNumber: number } | undefined
  if (!head) return null

  const { year, monthNumber } = head
  const monthLabel  = `${year}-${String(monthNumber).padStart(2, '0')}`
  const daysInMonth = new Date(year, monthNumber, 0).getDate()

  // Latest day with activity in that month
  const dayRow = getDb().prepare(`
    SELECT MAX(day) AS d
    FROM records
    WHERE year = ? AND monthNumber = ?
  `).get(year, monthNumber) as { d: number | null }
  const currentDayOfMonth = dayRow.d ?? 0

  // MTD revenue + per-day series (current month)
  const dailyRows = getDb().prepare(`
    SELECT day, SUM(${revenueExpr(metric)}) AS revenue
    FROM records
    WHERE year = ? AND monthNumber = ? AND day IS NOT NULL
    GROUP BY day
    ORDER BY day
  `).all(year, monthNumber) as { day: number; revenue: number }[]

  let cumulative = 0
  const dailySeries = dailyRows.map((d) => {
    cumulative += d.revenue
    return { day: d.day, revenue: d.revenue, cumulative }
  })
  const currentMTD = cumulative
  const avgDailyRate  = currentDayOfMonth > 0 ? currentMTD / currentDayOfMonth : 0
  const projectedEOM  = avgDailyRate * daysInMonth

  // Previous month (for MoM)
  const prevM = monthNumber > 1 ? monthNumber - 1 : 12
  const prevY = monthNumber > 1 ? year : year - 1
  const prevMonthRow = getDb().prepare(`
    SELECT COALESCE(SUM(${revenueExpr(metric)}), 0) AS s
    FROM records
    WHERE year = ? AND monthNumber = ?
  `).get(prevY, prevM) as { s: number }
  const previousMonthTotal = prevMonthRow.s
  const previousMonthLabel = `${prevY}-${String(prevM).padStart(2, '0')}`

  // Same month prior year (for YoY)
  const prevYearRow = getDb().prepare(`
    SELECT COALESCE(SUM(${revenueExpr(metric)}), 0) AS s
    FROM records
    WHERE year = ? AND monthNumber = ?
  `).get(year - 1, monthNumber) as { s: number }
  const previousYearSameMonth = prevYearRow.s
  const previousYearLabel = `${year - 1}-${String(monthNumber).padStart(2, '0')}`

  const pct = (curr: number, prior: number): number | null =>
    prior === 0 ? null : ((curr - prior) / Math.abs(prior)) * 100

  return {
    currentMonth: monthLabel,
    currentMTD,
    currentDayOfMonth,
    daysInMonth,
    projectedEOM,
    previousMonthTotal,
    previousMonthLabel,
    previousYearSameMonth,
    previousYearLabel,
    momDeltaPct: pct(projectedEOM, previousMonthTotal),
    yoyDeltaPct: pct(projectedEOM, previousYearSameMonth),
    avgDailyRate,
    dailySeries,
  }
}

// ─── Revenue waterfall (per-customer bridge between two years) ────────────────

import type { WaterfallBar } from '@/lib/calculations/aggregations'

/**
 * Computes the revenue bridge between two specific years, respecting the
 * filter set (so users can scope the bridge to e.g. one branch).
 */
export function sqlRevenueWaterfall(
  filters: DashboardFilters,
  metric: RevenueMetric,
  prevYear: number,
  currYear: number,
): WaterfallBar[] {
  // Pull per-customer revenue for the two years inside one query.
  const yearFilter = (y: number) => buildWhere(filters, { years: [y] })
  const a = yearFilter(prevYear)
  const b = yearFilter(currYear)

  const prevRows = getDb().prepare(`
    SELECT customerNo, customerCode, customerName,
           SUM(${revenueExpr(metric)}) AS rev
    FROM records
    ${a.sql}
    GROUP BY customerNo, customerCode, customerName
  `).all(...a.params) as { customerNo: string | null; customerCode: string | null; customerName: string | null; rev: number }[]

  const currRows = getDb().prepare(`
    SELECT customerNo, customerCode, customerName,
           SUM(${revenueExpr(metric)}) AS rev
    FROM records
    ${b.sql}
    GROUP BY customerNo, customerCode, customerName
  `).all(...b.params) as { customerNo: string | null; customerCode: string | null; customerName: string | null; rev: number }[]

  // Use the same identity priority as customerKey() in customerClassification.ts
  const keyOf = (r: { customerNo: string | null; customerCode: string | null; customerName: string | null }): string => {
    if (r.customerNo && r.customerNo.trim()) return `no:${r.customerNo.trim()}`
    if (r.customerCode && r.customerCode.trim()) return `code:${r.customerCode.trim()}`
    if (r.customerName) return `name:${r.customerName.trim().toLowerCase()}`
    return 'unknown'
  }

  const prevMap = new Map<string, number>()
  const currMap = new Map<string, number>()
  for (const r of prevRows) prevMap.set(keyOf(r), (prevMap.get(keyOf(r)) ?? 0) + r.rev)
  for (const r of currRows) currMap.set(keyOf(r), (currMap.get(keyOf(r)) ?? 0) + r.rev)

  const prevTotal = [...prevMap.values()].reduce((s, v) => s + v, 0)
  const currTotal = [...currMap.values()].reduce((s, v) => s + v, 0)

  let newRevenue = 0, grownRevenue = 0, shrunkRevenue = 0, lostRevenue = 0
  for (const [k, curr] of currMap) {
    const prev = prevMap.get(k)
    if (prev === undefined) newRevenue += curr
    else {
      const delta = curr - prev
      if (delta >= 0) grownRevenue += delta
      else shrunkRevenue += delta
    }
  }
  for (const [k, prev] of prevMap) if (!currMap.has(k)) lostRevenue -= prev

  const bars: WaterfallBar[] = []
  let running = prevTotal
  bars.push({ label: 'Prior Period', value: prevTotal, start: 0, type: 'base' })
  if (newRevenue !== 0)    { bars.push({ label: 'New Customers',  value: newRevenue,    start: running, type: 'positive' }); running += newRevenue }
  if (grownRevenue !== 0)  { bars.push({ label: 'Existing ↑',     value: grownRevenue,  start: running, type: 'positive' }); running += grownRevenue }
  if (shrunkRevenue !== 0) { bars.push({ label: 'Existing ↓',     value: shrunkRevenue, start: running, type: 'negative' }); running += shrunkRevenue }
  if (lostRevenue !== 0)   { bars.push({ label: 'Lost Customers', value: lostRevenue,   start: running, type: 'negative' }); running += lostRevenue }
  bars.push({ label: 'Current Period', value: currTotal, start: 0, type: 'total' })

  return bars
}
