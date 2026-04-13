'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Users, Database, Upload, Menu, X, Search, ArrowLeftRight, FlaskConical } from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { href: '/',                 label: 'Overview',  icon: BarChart3 },
  { href: '/customers',        label: 'Customers', icon: Users },
  { href: '/customer-lookup',  label: 'Lookup',    icon: Search },
  { href: '/test-analytics',   label: 'Tests',     icon: FlaskConical },
  { href: '/comparison',       label: 'Compare',   icon: ArrowLeftRight },
  { href: '/raw',              label: 'Raw Data',  icon: Database },
  { href: '/admin/import',     label: 'Admin',     icon: Upload },
]

export function TopNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
      <div className="px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <BarChart3 size={20} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-800">CLT Sales Dashboard</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-100 px-4 py-2 space-y-1 bg-white">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
