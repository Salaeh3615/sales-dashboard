/**
 * POST /api/test-analytics
 *
 * Body: { filters: DashboardFilters }
 * Returns test-code-level analytics: ranking, trend, YoY comparison,
 * plus customer group breakdown and document type breakdown.
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { applyFilters } from '@/lib/calculations/filterUtils'
import {
  testCodeRanking,
  testCodeMonthlyTrend,
  testCodeYearComparison,
  customerGroupRanking,
  customerGroupMonthlyTrend,
  documentTypeBreakdown,
} from '@/lib/calculations/aggregations'
import type { DashboardFilters } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { filters } = (await req.json()) as { filters: DashboardFilters }
  const allRecords = await getAllRecords()
  const filtered   = applyFilters(allRecords, filters)
  const metric     = filters.revenueMetric

  const testCodes  = testCodeRanking(filtered, metric)
  const topCodes   = testCodes.slice(0, 8).map((t) => t.name)

  // YoY growth per test code
  const allYears = [...new Set(allRecords.map((r) => r.year))].sort((a, b) => a - b)
  const yearComp = testCodeYearComparison(filtered, metric, 12)

  // Find fastest growing and fastest declining (needs ≥ 2 years)
  type GrowthItem = { code: string; prevRev: number; currRev: number; pct: number }
  const growth: GrowthItem[] = []
  if (allYears.length >= 2) {
    const prevYear = allYears[allYears.length - 2]
    const currYear = allYears[allYears.length - 1]
    for (const row of yearComp) {
      const prev = (row[String(prevYear)] as number | undefined) ?? 0
      const curr = (row[String(currYear)] as number | undefined) ?? 0
      if (prev > 0) {
        growth.push({ code: row.code, prevRev: prev, currRev: curr, pct: ((curr - prev) / prev) * 100 })
      }
    }
    growth.sort((a, b) => b.pct - a.pct)
  }

  return NextResponse.json({
    recordCount:   filtered.length,
    allYears,
    testCodes,
    testTrend:     testCodeMonthlyTrend(filtered, metric, 8),
    topCodes,
    yearComparison: yearComp,
    topGrowing:    growth.filter((g) => g.pct > 0).slice(0, 5),
    topDeclining:  growth.filter((g) => g.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 5),
    customerGroups:      customerGroupRanking(filtered, metric),
    customerGroupTrend:  customerGroupMonthlyTrend(filtered, metric, 6),
    topCustomerGroups:   customerGroupRanking(filtered, metric).slice(0, 6).map((g) => g.name),
    docTypes:      documentTypeBreakdown(filtered, metric),
  })
}
