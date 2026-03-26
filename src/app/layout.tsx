import type { Metadata } from 'next'
import './globals.css'
import { checkProductionEnv } from '@/lib/startup'
import { ErrorBoundary } from '@/lib/error-capture/ErrorBoundary'
import { ErrorCaptureProvider } from '@/lib/error-capture/ErrorCaptureProvider'

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
      <body className="antialiased">
        <ErrorBoundary project="clara">
          {children}
        </ErrorBoundary>
        <ErrorCaptureProvider />
      </body>
    </html>
  )
}
