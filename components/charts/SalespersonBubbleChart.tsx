'use client'

/**
 * SalespersonBubbleChart — behavioural quadrant:
 *   x: transactions (volume)
 *   y: avg deal size (value)
 *   bubble size: total revenue
 *   color: discount %
 *
 * Four quadrants emerge:
 *   High volume + High deal  → Star
 *   High volume + Low deal   → Farmer
 *   Low volume + High deal   → Hunter
 *   Low volume + Low deal    → Needs coaching
 */

import { useMemo } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ZAxis, ReferenceLine, Cell,
} from 'recharts'
import type { SalespersonBubble } from '@/lib/calculations/insights'

function fmtMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

// Discount % → emerald (low) → gold (high)
function discountColor(pct: number): string {
  const clamped = Math.max(0, Math.min(50, pct))
  if (clamped < 5)  return '#0a3d2a'  // emerald 900
  if (clamped < 10) return '#1c6c4c'  // emerald 600
  if (clamped < 15) return '#4ba078'  // emerald 400
  if (clamped < 20) return '#d9a900'  // gold 600
  if (clamped < 30) return '#FFCC00'  // gold 500
  return '#b91c1c'                     // red = heavy discounter
}

export function SalespersonBubbleChart({ data }: { data: SalespersonBubble[] }) {
  const medians = useMemo(() => {
    if (data.length === 0) return { x: 0, y: 0 }
    const sortedX = [...data].sort((a, b) => a.transactions - b.transactions)
    const sortedY = [...data].sort((a, b) => a.avgDealSize - b.avgDealSize)
    const mid = Math.floor(data.length / 2)
    return {
      x: sortedX[mid]?.transactions ?? 0,
      y: sortedY[mid]?.avgDealSize ?? 0,
    }
  }, [data])

  // cap at top 50 to avoid chart overload
  const chartData = data.slice(0, 50).map((s) => ({
    x: s.transactions,
    y: s.avgDealSize,
    z: s.revenue,
    name: s.name,
    discountPct: s.discountPct,
    customers: s.customerCount,
  }))

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
          <div>
            <h3 className="text-sm font-bold text-navy-900">Salesperson Behaviour · Farmer vs Hunter</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              X: volume · Y: avg deal size · Size: total revenue · Color: discount %
            </p>
          </div>
        </div>
      </div>

      {/* Quadrant labels */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 text-[10px]"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-navy-700"><strong>Star</strong> (high vol + high deal)</span></div>
        <div className="flex items-center gap-2 text-[10px]"><div className="w-2 h-2 rounded-full bg-gold-500" /><span className="text-navy-700"><strong>Hunter</strong> (low vol + high deal)</span></div>
        <div className="flex items-center gap-2 text-[10px]"><div className="w-2 h-2 rounded-full bg-sky-500" /><span className="text-navy-700"><strong>Farmer</strong> (high vol + low deal)</span></div>
        <div className="flex items-center gap-2 text-[10px]"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-navy-700"><strong>Coach</strong> (low vol + low deal)</span></div>
      </div>

      <div className="w-full h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="x"
              name="Transactions"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              label={{ value: 'Transactions (volume)', position: 'bottom', fontSize: 10, fill: '#64748b', offset: 10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Avg deal"
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                return String(v)
              }}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              label={{ value: 'Avg deal size', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
            />
            <ZAxis type="number" dataKey="z" range={[60, 800]} name="Revenue" />
            <ReferenceLine x={medians.x} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={medians.y} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const p = payload[0].payload as {
                  name: string; x: number; y: number; z: number; discountPct: number; customers: number
                }
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs">
                    <p className="font-semibold text-navy-900">{p.name}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 font-num text-slate-600">
                      <span>Revenue:</span><span>{fmtMoney(p.z)}</span>
                      <span>Transactions:</span><span>{p.x.toLocaleString()}</span>
                      <span>Avg deal:</span><span>{fmtMoney(p.y)}</span>
                      <span>Discount %:</span><span>{p.discountPct.toFixed(1)}%</span>
                      <span>Customers:</span><span>{p.customers}</span>
                    </div>
                  </div>
                )
              }}
            />
            <Scatter data={chartData}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={discountColor(d.discountPct)} fillOpacity={0.75} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 justify-end">
        <span>Discount:</span>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-navy-900" /><span>&lt;5%</span>
          <span className="w-2 h-2 rounded-full bg-navy-400 ml-1" /><span>5-15%</span>
          <span className="w-2 h-2 rounded-full bg-gold-500 ml-1" /><span>15-30%</span>
          <span className="w-2 h-2 rounded-full bg-red-700 ml-1" /><span>&gt;30%</span>
        </div>
      </div>
    </div>
  )
}
