'use client'

import type { Insight } from '@/types'
import { TrendingUp, TrendingDown, Info, AlertTriangle } from 'lucide-react'

const CONFIG = {
  positive: {
    icon: TrendingUp,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    title: 'text-emerald-800',
    body: 'text-emerald-700',
    icon_cls: 'text-emerald-600',
  },
  negative: {
    icon: TrendingDown,
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'text-red-800',
    body: 'text-red-700',
    icon_cls: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'text-amber-800',
    body: 'text-amber-700',
    icon_cls: 'text-amber-600',
  },
  neutral: {
    icon: Info,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    title: 'text-slate-800',
    body: 'text-slate-600',
    icon_cls: 'text-slate-500',
  },
}

export function InsightCard({ insight }: { insight: Insight }) {
  const c = CONFIG[insight.type]
  const Icon = c.icon
  return (
    <div className={`rounded-xl border ${c.bg} ${c.border} p-4 flex gap-3`}>
      <span className={`mt-0.5 shrink-0 ${c.icon_cls}`}>
        <Icon size={16} />
      </span>
      <div>
        <p className={`text-sm font-semibold ${c.title}`}>{insight.title}</p>
        <p className={`text-xs mt-0.5 ${c.body}`}>{insight.body}</p>
      </div>
    </div>
  )
}

export function InsightPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-800 mb-3">Insights</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {insights.map((ins, i) => (
          <InsightCard key={i} insight={ins} />
        ))}
      </div>
    </section>
  )
}
