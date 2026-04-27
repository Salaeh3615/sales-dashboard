'use client'

import type { EntityRevenue } from '@/types'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
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

export function BranchBarChart({ data }: { data: EntityRevenue[] }) {
  return (
    <ChartCard title="Branch Revenue Comparison">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
          <YAxis type="category" dataKey="name" tick={{ ...CLT_AXIS.tick, fontSize: 12, fill: '#1e293b' }} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={40} />
          <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function BranchPieChart({ data }: { data: EntityRevenue[] }) {
  const positive = data.filter((d) => d.revenue > 0)
  return (
    <ChartCard title="Branch Revenue Share">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={positive}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            label={({ name, share }) => `${name} ${share.toFixed(0)}%`}
            labelLine={false}
          >
            {positive.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function BranchTrendChart({
  data,
  branches,
}: {
  data: { label: string; [branch: string]: number | string }[]
  branches: string[]
}) {
  return (
    <ChartCard title="Branch Revenue Over Time">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
          <XAxis dataKey="label" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
          <Tooltip formatter={(v, name) => [fmtCurrency(v as number), name]} {...CLT_TOOLTIP} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
          {branches.map((b, i) => (
            <Line key={b} type="monotone" dataKey={b} stroke={CLT_COLORS[i % CLT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
