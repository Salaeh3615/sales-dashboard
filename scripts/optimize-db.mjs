#!/usr/bin/env node
/**
 * optimize-db.mjs — One-shot DB maintenance script
 *
 *   npm run optimize-db
 *
 * Adds missing indexes, refreshes ANALYZE statistics, then VACUUMs the file
 * to reclaim space and merge the WAL into the main DB.
 *
 * Safe to re-run anytime. **Stop the dev server first** — better-sqlite3
 * holds a write lock that conflicts with VACUUM.
 */

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_FILE = path.join(__dirname, '..', 'data', 'sales.db')

if (!fs.existsSync(DB_FILE)) {
  console.error(`✗ DB not found: ${DB_FILE}`)
  process.exit(1)
}

function fmtBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  if (n >= 1024)      return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function dbSize() {
  let total = 0
  for (const suffix of ['', '-wal', '-shm']) {
    const p = DB_FILE + suffix
    if (fs.existsSync(p)) total += fs.statSync(p).size
  }
  return total
}

const before = dbSize()
console.log(`▶ DB size before: ${fmtBytes(before)}`)

const db = new Database(DB_FILE)

// 1. Add indexes that the dashboard / new analytics tabs benefit from.
const INDEXES = [
  { name: 'idx_records_customer',      sql: 'CREATE INDEX IF NOT EXISTS idx_records_customer      ON records(customerCode)' },
  { name: 'idx_records_salesperson',   sql: 'CREATE INDEX IF NOT EXISTS idx_records_salesperson   ON records(salespersonCode)' },
  { name: 'idx_records_customerGroup', sql: 'CREATE INDEX IF NOT EXISTS idx_records_customerGroup ON records(customerGroupCode)' },
  { name: 'idx_records_quarter',       sql: 'CREATE INDEX IF NOT EXISTS idx_records_quarter       ON records(quarter)' },
  { name: 'idx_records_year_month',    sql: 'CREATE INDEX IF NOT EXISTS idx_records_year_month    ON records(year, monthNumber)' },
  { name: 'idx_records_docType',       sql: 'CREATE INDEX IF NOT EXISTS idx_records_docType       ON records(documentType)' },
  { name: 'idx_records_location',      sql: 'CREATE INDEX IF NOT EXISTS idx_records_location      ON records(locationCode)' },
]

console.log('\n▶ Ensuring indexes…')
for (const ix of INDEXES) {
  const t = Date.now()
  db.exec(ix.sql)
  console.log(`  ✓ ${ix.name} (${Date.now() - t}ms)`)
}

// 2. Refresh query-planner stats.
console.log('\n▶ Running ANALYZE…')
{
  const t = Date.now()
  db.exec('ANALYZE')
  console.log(`  ✓ ANALYZE done (${Date.now() - t}ms)`)
}

// 3. Checkpoint WAL → main, then VACUUM to compact.
console.log('\n▶ Checkpointing WAL…')
{
  const t = Date.now()
  db.pragma('wal_checkpoint(TRUNCATE)')
  console.log(`  ✓ WAL flushed (${Date.now() - t}ms)`)
}

console.log('\n▶ Running VACUUM (this may take a minute on large DBs)…')
{
  const t = Date.now()
  db.exec('VACUUM')
  console.log(`  ✓ VACUUM done (${Date.now() - t}ms)`)
}

db.close()

const after = dbSize()
const saved = before - after
const pct = before > 0 ? (saved / before) * 100 : 0
console.log(`\n▶ DB size after:  ${fmtBytes(after)}`)
console.log(`▶ Reclaimed:      ${fmtBytes(saved)} (${pct.toFixed(1)}%)`)
console.log('\n✔ Done.')
