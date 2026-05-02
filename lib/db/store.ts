/**
 * store.ts — SQLite-backed storage layer.
 *
 * ไฟล์เดียว: data/sales.db (portable — copy ไฟล์นี้เพื่อแจก DB ให้เครื่องอื่น)
 *
 * Public API (unchanged from NDJSON version):
 *   getStore, getAllRecords, getBatches, getDbMeta,
 *   appendRecords, clearAll, reload, recordHash
 */

import type { SalesRecord } from '@/types'
import path from 'node:path'
import fs from 'node:fs'
import type DatabaseType from 'better-sqlite3'

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

// ─── File locations ───────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_FILE  = path.join(DATA_DIR, 'sales.db')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

// ─── Lazy singleton DB connection ────────────────────────────────────────────

let _db: DatabaseType.Database | null = null

/**
 * Public accessor for the singleton DB connection. Used by `lib/db/queries.ts`
 * (SQL-side aggregations) so we don't have to re-open the DB or re-run schema
 * setup in every consumer.
 */
export function getDb(): DatabaseType.Database {
  return db()
}

function db(): DatabaseType.Database {
  if (_db) return _db
  ensureDir()

  // Dynamic require — better-sqlite3 is a native module; keep it out of webpack client bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  _db = new Database(DB_FILE)
  _db.pragma('journal_mode = WAL')
  _db.pragma('synchronous = NORMAL')
  _db.pragma('cache_size = -64000')  // 64MB cache
  _db.pragma('temp_store = MEMORY')

  initSchema(_db)
  return _db
}

function initSchema(d: DatabaseType.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      postingDate       TEXT NOT NULL,
      documentDate      TEXT,
      orderDate         TEXT,
      year              INTEGER NOT NULL,
      quarter           TEXT NOT NULL,
      month             TEXT NOT NULL,
      monthNumber       INTEGER NOT NULL,
      day               INTEGER,
      branchCode        TEXT NOT NULL,
      locationCode      TEXT,
      documentNo        TEXT,
      documentType      TEXT,
      customerNo        TEXT,
      customerCode      TEXT,
      customerName      TEXT,
      customerGroupCode TEXT,
      customerGroupName TEXT,
      salespersonCode   TEXT,
      salespersonName   TEXT NOT NULL,
      productCode       TEXT,
      productDescription TEXT,
      testCode          TEXT,
      description       TEXT,
      quantity          REAL,
      unitPrice         REAL,
      totalUnitPrice    REAL,
      lineAmount        REAL,
      discountAmount    REAL,
      netAmount         REAL NOT NULL,
      grossAmount       REAL,
      batchId           TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_year         ON records(year);
    CREATE INDEX IF NOT EXISTS idx_records_postingDate  ON records(postingDate);
    CREATE INDEX IF NOT EXISTS idx_records_branch       ON records(branchCode);
    CREATE INDEX IF NOT EXISTS idx_records_batchId      ON records(batchId);

    CREATE TABLE IF NOT EXISTS batches (
      id          TEXT PRIMARY KEY,
      filename    TEXT NOT NULL,
      importedAt  TEXT NOT NULL,
      recordCount INTEGER NOT NULL,
      createdAt   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

// ─── Row ⇄ SalesRecord mapping ───────────────────────────────────────────────

type RecordRow = {
  postingDate: string
  documentDate: string | null
  orderDate: string | null
  year: number
  quarter: string
  month: string
  monthNumber: number
  day: number | null
  branchCode: string
  locationCode: string | null
  documentNo: string | null
  documentType: string | null
  customerNo: string | null
  customerCode: string | null
  customerName: string | null
  customerGroupCode: string | null
  customerGroupName: string | null
  salespersonCode: string | null
  salespersonName: string
  productCode: string | null
  productDescription: string | null
  testCode: string | null
  description: string | null
  quantity: number | null
  unitPrice: number | null
  totalUnitPrice: number | null
  lineAmount: number | null
  discountAmount: number | null
  netAmount: number
  grossAmount: number | null
}

function rowToRecord(r: RecordRow): SalesRecord {
  const rec: SalesRecord = {
    postingDate: r.postingDate,
    year: r.year,
    quarter: r.quarter,
    month: r.month,
    monthNumber: r.monthNumber,
    branchCode: r.branchCode,
    salespersonName: r.salespersonName,
    netAmount: r.netAmount,
  }
  if (r.documentDate       !== null) rec.documentDate       = r.documentDate
  if (r.orderDate          !== null) rec.orderDate          = r.orderDate
  if (r.day                !== null) rec.day                = r.day
  if (r.locationCode       !== null) rec.locationCode       = r.locationCode
  if (r.documentNo         !== null) rec.documentNo         = r.documentNo
  if (r.documentType       !== null) rec.documentType       = r.documentType
  if (r.customerNo         !== null) rec.customerNo         = r.customerNo
  if (r.customerCode       !== null) rec.customerCode       = r.customerCode
  if (r.customerName       !== null) rec.customerName       = r.customerName
  if (r.customerGroupCode  !== null) rec.customerGroupCode  = r.customerGroupCode
  if (r.customerGroupName  !== null) rec.customerGroupName  = r.customerGroupName
  if (r.salespersonCode    !== null) rec.salespersonCode    = r.salespersonCode
  if (r.productCode        !== null) rec.productCode        = r.productCode
  if (r.productDescription !== null) rec.productDescription = r.productDescription
  if (r.testCode           !== null) rec.testCode           = r.testCode
  if (r.description        !== null) rec.description        = r.description
  if (r.quantity           !== null) rec.quantity           = r.quantity
  if (r.unitPrice          !== null) rec.unitPrice          = r.unitPrice
  if (r.totalUnitPrice     !== null) rec.totalUnitPrice     = r.totalUnitPrice
  if (r.lineAmount         !== null) rec.lineAmount         = r.lineAmount
  if (r.discountAmount     !== null) rec.discountAmount     = r.discountAmount
  if (r.grossAmount        !== null) rec.grossAmount        = r.grossAmount
  return rec
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let cache: StoreShape | null = null
let loadPromise: Promise<StoreShape> | null = null

async function loadFromDb(): Promise<StoreShape> {
  const d = db()
  const batchRows = d.prepare(
    `SELECT id, filename, importedAt, recordCount FROM batches ORDER BY createdAt`,
  ).all() as ImportBatch[]

  // Stream rows and map in chunks — avoids allocating the full row[] + records[]
  // simultaneously (which is what previously caused OOM at ~1.3M rows).
  const stmt = d.prepare(`SELECT * FROM records ORDER BY postingDate`)
  const records: SalesRecord[] = []
  for (const row of stmt.iterate() as IterableIterator<RecordRow>) {
    records.push(rowToRecord(row))
  }
  return { version: 1, records, batches: batchRows }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStore(): Promise<StoreShape> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = loadFromDb().then((s) => {
      cache = s
      loadPromise = null
      return s
    })
  }
  return loadPromise
}

export async function getAllRecords(): Promise<SalesRecord[]> {
  return (await getStore()).records
}

export async function getBatches(): Promise<ImportBatch[]> {
  const d = db()
  return d.prepare(
    `SELECT id, filename, importedAt, recordCount FROM batches ORDER BY createdAt`,
  ).all() as ImportBatch[]
}

export async function getDbMeta(): Promise<DbMeta> {
  const d = db()
  const row = d.prepare(
    `SELECT COUNT(*) AS totalRecords, COALESCE(SUM(netAmount), 0) AS rawAmountSum FROM records`,
  ).get() as { totalRecords: number; rawAmountSum: number }
  return { totalRecords: row.totalRecords, rawAmountSum: row.rawAmountSum }
}

export function recordHash(r: SalesRecord): string {
  return [
    r.postingDate, r.documentNo ?? '', r.documentType ?? '',
    r.customerNo ?? r.customerCode ?? '', r.salespersonCode ?? '',
    r.productCode ?? '', r.testCode ?? '', r.description ?? '', String(r.netAmount),
  ].join('|')
}

export async function appendRecords(
  newRecords: SalesRecord[],
  batchInfo: Omit<ImportBatch, 'id' | 'importedAt' | 'recordCount'>,
): Promise<{ inserted: number; skipped: number; batchId: string }> {
  const d = db()
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const importedAt = new Date().toISOString()

  const insertRecord = d.prepare(`
    INSERT INTO records (
      postingDate, documentDate, orderDate, year, quarter, month, monthNumber, day,
      branchCode, locationCode, documentNo, documentType,
      customerNo, customerCode, customerName, customerGroupCode, customerGroupName,
      salespersonCode, salespersonName,
      productCode, productDescription, testCode, description,
      quantity, unitPrice, totalUnitPrice, lineAmount, discountAmount,
      netAmount, grossAmount, batchId
    ) VALUES (
      @postingDate, @documentDate, @orderDate, @year, @quarter, @month, @monthNumber, @day,
      @branchCode, @locationCode, @documentNo, @documentType,
      @customerNo, @customerCode, @customerName, @customerGroupCode, @customerGroupName,
      @salespersonCode, @salespersonName,
      @productCode, @productDescription, @testCode, @description,
      @quantity, @unitPrice, @totalUnitPrice, @lineAmount, @discountAmount,
      @netAmount, @grossAmount, @batchId
    )
  `)

  const insertBatch = d.prepare(`
    INSERT INTO batches (id, filename, importedAt, recordCount, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `)

  const tx = d.transaction((records: SalesRecord[]) => {
    for (const r of records) {
      insertRecord.run({
        postingDate:       r.postingDate,
        documentDate:      r.documentDate        ?? null,
        orderDate:         r.orderDate           ?? null,
        year:              r.year,
        quarter:           r.quarter,
        month:             r.month,
        monthNumber:       r.monthNumber,
        day:               r.day                 ?? null,
        branchCode:        r.branchCode,
        locationCode:      r.locationCode        ?? null,
        documentNo:        r.documentNo          ?? null,
        documentType:      r.documentType        ?? null,
        customerNo:        r.customerNo          ?? null,
        customerCode:      r.customerCode        ?? null,
        customerName:      r.customerName        ?? null,
        customerGroupCode: r.customerGroupCode   ?? null,
        customerGroupName: r.customerGroupName   ?? null,
        salespersonCode:   r.salespersonCode     ?? null,
        salespersonName:   r.salespersonName,
        productCode:       r.productCode         ?? null,
        productDescription: r.productDescription ?? null,
        testCode:          r.testCode            ?? null,
        description:       r.description         ?? null,
        quantity:          r.quantity            ?? null,
        unitPrice:         r.unitPrice           ?? null,
        totalUnitPrice:    r.totalUnitPrice      ?? null,
        lineAmount:        r.lineAmount          ?? null,
        discountAmount:    r.discountAmount      ?? null,
        netAmount:         r.netAmount,
        grossAmount:       r.grossAmount         ?? null,
        batchId,
      })
    }
    insertBatch.run(batchId, batchInfo.filename, importedAt, records.length, Date.now())
  })

  tx(newRecords)
  cache = null

  return { inserted: newRecords.length, skipped: 0, batchId }
}

export async function clearAll(): Promise<void> {
  const d = db()
  d.exec(`DELETE FROM records; DELETE FROM batches; DELETE FROM meta;`)
  d.exec(`VACUUM;`)
  cache = null
}

export async function clearBatch(batchId: string): Promise<{ deletedRecords: number; deletedBatch: boolean }> {
  const d = db()
  const tx = d.transaction((id: string) => {
    const recDel   = d.prepare(`DELETE FROM records WHERE batchId = ?`).run(id)
    const batchDel = d.prepare(`DELETE FROM batches WHERE id = ?`).run(id)
    return {
      deletedRecords: recDel.changes as number,
      deletedBatch:   (batchDel.changes as number) > 0,
    }
  })
  const result = tx(batchId)
  cache = null
  return result
}

export async function reload(): Promise<void> {
  cache = null
  loadPromise = null
  cache = await loadFromDb()
}
