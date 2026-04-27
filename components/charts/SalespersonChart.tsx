'use client'

import type { EntityRevenue } from '@/types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { CLT_COLORS, CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <p className="text-sm font-semibold text-navy-900 mb-4">{title}</p>
      {children}
    </div>
  )
}

export function SalespersonBarChart({ data, topN = 10 }: { data: EntityRevenue[]; topN?: number }) {
  const slice = data.slice(0, topN)
  return (
    <ChartCard title={`Top ${topN} Salesperson Revenue`}>
      <ResponsiveContainer width="100%" height={Math.max(220, slice.length * 34)}>
        <BarChart data={slice} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
          <YAxis type="category" dataKey="name" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={120} />
          <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {slice.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function SalespersonPieChart({ data, topN = 8 }: { data: EntityRevenue[]; topN?: number }) {
  const positive = data.filter((d) => d.revenue > 0)
  const top = positive.slice(0, topN)
  const rest = positive.slice(topN)
  const chartData =
    rest.length > 0
      ? [
          ...top,
          {
            name: `Others (${rest.length})`,
            revenue: rest.reduce((s, r) => s + r.revenue, 0),
            share:   rest.reduce((s, r) => s + r.share,   0),
            count:   rest.reduce((s, r) => s + r.count,   0),
          },
        ]
      : top

  return (
    <ChartCard title={`Salesperson Revenue Share (Top ${topN})`}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={95}
            innerRadius={50}
            paddingAngle={2}
          >
            {chartData.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => (
              <span style={{ fontSize: 10, color: '#475569' }}>
                {String(v).length > 18 ? String(v).slice(0, 18) + '…' : v}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
