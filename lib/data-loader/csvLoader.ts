/**
 * csvLoader.ts
 *
 * Parse a CSV File object in the browser using PapaParse, detect the real
 * header row, then return normalised SalesRecord[].
 */

import Papa from 'papaparse'
import { detectHeaderRowIndex, extractHeaders } from '@/lib/transformers/headerDetector'
import { transformRows } from '@/lib/transformers/recordTransformer'
import type { RawRow, SalesRecord } from '@/types'

export function loadCSV(file: File): Promise<SalesRecord[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: false, // keep empty rows so we can detect header position
      encoding: 'UTF-8',
      complete(result) {
        try {
          const rawRows = result.data as string[][]

          // Detect where the real header row is
          const headerIdx = detectHeaderRowIndex(rawRows)
          const headers = extractHeaders(rawRows, headerIdx)
          const dataRows = rawRows.slice(headerIdx + 1)

          // Convert 2-D array into keyed objects
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
      },
      error(err) {
        reject(err)
      },
    })
  })
}
