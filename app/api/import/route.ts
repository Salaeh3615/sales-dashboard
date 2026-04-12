/**
 * /api/import
 *
 * POST — three modes:
 *   1. JSON { headers, rows, filename, replace }  — Vercel production
 *      Browser parses CSV locally, sends raw rows in small chunks.
 *      Each chunk is ~1-2 MB — well under Vercel's 4.5 MB limit.
 *      Server reconstructs a mini-CSV and uses the existing parser.
 *
 *   2. JSON { blobUrl, filename, replace }  — legacy blob-URL mode (kept for compat)
 *
 *   3. FormData { files, replace }  — local dev
 *
 * GET    — DB stats + blobMode flag
 * DELETE — wipe database
 */

import { NextResponse } from 'next/server'
import { parseFileBuffer } from '@/lib/data-loader/serverLoader'
import { transformRows } from '@/lib/transformers/recordTransformer'
import type { RawRow } from '@/types'
import { appendRecords, clearAll, getBatches, getDbMeta } from '@/lib/db/store'

export const dynamic    = 'force-dynamic'
export const runtime    = 'nodejs'
export const maxDuration = 60

const USE_KV   = typeof process.env.KV_REST_API_URL === 'string' && process.env.KV_REST_API_URL.length > 0
const USE_BLOB = !USE_KV && typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' && process.env.BLOB_READ_WRITE_TOKEN.length > 0
// blobMode = true means "don't send raw file bytes — parse CSV in browser and send chunks"
const CHUNK_MODE = USE_KV || USE_BLOB

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const body = await req.json() as {
        // chunk mode
        headers?: string[]
        rows?:    string[][]
        // blob-url mode
        blobUrl?:  string
        filename:  string
        replace?:  boolean
      }

      if (body.replace) await clearAll()

      // ── Mode A: raw CSV rows from browser (chunk upload) ──────────────────
      if (body.headers && body.rows) {
        const { headers, rows, filename } = body

        // Directly transform rows without rebuilding CSV — avoids re-parse issues.
        // Client already split header row from data rows; we just key them.
        const keyed: RawRow[] = rows.map(row => {
          const obj: RawRow = {}
          headers.forEach((h, i) => { if (h) obj[h] = String(row[i] ?? '').trim() })
          return obj
        })
        const records = transformRows(headers, keyed)
        const result  = await appendRecords(records, { filename })

        return NextResponse.json({
          ok:       true,
          inserted: result.inserted,
          skipped:  result.skipped,
          batches:  [{ filename, inserted: result.inserted, skipped: result.skipped }],
        })
      }

      // ── Mode B: blob-URL (legacy) ─────────────────────────────────────────
      if (body.blobUrl) {
        const { blobUrl, filename } = body
        const res = await fetch(blobUrl)
        if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`)
        const buffer  = Buffer.from(await res.arrayBuffer())
        const records = parseFileBuffer(filename, buffer)
        const result  = await appendRecords(records, { filename })

        try {
          const { del } = await import('@vercel/blob')
          await del(blobUrl)
        } catch { /* non-fatal */ }

        return NextResponse.json({
          ok:       true,
          inserted: result.inserted,
          skipped:  result.skipped,
          batches:  [{ filename, inserted: result.inserted, skipped: result.skipped }],
        })
      }

      return NextResponse.json({ error: 'Missing rows or blobUrl' }, { status: 400 })
    }

    // ── Mode C: FormData (local dev) ─────────────────────────────────────────
    const form    = await req.formData()
    const files   = form.getAll('files') as File[]
    const replace = form.get('replace') === 'true'

    if (files.length === 0)
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 })

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
      ok: true, inserted: totalInserted, skipped: totalSkipped, batches: batchSummaries,
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
    blobMode:     CHUNK_MODE,   // tells admin page to parse CSV in browser
  })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE() {
  await clearAll()
  return NextResponse.json({ ok: true })
}
