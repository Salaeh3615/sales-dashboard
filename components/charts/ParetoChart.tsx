'use client'

/**
 * ParetoChart — bar + cumulative % line (combo chart).
 * Classic 80/20 decomposition: bars show revenue per entity, line shows
 * cumulative % of total, reference line at 80%.
 */

import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import type { ParetoRow } from '@/lib/calculations/insights'

interface Props {
  rows: ParetoRow[]
  title?: string
  dimension?: string          // display name e.g. "test codes"
  top20PctShare?: number
  top20Count?: number
  totalCount?: number
}

function fmtMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}
function fmtYRev(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function ParetoChart({
  rows, title = 'Pareto analysis', dimension = 'items',
  top20PctShare, top20Count, totalCount,
}: Props) {
  // Highlight bars that fall within the 80% cumulative band
  const vital = rows.map((r) => r.cumulative <= 80)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
            <h3 className="text-sm font-bold text-navy-900">{title}</h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Gold bars = &quot;vital few&quot; that make up 80% of revenue
          </p>
        </div>
        {top20PctShare !== undefined && top20Count !== undefined && totalCount !== undefined && (
          <div className="text-right bg-gold-50 border border-gold-200 rounded-lg px-3 py-1.5">
            <p className="text-[10px] text-gold-700 font-semibold uppercase tracking-wider">
              Top 20% of {dimension}
            </p>
            <p className="text-base font-bold text-navy-900 font-num">
              {top20PctShare.toFixed(1)}% of revenue
            </p>
            <p className="text-[9px] text-slate-500">
              {top20Count.toLocaleString()} of {totalCount.toLocaleString()} items
            </p>
          </div>
        )}
      </div>

      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#475569' }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={fmtYRev}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v: number | string, name: string) => {
                const n = Number(v)
                if (name === 'Cumulative %') return [`${n.toFixed(1)}%`, 'Cumulative %']
                return [fmtMoney(n), 'Revenue']
              }}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
              {rows.map((_, i) => (
                <Cell key={i} fill={vital[i] ? '#FFCC00' : '#1c6c4c'} />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumulative"
              name="Cumulative %"
              stroke="#0a3d2a"
              strokeWidth={2}
              dot={{ r: 3, fill: '#0a3d2a' }}
              activeDot={{ r: 5 }}
            />
            <ReferenceLine
              yAxisId="right"
              y={80}
              stroke="#dc2626"
              strokeDasharray="4 3"
              label={{ value: '80%', position: 'right', fontSize: 10, fill: '#dc2626' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
