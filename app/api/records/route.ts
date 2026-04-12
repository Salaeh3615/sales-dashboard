/**
 * POST /api/records
 *
 * Drill-through endpoint: returns paginated, filtered raw records.
 *
 * Body: {
 *   filters: DashboardFilters,
 *   search?: string,         // free-text search across name/code/desc
 *   sortBy?: keyof SalesRecord,
 *   sortDir?: 'asc' | 'desc',
 *   page?: number,           // 1-indexed
 *   pageSize?: number        // default 100
 * }
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { applyFilters } from '@/lib/calculations/filterUtils'
import type { DashboardFilters, SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Body {
  filters: DashboardFilters
  search?: string
  sortBy?: keyof SalesRecord
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body
  const all = await getAllRecords()
  let filtered = applyFilters(all, body.filters)

  // Free-text search
  if (body.search && body.search.trim()) {
    const q = body.search.toLowerCase().trim()
    filtered = filtered.filter((r) => {
      return (
        (r.customerName ?? '').toLowerCase().includes(q) ||
        (r.customerNo ?? '').toLowerCase().includes(q) ||
        (r.customerCode ?? '').toLowerCase().includes(q) ||
        (r.salespersonName ?? '').toLowerCase().includes(q) ||
        (r.documentNo ?? '').toLowerCase().includes(q) ||
        (r.productCode ?? '').toLowerCase().includes(q) ||
        (r.productDescription ?? '').toLowerCase().includes(q) ||
        (r.testCode ?? '').toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      )
    })
  }

  // Sort
  const sortBy = (body.sortBy ?? 'postingDate') as keyof SalesRecord
  const sortDir = body.sortDir ?? 'desc'
  filtered.sort((a, b) => {
    const av = a[sortBy] as unknown
    const bv = b[sortBy] as unknown
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av))
  })

  // Pagination
  const page = Math.max(1, body.page ?? 1)
  const pageSize = Math.max(1, Math.min(500, body.pageSize ?? 100))
  const start = (page - 1) * pageSize
  const slice = filtered.slice(start, start + pageSize)

  return NextResponse.json({
    records: slice,
    totalCount: filtered.length,
    page,
    pageSize,
    pageCount: Math.ceil(filtered.length / pageSize),
  })
}
