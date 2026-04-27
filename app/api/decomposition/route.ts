/**
 * /api/decomposition — Revenue Decomposition endpoint.
 *
 * GET  → คืน list ของช่วง (year/quarter/month) ที่มีข้อมูล
 * POST → คำนวณ PVM + bridges ระหว่าง periodA และ periodB
 *
 * body: { periodA, periodB, filters? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import {
  computeDecomposition,
  discoverPeriods,
  type PeriodId,
} from '@/lib/calculations/decomposition'
import type { SalesRecord, DashboardFilters } from '@/types'

export const dynamic = 'force-dynamic'

function applyFilters(records: SalesRecord[], f?: DashboardFilters): SalesRecord[] {
  if (!f) return records
  return records.filter((r) => {
    if (f.branches?.length && !f.branches.includes(r.branchCode)) return false
    if (f.salespersons?.length && r.salespersonCode && !f.salespersons.includes(r.salespersonCode)) return false
    if (f.documentTypes?.length && r.documentType && !f.documentTypes.includes(r.documentType)) return false
    if (f.customerGroups?.length && r.customerGroupCode && !f.customerGroups.includes(r.customerGroupCode)) return false
    return true
  })
}

export async function GET() {
  const records = await getAllRecords()
  const periods = discoverPeriods(records)
  return NextResponse.json({
    availableYears: periods.years,
    availableQuarters: periods.quarters,
    availableMonths: periods.months,
    recordCount: records.length,
  })
}

export async function POST(req: NextRequest) {
  let body: { periodA?: PeriodId; periodB?: PeriodId; filters?: DashboardFilters } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const { periodA, periodB, filters } = body
  if (!periodA || !periodB) {
    return NextResponse.json({ error: 'periodA and periodB required' }, { status: 400 })
  }

  const all = await getAllRecords()
  const filtered = applyFilters(all, filters)
  const periods = discoverPeriods(all)

  const result = computeDecomposition(filtered, periodA, periodB)

  return NextResponse.json({
    ...result,
    availablePeriods: {
      years: periods.years,
      quarters: periods.quarters,
      months: periods.months,
    },
    recordCount: filtered.length,
  })
}
