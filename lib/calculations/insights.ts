/**
 * insights.ts
 *
 * Advanced aggregations for deeper analytics:
 *  - Daily revenue for calendar heatmap
 *  - Run-rate projection (MTD vs previous-month pace)
 *  - Pareto 80/20 decomposition
 *  - RFM customer segmentation
 *  - Salesperson behavioural bubble data
 *  - Discount analysis (rate, heatmap, quadrant)
 */

import type { DashboardFilters, SalesRecord } from '@/types'
import { getRevenue, sumRevenue } from './filterUtils'
import { customerKey } from './customerClassification'

type Metric = DashboardFilters['revenueMetric']

// ─── 1. Daily revenue — calendar heatmap ─────────────────────────────────────

export type DailyPoint = {
  date: string          // ISO yyyy-MM-dd
  revenue: number
  count: number
}

export function dailyRevenue(records: SalesRecord[], metric: Metric): DailyPoint[] {
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of records) {
    const date = r.postingDate?.slice(0, 10)
    if (!date) continue
    const cur = map.get(date) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(date, cur)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))
}

// ─── 2. Run-rate — projection for the current month ──────────────────────────

export type RunRateResult = {
  currentMonth: string       // "2026-04"
  currentMTD: number
  currentDayOfMonth: number
  daysInMonth: number
  projectedEOM: number
  previousMonthTotal: number
  previousMonthLabel: string
  previousYearSameMonth: number
  previousYearLabel: string
  momDeltaPct: number | null
  yoyDeltaPct: number | null
  avgDailyRate: number
  dailySeries: { day: number; revenue: number; cumulative: number }[]
}

export function runRate(records: SalesRecord[], metric: Metric): RunRateResult | null {
  if (records.length === 0) return null

  // Identify the latest posting date in the dataset — anchor "today"
  const dates = records
    .map((r) => r.postingDate?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort()
  if (dates.length === 0) return null

  const latestDate = dates[dates.length - 1]
  const [yStr, mStr, dStr] = latestDate.split('-')
  const year = parseInt(yStr)
  const month = parseInt(mStr)
  const dayOfMonth = parseInt(dStr)
  const daysInMonth = new Date(year, month, 0).getDate()

  const currentMonthKey = `${yStr}-${mStr}`
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`

  const prevYearSameMonthKey = `${year - 1}-${mStr}`

  let currentMTD = 0
  let previousMonthTotal = 0
  let previousYearSameMonth = 0
  const dayMap = new Map<number, number>()

  for (const r of records) {
    const d = r.postingDate?.slice(0, 10)
    if (!d) continue
    const mKey = d.slice(0, 7)
    const rev = getRevenue(r, metric)
    if (mKey === currentMonthKey) {
      currentMTD += rev
      const dd = parseInt(d.slice(8, 10))
      dayMap.set(dd, (dayMap.get(dd) ?? 0) + rev)
    } else if (mKey === prevMonthKey) {
      previousMonthTotal += rev
    }
    if (mKey === prevYearSameMonthKey) {
      previousYearSameMonth += rev
    }
  }

  const avgDailyRate = dayOfMonth > 0 ? currentMTD / dayOfMonth : 0
  const projectedEOM = avgDailyRate * daysInMonth

  const momDeltaPct = previousMonthTotal !== 0
    ? ((projectedEOM - previousMonthTotal) / previousMonthTotal) * 100
    : null
  const yoyDeltaPct = previousYearSameMonth !== 0
    ? ((projectedEOM - previousYearSameMonth) / previousYearSameMonth) * 100
    : null

  // Build cumulative daily series for the current month
  let cum = 0
  const dailySeries: { day: number; revenue: number; cumulative: number }[] = []
  for (let d = 1; d <= dayOfMonth; d++) {
    const rev = dayMap.get(d) ?? 0
    cum += rev
    dailySeries.push({ day: d, revenue: rev, cumulative: cum })
  }

  return {
    currentMonth: currentMonthKey,
    currentMTD,
    currentDayOfMonth: dayOfMonth,
    daysInMonth,
    projectedEOM,
    previousMonthTotal,
    previousMonthLabel: prevMonthKey,
    previousYearSameMonth,
    previousYearLabel: prevYearSameMonthKey,
    momDeltaPct,
    yoyDeltaPct,
    avgDailyRate,
    dailySeries,
  }
}

// ─── 3. Pareto 80/20 — for any string dimension ──────────────────────────────

export type ParetoRow = {
  name: string
  revenue: number
  share: number          // % of total
  cumulative: number     // cumulative % of total
  rank: number
}

export function paretoAnalysis(
  records: SalesRecord[],
  metric: Metric,
  dimension: 'testCode' | 'customerGroup' | 'customer' | 'salesperson',
  topN = 30,
): { rows: ParetoRow[]; total: number; top20PctShare: number; top20Count: number } {
  const map = new Map<string, number>()
  for (const r of records) {
    let key: string
    switch (dimension) {
      case 'testCode':
        key = r.testCode?.trim() || r.productCode?.trim() || '(no code)'
        break
      case 'customerGroup':
        key = r.customerGroupName?.trim() || '(no group)'
        break
      case 'customer':
        key = r.customerName?.trim() || r.customerCode?.trim() || '(unknown)'
        break
      case 'salesperson':
        key = r.salespersonName?.trim() || '(unknown)'
        break
    }
    map.set(key, (map.get(key) ?? 0) + getRevenue(r, metric))
  }

  const total = [...map.values()].reduce((s, v) => s + v, 0)
  const sorted = [...map.entries()].sort(([, a], [, b]) => b - a)

  let cum = 0
  const rows: ParetoRow[] = sorted.map(([name, revenue], i) => {
    const share = total !== 0 ? (revenue / total) * 100 : 0
    cum += share
    return { name, revenue, share, cumulative: cum, rank: i + 1 }
  }).slice(0, topN)

  // "Top 20%" analysis across the ENTIRE set (not topN slice)
  const cutoff = Math.ceil(sorted.length * 0.2)
  const top20Revenue = sorted.slice(0, cutoff).reduce((s, [, v]) => s + v, 0)
  const top20PctShare = total !== 0 ? (top20Revenue / total) * 100 : 0

  return { rows, total, top20PctShare, top20Count: cutoff }
}

// ─── 4. RFM customer segmentation ────────────────────────────────────────────

export type RFMSegment =
  | 'Champions'
  | 'Loyal'
  | 'Potential'
  | 'New'
  | 'At Risk'
  | 'Hibernating'
  | 'Lost'

export type RFMCustomer = {
  key: string
  name: string
  recencyDays: number
  frequency: number
  monetary: number
  rScore: 1 | 2 | 3 | 4 | 5
  fScore: 1 | 2 | 3 | 4 | 5
  mScore: 1 | 2 | 3 | 4 | 5
  segment: RFMSegment
}

function quintile(sortedAsc: number[], value: number): 1 | 2 | 3 | 4 | 5 {
  if (sortedAsc.length === 0) return 1
  const idx = sortedAsc.findIndex((v) => v >= value)
  const pos = idx < 0 ? sortedAsc.length : idx
  const frac = pos / sortedAsc.length
  if (frac < 0.2) return 1
  if (frac < 0.4) return 2
  if (frac < 0.6) return 3
  if (frac < 0.8) return 4
  return 5
}

function segmentFromRFM(r: number, f: number, m: number): RFMSegment {
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions'
  if (r >= 3 && f >= 3) return 'Loyal'
  if (r >= 4 && f <= 2) return 'New'
  if (r >= 3 && f <= 2) return 'Potential'
  if (r <= 2 && f >= 3) return 'At Risk'
  if (r <= 2 && f <= 2 && m >= 3) return 'Hibernating'
  return 'Lost'
}

export function rfmAnalysis(
  records: SalesRecord[],
  metric: Metric,
): { customers: RFMCustomer[]; segmentSummary: { segment: RFMSegment; count: number; revenue: number }[] } {
  if (records.length === 0) {
    return { customers: [], segmentSummary: [] }
  }

  // Anchor "today" = latest posting date
  const dates = records
    .map((r) => r.postingDate?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort()
  const anchorStr = dates[dates.length - 1]
  const anchor = new Date(anchorStr)

  type Agg = { name: string; recencyDays: number; frequency: number; monetary: number }
  const byCust = new Map<string, Agg>()

  for (const r of records) {
    const k = customerKey(r)
    const name = r.customerName?.trim() || r.customerCode?.trim() || k
    const cur = byCust.get(k) ?? { name, recencyDays: Number.POSITIVE_INFINITY, frequency: 0, monetary: 0 }
    cur.name = cur.name || name
    cur.frequency += 1
    cur.monetary += getRevenue(r, metric)
    const d = r.postingDate?.slice(0, 10)
    if (d) {
      const diffDays = Math.floor((anchor.getTime() - new Date(d).getTime()) / 86_400_000)
      if (diffDays < cur.recencyDays) cur.recencyDays = diffDays
    }
    byCust.set(k, cur)
  }

  const aggs = [...byCust.entries()]
  if (aggs.length === 0) return { customers: [], segmentSummary: [] }

  // Sort arrays for quintile scoring
  // Recency: LOWER days = better, so we invert (use negative)
  const recencySorted = aggs.map(([, a]) => -a.recencyDays).sort((x, y) => x - y)
  const freqSorted = aggs.map(([, a]) => a.frequency).sort((x, y) => x - y)
  const monSorted = aggs.map(([, a]) => a.monetary).sort((x, y) => x - y)

  const customers: RFMCustomer[] = aggs.map(([key, a]) => {
    const rScore = quintile(recencySorted, -a.recencyDays)
    const fScore = quintile(freqSorted, a.frequency)
    const mScore = quintile(monSorted, a.monetary)
    return {
      key,
      name: a.name,
      recencyDays: a.recencyDays === Number.POSITIVE_INFINITY ? 9999 : a.recencyDays,
      frequency: a.frequency,
      monetary: a.monetary,
      rScore,
      fScore,
      mScore,
      segment: segmentFromRFM(rScore, fScore, mScore),
    }
  })

  // Build segment summary
  const segMap = new Map<RFMSegment, { count: number; revenue: number }>()
  for (const c of customers) {
    const cur = segMap.get(c.segment) ?? { count: 0, revenue: 0 }
    cur.count += 1
    cur.revenue += c.monetary
    segMap.set(c.segment, cur)
  }
  const SEG_ORDER: RFMSegment[] = ['Champions', 'Loyal', 'Potential', 'New', 'At Risk', 'Hibernating', 'Lost']
  const segmentSummary = SEG_ORDER.map((segment) => ({
    segment,
    count: segMap.get(segment)?.count ?? 0,
    revenue: segMap.get(segment)?.revenue ?? 0,
  }))

  return { customers, segmentSummary }
}

// ─── 5. Salesperson behaviour bubble ─────────────────────────────────────────

export type SalespersonBubble = {
  name: string
  revenue: number
  transactions: number
  avgDealSize: number
  discountPct: number    // 0-100
  customerCount: number
}

export function salespersonBubble(records: SalesRecord[], metric: Metric): SalespersonBubble[] {
  type Agg = {
    revenue: number
    transactions: number
    lineSum: number
    discountSum: number
    customers: Set<string>
  }
  const map = new Map<string, Agg>()

  for (const r of records) {
    const name = r.salespersonName?.trim() || '(unknown)'
    const cur = map.get(name) ?? {
      revenue: 0, transactions: 0, lineSum: 0, discountSum: 0, customers: new Set<string>(),
    }
    cur.revenue += getRevenue(r, metric)
    cur.transactions += 1
    cur.lineSum += r.lineAmount ?? 0
    cur.discountSum += r.discountAmount ?? 0
    cur.customers.add(customerKey(r))
    map.set(name, cur)
  }

  return [...map.entries()]
    .map(([name, a]) => ({
      name,
      revenue: a.revenue,
      transactions: a.transactions,
      avgDealSize: a.transactions > 0 ? a.revenue / a.transactions : 0,
      discountPct: a.lineSum !== 0 ? (a.discountSum / a.lineSum) * 100 : 0,
      customerCount: a.customers.size,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ─── 6. Discount analysis ────────────────────────────────────────────────────

export type DiscountMonthlyPoint = {
  label: string
  discountRate: number     // percentage 0-100
  discountAmount: number
  lineAmount: number
  netAmount: number
}

export type DiscountHeatmapCell = {
  branch: string
  month: string
  discountRate: number
  lineAmount: number
}

export type DiscountBySalesperson = {
  name: string
  revenue: number
  discountPct: number
  discountAmount: number
  transactions: number
}

export function discountMonthly(records: SalesRecord[], metric: Metric): DiscountMonthlyPoint[] {
  const map = new Map<string, { discount: number; line: number; net: number }>()
  for (const r of records) {
    const key = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const cur = map.get(key) ?? { discount: 0, line: 0, net: 0 }
    cur.discount += Math.abs(r.discountAmount ?? 0)
    cur.line += r.lineAmount ?? 0
    cur.net += getRevenue(r, metric)
    map.set(key, cur)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { discount, line, net }]) => ({
      label,
      discountRate: line !== 0 ? (discount / line) * 100 : 0,
      discountAmount: discount,
      lineAmount: line,
      netAmount: net,
    }))
}

export function discountHeatmap(records: SalesRecord[]): DiscountHeatmapCell[] {
  const map = new Map<string, { discount: number; line: number }>()
  for (const r of records) {
    const month = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const key = `${r.branchCode}::${month}`
    const cur = map.get(key) ?? { discount: 0, line: 0 }
    cur.discount += Math.abs(r.discountAmount ?? 0)
    cur.line += r.lineAmount ?? 0
    map.set(key, cur)
  }
  return [...map.entries()].map(([k, { discount, line }]) => {
    const [branch, month] = k.split('::')
    return {
      branch,
      month,
      discountRate: line !== 0 ? (discount / line) * 100 : 0,
      lineAmount: line,
    }
  })
}

export function discountBySalesperson(
  records: SalesRecord[],
  metric: Metric,
): DiscountBySalesperson[] {
  type Agg = { revenue: number; discount: number; line: number; transactions: number }
  const map = new Map<string, Agg>()
  for (const r of records) {
    const name = r.salespersonName?.trim() || '(unknown)'
    const cur = map.get(name) ?? { revenue: 0, discount: 0, line: 0, transactions: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.discount += Math.abs(r.discountAmount ?? 0)
    cur.line += r.lineAmount ?? 0
    cur.transactions += 1
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, a]) => ({
      name,
      revenue: a.revenue,
      discountAmount: a.discount,
      discountPct: a.line !== 0 ? (a.discount / a.line) * 100 : 0,
      transactions: a.transactions,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function discountSummary(records: SalesRecord[], metric: Metric): {
  totalDiscount: number
  totalLine: number
  totalNet: number
  effectiveRate: number
  avgPerTransaction: number
  transactionsWithDiscount: number
  totalTransactions: number
} {
  let totalDiscount = 0
  let totalLine = 0
  let txnWith = 0
  for (const r of records) {
    totalDiscount += Math.abs(r.discountAmount ?? 0)
    totalLine += r.lineAmount ?? 0
    if ((r.discountAmount ?? 0) !== 0) txnWith += 1
  }
  const totalNet = sumRevenue(records, metric)
  return {
    totalDiscount,
    totalLine,
    totalNet,
    effectiveRate: totalLine !== 0 ? (totalDiscount / totalLine) * 100 : 0,
    avgPerTransaction: records.length > 0 ? totalDiscount / records.length : 0,
    transactionsWithDiscount: txnWith,
    totalTransactions: records.length,
  }
}
