/**
 * /api/health — Customer Health Watchlist endpoint.
 *
 * POST { filters? } → คืน health summary + รายชื่อลูกค้าพร้อมคะแนน 0–100
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { computeCustomerHealth } from '@/lib/calculations/health'
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
  let body: { filters?: DashboardFilters } = {}
  try { body = await req.json() } catch { /* allow empty body */ }

  const all = await getAllRecords()
  const filtered = applyFilters(all, body.filters)
  const summary = computeCustomerHealth(filtered)
  return NextResponse.json({ ...summary, recordCount: filtered.length })
}

export async function GET() {
  const all = await getAllRecords()
  const summary = computeCustomerHealth(all)
  return NextResponse.json({ ...summary, recordCount: all.length })
}
