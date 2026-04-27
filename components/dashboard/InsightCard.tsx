'use client'

import type { Insight } from '@/types'
import { TrendingUp, TrendingDown, Info, AlertTriangle, Sparkles } from 'lucide-react'

const CONFIG = {
  positive: {
    icon: TrendingUp,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    title: 'text-emerald-800',
    body: 'text-emerald-700',
    icon_bg: 'bg-emerald-100',
    icon_cls: 'text-emerald-600',
    accent: 'bg-emerald-400',
  },
  negative: {
    icon: TrendingDown,
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'text-red-800',
    body: 'text-red-700',
    icon_bg: 'bg-red-100',
    icon_cls: 'text-red-500',
    accent: 'bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'text-amber-800',
    body: 'text-amber-700',
    icon_bg: 'bg-amber-100',
    icon_cls: 'text-amber-600',
    accent: 'bg-amber-400',
  },
  neutral: {
    icon: Info,
    bg: 'bg-navy-50',
    border: 'border-navy-100',
    title: 'text-navy-900',
    body: 'text-navy-700',
    icon_bg: 'bg-navy-100',
    icon_cls: 'text-navy-700',
    accent: 'bg-navy-700',
  },
}

export function InsightCard({ insight }: { insight: Insight }) {
  const c = CONFIG[insight.type]
  const Icon = c.icon
  return (
    <div className={`relative rounded-2xl border ${c.bg} ${c.border} p-4 pl-5 flex gap-3 hover-lift overflow-hidden`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${c.accent}`} />
      <span className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg ${c.icon_bg} ${c.icon_cls} flex items-center justify-center`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${c.title}`}>{insight.title}</p>
        <p className={`text-xs mt-1 leading-relaxed ${c.body}`}>{insight.body}</p>
      </div>
    </div>
  )
}

export function InsightPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <section>
      <h2 className="text-base font-semibold text-navy-900 mb-3 flex items-center gap-2">
        <span className="inline-flex w-7 h-7 rounded-lg bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center">
          <Sparkles size={14} />
        </span>
        Insights
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {insights.map((ins, i) => (
          <InsightCard key={i} insight={ins} />
        ))}
      </div>
    </section>
  )
}
