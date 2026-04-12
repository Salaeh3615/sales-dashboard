/**
 * GET /api/customers/lookup?q={searchTerm}
 *
 * Search for a customer by:
 *   - Bill-to Customer No_ (contains match)
 *   - CustomerCodeWinspeed (contains match)
 *   - Customer name (partial, case-insensitive)
 *
 * Two-pass implementation:
 *   Pass 1 — build lightweight profiles (O(records))
 *   Pass 2 — collect transactions only for matched customers (O(records))
 *
 * Returns matched customer profiles with:
 *   - Full profile details + revenueByYear
 *   - Up to 50 most-recent transactions
 *   - Status classification vs the latest year
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import {
  customerKey,
  normalizeName,
  classifyForYear,
} from '@/lib/calculations/customerClassification'
import type { SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], message: 'Query must be at least 2 characters' })
  }

  const records = await getAllRecords()
  const allYears = Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b)
  const latestYear = allYears[allYears.length - 1] ?? new Date().getFullYear()
  const qLower = q.toLowerCase()

  // ── Pass 1: build lightweight profiles ────────────────────────────────────
  type Profile = {
    key: string
    displayName: string
    customerNo?: string
    customerCode?: string
    customerGroupName?: string
    yearsActive: Set<number>
    lastActiveYear: number
    branches: Set<string>
    salespersons: Set<string>
    totalRevenue: number
    revenueByYear: Map<number, number>
  }

  const profiles = new Map<string, Profile>()

  for (const r of records) {
    const ck = customerKey(r)
    let p = profiles.get(ck)
    if (!p) {
      p = {
        key: ck,
        displayName: r.customerName ?? r.customerCode ?? r.customerNo ?? ck,
        customerNo: r.customerNo,
        customerCode: r.customerCode,
        customerGroupName: r.customerGroupName,
        yearsActive: new Set(),
        lastActiveYear: r.year,
        branches: new Set(),
        salespersons: new Set(),
        totalRevenue: 0,
        revenueByYear: new Map(),
      }
      profiles.set(ck, p)
    }
    p.yearsActive.add(r.year)
    if (r.year > p.lastActiveYear) p.lastActiveYear = r.year
    if (r.branchCode) p.branches.add(r.branchCode)
    if (r.salespersonName) p.salespersons.add(r.salespersonName)
    p.totalRevenue += r.netAmount
    p.revenueByYear.set(r.year, (p.revenueByYear.get(r.year) ?? 0) + r.netAmount)
    if (r.customerName && r.customerName.length > p.displayName.length) {
      p.displayName = r.customerName
    }
  }

  // ── Filter to matching profiles (up to 20) ─────────────────────────────────
  const matched: Profile[] = []
  for (const p of profiles.values()) {
    const no   = (p.customerNo   ?? '').toLowerCase()
    const code = (p.customerCode ?? '').toLowerCase()
    const name = p.displayName.toLowerCase()
    const norm = normalizeName(p.displayName)

    if (no.includes(qLower) || code.includes(qLower) || name.includes(qLower) || norm.includes(qLower)) {
      matched.push(p)
    }
    if (matched.length >= 20) break
  }

  // Sort by total revenue descending
  matched.sort((a, b) => b.totalRevenue - a.totalRevenue)

  // ── Pass 2: collect transactions only for matched customers ────────────────
  const matchedKeys = new Set(matched.map((p) => p.key))
  const txByKey = new Map<string, SalesRecord[]>()
  for (const ck of matchedKeys) txByKey.set(ck, [])

  for (const r of records) {
    const ck = customerKey(r)
    if (!matchedKeys.has(ck)) continue
    txByKey.get(ck)!.push(r)
  }

  // Sort and trim transactions per customer
  for (const [ck, arr] of txByKey) {
    arr.sort((a, b) => b.postingDate.localeCompare(a.postingDate))
    txByKey.set(ck, arr.slice(0, 50))
  }

  // ── Build response ────────────────────────────────────────────────────────
  const results = matched.map((p) => {
    const revenueByYear: Record<string, number> = {}
    for (const [yr, rev] of [...p.revenueByYear.entries()].sort(([a], [b]) => a - b)) {
      revenueByYear[String(yr)] = rev
    }

    const recentTransactions = (txByKey.get(p.key) ?? []).map((r) => ({
      postingDate: r.postingDate,
      year: r.year,
      documentNo: r.documentNo,
      documentType: r.documentType,
      branchCode: r.branchCode,
      salespersonName: r.salespersonName,
      description: r.description,
      quantity: r.quantity,
      netAmount: r.netAmount,
      grossAmount: r.grossAmount,
    }))

    return {
      key: p.key,
      displayName: p.displayName,
      customerNo: p.customerNo,
      customerCode: p.customerCode,
      customerGroupName: p.customerGroupName,
      yearsActive: [...p.yearsActive].sort((a, b) => a - b),
      lastActiveYear: p.lastActiveYear,
      branches: [...p.branches],
      salespersons: [...p.salespersons],
      totalRevenue: p.totalRevenue,
      revenueByYear,
      status: classifyForYear(p.yearsActive, latestYear),
      recentTransactions,
    }
  })

  return NextResponse.json({ results, total: matched.length, latestYear, allYears })
}
