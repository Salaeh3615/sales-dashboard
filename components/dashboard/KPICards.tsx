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
  DollarSign,
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
    return <span className="text-sm text-slate-400 font-medium">N/A</span>
  const positive = value >= 0
  const Icon = positive ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-lg font-bold font-num ${
        positive ? 'text-emerald-600' : 'text-red-500'
      }`}
    >
      <Icon size={16} />
      {positive ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  )
}

type Variant = 'hero' | 'soft' | 'default'

function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  variant = 'default',
  accent = 'bg-navy-50 text-navy-900',
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: React.ElementType
  variant?: Variant
  accent?: string
}) {
  if (variant === 'hero') {
    return (
      <div className="hero-card p-5 hover-lift animate-slide-up h-full">
        <div className="relative">
          <div className="absolute top-0 right-0 w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400/30 to-gold-500/10 flex items-center justify-center backdrop-blur-sm border border-gold-400/30">
            <Icon size={18} className="text-gold-300" strokeWidth={2.2} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-100/70">{label}</p>
          <p className="mt-2 text-3xl font-bold font-num leading-tight tracking-tight text-white drop-shadow">
            {value}
          </p>
          {sub && <div className="mt-1.5 text-xs text-navy-100/70">{sub}</div>}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
      </div>
    )
  }

  if (variant === 'soft') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white via-navy-50/40 to-white border border-navy-100 p-4 shadow-luxe hover-lift">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-navy-700 uppercase tracking-[0.12em]">{label}</p>
          <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${accent}`}>
            <Icon size={16} strokeWidth={2.2} />
          </span>
        </div>
        <div className="mt-3 text-2xl font-bold text-navy-900 font-num leading-tight tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-4 shadow-luxe hover-lift">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.12em]">{label}</p>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${accent}`}>
          <Icon size={16} strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-navy-900 font-num leading-tight tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

export function KPICards({ kpis, recordCount }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* HERO — Total Revenue */}
      <div className="sm:col-span-2 lg:col-span-2">
        <KPICard
          variant="hero"
          label="Total Revenue"
          value={fmt(kpis.totalRevenue)}
          sub={`${recordCount.toLocaleString()} transactions`}
          icon={DollarSign}
        />
      </div>

      {/* YoY Growth */}
      <KPICard
        variant="soft"
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
        variant="soft"
        label="QoQ Growth"
        value={<GrowthBadge value={kpis.qoqGrowth} />}
        sub="vs previous quarter"
        icon={Minus}
        accent="bg-gold-100 text-gold-700"
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
        value={<span className="font-num">{kpis.activeBranches}</span>}
        sub={`Best: ${kpis.bestBranch}`}
        icon={Building2}
        accent="bg-navy-50 text-navy-700"
      />

      {/* Active Salespersons */}
      <KPICard
        label="Active Salespeople"
        value={<span className="font-num">{kpis.activeSalespersons}</span>}
        sub={`Top: ${kpis.bestSalesperson}`}
        icon={Users}
        accent="bg-navy-50 text-navy-700"
      />

      {/* Best Branch */}
      <KPICard
        label="Best Branch"
        value={<span className="text-xl font-bold text-navy-900">{kpis.bestBranch}</span>}
        sub="Highest revenue branch"
        icon={Award}
        accent="bg-gold-100 text-gold-700"
      />
    </div>
  )
}

export function CreditMemoBanner({ rate }: { rate: number }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-gold-50 via-gold-100/60 to-white border border-gold-200 rounded-2xl p-4 flex items-start gap-3 shadow-luxe">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gold-300/30 blur-2xl pointer-events-none" />
      <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shrink-0 shadow-[0_4px_12px_-2px_rgba(255,204,0,0.4)]">
        <AlertTriangle size={18} className="text-navy-950" strokeWidth={2.4} />
      </div>
      <div className="relative flex-1">
        <p className="text-sm font-semibold text-navy-900 tracking-tight">
          Credit Memo Rate: <span className="font-num text-gold-700">{rate.toFixed(1)}%</span>
        </p>
        <p className="text-xs text-navy-700 mt-0.5">
          Credit memos are unusually high relative to invoices. Check for returns or billing corrections.
        </p>
      </div>
    </div>
  )
}
