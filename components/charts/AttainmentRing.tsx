'use client'

/**
 * AttainmentRing — SVG donut/ring chart showing attainment percentage with
 * gradient fill and center label.  Supports:
 *   - Single ring (YTD attainment)
 *   - Optional secondary ring (projected EOY attainment)
 *   - Number count-up animation
 */

import { useCountUp } from './BentoCard'

type Props = {
  percentage: number           // 0-100+ (caps visual at 120)
  secondary?: number           // second ring (e.g. projected EOY)
  secondaryLabel?: string
  label?: string               // center text under number
  size?: number                // pixels
  strokeWidth?: number
  gradientFrom?: string
  gradientTo?: string
  animate?: boolean
}

function colorForPct(pct: number): { from: string; to: string } {
  if (pct >= 100) return { from: '#10B981', to: '#059669' }       // emerald
  if (pct >= 95)  return { from: '#0a3d2a', to: '#052218' }       // emerald
  if (pct >= 85)  return { from: '#FFCC00', to: '#D4A017' }       // gold
  return { from: '#EF4444', to: '#B91C1C' }                       // red
}

export function AttainmentRing({
  percentage,
  secondary,
  secondaryLabel,
  label,
  size = 220,
  strokeWidth = 18,
  gradientFrom,
  gradientTo,
  animate = true,
}: Props) {
  const safePct = Number.isFinite(percentage) ? percentage : 0
  const displayPct = useCountUp(animate ? safePct : safePct)
  const pctForArc = animate ? displayPct : safePct
  const capped = Math.min(120, Math.max(0, pctForArc))

  // Main ring
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (capped / 100) * circumference
  const dashArray = `${progress} ${circumference - progress}`

  // Secondary ring (inner)
  const innerR = radius - strokeWidth - 4
  const innerC = 2 * Math.PI * innerR
  const secSafe = Number.isFinite(secondary ?? NaN) ? Math.min(120, Math.max(0, secondary!)) : null
  const secDash = secSafe !== null ? `${(secSafe / 100) * innerC} ${innerC - (secSafe / 100) * innerC}` : null

  const auto = colorForPct(safePct)
  const gradFrom = gradientFrom ?? auto.from
  const gradTo   = gradientTo   ?? auto.to
  const id = `ring-${Math.abs(safePct * 1000) | 0}-${size}`

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradFrom} />
            <stop offset="100%" stopColor={gradTo} />
          </linearGradient>
        </defs>
        {/* bg track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#F1F5F9" strokeWidth={strokeWidth} fill="none"
        />
        {/* 100% reference tick */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#CBD5E1" strokeWidth={1.5} fill="none"
          strokeDasharray={`${circumference} 0`}
          opacity="0.4"
        />
        {/* progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#${id})`} strokeWidth={strokeWidth} fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          style={{ transition: animate ? 'none' : 'stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)' }}
        />
        {/* secondary ring */}
        {secSafe !== null && (
          <>
            <circle cx={size / 2} cy={size / 2} r={innerR}
              stroke="#F1F5F9" strokeWidth={strokeWidth * 0.55} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={innerR}
              stroke="#FFCC00" strokeWidth={strokeWidth * 0.55} fill="none"
              strokeLinecap="round"
              strokeDasharray={secDash!}
              opacity="0.75" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
          {label ?? 'YTD Attainment'}
        </p>
        <p className="text-4xl font-bold text-navy-900 font-num leading-none">
          {displayPct.toFixed(1)}<span className="text-lg align-top">%</span>
        </p>
        {secSafe !== null && (
          <p className="text-[10px] text-gold-700 mt-1.5 font-num">
            {secondaryLabel ?? 'EOY proj.'} {secondary!.toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  )
}
