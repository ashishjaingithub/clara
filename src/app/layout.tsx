import type { Metadata } from 'next'
import './globals.css'
import { checkProductionEnv } from '@/lib/startup'

checkProductionEnv()

export const metadata: Metadata = {
  title: 'Clara — AI Receptionist',
  description: 'AI-powered receptionist for local businesses',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>): JSX.Element {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
