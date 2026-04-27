'use client'

/**
 * WaterfallChart — Revenue Bridge / Waterfall Chart
 *
 * Shows how revenue changed from prior period to current period,
 * broken down by driver: New customers, Existing↑, Existing↓, Lost customers.
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, ReferenceLine,
} from 'recharts'
import type { WaterfallBar } from '@/lib/calculations/aggregations'
import { CLT_AXIS, fmtY, fmtCurrency } from '@/lib/chartTheme'

const TYPE_COLORS: Record<WaterfallBar['type'], string> = {
  base:     '#0a3d2a', // emerald 900 (baseline)
  positive: '#10b981', // emerald (growth)
  negative: '#ef4444', // red (decline)
  total:    '#FFCC00', // gold (current total)
}

type CustomTooltipProps = {
  active?: boolean
  payload?: { payload: WaterfallBar & { displayValue: number } }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const sign = d.type === 'negative' ? '' : d.type === 'positive' ? '+' : ''
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-card text-xs">
      <p className="font-semibold text-navy-900 mb-1">{d.label}</p>
      <p className={
        d.type === 'negative' ? 'text-red-600'
        : d.type === 'positive' ? 'text-emerald-600'
        : d.type === 'total' ? 'text-gold-600 font-semibold'
        : 'text-navy-900'
      }>
        {sign}{fmtCurrency(d.value)}
      </p>
    </div>
  )
}

export function WaterfallChart({ data }: { data: WaterfallBar[] }) {
  // Transform for recharts: use a stacked bar with invisible + visible parts
  const chartData = data.map((d) => {
    const isNeg = d.type === 'negative'
    const absVal = Math.abs(d.value)
    return {
      ...d,
      displayValue: absVal,
      // invisible spacer to float the bar
      spacer: d.type === 'total' ? 0 : isNeg ? d.start + d.value : d.start,
      barValue: absVal,
    }
  })

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <p className="text-sm font-semibold text-navy-900 mb-1">Revenue Bridge Analysis</p>
      <p className="text-xs text-slate-400 mb-4">What drove the change between periods</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={CLT_AXIS.tickLine}
            axisLine={CLT_AXIS.axisLine}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={CLT_AXIS.tick}
            tickLine={CLT_AXIS.tickLine}
            axisLine={CLT_AXIS.axisLine}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#e2e8f0" />
          {/* Invisible spacer bar */}
          <Bar dataKey="spacer" stackId="a" fill="transparent" />
          {/* Visible colored bar */}
          <Bar dataKey="barValue" stackId="a" radius={[6, 6, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={TYPE_COLORS[d.type]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 justify-center">
        {(
          [
            { type: 'base',     label: 'Prior Period' },
            { type: 'positive', label: 'Growth drivers' },
            { type: 'negative', label: 'Decline drivers' },
            { type: 'total',    label: 'Current Period' },
          ] as { type: WaterfallBar['type']; label: string }[]
        ).map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: TYPE_COLORS[type] }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
