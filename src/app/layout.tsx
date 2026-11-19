import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lead Wizard',
  description: 'Pick an industry, find the businesses, profile their websites and contacts, and get a call-ready queue',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
