/**
 * insightGenerator.ts
 *
 * Generates simple business insight text from the filtered dataset and KPIs.
 */

import type { DashboardFilters, Insight, KPISummary, SalesRecord } from '@/types'
import { branchRanking, monthlyTrend, salespersonRanking } from '@/lib/calculations/aggregations'
import { sumRevenue } from '@/lib/calculations/filterUtils'

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function pct(n: number | null): string {
  if (n === null) return 'N/A'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

export function generateInsights(
  filteredRecords: SalesRecord[],
  kpis: KPISummary,
  filters: DashboardFilters,
): Insight[] {
  const insights: Insight[] = []
  const metric = filters.revenueMetric

  if (filteredRecords.length === 0) {
    insights.push({
      type: 'neutral',
      title: 'No data for the current filter',
      body: 'Adjust the filters to see insights.',
    })
    return insights
  }

  // ── YoY growth ────────────────────────────────────────────────────────────
  if (kpis.yoyGrowth !== null) {
    const type = kpis.yoyGrowth >= 0 ? 'positive' : 'negative'
    insights.push({
      type,
      title: `Year-over-Year Revenue ${kpis.yoyGrowth >= 0 ? 'Growth' : 'Decline'}`,
      body: `Revenue is ${pct(kpis.yoyGrowth)} compared to the same period last year. Total: ${fmt(kpis.totalRevenue)}.`,
    })
  }

  // ── Top branch ────────────────────────────────────────────────────────────
  const branches = branchRanking(filteredRecords, metric)
  if (branches.length > 0) {
    const top = branches[0]
    insights.push({
      type: 'positive',
      title: `Top Branch: ${top.name}`,
      body: `${top.name} leads with ${fmt(top.revenue)} (${top.share.toFixed(1)}% share, ${top.count} transactions).`,
    })
    if (branches.length > 1) {
      const bottom = branches[branches.length - 1]
      insights.push({
        type: bottom.revenue < 0 ? 'warning' : 'neutral',
        title: `Lowest Branch: ${bottom.name}`,
        body: `${bottom.name} contributed ${fmt(bottom.revenue)} (${bottom.share.toFixed(1)}% share).${bottom.revenue < 0 ? ' Negative revenue — check for credit memos or returns.' : ''}`,
      })
    }
  }

  // ── Top salesperson ───────────────────────────────────────────────────────
  const salespeople = salespersonRanking(filteredRecords, metric)
  if (salespeople.length > 0) {
    const top = salespeople[0]
    insights.push({
      type: 'positive',
      title: `Top Salesperson: ${top.name}`,
      body: `${top.name} generated ${fmt(top.revenue)} (${top.share.toFixed(1)}% of period revenue).`,
    })
  }

  // ── Trend anomaly: biggest MoM spike or drop ──────────────────────────────
  const trend = monthlyTrend(filteredRecords, metric)
  if (trend.length >= 2) {
    let maxSpike = { label: '', delta: 0, pct: 0 }
    let maxDrop = { label: '', delta: 0, pct: 0 }
    for (let i = 1; i < trend.length; i++) {
      const prev = trend[i - 1].revenue
      const curr = trend[i].revenue
      if (prev === 0) continue
      const change = ((curr - prev) / Math.abs(prev)) * 100
      if (change > maxSpike.pct) maxSpike = { label: trend[i].label, delta: curr - prev, pct: change }
      if (change < maxDrop.pct) maxDrop = { label: trend[i].label, delta: curr - prev, pct: change }
    }
    if (maxSpike.pct > 30) {
      insights.push({
        type: 'positive',
        title: `Strongest Growth Month: ${maxSpike.label}`,
        body: `Revenue spiked ${pct(maxSpike.pct)} vs prior month (+${fmt(maxSpike.delta)}).`,
      })
    }
    if (maxDrop.pct < -30) {
      insights.push({
        type: 'warning',
        title: `Largest Decline Month: ${maxDrop.label}`,
        body: `Revenue dropped ${pct(maxDrop.pct)} vs prior month (${fmt(maxDrop.delta)}).`,
      })
    }
  }

  // ── Branch concentration risk ─────────────────────────────────────────────
  if (branches.length > 0 && branches[0].share > 60) {
    insights.push({
      type: 'warning',
      title: 'High Branch Concentration',
      body: `${branches[0].name} accounts for ${branches[0].share.toFixed(1)}% of revenue. Consider diversifying across branches.`,
    })
  }

  // ── Negative revenue alert ────────────────────────────────────────────────
  const totalRevenue = sumRevenue(filteredRecords, metric)
  if (totalRevenue < 0) {
    insights.push({
      type: 'warning',
      title: 'Net Revenue is Negative',
      body: `Total revenue is ${fmt(totalRevenue)} for the selected period. This may indicate credit memos or returns exceeding invoices.`,
    })
  }

  return insights
}
