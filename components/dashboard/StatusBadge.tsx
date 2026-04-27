'use client'

/**
 * StatusBadge — Small semantic pill for status indicators
 *
 * Variants: pending | in-progress | completed | success | warning | danger | info
 * Brand palette: navy/gold accents with soft pastel backgrounds
 */

import type { ReactNode } from 'react'
import { Clock, Loader2, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react'

export type StatusVariant =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

const STYLES: Record<StatusVariant, { bg: string; text: string; dot: string; Icon?: typeof Clock }> = {
  'pending':     { bg: 'bg-slate-100',    text: 'text-slate-700',    dot: 'bg-slate-400',    Icon: Clock },
  'in-progress': { bg: 'bg-gold-50',      text: 'text-gold-900',     dot: 'bg-gold-500',     Icon: Loader2 },
  'completed':   { bg: 'bg-emerald-50',   text: 'text-emerald-700',  dot: 'bg-emerald-500',  Icon: CheckCircle2 },
  'success':     { bg: 'bg-emerald-50',   text: 'text-emerald-700',  dot: 'bg-emerald-500',  Icon: CheckCircle2 },
  'warning':     { bg: 'bg-amber-50',     text: 'text-amber-800',    dot: 'bg-amber-500',    Icon: AlertTriangle },
  'danger':      { bg: 'bg-red-50',       text: 'text-red-700',      dot: 'bg-red-500',      Icon: XCircle },
  'info':        { bg: 'bg-navy-50',      text: 'text-navy-900',     dot: 'bg-navy-700',     Icon: Info },
  'neutral':     { bg: 'bg-slate-50',     text: 'text-slate-700',    dot: 'bg-slate-400' },
}

const LABELS: Record<StatusVariant, string> = {
  'pending':     'Pending',
  'in-progress': 'In Progress',
  'completed':   'Completed',
  'success':     'Success',
  'warning':     'Warning',
  'danger':      'Error',
  'info':        'Info',
  'neutral':     'Neutral',
}

interface StatusBadgeProps {
  variant: StatusVariant
  label?: ReactNode
  showIcon?: boolean
  showDot?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({
  variant,
  label,
  showIcon = false,
  showDot = true,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  const s = STYLES[variant]
  const Icon = s.Icon
  const sizeCls = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
  const spin = variant === 'in-progress' ? 'animate-spin' : ''
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${s.bg} ${s.text} ${sizeCls} ${className}`}
    >
      {showIcon && Icon ? (
        <Icon size={size === 'md' ? 13 : 11} className={spin} />
      ) : showDot ? (
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      ) : null}
      {label ?? LABELS[variant]}
    </span>
  )
}
