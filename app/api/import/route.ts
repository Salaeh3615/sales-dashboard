/**
 * /api/import
 *
 * POST — two modes:
 *   1. FormData { files, replace }   — local dev (files < 4.5 MB each)
 *   2. JSON { blobUrl, filename, replace } — Vercel production (any size)
 *      Browser uploads directly to Blob, then calls this with the URL.
 *
 * GET  — returns DB stats + blobMode flag for the admin page.
 * DELETE — wipes the database.
 */

import { NextResponse } from 'next/server'
import { parseFileBuffer } from '@/lib/data-loader/serverLoader'
import { appendRecords, clearAll, getBatches, getDbMeta } from '@/lib/db/store'

export const dynamic = 'force-dynamic'
export const runtime  = 'nodejs'
export const maxDuration = 60

const USE_BLOB = typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
                 process.env.BLOB_READ_WRITE_TOKEN.length > 0

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    // ── Mode 1: blob URL (production) ────────────────────────────────────────
    if (contentType.includes('application/json')) {
      const { blobUrl, filename, replace } = await req.json() as {
        blobUrl: string
        filename: string
        replace?: boolean
      }

      if (!blobUrl || !filename) {
        return NextResponse.json({ error: 'blobUrl and filename required' }, { status: 400 })
      }

      if (replace) await clearAll()

      // Fetch the CSV/XLSX from Blob storage and parse it
      const res = await fetch(blobUrl)
      if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())

      const records = parseFileBuffer(filename, buffer)
      const result  = await appendRecords(records, { filename })

      // Clean up the temporary upload blob
      try {
        const { del } = await import('@vercel/blob')
        await del(blobUrl)
      } catch { /* non-fatal */ }

      return NextResponse.json({
        ok: true,
        inserted: result.inserted,
        skipped:  result.skipped,
        batches:  [{ filename, inserted: result.inserted, skipped: result.skipped }],
      })
    }

    // ── Mode 2: FormData (local dev) ─────────────────────────────────────────
    const form  = await req.formData()
    const files = form.getAll('files') as File[]
    const replace = form.get('replace') === 'true'

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })
    }

    if (replace) await clearAll()

    let totalInserted = 0
    let totalSkipped  = 0
    const batchSummaries: { filename: string; inserted: number; skipped: number }[] = []

    for (const file of files) {
      const buffer  = Buffer.from(await file.arrayBuffer())
      const records = parseFileBuffer(file.name, buffer)
      const result  = await appendRecords(records, { filename: file.name })
      totalInserted += result.inserted
      totalSkipped  += result.skipped
      batchSummaries.push({ filename: file.name, inserted: result.inserted, skipped: result.skipped })
    }

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      skipped:  totalSkipped,
      batches:  batchSummaries,
    })

  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    )
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const [batches, meta] = await Promise.all([getBatches(), getDbMeta()])
  return NextResponse.json({
    batches,
    recordCount:  meta.totalRecords,
    rawAmountSum: meta.rawAmountSum,
    blobMode:     USE_BLOB,          // tells the admin page which upload path to use
  })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE() {
  await clearAll()
  return NextResponse.json({ ok: true })
}
