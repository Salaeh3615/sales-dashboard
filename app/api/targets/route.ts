/**
 * POST /api/targets
 *
 * Body: { filters: DashboardFilters, year?: number }
 * Returns attainment metrics versus monthly revenue targets.
 *
 * The client chooses the target year via the `year` body field.  If omitted,
 * the latest available year is used.  Filters (metric, branch subset) are
 * applied to the record set before computing actuals.
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { applyFilters } from '@/lib/calculations/filterUtils'
import { computeTargetDashboard } from '@/lib/calculations/targets'
import { getAvailableTargetYears } from '@/lib/targets/store'
import type { DashboardFilters } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = (await req.json()) as { filters?: DashboardFilters; year?: number }
  const filters: DashboardFilters = body.filters ?? {
    years: [], quarters: [], months: [], branches: [],
    salespersons: [], documentTypes: [], customerGroups: [],
    revenueMetric: 'netAmount',
  }

  const availableYears = getAvailableTargetYears()
  const latestYear = availableYears[availableYears.length - 1] ?? new Date().getFullYear()
  const year = body.year ?? latestYear

  // Apply filters but override year to make sure we only look at the requested year
  const allRecords = await getAllRecords()
  const filtered = applyFilters(allRecords, { ...filters, years: [year] })

  const data = computeTargetDashboard(
    filtered,
    year,
    filters.revenueMetric,
    filters.branches,
  )

  return NextResponse.json({
    ...data,
    availableYears,
    recordCount: filtered.length,
  })
}

export async function GET() {
  return NextResponse.json({
    availableYears: getAvailableTargetYears(),
  })
}
