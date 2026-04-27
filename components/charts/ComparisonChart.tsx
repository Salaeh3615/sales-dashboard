'use client'

import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
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

/** Quarter comparison across years */
export function QuarterComparisonChart({
  data,
  years,
}: {
  data: { quarter: string; [year: string]: number | string }[]
  years: number[]
}) {
  return (
    <ChartCard title="Quarterly Comparison by Year">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
          <XAxis dataKey="quarter" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
          <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
          <Tooltip formatter={(v, name) => [fmtCurrency(v as number), name]} {...CLT_TOOLTIP} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>}
          />
          {years.map((y, i) => (
            <Bar
              key={y}
              dataKey={String(y)}
              fill={CLT_COLORS[i % CLT_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/** Month comparison across years */
export function MonthComparisonChart({
  data,
  years,
}: {
  data: { month: string; [year: string]: number | string }[]
  years: number[]
}) {
  return (
    <ChartCard title="Monthly Comparison by Year">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
          <XAxis dataKey="month" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
          <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
          <Tooltip formatter={(v, name) => [fmtCurrency(v as number), name]} {...CLT_TOOLTIP} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>}
          />
          {years.map((y, i) => (
            <Bar
              key={y}
              dataKey={String(y)}
              fill={CLT_COLORS[i % CLT_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

/** Simple year-over-year bar */
export function YearComparisonChart({
  data,
}: {
  data: { year: number; revenue: number }[]
}) {
  return (
    <ChartCard title="Annual Revenue Comparison">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
          <XAxis dataKey="year" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
          <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={60} />
          <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
