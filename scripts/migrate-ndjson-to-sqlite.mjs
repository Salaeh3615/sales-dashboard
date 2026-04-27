/**
 * migrate-ndjson-to-sqlite.mjs
 *
 * ย้ายข้อมูลจาก data/records.ndjson + data/batches.json → data/sales.db
 *
 * ใช้งาน:
 *   node scripts/migrate-ndjson-to-sqlite.mjs
 *
 * หลัง migrate สำเร็จ ไฟล์เก่า (records.ndjson / batches.json / meta.json) จะยังอยู่
 * ถ้าใช้งานได้แล้วค่อยลบทิ้งเอง (ผู้ใช้ตัดสินใจ)
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import Database from 'better-sqlite3'

const DATA_DIR    = path.join(process.cwd(), 'data')
const NDJSON_FILE = path.join(DATA_DIR, 'records.ndjson')
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json')
const DB_FILE     = path.join(DATA_DIR, 'sales.db')

if (!fs.existsSync(NDJSON_FILE)) {
  console.error('❌ ไม่เจอไฟล์', NDJSON_FILE)
  process.exit(1)
}

const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')
db.pragma('synchronous = OFF')         // สูงสุดความเร็ว — เฉพาะตอน migrate
db.pragma('cache_size = -200000')      // 200MB
db.pragma('temp_store = MEMORY')

db.exec(`
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

// 1. ตรวจสอบว่า DB ว่างเปล่า (ไม่ทับของเดิม)
const existing = db.prepare('SELECT COUNT(*) AS c FROM records').get().c
if (existing > 0) {
  console.error(`❌ data/sales.db มีข้อมูลอยู่แล้ว ${existing.toLocaleString()} rows — ยกเลิก migrate`)
  console.error('    ถ้าต้องการ migrate ใหม่ให้ลบไฟล์ data/sales.db ก่อน')
  process.exit(1)
}

// 2. Import batches
const LEGACY_BATCH_ID = 'legacy-ndjson'
if (fs.existsSync(BATCHES_FILE)) {
  const batches = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf-8'))
  const insertBatch = db.prepare(
    `INSERT INTO batches (id, filename, importedAt, recordCount, createdAt) VALUES (?, ?, ?, ?, ?)`,
  )
  const tx = db.transaction(() => {
    for (const b of batches) {
      insertBatch.run(
        b.id,
        b.filename,
        b.importedAt,
        b.recordCount,
        Date.parse(b.importedAt) || Date.now(),
      )
    }
  })
  tx()
  console.log(`✅ Migrated ${batches.length} batch(es)`)
} else {
  // สร้าง batch เดียวสำหรับข้อมูล legacy
  db.prepare(
    `INSERT INTO batches (id, filename, importedAt, recordCount, createdAt) VALUES (?, ?, ?, ?, ?)`,
  ).run(LEGACY_BATCH_ID, 'legacy-ndjson', new Date().toISOString(), 0, Date.now())
}

// 3. Stream NDJSON → SQLite
const insertRecord = db.prepare(`
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

function toParams(r) {
  return {
    postingDate:        r.postingDate,
    documentDate:       r.documentDate       ?? null,
    orderDate:          r.orderDate          ?? null,
    year:               r.year,
    quarter:            r.quarter,
    month:              r.month,
    monthNumber:        r.monthNumber,
    day:                r.day                ?? null,
    branchCode:         r.branchCode,
    locationCode:       r.locationCode       ?? null,
    documentNo:         r.documentNo         ?? null,
    documentType:       r.documentType       ?? null,
    customerNo:         r.customerNo         ?? null,
    customerCode:       r.customerCode       ?? null,
    customerName:       r.customerName       ?? null,
    customerGroupCode:  r.customerGroupCode  ?? null,
    customerGroupName:  r.customerGroupName  ?? null,
    salespersonCode:    r.salespersonCode    ?? null,
    salespersonName:    r.salespersonName,
    productCode:        r.productCode        ?? null,
    productDescription: r.productDescription ?? null,
    testCode:           r.testCode           ?? null,
    description:        r.description        ?? null,
    quantity:           r.quantity           ?? null,
    unitPrice:          r.unitPrice          ?? null,
    totalUnitPrice:     r.totalUnitPrice     ?? null,
    lineAmount:         r.lineAmount         ?? null,
    discountAmount:     r.discountAmount     ?? null,
    netAmount:          r.netAmount,
    grossAmount:        r.grossAmount        ?? null,
    batchId:            r.batchId            ?? LEGACY_BATCH_ID,
  }
}

const batchSize = 5000
let buffer = []
let total = 0
const t0 = Date.now()

const insertMany = db.transaction((rows) => {
  for (const r of rows) insertRecord.run(r)
})

const rl = readline.createInterface({
  input: fs.createReadStream(NDJSON_FILE, { encoding: 'utf-8' }),
  crlfDelay: Infinity,
})

console.log('📥 เริ่ม import records…')

for await (const line of rl) {
  const trimmed = line.trim()
  if (!trimmed) continue
  try {
    buffer.push(toParams(JSON.parse(trimmed)))
  } catch (e) {
    console.warn(`⚠️ ข้าม line ที่ parse ไม่ได้: ${trimmed.slice(0, 80)}…`)
    continue
  }
  if (buffer.length >= batchSize) {
    insertMany(buffer)
    total += buffer.length
    buffer = []
    if (total % 50000 === 0) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      const rate    = Math.round(total / (Date.now() - t0) * 1000)
      console.log(`   ${total.toLocaleString()} rows  (${elapsed}s, ${rate.toLocaleString()} rows/sec)`)
    }
  }
}
if (buffer.length > 0) {
  insertMany(buffer)
  total += buffer.length
}

// 4. สร้าง index (ทำทีหลังเพื่อให้ insert เร็วขึ้น)
console.log('🔧 สร้าง indexes…')
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_records_year         ON records(year);
  CREATE INDEX IF NOT EXISTS idx_records_postingDate  ON records(postingDate);
  CREATE INDEX IF NOT EXISTS idx_records_branch       ON records(branchCode);
  CREATE INDEX IF NOT EXISTS idx_records_batchId      ON records(batchId);
`)

// 5. ถ้าใช้ legacy batch แต่ไม่มี record ใดๆ ที่อ้างถึง → อัพเดท recordCount
const legacyCount = db.prepare(`SELECT COUNT(*) AS c FROM records WHERE batchId = ?`).get(LEGACY_BATCH_ID).c
if (legacyCount > 0) {
  db.prepare(`UPDATE batches SET recordCount = ? WHERE id = ?`).run(legacyCount, LEGACY_BATCH_ID)
}

db.pragma('synchronous = NORMAL')

const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`\n✅ Migrate เสร็จแล้ว!`)
console.log(`   - ${total.toLocaleString()} records`)
console.log(`   - ${elapsed} วินาที`)
console.log(`   - ไฟล์: ${DB_FILE}`)
console.log(`\n💡 ไฟล์ NDJSON ยังอยู่ — ถ้าเทสว่าใช้ได้ดีแล้วค่อยลบทิ้งได้`)

db.close()
