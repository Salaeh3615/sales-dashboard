/**
 * POST /api/import
 *
 * Admin endpoint: accepts one or more CSV/XLSX files, parses them on the
 * server, normalizes records, and appends to the JSON store.
 *
 * Body: multipart/form-data with one or more `files` fields.
 * Returns: { batches: ImportBatch[], inserted, skipped }
 */

import { NextResponse } from 'next/server'
import { parseFileBuffer } from '@/lib/data-loader/serverLoader'
import { appendRecords, clearAll, getBatches, getDbMeta } from '@/lib/db/store'

// Disable caching — every import must be processed fresh.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const files = form.getAll('files') as File[]
    const replace = form.get('replace') === 'true'

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    if (replace) await clearAll()

    let totalInserted = 0
    let totalSkipped = 0
    const batchSummaries: {
      filename: string
      inserted: number
      skipped: number
    }[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const records = parseFileBuffer(file.name, buffer)
      const result = await appendRecords(records, { filename: file.name })
      totalInserted += result.inserted
      totalSkipped += result.skipped
      batchSummaries.push({
        filename: file.name,
        inserted: result.inserted,
        skipped: result.skipped,
      })
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      skipped: totalSkipped,
      batches: batchSummaries,
    })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    )
  }
}

/**
 * GET — import metadata + DB stats for the admin page.
 * Uses meta.json (O(1) read) so the admin page loads instantly
 * regardless of how many records are in the DB.
 */
export async function GET() {
  const [batches, meta] = await Promise.all([getBatches(), getDbMeta()])
  return NextResponse.json({
    batches,
    recordCount: meta.totalRecords,
    rawAmountSum: meta.rawAmountSum,
  })
}

/** DELETE — wipe the database (admin only). */
export async function DELETE() {
  await clearAll()
  return NextResponse.json({ ok: true })
}
