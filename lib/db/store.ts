/**
 * store.ts — Storage layer with two backends:
 *
 *   LOCAL  (default / dev)  — reads & writes files under ./data/
 *   BLOB   (Vercel prod)    — Vercel Blob Storage (BLOB_READ_WRITE_TOKEN set)
 *
 * BLOB mode uses per-batch files so imports are always O(batch_size) writes,
 * never O(total_records).  This avoids re-uploading the full dataset on every
 * import chunk and prevents Vercel function timeouts.
 *
 *   clt-db/batches/{id}.ndjson  — one file per import batch
 *   clt-db/batches.json         — batch metadata list
 *   clt-db/meta.json            — quick stats (totalRecords, rawAmountSum)
 */

import type { SalesRecord } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportBatch = {
  id: string
  filename: string
  importedAt: string
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

// ─── NDJSON parser ────────────────────────────────────────────────────────────

function parseNdjsonBuffer(buf: Buffer): SalesRecord[] {
  const records: SalesRecord[] = []
  let start = 0
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 10) {
      if (i > start) {
        const line = buf.slice(start, i).toString('utf-8').trim()
        if (line) records.push(JSON.parse(line) as SalesRecord)
      }
      start = i + 1
    }
  }
  return records
}

// ─── Blob helpers ─────────────────────────────────────────────────────────────

const B = {
  batchDir:  'clt-db/batches/',
  batchFile: (id: string) => `clt-db/batches/${id}.ndjson`,
  batches:   'clt-db/batches.json',
  meta:      'clt-db/meta.json',
} as const

// Private blob fetch — adds Authorization header for private-access stores
async function blobFetch(url: string): Promise<Response | null> {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
    const res   = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok ? res : null
  } catch { return null }
}

async function blobReadString(pathname: string): Promise<string | null> {
  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: pathname, limit: 5 })
  const found = blobs.find(b => b.pathname === pathname)
  if (!found) return null
  try {
    const res = await blobFetch(found.url + '?_=' + found.uploadedAt)
    if (!res) return null
    return res.text()
  } catch { return null }
}

async function blobWriteString(pathname: string, content: string): Promise<void> {
  const { put } = await import('@vercel/blob')
  await put(pathname, content, {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'text/plain; charset=utf-8',
  })
}

async function blobWriteNdjson(pathname: string, records: SalesRecord[]): Promise<void> {
  if (records.length === 0) return   // Vercel Blob requires non-empty body
  const { put } = await import('@vercel/blob')
  const content = records.map(r => JSON.stringify(r)).join('\n') + '\n'
  await put(pathname, content, {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'text/plain; charset=utf-8',
  })
}

// ─── Local filesystem helpers ─────────────────────────────────────────────────

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

// ─── Singleton cache ──────────────────────────────────────────────────────────

let cache: StoreShape | null = null

const EMPTY_STORE: StoreShape = { version: 1, records: [], batches: [] }

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadFromBlob(): Promise<StoreShape> {
  const { list } = await import('@vercel/blob')

  // List all per-batch ndjson files
  const { blobs } = await list({ prefix: B.batchDir, limit: 1000 })
  const batchBlobs = blobs.filter(b => b.pathname.endsWith('.ndjson'))

  // Download all batch files in parallel (up to 10 at once)
  const chunkSize = 10
  const allRecords: SalesRecord[] = []
  for (let i = 0; i < batchBlobs.length; i += chunkSize) {
    const chunk = batchBlobs.slice(i, i + chunkSize)
    const buffers = await Promise.all(
      chunk.map(async b => {
        try {
          const res = await blobFetch(b.url + '?_=' + b.uploadedAt)
          if (!res) return null
          return Buffer.from(await res.arrayBuffer())
        } catch { return null }
      })
    )
    for (const buf of buffers) {
      if (buf) allRecords.push(...parseNdjsonBuffer(buf))
    }
  }

  // Load batch metadata
  const batchesRaw = await blobReadString(B.batches)
  const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []

  return { version: 1, records: allRecords, batches }
}

async function loadFromDisk(): Promise<StoreShape> {
  await localEnsureDir()
  const fs = await import('node:fs/promises')

  try {
    await fs.access(LEGACY_FILE)
    console.log('[store] Legacy records.json found — removing. Re-import via /admin/import.')
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
    batches = JSON.parse(await fs.readFile(BATCHES_FILE, 'utf-8')) as ImportBatch[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  }

  return { version: 1, records, batches }
}

// ─── Save (local only — blob uses per-batch writes) ───────────────────────────

async function saveToDisk(store: StoreShape): Promise<void> {
  await localEnsureDir()
  const fs     = await import('node:fs/promises')
  const fsSync = (await import('node:fs')).default

  const ndjsonTmp = NDJSON_FILE + '.tmp'
  await new Promise<void>((resolve, reject) => {
    const ws = fsSync.createWriteStream(ndjsonTmp, { encoding: 'utf-8' })
    ws.on('error', reject)
    ws.on('finish', resolve)
    for (const rec of store.records) ws.write(JSON.stringify(rec) + '\n')
    ws.end()
  })
  await fs.rename(ndjsonTmp, NDJSON_FILE)

  const batchesTmp = BATCHES_FILE + '.tmp'
  await fs.writeFile(batchesTmp, JSON.stringify(store.batches), 'utf-8')
  await fs.rename(batchesTmp, BATCHES_FILE)

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

  const store = await getStore()
  return {
    totalRecords: store.records.length,
    rawAmountSum: store.records.reduce((s, r) => s + r.netAmount, 0),
  }
}

export function recordHash(r: SalesRecord): string {
  return [
    r.postingDate, r.documentNo ?? '', r.documentType ?? '',
    r.customerNo ?? r.customerCode ?? '', r.salespersonCode ?? '',
    r.productCode ?? '', r.testCode ?? '', r.description ?? '',
    String(r.netAmount),
  ].join('|')
}

/**
 * Append records.
 *
 * BLOB mode: writes ONLY the new records as a separate batch blob (O(batch_size)).
 *   No re-writing of existing data — safe, fast, no timeout risk.
 *
 * LOCAL mode: appends to single NDJSON file (same as before).
 */
export async function appendRecords(
  newRecords: SalesRecord[],
  batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'recordCount'>,
): Promise<{ inserted: number; skipped: number; batchId: string }> {
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const batch: ImportBatch = {
    id:          batchId,
    filename:    batchInfo.filename,
    importedAt:  new Date().toISOString(),
    recordCount: newRecords.length,
  }

  if (USE_BLOB) {
    // 1. Upload this batch's records as its own blob file (skip if empty chunk)
    if (newRecords.length > 0) {
      await blobWriteNdjson(B.batchFile(batchId), newRecords)
    }

    // 2. Update batches.json
    const batchesRaw = await blobReadString(B.batches)
    const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
    batches.push(batch)
    await blobWriteString(B.batches, JSON.stringify(batches))

    // 3. Update meta.json (incremental — no full scan needed)
    const currentMeta = await getDbMeta()
    const newMeta: DbMeta = {
      totalRecords: currentMeta.totalRecords + newRecords.length,
      rawAmountSum: currentMeta.rawAmountSum + newRecords.reduce((s, r) => s + r.netAmount, 0),
    }
    await blobWriteString(B.meta, JSON.stringify(newMeta))

    // 4. Invalidate in-memory cache so next read merges this batch
    cache = null

  } else {
    // Local mode: append to in-memory store + rewrite disk files
    const store = await getStore()
    for (const r of newRecords) store.records.push(r)
    store.records.sort((a, b) => a.postingDate.localeCompare(b.postingDate))
    store.batches.push(batch)
    await saveToDisk(store)
    cache = store
  }

  return { inserted: newRecords.length, skipped: 0, batchId }
}

export async function clearAll(): Promise<void> {
  if (USE_BLOB) {
    const { list, del } = await import('@vercel/blob')
    // Delete all batch ndjson files
    const { blobs } = await list({ prefix: B.batchDir, limit: 1000 })
    if (blobs.length > 0) {
      await del(blobs.map(b => b.url))
    }
    // Reset metadata
    await Promise.all([
      blobWriteString(B.batches, '[]'),
      blobWriteString(B.meta, JSON.stringify({ totalRecords: 0, rawAmountSum: 0 })),
    ])
  } else {
    cache = { ...EMPTY_STORE }
    await saveToDisk(cache)
  }
  cache = null
}

export async function reload(): Promise<void> {
  cache = null
  cache = USE_BLOB ? await loadFromBlob() : await loadFromDisk()
}
