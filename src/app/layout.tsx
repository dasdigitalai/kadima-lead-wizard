import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PartsLocatorRadar',
  description: 'Find used-auto-parts locator businesses, profile their websites and contacts, export to Zoho CRM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
