/**
 * insightGenerator.ts
 *
 * Generates business insight cards from the filtered dataset + KPIs.
 * Covers:
 *   - YoY / QoQ / MoM growth
 *   - Top / bottom branch and salesperson
 *   - Trend anomalies (spikes / drops) with root-cause attribution
 *   - Branch concentration risk
 *   - Negative revenue (credit memo) alert
 *   - Customer movement warnings
 *   - Test / product code alerts
 *   - Revenue driver decomposition (what caused the change)
 */

import type { DashboardFilters, Insight, KPISummary, SalesRecord } from '@/types'
import {
  branchRanking,
  monthlyTrend,
  salespersonRanking,
  testCodeRanking,
  customerGroupRanking,
  documentTypeBreakdown,
  revenueWaterfall,
} from '@/lib/calculations/aggregations'
import { sumRevenue } from '@/lib/calculations/filterUtils'

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function pct(n: number | null): string {
  if (n === null) return 'N/A'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  // ── 1. YoY growth ─────────────────────────────────────────────────────────
  if (kpis.yoyGrowth !== null) {
    const type = kpis.yoyGrowth >= 5 ? 'positive' : kpis.yoyGrowth <= -5 ? 'negative' : 'neutral'
    insights.push({
      type,
      title: `Year-over-Year Revenue ${kpis.yoyGrowth >= 0 ? 'Growth' : 'Decline'}: ${pct(kpis.yoyGrowth)}`,
      body: `Total revenue is ${fmt(kpis.totalRevenue)}. ${
        Math.abs(kpis.yoyGrowth) < 5 ? 'Revenue is relatively flat compared to the same period last year.' :
        kpis.yoyGrowth > 0
          ? `Strong growth of ${pct(kpis.yoyGrowth)} vs same period last year.`
          : `Revenue fell ${pct(kpis.yoyGrowth)} vs same period last year — investigate root causes below.`
      }`,
    })
  }

  // ── 2. QoQ growth ─────────────────────────────────────────────────────────
  if (kpis.qoqGrowth !== null && Math.abs(kpis.qoqGrowth) >= 10) {
    insights.push({
      type: kpis.qoqGrowth >= 0 ? 'positive' : 'warning',
      title: `Quarter-over-Quarter: ${pct(kpis.qoqGrowth)}`,
      body: `Revenue ${kpis.qoqGrowth >= 0 ? 'grew' : 'fell'} ${pct(kpis.qoqGrowth)} vs the previous quarter.`,
    })
  }

  // ── 3. MoM growth ─────────────────────────────────────────────────────────
  if (kpis.momGrowth !== null && Math.abs(kpis.momGrowth) >= 15) {
    insights.push({
      type: kpis.momGrowth >= 0 ? 'positive' : 'warning',
      title: `Month-over-Month: ${pct(kpis.momGrowth)}`,
      body: `Revenue ${kpis.momGrowth >= 0 ? 'grew' : 'fell'} ${pct(kpis.momGrowth)} vs the previous month.`,
    })
  }

  // ── 4. Top & bottom branch ────────────────────────────────────────────────
  const branches = branchRanking(filteredRecords, metric)
  if (branches.length > 0) {
    const top = branches[0]
    insights.push({
      type: 'positive',
      title: `Top Branch: ${top.name}`,
      body: `${top.name} leads with ${fmt(top.revenue)} (${top.share.toFixed(1)}% share, ${top.count.toLocaleString()} transactions).`,
    })
    if (branches.length > 1) {
      const bottom = branches[branches.length - 1]
      insights.push({
        type: bottom.revenue < 0 ? 'warning' : 'neutral',
        title: `Lowest Branch: ${bottom.name}`,
        body: `${bottom.name} contributed ${fmt(bottom.revenue)} (${bottom.share.toFixed(1)}% share).${
          bottom.revenue < 0 ? ' Negative revenue — likely credit memos exceed invoices for this branch.' : ''
        }`,
      })
    }
  }

  // ── 5. Top salesperson ────────────────────────────────────────────────────
  const salespeople = salespersonRanking(filteredRecords, metric)
  if (salespeople.length > 0) {
    const top = salespeople[0]
    insights.push({
      type: 'positive',
      title: `Top Salesperson: ${top.name}`,
      body: `${top.name} generated ${fmt(top.revenue)} (${top.share.toFixed(1)}% of period revenue, ${top.count.toLocaleString()} transactions).`,
    })
    // Concentration warning for top salesperson
    if (top.share > 40 && salespeople.length > 3) {
      insights.push({
        type: 'warning',
        title: `Salesperson Concentration Risk`,
        body: `${top.name} accounts for ${top.share.toFixed(1)}% of revenue. High dependency on a single salesperson poses a retention risk.`,
      })
    }
  }

  // ── 6. Top test code ──────────────────────────────────────────────────────
  const tests = testCodeRanking(filteredRecords, metric)
  if (tests.length > 0) {
    const top = tests[0]
    if (top.name !== '(no code)') {
      insights.push({
        type: 'positive',
        title: `Top Test Code: ${top.name}`,
        body: `"${top.name}" is the highest-revenue test: ${fmt(top.revenue)} (${top.share.toFixed(1)}% of revenue, ${top.count.toLocaleString()} transactions).`,
      })
    }
    // Test concentration
    if (tests.length > 1 && top.share > 50) {
      insights.push({
        type: 'warning',
        title: `Test Code Concentration: ${top.share.toFixed(1)}% in one code`,
        body: `Over half of revenue comes from test "${top.name}". A drop in demand for this test would have a major impact.`,
      })
    }
  }

  // ── 7. Customer group insight ─────────────────────────────────────────────
  const groups = customerGroupRanking(filteredRecords, metric)
  if (groups.length > 1 && groups[0].name !== '(no group)') {
    insights.push({
      type: 'neutral',
      title: `Top Customer Group: ${groups[0].name}`,
      body: `"${groups[0].name}" generates ${fmt(groups[0].revenue)} (${groups[0].share.toFixed(1)}% share). ${
        groups.length === 1 ? '' : `Second largest: "${groups[1].name}" at ${groups[1].share.toFixed(1)}%.`
      }`,
    })
  }

  // ── 8. Trend anomaly: biggest MoM spike or drop ───────────────────────────
  const trend = monthlyTrend(filteredRecords, metric)
  if (trend.length >= 3) {
    let maxSpike = { label: '', delta: 0, pct: 0 }
    let maxDrop  = { label: '', delta: 0, pct: 0 }
    for (let i = 1; i < trend.length; i++) {
      const prev = trend[i - 1].revenue
      const curr = trend[i].revenue
      if (prev === 0) continue
      const change = ((curr - prev) / Math.abs(prev)) * 100
      if (change > maxSpike.pct) maxSpike = { label: trend[i].label, delta: curr - prev, pct: change }
      if (change < maxDrop.pct)  maxDrop  = { label: trend[i].label, delta: curr - prev, pct: change }
    }

    if (maxSpike.pct > 25) {
      // Find which branches drove the spike
      const spikeMonth = maxSpike.label  // "YYYY-MM"
      const [sy, sm] = spikeMonth.split('-').map(Number)
      const spikeRecs = filteredRecords.filter((r) => r.year === sy && r.monthNumber === sm)
      const spikeBranches = branchRanking(spikeRecs, metric).slice(0, 2).map((b) => `${b.name} (${fmt(b.revenue)})`)
      insights.push({
        type: 'positive',
        title: `Revenue Spike in ${maxSpike.label}: ${pct(maxSpike.pct)}`,
        body: `Revenue jumped ${pct(maxSpike.pct)} MoM (+${fmt(maxSpike.delta)}). Top contributors that month: ${spikeBranches.join(', ')}.`,
      })
    }

    if (maxDrop.pct < -25) {
      // Find which branches drove the drop
      const dropMonth = maxDrop.label
      const [dy, dm] = dropMonth.split('-').map(Number)
      const dropRecs = filteredRecords.filter((r) => r.year === dy && r.monthNumber === dm)
      const dropBranches = branchRanking(dropRecs, metric).slice(0, 2).map((b) => `${b.name} (${fmt(b.revenue)})`)
      const prevMonthIdx = trend.findIndex((t) => t.label === dropMonth) - 1
      const prevRecs = prevMonthIdx >= 0
        ? filteredRecords.filter((r) => {
            const [py, pm] = trend[prevMonthIdx].label.split('-').map(Number)
            return r.year === py && r.monthNumber === pm
          })
        : []
      const prevBranches = prevRecs.length > 0
        ? branchRanking(prevRecs, metric).slice(0, 2).map((b) => b.name)
        : []
      const missingBranches = prevBranches.filter((b) => !dropBranches.map((d) => d.split(' ')[0]).includes(b))
      insights.push({
        type: 'warning',
        title: `Revenue Drop in ${maxDrop.label}: ${pct(maxDrop.pct)}`,
        body: `Revenue fell ${pct(maxDrop.pct)} MoM (${fmt(maxDrop.delta)}).${
          dropBranches.length > 0 ? ` Active branches: ${dropBranches.join(', ')}.` : ''
        }${missingBranches.length > 0 ? ` Branches that had revenue prior month but not this month: ${missingBranches.join(', ')}.` : ''}`,
      })
    }
  }

  // ── 9. Revenue waterfall (YoY driver decomposition) ───────────────────────
  const allYears = [...new Set(filteredRecords.map((r) => r.year))].sort((a, b) => a - b)
  if (allYears.length >= 2) {
    const prevYear = allYears[allYears.length - 2]
    const currYear = allYears[allYears.length - 1]
    const prevRecs = filteredRecords.filter((r) => r.year === prevYear)
    const currRecs = filteredRecords.filter((r) => r.year === currYear)
    const waterfall = revenueWaterfall(prevRecs, currRecs, metric)

    const base = waterfall.find((w) => w.type === 'base')
    const newC = waterfall.find((w) => w.label === 'New Customers')
    const grown = waterfall.find((w) => w.label === 'Existing ↑')
    const shrunk = waterfall.find((w) => w.label === 'Existing ↓')
    const lost = waterfall.find((w) => w.label === 'Lost Customers')
    const curr = waterfall.find((w) => w.type === 'total')

    if (base && curr) {
      const netChange = curr.value - base.value
      const drivers: string[] = []
      if (newC && newC.value > 0)    drivers.push(`new customers +${fmt(newC.value)}`)
      if (grown && grown.value > 0)  drivers.push(`existing growth +${fmt(grown.value)}`)
      if (shrunk && shrunk.value < 0) drivers.push(`existing decline ${fmt(shrunk.value)}`)
      if (lost && lost.value < 0)    drivers.push(`lost customers ${fmt(lost.value)}`)

      insights.push({
        type: netChange >= 0 ? 'positive' : 'warning',
        title: `Revenue Bridge ${prevYear}→${currYear}: ${netChange >= 0 ? '+' : ''}${fmt(netChange)} (${pct((netChange / Math.abs(base.value)) * 100)})`,
        body: drivers.length > 0
          ? `Drivers: ${drivers.join(' | ')}.`
          : `No significant customer-level changes detected between the two periods.`,
      })
    }
  }

  // ── 10. Credit memo / return alert ────────────────────────────────────────
  const docTypes = documentTypeBreakdown(filteredRecords, metric)
  const invoiceDoc = docTypes.find((d) => /invoice/i.test(d.type))
  const creditDoc  = docTypes.find((d) => /credit/i.test(d.type))
  if (invoiceDoc && creditDoc) {
    const creditRate = (Math.abs(creditDoc.revenue) / Math.abs(invoiceDoc.revenue)) * 100
    if (creditRate > 5) {
      insights.push({
        type: creditRate > 15 ? 'warning' : 'neutral',
        title: `Credit Memo Rate: ${creditRate.toFixed(1)}%`,
        body: `Credit memos total ${fmt(creditDoc.revenue)} against ${fmt(invoiceDoc.revenue)} in invoices.${
          creditRate > 15
            ? ' This is significantly above normal. Investigate for billing errors, returns, or service disputes.'
            : ' Monitor for further increases.'
        }`,
      })
    }
  }

  // ── 11. Branch concentration risk ────────────────────────────────────────
  if (branches.length > 0 && branches[0].share > 60) {
    insights.push({
      type: 'warning',
      title: 'High Branch Concentration',
      body: `${branches[0].name} accounts for ${branches[0].share.toFixed(1)}% of revenue. Revenue is highly dependent on a single branch.`,
    })
  }

  // ── 12. Negative net revenue alert ────────────────────────────────────────
  const totalRevenue = sumRevenue(filteredRecords, metric)
  if (totalRevenue < 0) {
    insights.push({
      type: 'warning',
      title: 'Net Revenue is Negative',
      body: `Total revenue is ${fmt(totalRevenue)} for the selected period. Credit memos or returns are exceeding invoiced amounts.`,
    })
  }

  return insights
}
