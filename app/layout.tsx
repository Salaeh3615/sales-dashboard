import type { Metadata } from 'next'
import './globals.css'
import { TopNav } from '@/components/dashboard/TopNav'

export const metadata: Metadata = {
  title: 'CLT Sales Dashboard',
  description: 'Sales & Marketing Performance Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased flex flex-col">
        <TopNav />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  )
}
