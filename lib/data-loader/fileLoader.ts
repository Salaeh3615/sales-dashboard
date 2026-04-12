/**
 * fileLoader.ts
 *
 * Entry point: accepts a File and dispatches to the correct loader.
 * Also provides a helper to merge multiple file loads into one dataset.
 */

import { loadCSV } from './csvLoader'
import { loadExcel } from './excelLoader'
import type { SalesRecord } from '@/types'

export async function loadFile(file: File): Promise<SalesRecord[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) return loadCSV(file)
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return loadExcel(file)
  throw new Error(`Unsupported file type: ${file.name}`)
}

/**
 * Load multiple files and merge all records into one sorted array.
 * Deduplication is intentionally NOT applied – the same invoice appearing in
 * multiple files is allowed; the user controls which files to load.
 */
export async function loadFiles(files: File[]): Promise<SalesRecord[]> {
  const chunks = await Promise.all(files.map(loadFile))
  const all = chunks.flat()
  // Sort ascending by posting date
  all.sort((a, b) => a.postingDate.localeCompare(b.postingDate))
  return all
}

/** Derive all unique filter option values from a dataset */
export function deriveFilterOptions(records: SalesRecord[]) {
  const years = [...new Set(records.map((r) => r.year))].sort((a, b) => a - b)
  const quarters = [...new Set(records.map((r) => r.quarter))].sort()
  const monthSet = new Map<number, string>()
  records.forEach((r) => monthSet.set(r.monthNumber, r.month))
  const months = [...monthSet.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, name]) => ({ number, name }))
  const branches = [...new Set(records.map((r) => r.branchCode))].sort()
  const salespersons = [...new Set(records.map((r) => r.salespersonName))].sort()
  const documentTypes = [
    ...new Set(records.map((r) => r.documentType).filter(Boolean) as string[]),
  ].sort()
  const customerGroups = [
    ...new Set(records.map((r) => r.customerGroupName).filter(Boolean) as string[]),
  ].sort()

  return { years, quarters, months, branches, salespersons, documentTypes, customerGroups }
}
