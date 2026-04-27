/**
 * parser.ts — Parse Thai sales-target CSV files.
 *
 * Handles two formats:
 *   - 2023–2025:  { branch|subdivision, m1..m12, total }
 *   - 2026:       { branch, subdivision?, m1..m12, total }
 *
 * Quirks handled:
 *   - UTF-8 BOM at file start
 *   - Numbers wrapped in quotes with internal commas ("15,500,000.00")
 *   - Leading/trailing spaces in every field
 *   - Grand total / subtotal rows (filtered out)
 *   - Missing rows / zero months
 */

import fs from 'node:fs'
import path from 'node:path'

export type TargetRow = {
  year: number
  branchCode: string                  // BK, SS, CS, SK, KK, CM, HO
  subdivision?: string                // HO-specific sub-division label
  monthlyTargets: number[]            // length 12, index 0 = January
  total: number
}

const BRANCHES = new Set(['BK', 'SS', 'CS', 'SK', 'KK', 'CM', 'HO'])

const HO_SUBS = [
  'ส่วนบริการสอบเทียบเครื่องมือ',
  'ส่วนตรวจประเมินและรับรองระบบ',
  'ส่วนฝึกอบรมและทดสอบความชำนาญฯ',
  'ส่วนประสานงานขายและพัฒนาธุรกิจ',
  'สำนักงานพานิชย์และยุทธศาสตร์',
]

// ─── Low-level helpers ────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

function parseNumber(s: string): number {
  const cleaned = (s || '').replace(/[",\s]/g, '')
  if (!cleaned) return 0
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseTargetCsv(content: string, year: number): TargetRow[] {
  // Strip BOM
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1)

  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  const rows: TargetRow[] = []
  const monthOffset = year >= 2026 ? 2 : 1

  for (const rawLine of lines) {
    const fields = parseCsvLine(rawLine).map((f) => f.trim())
    if (fields.length < monthOffset + 12) continue

    const first = fields[0].trim()
    const second = (fields[1] || '').trim()

    // Skip grand total and HO aggregate rows (we re-compute these ourselves)
    if (/ผลรวมทั้งหมด/.test(first)) continue
    if (/HO\s*ผลรวม/.test(first)) continue
    // Skip header rows
    if (/Global Dimension|Budget\d{4}|ป้ายชื่อ|Attribute|Sum of Value|จำนวนเงิน/.test(first)) continue

    const months: number[] = []
    for (let i = 0; i < 12; i++) {
      months.push(parseNumber(fields[monthOffset + i] || '0'))
    }
    const total = parseNumber(fields[monthOffset + 12] || '0')

    if (year >= 2026) {
      // 2026 format — first = branch, second = subdivision? | "" | "ผลรวม"
      if (BRANCHES.has(first) && !second) {
        rows.push({ year, branchCode: first, monthlyTargets: months, total })
      } else if (first === 'HO' && HO_SUBS.includes(second)) {
        rows.push({ year, branchCode: 'HO', subdivision: second, monthlyTargets: months, total })
      }
    } else {
      // 2023-2025 format — first = branch | HO subdivision name
      if (BRANCHES.has(first)) {
        rows.push({ year, branchCode: first, monthlyTargets: months, total })
      } else if (HO_SUBS.includes(first)) {
        rows.push({ year, branchCode: 'HO', subdivision: first, monthlyTargets: months, total })
      }
    }
  }

  return rows
}

// ─── Load all years from disk ────────────────────────────────────────────────

/** Resolve target CSV files from the project root (parent of `sales-dashboard`). */
function resolveTargetFile(year: number): string | null {
  const candidates = [
    path.join(process.cwd(), '..', `เป้า ${year}.csv`),
    path.join(process.cwd(), `เป้า ${year}.csv`),
    path.join(process.cwd(), 'data', 'targets', `${year}.csv`),
    path.join(process.cwd(), '..', 'targets', `${year}.csv`),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // ignore
    }
  }
  return null
}

export function loadAllTargets(years: number[] = [2023, 2024, 2025, 2026]): TargetRow[] {
  const rows: TargetRow[] = []
  for (const year of years) {
    const filePath = resolveTargetFile(year)
    if (!filePath) continue
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      rows.push(...parseTargetCsv(content, year))
    } catch (err) {
      console.warn(`[targets] Failed to load ${year}:`, (err as Error).message)
    }
  }
  return rows
}
