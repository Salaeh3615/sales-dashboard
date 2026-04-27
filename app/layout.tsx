import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/dashboard/Sidebar'

export const metadata: Metadata = {
  title: 'CLT Sales Dashboard · Central Lab Thai',
  description: 'Sales & Marketing Performance Dashboard for Central Lab Thai',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] antialiased">
        <div className="lg:flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">{children}</div>
        </div>
      </body>
    </html>
  )
}
