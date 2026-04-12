/**
 * recordTransformer.ts
 *
 * Converts raw parsed rows (keyed by column header names) into clean
 * SalesRecord objects, handling:
 *  - Thai / English mixed text
 *  - Date formats: d/m/yyyy  or  dd/mm/yyyy
 *  - Numeric parsing (preserving negatives)
 *  - Column name variations between file years
 *  - Derived quarter / month fields
 */

import type { RawRow, SalesRecord } from '@/types'

// ─── Column name aliases ──────────────────────────────────────────────────────
// Keys are the normalised lower-case column name from the file.
// Multiple aliases handle small variations across export years.

const COL = {
  branch: ['shortcut dimension 1 code'],
  location: ['shortcut dimension 2 code'],
  postingDate: ['posting date'],
  docNo: ['no_'],
  docDate: ['document date'],
  docType: ['document_type'],
  customerNo: ['bill-to customer no_'],
  customerCode: ['customercode', 'customerCodeWinspeed'.toLowerCase()],
  customerName: ['bill-to name'],
  customerGroupCode: ['customergroupcode'],
  customerGroupName: ['customergroupname'],
  salespersonCode: ['salesperson code'],
  orderDate: ['orders_date'],
  productCode: ['product code'],
  productDesc: ['product description'],
  testCode: ['test code'],
  description: ['description'],
  quantity: ['quantity'],
  unitPrice: ['unitprice'],
  totalUnitPrice: ['total_unit_price'],
  lineAmount: ['lineamount'],
  discountAmount: ['linediscountamount', 'invdiscountamount'],
  netAmount: ['amount'],
  grossAmount: ['amountincludingvat'],
  year: ['year'],
  month: ['month'],
  day: ['day'],
  salespersonName: ['sale person name'],
}

const MONTH_NAMES = [
  '', // index 0 unused
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a lookup map from column names (lower-cased, trimmed) to the actual
 * header string as it appears in the file.
 */
export function buildColumnMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of headers) {
    map.set(h.toLowerCase().trim(), h)
  }
  return map
}

/** Resolve a canonical column key to the actual header name in this file */
function resolveCol(
  aliases: string[],
  columnMap: Map<string, string>,
): string | undefined {
  for (const alias of aliases) {
    if (columnMap.has(alias.toLowerCase())) {
      return columnMap.get(alias.toLowerCase())
    }
  }
  return undefined
}

/** Get a string value from a raw row, trimmed */
function str(row: RawRow, key: string | undefined): string {
  if (!key) return ''
  return String(row[key] ?? '').trim()
}

/** Parse a number from a raw row cell; preserve negatives */
function num(row: RawRow, key: string | undefined): number | undefined {
  if (!key) return undefined
  const raw = String(row[key] ?? '').trim().replace(/,/g, '')
  if (raw === '' || raw === '-') return undefined
  const n = parseFloat(raw)
  return isNaN(n) ? undefined : n
}

/**
 * Parse date strings in formats:
 *   d/m/yyyy   →  common Thai export format
 *   dd/mm/yyyy
 *   yyyy-mm-dd  (ISO, pass-through)
 */
function parseDate(raw: string): { iso: string; y: number; m: number; d: number } | null {
  if (!raw) return null

  // Try ISO format first
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return { iso: raw.slice(0, 10), y: +y, m: +m, d: +d }
  }

  // Try d/m/yyyy or dd/mm/yyyy
  const dmyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    const mm = m.padStart(2, '0')
    const dd = d.padStart(2, '0')
    return { iso: `${y}-${mm}-${dd}`, y: +y, m: +m, d: +d }
  }

  return null
}

function getQuarter(monthNumber: number): string {
  if (monthNumber <= 3) return 'Q1'
  if (monthNumber <= 6) return 'Q2'
  if (monthNumber <= 9) return 'Q3'
  return 'Q4'
}

// ─── Main transformer ─────────────────────────────────────────────────────────

/**
 * Transform a batch of raw rows into SalesRecord[].
 *
 * @param headers  Array of column header strings from the file
 * @param rows     Array of raw row objects (header → cell value)
 * @returns        Cleaned SalesRecord array (bad rows silently dropped)
 */
export function transformRows(
  headers: string[],
  rows: RawRow[],
): SalesRecord[] {
  const colMap = buildColumnMap(headers)

  // Pre-resolve column keys for this file
  const C = Object.fromEntries(
    Object.entries(COL).map(([key, aliases]) => [key, resolveCol(aliases, colMap)]),
  ) as Record<keyof typeof COL, string | undefined>

  const records: SalesRecord[] = []

  for (const row of rows) {
    // Skip completely empty rows
    const vals = Object.values(row).map((v) => String(v).trim())
    if (vals.every((v) => v === '')) continue

    // Must have at least a posting date or a year
    const rawDate = str(row, C.postingDate)
    const rawYear = str(row, C.year)
    if (!rawDate && !rawYear) continue

    // Parse date
    let postingDateIso = ''
    let year = 0
    let monthNumber = 0
    let day: number | undefined

    const parsed = parseDate(rawDate)
    if (parsed) {
      postingDateIso = parsed.iso
      year = parsed.y
      monthNumber = parsed.m
      day = parsed.d
    } else {
      // Fall back to separate year/month/day columns
      year = parseInt(rawYear) || 0
      monthNumber = parseInt(str(row, C.month)) || 0
      day = parseInt(str(row, C.day)) || undefined
      if (year && monthNumber) {
        const mm = String(monthNumber).padStart(2, '0')
        const dd = day ? String(day).padStart(2, '0') : '01'
        postingDateIso = `${year}-${mm}-${dd}`
      }
    }

    // Override year/month from explicit columns if present and more reliable
    const explicitYear = parseInt(str(row, C.year))
    const explicitMonth = parseInt(str(row, C.month))
    if (explicitYear > 2000) year = explicitYear
    if (explicitMonth >= 1 && explicitMonth <= 12) monthNumber = explicitMonth

    if (!year || !monthNumber) continue

    const quarter = getQuarter(monthNumber)
    const month = MONTH_NAMES[monthNumber] ?? ''

    const branchCode = str(row, C.branch).toUpperCase() || 'UNKNOWN'
    const salespersonName = str(row, C.salespersonName) || str(row, C.salespersonCode) || 'Unknown'

    const netAmountRaw = num(row, C.netAmount)
    if (netAmountRaw === undefined) continue  // must have Amount

    const record: SalesRecord = {
      postingDate: postingDateIso,
      documentDate: parseDate(str(row, C.docDate))?.iso,
      orderDate: parseDate(str(row, C.orderDate))?.iso,
      year,
      quarter,
      month,
      monthNumber,
      day: (day ?? parseInt(str(row, C.day))) || undefined,

      branchCode,
      locationCode: str(row, C.location) || undefined,

      documentNo: str(row, C.docNo) || undefined,
      documentType: str(row, C.docType) || undefined,

      customerNo: str(row, C.customerNo) || undefined,
      customerCode: str(row, C.customerCode) || undefined,
      customerName: str(row, C.customerName) || undefined,
      customerGroupCode: str(row, C.customerGroupCode) || undefined,
      customerGroupName: str(row, C.customerGroupName) || undefined,

      salespersonCode: str(row, C.salespersonCode) || undefined,
      salespersonName,

      productCode: str(row, C.productCode) || undefined,
      productDescription: str(row, C.productDesc) || undefined,
      testCode: str(row, C.testCode) || undefined,
      description: str(row, C.description) || undefined,

      quantity: num(row, C.quantity),
      unitPrice: num(row, C.unitPrice),
      totalUnitPrice: num(row, C.totalUnitPrice),
      lineAmount: num(row, C.lineAmount),
      discountAmount: num(row, C.discountAmount),
      netAmount: netAmountRaw,
      grossAmount: num(row, C.grossAmount),
    }

    records.push(record)
  }

  return records
}
