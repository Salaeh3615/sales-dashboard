'use client'

/**
 * BentoCard — Base card wrapper for the `/targets` Bento grid.
 *
 * Provides:
 *   - Consistent rounded-3xl + shadow + hover-lift
 *   - Optional status strip (colored rail on left)
 *   - Title row with optional subtitle and right-aligned slot
 *   - Col-span / row-span props for tile sizing in the 12-col bento grid
 */

import React from 'react'

type Status = 'ahead' | 'on_track' | 'behind' | 'at_risk' | 'neutral'

const STATUS_STRIP: Record<Status, string> = {
  ahead:    'bg-gradient-to-b from-emerald-400 to-emerald-600',
  on_track: 'bg-gradient-to-b from-navy-700 to-navy-900',
  behind:   'bg-gradient-to-b from-gold-400 to-gold-600',
  at_risk:  'bg-gradient-to-b from-red-400 to-red-600',
  neutral:  'bg-gradient-to-b from-slate-300 to-slate-500',
}

export function BentoCard({
  title,
  subtitle,
  right,
  status = 'neutral',
  colSpan = 1,
  rowSpan = 1,
  children,
  padding = 'p-5',
  className = '',
  headless = false,
}: {
  title?: string
  subtitle?: string
  right?: React.ReactNode
  status?: Status
  colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
  rowSpan?: 1 | 2 | 3 | 4
  children: React.ReactNode
  padding?: string
  className?: string
  headless?: boolean
}) {
  // NOTE: Tailwind cannot detect dynamic class names — these maps
  // ensure the actual class strings appear verbatim in source.
  const COL: Record<number, string> = {
    1: 'lg:col-span-1',  2: 'lg:col-span-2',  3: 'lg:col-span-3',
    4: 'lg:col-span-4',  5: 'lg:col-span-5',  6: 'lg:col-span-6',
    7: 'lg:col-span-7',  8: 'lg:col-span-8',  9: 'lg:col-span-9',
    10: 'lg:col-span-10', 11: 'lg:col-span-11', 12: 'lg:col-span-12',
  }
  const ROW: Record<number, string> = {
    1: 'lg:row-span-1', 2: 'lg:row-span-2',
    3: 'lg:row-span-3', 4: 'lg:row-span-4',
  }
  const spanClasses = `${COL[colSpan] ?? 'lg:col-span-1'} ${ROW[rowSpan] ?? 'lg:row-span-1'}`

  return (
    <div
      className={`relative bg-white rounded-3xl border border-slate-200 shadow-card hover-lift overflow-hidden ${spanClasses} ${className}`}
    >
      <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-full ${STATUS_STRIP[status]}`} />
      <div className={padding}>
        {!headless && (title || right) && (
          <div className="flex items-start justify-between gap-2 mb-3 pl-2">
            <div className="min-w-0">
              {title && <p className="text-sm font-semibold text-navy-900 truncate">{title}</p>}
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            {right && <div className="shrink-0">{right}</div>}
          </div>
        )}
        <div className={!headless && (title || right) ? 'pl-2' : ''}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Shared status pill ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  ahead:    { label: 'Ahead',    bg: 'bg-emerald-50', text: 'text-emerald-700' },
  on_track: { label: 'On Track', bg: 'bg-navy-50',    text: 'text-navy-900' },
  behind:   { label: 'Behind',   bg: 'bg-gold-50',    text: 'text-gold-800' },
  at_risk:  { label: 'At Risk',  bg: 'bg-red-50',     text: 'text-red-700' },
  neutral:  { label: '—',        bg: 'bg-slate-50',   text: 'text-slate-600' },
}

export function StatusPill({ status, className = '' }: { status: Status; className?: string }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text} ${className}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'ahead' ? 'bg-emerald-500' : status === 'on_track' ? 'bg-navy-700' : status === 'behind' ? 'bg-gold-500' : status === 'at_risk' ? 'bg-red-500' : 'bg-slate-400'}`} />
      {c.label}
    </span>
  )
}

// ─── Animated counter ────────────────────────────────────────────────────────

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = React.useState(0)
  React.useEffect(() => {
    if (!Number.isFinite(target)) { setValue(0); return }
    const start = performance.now()
    const from = 0
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(from + (target - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}
