'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3, Users, Search, FlaskConical, ArrowLeftRight,
  Database, Upload, Menu, X, ChevronLeft, ChevronRight, Percent, Target, Activity,
  HeartPulse, AlertTriangle,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: React.ElementType }

const NAV: NavItem[] = [
  { href: '/',                 label: 'Overview',    icon: BarChart3 },
  { href: '/customers',        label: 'Customers',   icon: Users },
  { href: '/customer-lookup',  label: 'Lookup',      icon: Search },
  { href: '/test-analytics',   label: 'Tests',       icon: FlaskConical },
  { href: '/comparison',       label: 'Compare',     icon: ArrowLeftRight },
  { href: '/decomposition',    label: 'Why?',        icon: Activity },
  { href: '/health',           label: 'Health',      icon: HeartPulse },
  { href: '/variance',         label: 'Investigate', icon: AlertTriangle },
  { href: '/targets',          label: 'Targets',     icon: Target },
  { href: '/discounts',        label: 'Discounts',   icon: Percent },
  { href: '/raw',              label: 'Raw Data',    icon: Database },
]

const ADMIN: NavItem[] = [
  { href: '/admin/import',     label: 'Admin',       icon: Upload },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = pathname === item.href
    const Icon = item.icon
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-gold-500 to-gold-400 text-navy-950 font-semibold gold-ring'
            : 'text-navy-100/80 hover:bg-white/5 hover:text-white hover:translate-x-0.5'
        }`}
        title={collapsed ? item.label : undefined}
      >
        {active && (
          <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-gold-400 shadow-[0_0_12px_rgba(255,204,0,0.6)]" />
        )}
        <Icon size={18} className="shrink-0" strokeWidth={active ? 2.4 : 2} />
        {!collapsed && <span className="text-sm tracking-tight">{item.label}</span>}
        {active && !collapsed && (
          <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-navy-950" />
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile toggle (top bar) */}
      <div className="lg:hidden sticky top-0 z-30 bg-gradient-to-r from-navy-950 via-navy-900 to-[#062a1d] text-white px-4 h-14 flex items-center justify-between shadow-lg border-b border-white/5">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(255,204,0,0.4)]">
            <FlaskConical size={16} className="text-navy-950" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight tracking-tight">CLT Dashboard</p>
            <p className="text-[10px] text-navy-100/70 leading-tight tracking-wide uppercase">Central Lab Thai</p>
          </div>
        </Link>
        <button
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-navy-950/60 z-40 animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50
          h-screen flex flex-col text-white shadow-2xl
          bg-gradient-to-b from-navy-950 via-navy-900 to-[#062a1d]
          border-r border-white/5
          transition-all duration-300 ease-out
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'} w-64`}
      >
        {/* Logo + close (mobile) */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5 shrink-0">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shrink-0 shadow-[0_4px_12px_-2px_rgba(255,204,0,0.4)] group-hover:shadow-[0_4px_16px_-2px_rgba(255,204,0,0.6)] transition-shadow">
              <FlaskConical size={18} className="text-navy-950" strokeWidth={2.4} />
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/30 pointer-events-none" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-bold leading-tight tracking-tight">CLT Dashboard</p>
                <p className="text-[10px] text-navy-100/70 leading-tight tracking-wide uppercase">Central Lab Thai</p>
              </div>
            )}
          </Link>
          <button
            className="lg:hidden p-1.5 rounded-lg hover:bg-navy-800"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {!collapsed && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-200/50 px-3 mb-2">
              Analytics
            </p>
          )}
          {NAV.map((item) => <NavLink key={item.href} item={item} />)}

          <div className="pt-4 mt-4 border-t border-white/5">
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-200/50 px-3 mb-2">
                System
              </p>
            )}
            {ADMIN.map((item) => <NavLink key={item.href} item={item} />)}
          </div>
        </nav>

        {/* Footer — collapse toggle + badge */}
        <div className="border-t border-white/5 p-3 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-navy-100/70 hover:bg-white/5 hover:text-white transition-colors text-xs"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
          </button>
          {!collapsed && (
            <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm">
              <p className="text-[10px] text-navy-200/70 tracking-wide uppercase">Powered by</p>
              <p className="text-xs font-semibold text-gold-400 mt-0.5">SQLite · Next.js 14</p>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
