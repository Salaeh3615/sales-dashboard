/**
 * /api/variance — Variance Investigator endpoint.
 *
 * POST { granularity?, zThreshold?, filters? } → คืน series + anomaly deep dives
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { computeVariance, type Granularity } from '@/lib/calculations/variance'
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

export async function POST(req: NextRequest) {
  let body: { granularity?: Granularity; zThreshold?: number; filters?: DashboardFilters } = {}
  try { body = await req.json() } catch { /* allow empty body */ }

  const all = await getAllRecords()
  const filtered = applyFilters(all, body.filters)
  const result = computeVariance(filtered, body.granularity ?? 'month', body.zThreshold ?? 2)
  return NextResponse.json({ ...result, recordCount: filtered.length })
}

export async function GET() {
  const all = await getAllRecords()
  const result = computeVariance(all, 'month', 2)
  return NextResponse.json({ ...result, recordCount: all.length })
}
