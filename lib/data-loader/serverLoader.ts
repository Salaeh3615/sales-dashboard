/**
 * serverLoader.ts
 *
 * Server-side equivalents of csvLoader / excelLoader.  Accepts a filename and
 * a Buffer (raw file bytes) and returns parsed SalesRecord[].
 *
 * Used by the /api/import route which receives multipart/form-data uploads.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'

import {
  detectHeaderRowIndex,
  extractHeaders,
} from '@/lib/transformers/headerDetector'
import { transformRows } from '@/lib/transformers/recordTransformer'
import type { RawRow, SalesRecord } from '@/types'

// ─── CSV ─────────────────────────────────────────────────────────────────────

function parseCsvBuffer(buffer: Buffer): SalesRecord[] {
  // PapaParse returns arrays-of-arrays when no header option is set
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '') // strip BOM
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: false,
  })

  const rawRows = result.data as string[][]
  const headerIdx = detectHeaderRowIndex(rawRows)
  const headers = extractHeaders(rawRows, headerIdx)
  const dataRows = rawRows.slice(headerIdx + 1)

  const keyedRows: RawRow[] = dataRows.map((row) => {
    const obj: RawRow = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = String(row[i] ?? '').trim()
    })
    return obj
  })

  return transformRows(headers, keyedRows)
}

// ─── Excel ───────────────────────────────────────────────────────────────────

function parseExcelBuffer(buffer: Buffer): SalesRecord[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  const headerIdx = detectHeaderRowIndex(rawRows)
  const headers = extractHeaders(rawRows, headerIdx)
  const dataRows = rawRows.slice(headerIdx + 1)

  const keyedRows: RawRow[] = dataRows.map((row) => {
    const obj: RawRow = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = String(row[i] ?? '').trim()
    })
    return obj
  })

  return transformRows(headers, keyedRows)
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function parseFileBuffer(filename: string, buffer: Buffer): SalesRecord[] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) return parseCsvBuffer(buffer)
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return parseExcelBuffer(buffer)
  throw new Error(`Unsupported file type: ${filename}`)
}
