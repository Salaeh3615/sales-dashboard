/**
 * GET /api/options
 *
 * Returns all unique filter values derived from the current dataset:
 *   - years, quarters, months, branches, salespersons, documentTypes,
 *     customerGroups, customerStatuses
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { deriveFilterOptions } from '@/lib/data-loader/fileLoader'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const records = await getAllRecords()
  const options = deriveFilterOptions(records)
  return NextResponse.json({
    ...options,
    customerStatuses: ['new', 'existing', 'lost', 'returning'],
    totalRecords: records.length,
  })
}
