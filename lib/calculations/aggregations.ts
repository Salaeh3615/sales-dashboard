/**
 * aggregations.ts
 *
 * Aggregate filtered records into chart-ready data structures.
 */

import type { DashboardFilters, EntityRevenue, SalesRecord, TimePoint } from '@/types'
import { getRevenue, sumRevenue } from './filterUtils'

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
