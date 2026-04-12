/**
 * excelLoader.ts
 *
 * Parse an Excel (.xlsx / .xls) File object using the `xlsx` library,
 * detect the real header row, then return normalised SalesRecord[].
 */

import * as XLSX from 'xlsx'
import { detectHeaderRowIndex, extractHeaders } from '@/lib/transformers/headerDetector'
import { transformRows } from '@/lib/transformers/recordTransformer'
import type { RawRow, SalesRecord } from '@/types'

export function loadExcel(file: File): Promise<SalesRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: false })

        // Use the first sheet
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Convert to 2-D array of strings (header:1 mode gives object array –
        // we want raw rows first so we can detect the header ourselves)
        const rawRows: string[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: false, // force string values
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

        resolve(transformRows(headers, keyedRows))
      } catch (err) {
        reject(err)
      }
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}
