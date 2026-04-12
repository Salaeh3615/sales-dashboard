/**
 * filterUtils.ts
 *
 * Pure functions for applying DashboardFilters to a SalesRecord array.
 */

import type { DashboardFilters, RevenueMetric, SalesRecord } from '@/types'

/**
 * The single source-of-truth revenue field used everywhere by default.
 * Maps to the `Amount` column in source Excel/CSV files (stored as `netAmount`
 * in SalesRecord).  All KPIs, charts, rankings, and comparisons use this field
 * unless the user explicitly overrides it in the filter panel.
 */
export const DEFAULT_REVENUE_METRIC: RevenueMetric = 'netAmount'

export function applyFilters(
  records: SalesRecord[],
  filters: DashboardFilters,
): SalesRecord[] {
  return records.filter((r) => {
    if (filters.years.length && !filters.years.includes(r.year)) return false
    if (filters.quarters.length && !filters.quarters.includes(r.quarter)) return false
    if (filters.months.length && !filters.months.includes(r.monthNumber)) return false
    if (filters.branches.length && !filters.branches.includes(r.branchCode)) return false
    if (
      filters.salespersons.length &&
      !filters.salespersons.includes(r.salespersonName)
    )
      return false
    if (
      filters.documentTypes.length &&
      r.documentType &&
      !filters.documentTypes.includes(r.documentType)
    )
      return false
    if (
      filters.customerGroups.length &&
      r.customerGroupName &&
      !filters.customerGroups.includes(r.customerGroupName)
    )
      return false
    return true
  })
}

/** Get the revenue value based on the selected metric */
export function getRevenue(
  record: SalesRecord,
  metric: DashboardFilters['revenueMetric'],
): number {
  switch (metric) {
    case 'grossAmount':
      return record.grossAmount ?? record.netAmount
    case 'lineAmount':
      return record.lineAmount ?? record.netAmount
    default:
      return record.netAmount
  }
}

/** Sum revenue of a record set */
export function sumRevenue(
  records: SalesRecord[],
  metric: DashboardFilters['revenueMetric'],
): number {
  return records.reduce((acc, r) => acc + getRevenue(r, metric), 0)
}
