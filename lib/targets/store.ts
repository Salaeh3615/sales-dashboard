/**
 * store.ts — In-memory cache of target data.
 *
 * First call parses all CSV files from disk.  Subsequent calls return the cached
 * rows.  Use `reloadTargets()` after files are updated on disk.
 */

import { loadAllTargets, type TargetRow } from './parser'

let _cache: TargetRow[] | null = null

export function getAllTargets(): TargetRow[] {
  if (_cache) return _cache
  _cache = loadAllTargets()
  return _cache
}

export function reloadTargets(): TargetRow[] {
  _cache = loadAllTargets()
  return _cache
}

/**
 * Get target rows for a specific year, optionally filtered to branch-level
 * rows only (excluding HO subdivisions) or subdivisions only.
 */
export function getTargetsForYear(
  year: number,
  opts: { branchOnly?: boolean; subdivisionsOnly?: boolean } = {},
): TargetRow[] {
  const rows = getAllTargets().filter((r) => r.year === year)
  if (opts.branchOnly) return rows.filter((r) => !r.subdivision)
  if (opts.subdivisionsOnly) return rows.filter((r) => !!r.subdivision)
  return rows
}

/**
 * Resolve the branch-level target (array of 12 monthly values + total).
 *
 * For 2026 HO, the branch row is missing — we synthesise it by summing all
 * subdivisions.  For 2023–2025, the explicit HO branch row is used.
 */
export function getBranchTarget(
  year: number,
  branchCode: string,
): { monthly: number[]; total: number } {
  const rows = getAllTargets().filter((r) => r.year === year && r.branchCode === branchCode)
  const branchRow = rows.find((r) => !r.subdivision)
  if (branchRow) return { monthly: branchRow.monthlyTargets, total: branchRow.total }

  // Synthesise from subdivisions (2026 HO case)
  const subs = rows.filter((r) => r.subdivision)
  if (subs.length === 0) return { monthly: new Array(12).fill(0), total: 0 }
  const monthly = new Array(12).fill(0)
  let total = 0
  for (const s of subs) {
    for (let i = 0; i < 12; i++) monthly[i] += s.monthlyTargets[i]
    total += s.total
  }
  return { monthly, total }
}

export function getAllBranchCodesWithTargets(year: number): string[] {
  const set = new Set<string>()
  for (const r of getAllTargets()) {
    if (r.year === year) set.add(r.branchCode)
  }
  return [...set].sort()
}

export function getAvailableTargetYears(): number[] {
  const set = new Set<number>()
  for (const r of getAllTargets()) set.add(r.year)
  return [...set].sort()
}
