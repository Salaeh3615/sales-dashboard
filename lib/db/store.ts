/**
 * store.ts — Storage layer with three backends:
 *
 *   KV     (Vercel prod, preferred) — Upstash Redis via @vercel/kv
 *                                     Env: KV_REST_API_URL + KV_REST_API_TOKEN
 *   BLOB   (Vercel prod, fallback)  — Vercel Blob (BLOB_READ_WRITE_TOKEN set)
 *   LOCAL  (dev / default)          — reads & writes files under ./data/
 *
 * KV mode stores per-batch records as Redis keys:
 *   clt:batch:<id>   — NDJSON string of records for one import batch
 *   clt:batches      — JSON array of ImportBatch metadata
 *   clt:meta         — JSON object { totalRecords, rawAmountSum }
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

const USE_KV   = typeof process.env.KV_REST_API_URL   === 'string' && process.env.KV_REST_API_URL.length   > 0
const USE_BLOB = !USE_KV &&
                 typeof process.env.BLOB_READ_WRITE_TOKEN === 'string' &&
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

function parseNdjsonString(s: string): SalesRecord[] {
  return s.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as SalesRecord)
}

// ─── KV helpers (Upstash / @vercel/kv) ───────────────────────────────────────
// Uses only get / set / del — all "Simple Commands", no scan/keys/list calls.

const K = {
  batches:   'clt:batches',
  meta:      'clt:meta',
  batch: (id: string) => `clt:batch:${id}`,
} as const

/**
 * kvGet — always returns a JSON string (or null).
 * @vercel/kv auto-deserializes stored values, so we may receive an object
 * instead of the raw string.  Re-stringify if needed so callers can always
 * do JSON.parse() safely.
 */
async function kvGet(key: string): Promise<string | null> {
  const { kv } = await import('@vercel/kv')
  const val = await kv.get(key)
  if (val === null || val === undefined) return null
  if (typeof val === 'string') return val
  return JSON.stringify(val)   // already deserialized → re-stringify
}

async function kvSet(key: string, value: string): Promise<void> {
  const { kv } = await import('@vercel/kv')
  await kv.set(key, value)
}

async function kvDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const { kv } = await import('@vercel/kv')
  await kv.del(...keys as [string, ...string[]])
}

// ─── Blob helpers (fallback — see original for notes) ─────────────────────────

const B = {
  batchFile: (id: string) => `clt-db/batches/${id}.ndjson`,
  batches:   'clt-db/batches.json',
  meta:      'clt-db/meta.json',
  init:      'clt-db/.init',
} as const

let _blobBase: string | null = null
function extractBase(url: string): string | null {
  const m = url.match(/^(https:\/\/[^/]+\.public\.blob\.vercel-storage\.com)/)
  return m ? m[1] : null
}
async function getBlobBase(): Promise<string> {
  if (_blobBase) return _blobBase
  const { put } = await import('@vercel/blob')
  const r = await put(B.init, '1', { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'text/plain' })
  _blobBase = extractBase(r.url)
  if (!_blobBase) throw new Error('Cannot derive Vercel Blob base URL')
  return _blobBase
}
async function blobRead(pathname: string): Promise<string | null> {
  const base = await getBlobBase()
  try { const res = await fetch(`${base}/${pathname}?t=${Date.now()}`); return res.ok ? res.text() : null } catch { return null }
}
async function blobWrite(pathname: string, content: string): Promise<void> {
  const { put } = await import('@vercel/blob')
  const r = await put(pathname, content, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'text/plain; charset=utf-8' })
  if (!_blobBase) _blobBase = extractBase(r.url)
}
async function blobWriteNdjson(pathname: string, records: SalesRecord[]): Promise<void> {
  if (records.length === 0) return
  await blobWrite(pathname, records.map(r => JSON.stringify(r)).join('\n') + '\n')
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

async function loadFromKV(): Promise<StoreShape> {
  const batchesRaw = await kvGet(K.batches)
  const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
  if (batches.length === 0) return { version: 1, records: [], batches: [] }

  const chunkSize = 10
  const allRecords: SalesRecord[] = []
  for (let i = 0; i < batches.length; i += chunkSize) {
    const chunk = batches.slice(i, i + chunkSize)
    const contents = await Promise.all(chunk.map(b => kvGet(K.batch(b.id))))
    for (const c of contents) {
      if (c) allRecords.push(...parseNdjsonString(c))
    }
  }
  return { version: 1, records: allRecords, batches }
}

async function loadFromBlob(): Promise<StoreShape> {
  const batchesRaw = await blobRead(B.batches)
  const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
  if (batches.length === 0) return { version: 1, records: [], batches: [] }

  const base = await getBlobBase()
  const chunkSize = 10
  const allRecords: SalesRecord[] = []
  for (let i = 0; i < batches.length; i += chunkSize) {
    const chunk = batches.slice(i, i + chunkSize)
    const buffers = await Promise.all(
      chunk.map(async b => {
        try {
          const res = await fetch(`${base}/${B.batchFile(b.id)}?t=${Date.now()}`)
          return res.ok ? Buffer.from(await res.arrayBuffer()) : null
        } catch { return null }
      })
    )
    for (const buf of buffers) {
      if (buf) allRecords.push(...parseNdjsonBuffer(buf))
    }
  }
  return { version: 1, records: allRecords, batches }
}

async function loadFromDisk(): Promise<StoreShape> {
  await localEnsureDir()
  const fs = await import('node:fs/promises')
  try { await fs.access(LEGACY_FILE); await fs.unlink(LEGACY_FILE).catch(() => {}) } catch { /* ok */ }

  let records: SalesRecord[] = []
  try { records = parseNdjsonBuffer(await fs.readFile(NDJSON_FILE)) }
  catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }

  let batches: ImportBatch[] = []
  try { batches = JSON.parse(await fs.readFile(BATCHES_FILE, 'utf-8')) as ImportBatch[] }
  catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e }

  return { version: 1, records, batches }
}

async function saveToDisk(store: StoreShape): Promise<void> {
  await localEnsureDir()
  const fs     = await import('node:fs/promises')
  const fsSync = (await import('node:fs')).default
  const ndjsonTmp = NDJSON_FILE + '.tmp'
  await new Promise<void>((resolve, reject) => {
    const ws = fsSync.createWriteStream(ndjsonTmp, { encoding: 'utf-8' })
    ws.on('error', reject); ws.on('finish', resolve)
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
  if (!cache) {
    cache = USE_KV ? await loadFromKV() : USE_BLOB ? await loadFromBlob() : await loadFromDisk()
  }
  return cache
}

export async function getAllRecords(): Promise<SalesRecord[]> {
  return (await getStore()).records
}

export async function getBatches(): Promise<ImportBatch[]> {
  if (USE_KV) {
    const raw = await kvGet(K.batches)
    return raw ? JSON.parse(raw) : []
  }
  return (await getStore()).batches
}

export async function getDbMeta(): Promise<DbMeta> {
  try {
    if (USE_KV) {
      const raw = await kvGet(K.meta)
      if (raw) return JSON.parse(raw) as DbMeta
    } else if (USE_BLOB) {
      const raw = await blobRead(B.meta)
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
  return [r.postingDate, r.documentNo ?? '', r.documentType ?? '',
    r.customerNo ?? r.customerCode ?? '', r.salespersonCode ?? '',
    r.productCode ?? '', r.testCode ?? '', r.description ?? '', String(r.netAmount),
  ].join('|')
}

export async function appendRecords(
  newRecords: SalesRecord[],
  batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'recordCount'>,
): Promise<{ inserted: number; skipped: number; batchId: string }> {
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const batch: ImportBatch = {
    id: batchId, filename: batchInfo.filename,
    importedAt: new Date().toISOString(), recordCount: newRecords.length,
  }

  if (USE_KV) {
    // 1. Store records as NDJSON string
    if (newRecords.length > 0) {
      await kvSet(K.batch(batchId), newRecords.map(r => JSON.stringify(r)).join('\n') + '\n')
    }
    // 2. Update batches list
    const batchesRaw = await kvGet(K.batches)
    const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
    batches.push(batch)
    await kvSet(K.batches, JSON.stringify(batches))
    // 3. Update meta
    const currentMeta = await getDbMeta()
    await kvSet(K.meta, JSON.stringify({
      totalRecords: currentMeta.totalRecords + newRecords.length,
      rawAmountSum: currentMeta.rawAmountSum + newRecords.reduce((s, r) => s + r.netAmount, 0),
    }))
    cache = null

  } else if (USE_BLOB) {
    if (newRecords.length > 0) await blobWriteNdjson(B.batchFile(batchId), newRecords)
    const batchesRaw = await blobRead(B.batches)
    const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
    batches.push(batch)
    await blobWrite(B.batches, JSON.stringify(batches))
    const currentMeta = await getDbMeta()
    await blobWrite(B.meta, JSON.stringify({
      totalRecords: currentMeta.totalRecords + newRecords.length,
      rawAmountSum: currentMeta.rawAmountSum + newRecords.reduce((s, r) => s + r.netAmount, 0),
    }))
    cache = null

  } else {
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
  if (USE_KV) {
    const batchesRaw = await kvGet(K.batches)
    const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
    const keys = [K.batches, K.meta, ...batches.map(b => K.batch(b.id))]
    if (keys.length > 0) await kvDel(...keys)

  } else if (USE_BLOB) {
    const { del } = await import('@vercel/blob')
    const base = await getBlobBase()
    try {
      const batchesRaw = await blobRead(B.batches)
      const batches: ImportBatch[] = batchesRaw ? JSON.parse(batchesRaw) : []
      if (batches.length > 0) {
        const urls = batches.map(b => `${base}/${B.batchFile(b.id)}`)
        for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100)).catch(() => {})
      }
    } catch (e) { console.warn('[clearAll] blob delete failed (non-fatal):', e) }
    await Promise.all([blobWrite(B.batches, '[]'), blobWrite(B.meta, JSON.stringify({ totalRecords: 0, rawAmountSum: 0 }))])

  } else {
    cache = { ...EMPTY_STORE }
    await saveToDisk(cache)
  }
  cache = null
}

export async function reload(): Promise<void> {
  cache = null
  cache = USE_KV ? await loadFromKV() : USE_BLOB ? await loadFromBlob() : await loadFromDisk()
}
