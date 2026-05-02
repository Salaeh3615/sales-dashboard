/**
 * POST /api/dashboard
 *
 * Body: { filters: DashboardFilters }
 * Returns: KPIs, chart data, customer movement summary, insights — everything
 *          the main dashboard needs in one round-trip.
 *
 * SQL-backed: aggregations run as `GROUP BY` queries against SQLite via
 * `lib/db/queries.ts`. The full 1.29M-row in-memory cache is no longer
 * touched by this route; only `generateInsights` still needs row-level data
 * and it pulls the *filtered* subset directly from SQL (not the cached array).
 */

import { NextResponse } from 'next/server'
import {
  sqlRecordCount, sqlTotalRecords, sqlAllYears, sqlFilteredYears,
  sqlTotalRevenue, sqlMonthlyTrend, sqlQuarterlyTrend, sqlYearlyTrend,
  sqlBranchRanking, sqlSalespersonRanking, sqlCustomerGroupRanking,
  sqlBranchMonthlyTrend, sqlCustomerGroupMonthlyTrend,
  sqlYearComparison, sqlQuarterComparison, sqlMonthComparison,
  sqlDocumentTypeBreakdown, sqlDailyRevenue, sqlRunRate,
  sqlRevenueWaterfall, sqlPriorPeriodGrowth, sqlCustomerCounts,
  sqlFilteredRecords,
} from '@/lib/db/queries'
import { generateInsights } from '@/lib/insights/insightGenerator'
import type { DashboardFilters, KPISummary } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { filters } = (await req.json()) as { filters: DashboardFilters }
  const metric = filters.revenueMetric

  // Target year for customer classification: max selected year, or max in dataset
  const allYears = sqlAllYears()
  const targetYear =
    filters.years.length > 0 ? Math.max(...filters.years) : allYears[allYears.length - 1] ?? 0

  // Customer counts (full dataset — classification needs full history)
  const counts = sqlCustomerCounts(targetYear)

  // Top-level totals
  const totalRevenue = sqlTotalRevenue(filters, metric)
  const branches = sqlBranchRanking(filters, metric)
  const salespeople = sqlSalespersonRanking(filters, metric)
  const { yoy, qoq, mom } = sqlPriorPeriodGrowth(filters, metric)

  const kpis: KPISummary = {
    totalRevenue,
    yoyGrowth:        yoy,
    qoqGrowth:        qoq,
    momGrowth:        mom,
    activeBranches:   branches.length,
    activeSalespersons: salespeople.length,
    bestBranch:       branches[0]?.name ?? '—',
    bestSalesperson:  salespeople[0]?.name ?? '—',
    worstBranch:      branches[branches.length - 1]?.name ?? '—',
    worstSalesperson: salespeople[salespeople.length - 1]?.name ?? '—',
  }

  const topBranches = branches.slice(0, 6).map((b) => b.name)

  // Revenue waterfall: compare last two years in the filtered set
  const filteredYears = sqlFilteredYears(filters)
  let waterfallData = null
  let waterfallLabel = { prev: '', curr: '' }
  if (filteredYears.length >= 2) {
    const prevYear = filteredYears[filteredYears.length - 2]
    const currYear = filteredYears[filteredYears.length - 1]
    waterfallData  = sqlRevenueWaterfall(filters, metric, prevYear, currYear)
    waterfallLabel = { prev: String(prevYear), curr: String(currYear) }
  }

  const customerGroups = sqlCustomerGroupRanking(filters, metric)

  // Insights still need row-level data — pull filtered subset from SQL
  // (bypasses the in-memory cache). Only one query, no full scan unless the
  // user explicitly clears filters.
  const filtered = sqlFilteredRecords(filters)
  const insights  = generateInsights(filtered, kpis, filters)

  return NextResponse.json({
    recordCount:  sqlRecordCount(filters),
    totalRecords: sqlTotalRecords(),
    targetYear,
    kpis: {
      ...kpis,
      totalCustomers:     counts.total,
      newCustomers:       counts.new,
      existingCustomers:  counts.existing,
      lostCustomers:      counts.lost,
      returningCustomers: counts.returning,
    },
    monthly:   sqlMonthlyTrend(filters, metric),
    quarterly: sqlQuarterlyTrend(filters, metric),
    yearly:    sqlYearlyTrend(filters, metric),
    branches,
    salespeople,
    branchTrend: sqlBranchMonthlyTrend(filters, metric, 6),
    topBranches,
    yearComparison:    sqlYearComparison(filters, metric),
    quarterComparison: sqlQuarterComparison(filters, metric),
    monthComparison:   sqlMonthComparison(filters, metric),
    allYears,
    insights,
    customerGroups,
    customerGroupTrend: sqlCustomerGroupMonthlyTrend(filters, metric, 6),
    topCustomerGroups:  customerGroups.slice(0, 6).map((g) => g.name),
    docTypes:           sqlDocumentTypeBreakdown(filters, metric),
    waterfallData,
    waterfallLabel,
    daily:    sqlDailyRevenue(filters, metric),
    runRate:  sqlRunRate(filters, metric),
  })
}
