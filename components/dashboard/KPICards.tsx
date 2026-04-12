'use client'

import type { KPISummary } from '@/types'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Users,
  Award,
  AlertTriangle,
} from 'lucide-react'

interface KPICardsProps {
  kpis: KPISummary
  recordCount: number
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toLocaleString()}`
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-xs text-slate-400">N/A</span>
  const positive = value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        positive ? 'text-emerald-600' : 'text-red-500'
      }`}
    >
      <Icon size={14} />
      {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`p-1.5 rounded-lg ${accent}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function KPICards({ kpis, recordCount }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Revenue */}
      <KPICard
        label="Total Revenue"
        value={fmt(kpis.totalRevenue)}
        sub={`${recordCount.toLocaleString()} transactions`}
        icon={kpis.totalRevenue >= 0 ? TrendingUp : AlertTriangle}
        accent={kpis.totalRevenue >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}
      />

      {/* YoY Growth */}
      <KPICard
        label="YoY Growth"
        value={<GrowthBadge value={kpis.yoyGrowth} />}
        sub="vs same period last year"
        icon={kpis.yoyGrowth === null || kpis.yoyGrowth >= 0 ? TrendingUp : TrendingDown}
        accent={
          kpis.yoyGrowth === null
            ? 'bg-slate-100 text-slate-400'
            : kpis.yoyGrowth >= 0
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-red-50 text-red-500'
        }
      />

      {/* QoQ Growth */}
      <KPICard
        label="QoQ Growth"
        value={<GrowthBadge value={kpis.qoqGrowth} />}
        sub="vs previous quarter"
        icon={Minus}
        accent="bg-violet-50 text-violet-600"
      />

      {/* MoM Growth */}
      <KPICard
        label="MoM Growth"
        value={<GrowthBadge value={kpis.momGrowth} />}
        sub="vs previous month"
        icon={Minus}
        accent="bg-amber-50 text-amber-600"
      />

      {/* Active Branches */}
      <KPICard
        label="Active Branches"
        value={kpis.activeBranches}
        sub={`Best: ${kpis.bestBranch}`}
        icon={Building2}
        accent="bg-sky-50 text-sky-600"
      />

      {/* Active Salespersons */}
      <KPICard
        label="Active Salespeople"
        value={kpis.activeSalespersons}
        sub={`Top: ${kpis.bestSalesperson}`}
        icon={Users}
        accent="bg-indigo-50 text-indigo-600"
      />

      {/* Best Branch */}
      <KPICard
        label="Best Branch"
        value={kpis.bestBranch}
        sub="Highest revenue branch"
        icon={Award}
        accent="bg-emerald-50 text-emerald-600"
      />

      {/* Best Salesperson */}
      <KPICard
        label="Best Salesperson"
        value={
          <span className="text-lg font-bold text-slate-900 leading-tight line-clamp-1">
            {kpis.bestSalesperson}
          </span>
        }
        sub="Highest revenue individual"
        icon={Award}
        accent="bg-teal-50 text-teal-600"
      />
    </div>
  )
}
