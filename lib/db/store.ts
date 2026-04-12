/**
 * store.ts — Storage layer with two backends:
 *
 *   LOCAL  (default / dev)   — reads & writes files under ./data/
 *   BLOB   (Vercel production) — reads & writes to Vercel Blob Storage
 *                                activated when BLOB_READ_WRITE_TOKEN is set
 *
 * Public API is identical in both modes; callers never see the difference.
 *
 * Format: NDJSON  (one JSON record per line — no V8 512 MB string limit)
 *   records.ndjson  — all SalesRecord rows
 *   batches.json    — import batch metadata (tiny)
 *   meta.json       — quick stats (totalRecords, rawAmountSum)
 */

import type { SalesRecord } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportBatch = {
  id: string
  filename: string
  importedAt: string   // ISO timestamp
  recordCount: number
}

export type DbMeta = {
  totalRecords: number
  rawAmountSum: number
}

export type StoreShape = {
  version: number
  records: SalesRecord[]
  batches: ImportBatch[]
}

// ─── Backend selection ────────────────────────────────────────────────────────

const USE_BLOB = typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
                 process.env.BLOB_READ_WRITE_TOKEN.length > 0

// ─── Blob backend ─────────────────────────────────────────────────────────────
//
// Pathnames are fixed (addRandomSuffix: false) so re-uploading the same name
// atomically replaces the previous blob — same semantics as rename().
//
// access: 'public' means blob URLs are world-readable.  For an internal
// dashboard that is acceptable; the URL is unguessable (random store ID).

const B = {
  records: 'clt-db/records.ndjson',
  batches: 'clt-db/batches.json',
  meta:    'clt-db/meta.json',
} as const

async function blobReadBuffer(pathname: string): Promise<Buffer | null> {
  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: pathname, limit: 5 })
  const found = blobs.find(b => b.pathname === pathname)
  if (!found) return null
  try {
    // Add cache-busting query so we always get the latest version
    const res = await fetch(found.url + '?_=' + found.uploadedAt)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function blobReadString(pathname: string): Promise<string | null> {
  const buf = await blobReadBuffer(pathname)
  return buf ? buf.toString('utf-8') : null
}

async function blobWriteString(pathname: string, content: string): Promise<void> {
  const { put } = await import('@vercel/blob')
  await put(pathname, content, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'text/plain; charset=utf-8',
  })
}

/**
 * Stream NDJSON to Vercel Blob via a Node.js Readable generator.
 * Avoids creating one large concatenated string in memory.
 */
async function blobWriteNdjson(pathname: string, records: SalesRecord[]): Promise<void> {
  const { put }      = await import('@vercel/blob')
  const { Readable } = await import('stream')

  const stream = Readable.from(
    (function* () { for (const r of records) yield JSON.stringify(r) + '\n' })()
  )
  await put(pathname, stream, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'text/plain; charset=utf-8',
  })
}

// ─── Local filesystem backend ─────────────────────────────────────────────────

import path from 'node:path'

const DATA_DIR     = path.join(process.cwd(), 'data')
const NDJSON_FILE  = path.join(DATA_DIR, 'records.ndjson')
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json')
const META_FILE    = path.join(DATA_DIR, 'meta.json')
const LEGACY_FILE  = path.join(DATA_DIR, 'records.json')

async function localEnsureDir() {
  const fs = await import('node:fs/promises')
  await fs.mkdir(DATA_DIR, { recursive: true })
}

// ─── NDJSON parser ────────────────────────────────────────────────────────────

/**
 * Parse NDJSON from a Buffer without ever creating one large string.
 * Each line is a small individual toString() call.
 */
function parseNdjsonBuffer(buf: Buffer): SalesRecord[] {
  const records: SalesRecord[] = []
  let start = 0
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 10 /* \n */) {
      if (i > start) {
        const line = buf.slice(start, i).toString('utf-8').trim()
        if (line) records.push(JSON.parse(line) as SalesRecord)
      }
      start = i + 1
    }
  }
  return records
}

// ─── Singleton cache ──────────────────────────────────────────────────────────

let cache: StoreShape | null = null
let writeLock: Promise<void> | null = null

const EMPTY_STORE: StoreShape = { version: 1, records: [], batches: [] }

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadFromBlob(): Promise<StoreShape> {
  const recBuf  = await blobReadBuffer(B.records)
  const batRaw  = await blobReadString(B.batches)
  const records = recBuf ? parseNdjsonBuffer(recBuf) : []
  const batches = batRaw ? (JSON.parse(batRaw) as ImportBatch[]) : []
  return { version: 1, records, batches }
}

async function loadFromDisk(): Promise<StoreShape> {
  await localEnsureDir()
  const fs = await import('node:fs/promises')

  // ── Migrate legacy records.json if present ────────────────────────────────
  try {
    await fs.access(LEGACY_FILE)
    console.log('[store] Legacy records.json found — removing. Please re-import via /admin/import.')
    await fs.unlink(LEGACY_FILE).catch(() => {})
  } catch { /* no legacy file */ }

  let records: SalesRecord[] = []
  try {
    const buf = await fs.readFile(NDJSON_FILE)
    records = parseNdjsonBuffer(buf)
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }

  let batches: ImportBatch[] = []
  try {
    const raw = await fs.readFile(BATCHES_FILE, 'utf-8')
    batches = JSON.parse(raw) as ImportBatch[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }

  return { version: 1, records, batches }
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function saveToBlob(store: StoreShape): Promise<void> {
  const meta: DbMeta = {
    totalRecords: store.records.length,
    rawAmountSum: store.records.reduce((s, r) => s + r.netAmount, 0),
  }
  // Write all three blobs in parallel (records last — largest upload)
  await Promise.all([
    blobWriteString(B.batches, JSON.stringify(store.batches)),
    blobWriteString(B.meta,    JSON.stringify(meta)),
    blobWriteNdjson(B.records, store.records),
  ])
}

async function saveToDisk(store: StoreShape): Promise<void> {
  await localEnsureDir()
  const fs   = await import('node:fs/promises')
  const fsSync = (await import('node:fs')).default

  // ── records.ndjson (streaming write, no large string) ────────────────────
  const ndjsonTmp = NDJSON_FILE + '.tmp'
  await new Promise<void>((resolve, reject) => {
    const ws = fsSync.createWriteStream(ndjsonTmp, { encoding: 'utf-8' })
    ws.on('error', reject)
    ws.on('finish', resolve)
    for (const rec of store.records) ws.write(JSON.stringify(rec) + '\n')
    ws.end()
  })
  await fs.rename(ndjsonTmp, NDJSON_FILE)

  // ── batches.json ──────────────────────────────────────────────────────────
  const batchesTmp = BATCHES_FILE + '.tmp'
  await fs.writeFile(batchesTmp, JSON.stringify(store.batches), 'utf-8')
  await fs.rename(batchesTmp, BATCHES_FILE)

  // ── meta.json ─────────────────────────────────────────────────────────────
  const meta: DbMeta = {
    totalRecords: store.records.length,
    rawAmountSum: store.records.reduce((s, r) => s + r.netAmount, 0),
  }
  const metaTmp = META_FILE + '.tmp'
  await fs.writeFile(metaTmp, JSON.stringify(meta), 'utf-8')
  await fs.rename(metaTmp, META_FILE)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStore(): Promise<StoreShape> {
  if (!cache) cache = USE_BLOB ? await loadFromBlob() : await loadFromDisk()
  return cache
}

export async function getAllRecords(): Promise<SalesRecord[]> {
  return (await getStore()).records
}

export async function getBatches(): Promise<ImportBatch[]> {
  return (await getStore()).batches
}

export async function getDbMeta(): Promise<DbMeta> {
  // Fast path: read meta file without loading all records
  try {
    if (USE_BLOB) {
      const raw = await blobReadString(B.meta)
      if (raw) return JSON.parse(raw) as DbMeta
    } else {
      const fs  = await import('node:fs/promises')
      const raw = await fs.readFile(META_FILE, 'utf-8')
      return JSON.parse(raw) as DbMeta
    }
  } catch { /* fall through */ }

  // Slow path: compute from cached records
  const store = await getStore()
  return {
    totalRecords: store.records.length,
    rawAmountSum: store.records.reduce((s, r) => s + r.netAmount, 0),
  }
}

export function recordHash(r: SalesRecord): string {
  return [
    r.postingDate,
    r.documentNo      ?? '',
    r.documentType    ?? '',
    r.customerNo      ?? r.customerCode ?? '',
    r.salespersonCode ?? '',
    r.productCode     ?? '',
    r.testCode        ?? '',
    r.description     ?? '',
    String(r.netAmount),
  ].join('|')
}

/**
 * Append records — no row-level dedup.
 * Every row from the source file is inserted as-is so totals match the source.
 * Re-importing the same file doubles the data; use clearAll() first if needed.
 */
export async function appendRecords(
  newRecords: SalesRecord[],
  batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'recordCount'>,
): Promise<{ inserted: number; skipped: number; batchId: string }> {
  if (writeLock) await writeLock
  writeLock = (async () => {
    const store = await getStore()

    for (const r of newRecords) store.records.push(r)
    store.records.sort((a, b) => a.postingDate.localeCompare(b.postingDate))

    const batch: ImportBatch = {
      id:          `batch-${Date.now()}`,
      filename:    batchInfo.filename,
      importedAt:  new Date().toISOString(),
      recordCount: newRecords.length,
    }
    store.batches.push(batch)

    if (USE_BLOB) await saveToBlob(store)
    else          await saveToDisk(store)
    cache = store
  })()
  try {
    await writeLock
  } finally {
    writeLock = null
  }
  return { inserted: newRecords.length, skipped: 0, batchId: `batch-${Date.now()}` }
}

export async function clearAll(): Promise<void> {
  if (writeLock) await writeLock
  writeLock = (async () => {
    cache = { ...EMPTY_STORE }
    if (USE_BLOB) await saveToBlob(cache)
    else          await saveToDisk(cache)
  })()
  try { await writeLock } finally { writeLock = null }
}

export async function reload(): Promise<void> {
  cache = null
  cache = USE_BLOB ? await loadFromBlob() : await loadFromDisk()
}
