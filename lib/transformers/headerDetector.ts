/**
 * headerDetector.ts
 *
 * Finds the real header row in files that may contain title / intro rows
 * before the actual column headers. Works for both CSV (string[][]) and
 * Excel (any[][]) inputs.
 *
 * Strategy: scan rows from the top; the first row whose first non-empty cell
 * matches one of the known header keywords is treated as the header row.
 */

/** Keywords that must appear in the real header row */
const HEADER_KEYWORDS = [
  'shortcut dimension 1 code',
  'posting date',
  'salesperson code',
  'bill-to name',
  'sale person name',
  'amount',
]

/**
 * Given a 2-D array of rows, return the index of the first row that looks
 * like the real column-header row.  Falls back to 0 if none found.
 */
export function detectHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const rowText = rows[i]
      .map((c) => String(c ?? '').toLowerCase().trim())
      .join(' ')

    const matches = HEADER_KEYWORDS.filter((kw) => rowText.includes(kw))
    if (matches.length >= 2) return i
  }
  return 0
}

/**
 * Given a 2-D array of rows and a known header row index, return an array of
 * header column names (trimmed strings).
 */
export function extractHeaders(
  rows: string[][],
  headerRowIndex: number,
): string[] {
  return (rows[headerRowIndex] ?? []).map((c) => String(c ?? '').trim())
}

/**
 * Slice out only the data rows (after the header row).
 */
export function extractDataRows(
  rows: string[][],
  headerRowIndex: number,
): string[][] {
  return rows.slice(headerRowIndex + 1)
}
