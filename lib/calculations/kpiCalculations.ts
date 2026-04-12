/**
 * kpiCalculations.ts
 *
 * Compute top-level KPI summary from filtered records plus full dataset
 * (needed for growth % comparisons).
 */

import type { DashboardFilters, KPISummary, SalesRecord } from '@/types'
import { getRevenue, sumRevenue } from './filterUtils'
import { branchRanking, salespersonRanking } from './aggregations'

function growthPct(current: number, prior: number): number | null {
  if (prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

/**
 * Find the single prior-period records to compare against.
 *
 * We compare against the same filter set but with the period shifted back by 1.
 * Strategy:
 *   - If filtering by year(s): use years - 1  →  YoY
 *   - If filtering by quarter(s): use same quarter in prior year
 *   - If filtering by month(s): use same months in prior year
 */
function priorPeriodRevenue(
  allRecords: SalesRecord[],
  filters: DashboardFilters,
): { yoy: number | null; qoq: number | null; mom: number | null } {
  const metric = filters.revenueMetric

  // ── YoY: compare each selected year to year-1 ────────────────────────────
  let yoy: number | null = null
  if (filters.years.length) {
    const priorYears = filters.years.map((y) => y - 1)
    const priorRecords = allRecords.filter((r) => {
      if (!priorYears.includes(r.year)) return false
      if (filters.quarters.length && !filters.quarters.includes(r.quarter)) return false
      if (filters.months.length && !filters.months.includes(r.monthNumber)) return false
      if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
      if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
        return false
      return true
    })
    if (priorRecords.length) {
      const currentTotal = sumRevenue(
        allRecords.filter((r) => {
          if (!filters.years.includes(r.year)) return false
          if (filters.quarters.length && !filters.quarters.includes(r.quarter)) return false
          if (filters.months.length && !filters.months.includes(r.monthNumber)) return false
          if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
          if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
            return false
          return true
        }),
        metric,
      )
      yoy = growthPct(currentTotal, sumRevenue(priorRecords, metric))
    }
  }

  // ── QoQ: compare selected quarters to previous quarter ───────────────────
  let qoq: number | null = null
  if (filters.quarters.length === 1) {
    const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
    const qi = QUARTERS.indexOf(filters.quarters[0])
    const prevQ = qi > 0 ? QUARTERS[qi - 1] : 'Q4'
    const prevYear = qi > 0 ? filters.years : filters.years.map((y) => y - 1)
    const priorRecords = allRecords.filter((r) => {
      if (!prevYear.includes(r.year)) return false
      if (r.quarter !== prevQ) return false
      if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
      if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
        return false
      return true
    })
    if (priorRecords.length) {
      const currentQ = allRecords.filter((r) => {
        if (!filters.years.includes(r.year)) return false
        if (r.quarter !== filters.quarters[0]) return false
        if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
        if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
          return false
        return true
      })
      qoq = growthPct(sumRevenue(currentQ, metric), sumRevenue(priorRecords, metric))
    }
  }

  // ── MoM: compare selected months to the previous calendar month ──────────
  let mom: number | null = null
  if (filters.months.length === 1 && filters.years.length) {
    const m = filters.months[0]
    const prevM = m > 1 ? m - 1 : 12
    const prevYear = m > 1 ? filters.years : filters.years.map((y) => y - 1)
    const priorRecords = allRecords.filter((r) => {
      if (!prevYear.includes(r.year)) return false
      if (r.monthNumber !== prevM) return false
      if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
      if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
        return false
      return true
    })
    if (priorRecords.length) {
      const currentM = allRecords.filter((r) => {
        if (!filters.years.includes(r.year)) return false
        if (r.monthNumber !== filters.months[0]) return false
        if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
        if (filters.salespersons.length && !filters.salespersons.includes(r.salespersonName))
          return false
        return true
      })
      mom = growthPct(sumRevenue(currentM, metric), sumRevenue(priorRecords, metric))
    }
  }

  return { yoy, qoq, mom }
}

export function computeKPIs(
  filteredRecords: SalesRecord[],
  allRecords: SalesRecord[],
  filters: DashboardFilters,
): KPISummary {
  const metric = filters.revenueMetric
  const totalRevenue = sumRevenue(filteredRecords, metric)

  const branches = branchRanking(filteredRecords, metric)
  const salespeople = salespersonRanking(filteredRecords, metric)

  const { yoy, qoq, mom } = priorPeriodRevenue(allRecords, filters)

  return {
    totalRevenue,
    yoyGrowth: yoy,
    qoqGrowth: qoq,
    momGrowth: mom,
    activeBranches: branches.length,
    activeSalespersons: salespeople.length,
    bestBranch: branches[0]?.name ?? '—',
    bestSalesperson: salespeople[0]?.name ?? '—',
    worstBranch: branches[branches.length - 1]?.name ?? '—',
    worstSalesperson: salespeople[salespeople.length - 1]?.name ?? '—',
  }
}
