/**
 * aggregations.ts
 *
 * Aggregate filtered records into chart-ready data structures.
 */

import type { DashboardFilters, EntityRevenue, SalesRecord, TimePoint } from '@/types'
import { getRevenue, sumRevenue } from './filterUtils'
import { customerKey } from './customerClassification'

// ─── Monthly trend ────────────────────────────────────────────────────────────

export function monthlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): TimePoint[] {
  const map = new Map<string, { revenue: number; count: number }>()

  for (const r of records) {
    const key = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const cur = map.get(key) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { revenue, count }]) => ({ label, revenue, count }))
}

// ─── Quarterly trend ──────────────────────────────────────────────────────────

export function quarterlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): TimePoint[] {
  const map = new Map<string, { revenue: number; count: number }>()

  for (const r of records) {
    const key = `${r.year} ${r.quarter}`
    const cur = map.get(key) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      // Sort by year then Q number
      const [ay, aq] = a.split(' ')
      const [by, bq] = b.split(' ')
      return ay !== by ? ay.localeCompare(by) : aq.localeCompare(bq)
    })
    .map(([label, { revenue, count }]) => ({ label, revenue, count }))
}

// ─── Yearly trend ─────────────────────────────────────────────────────────────

export function yearlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): TimePoint[] {
  const map = new Map<string, { revenue: number; count: number }>()

  for (const r of records) {
    const key = String(r.year)
    const cur = map.get(key) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, { revenue, count }]) => ({ label, revenue, count }))
}

// ─── Branch ranking ───────────────────────────────────────────────────────────

export function branchRanking(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): EntityRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of records) {
    const cur = map.get(r.branchCode) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(r.branchCode, cur)
  }
  const total = sumRevenue(records, metric)
  return [...map.entries()]
    .map(([name, { revenue, count }]) => ({
      name,
      revenue,
      share: total !== 0 ? (revenue / total) * 100 : 0,
      count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ─── Salesperson ranking ──────────────────────────────────────────────────────

export function salespersonRanking(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): EntityRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of records) {
    const cur = map.get(r.salespersonName) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(r.salespersonName, cur)
  }
  const total = sumRevenue(records, metric)
  return [...map.entries()]
    .map(([name, { revenue, count }]) => ({
      name,
      revenue,
      share: total !== 0 ? (revenue / total) * 100 : 0,
      count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

// ─── Branch trend over time ───────────────────────────────────────────────────

export function branchMonthlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
  topN = 6,
): { label: string; [branch: string]: number | string }[] {
  const topBranches = branchRanking(records, metric)
    .slice(0, topN)
    .map((b) => b.name)

  const map = new Map<string, Record<string, number>>()
  for (const r of records) {
    if (!topBranches.includes(r.branchCode)) continue
    const key = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const cur = map.get(key) ?? {}
    cur[r.branchCode] = (cur[r.branchCode] ?? 0) + getRevenue(r, metric)
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, vals]) => ({ label, ...vals }))
}

// ─── YoY comparison ───────────────────────────────────────────────────────────

/** Returns per-year revenue for selected years, usable in a grouped bar chart */
export function yearComparison(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): { year: number; revenue: number }[] {
  return yearlyTrend(records, metric).map((p) => ({
    year: parseInt(p.label),
    revenue: p.revenue,
  }))
}

/** Returns per-quarter revenue grouped by quarter label, across years */
export function quarterComparison(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): { quarter: string; [year: string]: number | string }[] {
  const map = new Map<string, Record<string, number>>()
  for (const r of records) {
    const cur = map.get(r.quarter) ?? {}
    cur[String(r.year)] = (cur[String(r.year)] ?? 0) + getRevenue(r, metric)
    map.set(r.quarter, cur)
  }
  return ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
    quarter: q,
    ...(map.get(q) ?? {}),
  }))
}

/** Returns per-month revenue grouped by month number, across years */
export function monthComparison(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): { month: string; monthNumber: number; [year: string]: number | string }[] {
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const map = new Map<number, Record<string, number>>()
  for (const r of records) {
    const cur = map.get(r.monthNumber) ?? {}
    cur[String(r.year)] = (cur[String(r.year)] ?? 0) + getRevenue(r, metric)
    map.set(r.monthNumber, cur)
  }
  return Array.from({ length: 12 }, (_, i) => ({
    month: MONTHS[i],
    monthNumber: i + 1,
    ...(map.get(i + 1) ?? {}),
  }))
}

// ─── Test code ranking ────────────────────────────────────────────────────────

export type TestCodeRevenue = EntityRevenue & { description?: string }

export function testCodeRanking(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): TestCodeRevenue[] {
  const map = new Map<string, { revenue: number; count: number; description?: string }>()
  for (const r of records) {
    const key = r.testCode?.trim() || r.productCode?.trim() || r.description?.trim() || '(no code)'
    const cur = map.get(key) ?? { revenue: 0, count: 0, description: r.description || r.productDescription }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    if (!cur.description && (r.description || r.productDescription)) {
      cur.description = r.description || r.productDescription
    }
    map.set(key, cur)
  }
  const total = sumRevenue(records, metric)
  return [...map.entries()]
    .map(([name, { revenue, count, description }]) => ({
      name,
      revenue,
      share: total !== 0 ? (revenue / total) * 100 : 0,
      count,
      description,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** Monthly trend for top-N test codes */
export function testCodeMonthlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
  topN = 8,
): { label: string; [code: string]: number | string }[] {
  const topCodes = testCodeRanking(records, metric)
    .slice(0, topN)
    .map((t) => t.name)

  const map = new Map<string, Record<string, number>>()
  for (const r of records) {
    const code = r.testCode?.trim() || r.productCode?.trim() || r.description?.trim() || '(no code)'
    if (!topCodes.includes(code)) continue
    const key = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const cur = map.get(key) ?? {}
    cur[code] = (cur[code] ?? 0) + getRevenue(r, metric)
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, vals]) => ({ label, ...vals }))
}

/** Year-over-year comparison per test code (top N) */
export function testCodeYearComparison(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
  topN = 12,
): { code: string; [year: string]: number | string }[] {
  const topCodes = testCodeRanking(records, metric)
    .slice(0, topN)
    .map((t) => t.name)

  const map = new Map<string, Record<string, number>>()
  for (const r of records) {
    const code = r.testCode?.trim() || r.productCode?.trim() || r.description?.trim() || '(no code)'
    if (!topCodes.includes(code)) continue
    const cur = map.get(code) ?? {}
    cur[String(r.year)] = (cur[String(r.year)] ?? 0) + getRevenue(r, metric)
    map.set(code, cur)
  }

  return topCodes.map((code) => ({ code, ...(map.get(code) ?? {}) }))
}

// ─── Customer group ranking ───────────────────────────────────────────────────

export function customerGroupRanking(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): EntityRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of records) {
    const key = r.customerGroupName?.trim() || r.customerGroupCode?.trim() || '(no group)'
    const cur = map.get(key) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(key, cur)
  }
  const total = sumRevenue(records, metric)
  return [...map.entries()]
    .map(([name, { revenue, count }]) => ({
      name,
      revenue,
      share: total !== 0 ? (revenue / total) * 100 : 0,
      count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** Monthly trend for top-N customer groups */
export function customerGroupMonthlyTrend(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
  topN = 6,
): { label: string; [group: string]: number | string }[] {
  const topGroups = customerGroupRanking(records, metric)
    .slice(0, topN)
    .map((g) => g.name)

  const map = new Map<string, Record<string, number>>()
  for (const r of records) {
    const group = r.customerGroupName?.trim() || r.customerGroupCode?.trim() || '(no group)'
    if (!topGroups.includes(group)) continue
    const key = `${r.year}-${String(r.monthNumber).padStart(2, '0')}`
    const cur = map.get(key) ?? {}
    cur[group] = (cur[group] ?? 0) + getRevenue(r, metric)
    map.set(key, cur)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, vals]) => ({ label, ...vals }))
}

// ─── Document type breakdown ──────────────────────────────────────────────────

export type DocTypeBreakdown = {
  type: string
  revenue: number
  count: number
  share: number
}

export function documentTypeBreakdown(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): DocTypeBreakdown[] {
  const map = new Map<string, { revenue: number; count: number }>()
  for (const r of records) {
    const type = r.documentType?.trim() || '(unknown)'
    const cur = map.get(type) ?? { revenue: 0, count: 0 }
    cur.revenue += getRevenue(r, metric)
    cur.count += 1
    map.set(type, cur)
  }
  const total = records.reduce((s, r) => s + Math.abs(getRevenue(r, metric)), 0)
  return [...map.entries()]
    .map(([type, { revenue, count }]) => ({
      type,
      revenue,
      count,
      share: total !== 0 ? (Math.abs(revenue) / total) * 100 : 0,
    }))
    .sort((a, b) => Math.abs(b.revenue) - Math.abs(a.revenue))
}

// ─── Revenue waterfall (bridge) ───────────────────────────────────────────────

export type WaterfallBar = {
  label: string
  value: number       // absolute value for the bar
  start: number       // running total before this bar (for stacking)
  type: 'base' | 'positive' | 'negative' | 'total'
}

/**
 * Decompose revenue change between two periods into:
 *   Base → + New customers → + Existing growth → - Existing decline → - Lost customers → Current
 */
export function revenueWaterfall(
  prevRecords: SalesRecord[],
  currRecords: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): WaterfallBar[] {
  // Aggregate revenue per customer key for each period
  const prevMap = new Map<string, number>()
  const currMap = new Map<string, number>()

  for (const r of prevRecords) {
    const k = customerKey(r)
    prevMap.set(k, (prevMap.get(k) ?? 0) + getRevenue(r, metric))
  }
  for (const r of currRecords) {
    const k = customerKey(r)
    currMap.set(k, (currMap.get(k) ?? 0) + getRevenue(r, metric))
  }

  const prevTotal = [...prevMap.values()].reduce((s, v) => s + v, 0)
  const currTotal = [...currMap.values()].reduce((s, v) => s + v, 0)

  let newRevenue    = 0  // customers in curr but not prev
  let grownRevenue  = 0  // existing customers who spent MORE
  let shrunkRevenue = 0  // existing customers who spent LESS (negative)
  let lostRevenue   = 0  // customers in prev but not curr (negative)

  // New + grown/shrunk from existing
  for (const [k, curr] of currMap) {
    const prev = prevMap.get(k)
    if (prev === undefined) {
      newRevenue += curr
    } else {
      const delta = curr - prev
      if (delta >= 0) grownRevenue += delta
      else shrunkRevenue += delta
    }
  }
  // Lost
  for (const [k, prev] of prevMap) {
    if (!currMap.has(k)) lostRevenue -= prev
  }

  // Build waterfall bars
  const bars: WaterfallBar[] = []
  let running = 0

  bars.push({ label: 'Prior Period', value: prevTotal, start: 0, type: 'base' })
  running = prevTotal

  if (newRevenue !== 0) {
    bars.push({ label: 'New Customers', value: newRevenue, start: running, type: 'positive' })
    running += newRevenue
  }
  if (grownRevenue !== 0) {
    bars.push({ label: 'Existing ↑', value: grownRevenue, start: running, type: 'positive' })
    running += grownRevenue
  }
  if (shrunkRevenue !== 0) {
    bars.push({ label: 'Existing ↓', value: shrunkRevenue, start: running, type: 'negative' })
    running += shrunkRevenue
  }
  if (lostRevenue !== 0) {
    bars.push({ label: 'Lost Customers', value: lostRevenue, start: running, type: 'negative' })
    running += lostRevenue
  }

  bars.push({ label: 'Current Period', value: currTotal, start: 0, type: 'total' })

  return bars
}
