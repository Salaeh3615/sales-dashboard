'use client'

/**
 * RFMMatrix — customer segmentation visualised as:
 *  - 7 segment cards (Champions, Loyal, Potential, New, At Risk, Hibernating, Lost)
 *  - Scatter plot Recency × Frequency, bubble size = Monetary
 */

import { useState } from 'react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ZAxis, Cell,
} from 'recharts'
import type { RFMCustomer, RFMSegment } from '@/lib/calculations/insights'

interface Props {
  customers: RFMCustomer[]
  summary: { segment: RFMSegment; count: number; revenue: number }[]
}

const SEG_CONFIG: Record<RFMSegment, { color: string; bg: string; text: string; desc: string }> = {
  Champions:   { color: '#059669', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', desc: 'Best customers — high R, F, M' },
  Loyal:       { color: '#0891b2', bg: 'bg-cyan-50 border-cyan-200',       text: 'text-cyan-800',    desc: 'Buy often, recent' },
  Potential:   { color: '#0ea5e9', bg: 'bg-sky-50 border-sky-200',         text: 'text-sky-800',     desc: 'Recent with moderate value' },
  New:         { color: '#FFCC00', bg: 'bg-gold-50 border-gold-200',       text: 'text-gold-800',    desc: 'First-time buyers to nurture' },
  'At Risk':   { color: '#ea580c', bg: 'bg-orange-50 border-orange-200',   text: 'text-orange-800',  desc: 'Were loyal, slipping away' },
  Hibernating: { color: '#78716c', bg: 'bg-stone-50 border-stone-200',     text: 'text-stone-700',   desc: 'Inactive but valuable history' },
  Lost:        { color: '#991b1b', bg: 'bg-red-50 border-red-200',         text: 'text-red-800',     desc: 'Long gone, low spend' },
}

function fmtMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

export function RFMMatrix({ customers, summary }: Props) {
  const [activeSeg, setActiveSeg] = useState<RFMSegment | 'all'>('all')

  const totalCustomers = summary.reduce((s, g) => s + g.count, 0)
  const totalRevenue = summary.reduce((s, g) => s + g.revenue, 0)

  const filtered = activeSeg === 'all'
    ? customers
    : customers.filter((c) => c.segment === activeSeg)

  // Prepare scatter: cap recency at 365 for visualisation
  const scatterData = filtered.slice(0, 400).map((c) => ({
    x: Math.min(c.recencyDays, 365),
    y: c.frequency,
    z: c.monetary,
    name: c.name,
    segment: c.segment,
  }))

  return (
    <div className="space-y-4">
      {/* Segment cards */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-2">
        <SegBtn
          active={activeSeg === 'all'}
          onClick={() => setActiveSeg('all')}
          label="All"
          color="#0a3d2a"
          bg="bg-navy-50 border-navy-200"
          text="text-navy-900"
          count={totalCustomers}
          revenue={totalRevenue}
          totalCust={totalCustomers}
          totalRev={totalRevenue}
        />
        {summary.map((g) => {
          const cfg = SEG_CONFIG[g.segment]
          return (
            <SegBtn
              key={g.segment}
              active={activeSeg === g.segment}
              onClick={() => setActiveSeg(g.segment)}
              label={g.segment}
              color={cfg.color}
              bg={cfg.bg}
              text={cfg.text}
              count={g.count}
              revenue={g.revenue}
              totalCust={totalCustomers}
              totalRev={totalRevenue}
            />
          )
        })}
      </div>

      {/* Scatter plot */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
            <h3 className="text-sm font-bold text-navy-900">
              RFM Scatter · Recency × Frequency
              {activeSeg !== 'all' && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  filtered to <span className="font-semibold" style={{ color: SEG_CONFIG[activeSeg].color }}>
                    {activeSeg}
                  </span>
                </span>
              )}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500">
            Bubble size = monetary · showing top {scatterData.length} customers
          </p>
        </div>

        <div className="w-full h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                type="number"
                dataKey="x"
                name="Recency (days)"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                label={{ value: 'Recency (days ago) — lower = more recent', position: 'bottom', fontSize: 10, fill: '#64748b', offset: 10 }}
                reversed
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Frequency"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                label={{ value: 'Frequency (transactions)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748b' }}
              />
              <ZAxis type="number" dataKey="z" range={[30, 600]} name="Monetary" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const p = payload[0].payload as { name: string; x: number; y: number; z: number; segment: RFMSegment }
                  return (
                    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs">
                      <p className="font-semibold text-navy-900">{p.name}</p>
                      <p className="text-slate-600 mt-0.5">Segment: <span className="font-semibold" style={{ color: SEG_CONFIG[p.segment].color }}>{p.segment}</span></p>
                      <p className="text-slate-600 font-num">Recency: {p.x} days</p>
                      <p className="text-slate-600 font-num">Frequency: {p.y} txn</p>
                      <p className="text-slate-600 font-num">Monetary: {fmtMoney(p.z)}</p>
                    </div>
                  )
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => (
                  <Cell key={i} fill={SEG_CONFIG[d.segment].color} fillOpacity={0.7} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function SegBtn({
  active, onClick, label, color, bg, text, count, revenue, totalCust, totalRev,
}: {
  active: boolean; onClick: () => void; label: string; color: string
  bg: string; text: string; count: number; revenue: number
  totalCust: number; totalRev: number
}) {
  const pctCust = totalCust > 0 ? (count / totalCust) * 100 : 0
  const pctRev = totalRev > 0 ? (revenue / totalRev) * 100 : 0
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl border text-left p-2.5 transition-all hover-lift ${bg} ${
        active ? 'ring-2 ring-offset-1 ring-navy-900 shadow-card' : 'opacity-90'
      }`}
    >
      <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full" style={{ backgroundColor: color }} />
      <p className={`text-[10px] font-semibold uppercase tracking-wider pl-1.5 ${text}`}>{label}</p>
      <p className="text-sm font-bold text-navy-900 pl-1.5 mt-0.5 font-num">
        {count.toLocaleString()}
      </p>
      <p className="text-[9px] text-slate-500 pl-1.5 font-num">
        {pctCust.toFixed(0)}% · {pctRev.toFixed(0)}% rev
      </p>
    </button>
  )
}
