/**
 * POST /api/dashboard
 *
 * Body: { filters: DashboardFilters }
 * Returns: KPIs, chart data, customer movement summary, insights — everything
 *          the main dashboard needs in one round-trip.
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { applyFilters } from '@/lib/calculations/filterUtils'
import { computeKPIs } from '@/lib/calculations/kpiCalculations'
import {
  monthlyTrend,
  quarterlyTrend,
  yearlyTrend,
  branchRanking,
  salespersonRanking,
  branchMonthlyTrend,
  yearComparison,
  quarterComparison,
  monthComparison,
  customerGroupRanking,
  customerGroupMonthlyTrend,
  documentTypeBreakdown,
  revenueWaterfall,
} from '@/lib/calculations/aggregations'
import { generateInsights } from '@/lib/insights/insightGenerator'
import {
  buildCustomerProfiles,
  classifyAll,
} from '@/lib/calculations/customerClassification'
import type { DashboardFilters } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { filters } = (await req.json()) as { filters: DashboardFilters }
  const allRecords = await getAllRecords()
  const filtered = applyFilters(allRecords, filters)

  // Customer movement: target year = max selected year, or max year in dataset
  const allYears = [...new Set(allRecords.map((r) => r.year))].sort((a, b) => a - b)
  const targetYear =
    filters.years.length > 0 ? Math.max(...filters.years) : allYears[allYears.length - 1] ?? 0

  // Build customer profiles from FULL dataset (need historical years for
  // classification — filters would distort it)
  const profiles = buildCustomerProfiles(allRecords)
  const breakdown = classifyAll(profiles, targetYear)

  const kpis = computeKPIs(filtered, allRecords, filters)
  const metric = filters.revenueMetric

  const branches = branchRanking(filtered, metric)
  const topBranches = branches.slice(0, 6).map((b) => b.name)

  // Revenue waterfall: compare last two years in the filtered set
  const filteredYears = [...new Set(filtered.map((r) => r.year))].sort((a, b) => a - b)
  let waterfallData = null
  let waterfallLabel = { prev: '', curr: '' }
  if (filteredYears.length >= 2) {
    const prevYear = filteredYears[filteredYears.length - 2]
    const currYear = filteredYears[filteredYears.length - 1]
    const prevRecords = filtered.filter((r) => r.year === prevYear)
    const currRecords = filtered.filter((r) => r.year === currYear)
    waterfallData  = revenueWaterfall(prevRecords, currRecords, metric)
    waterfallLabel = { prev: String(prevYear), curr: String(currYear) }
  }

  return NextResponse.json({
    recordCount: filtered.length,
    totalRecords: allRecords.length,
    targetYear,
    kpis: {
      ...kpis,
      totalCustomers: profiles.size,
      newCustomers: breakdown.new.length,
      existingCustomers: breakdown.existing.length,
      lostCustomers: breakdown.lost.length,
      returningCustomers: breakdown.returning.length,
    },
    monthly: monthlyTrend(filtered, metric),
    quarterly: quarterlyTrend(filtered, metric),
    yearly: yearlyTrend(filtered, metric),
    branches,
    salespeople: salespersonRanking(filtered, metric),
    branchTrend: branchMonthlyTrend(filtered, metric, 6),
    topBranches,
    yearComparison: yearComparison(filtered, metric),
    quarterComparison: quarterComparison(filtered, metric),
    monthComparison: monthComparison(filtered, metric),
    allYears,
    insights: generateInsights(filtered, kpis, filters),
    customerGroups:       customerGroupRanking(filtered, metric),
    customerGroupTrend:   customerGroupMonthlyTrend(filtered, metric, 6),
    topCustomerGroups:    customerGroupRanking(filtered, metric).slice(0, 6).map((g) => g.name),
    docTypes:             documentTypeBreakdown(filtered, metric),
    waterfallData,
    waterfallLabel,
  })
}
