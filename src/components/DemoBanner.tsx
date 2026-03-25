'use client'

interface DemoBannerProps {
  businessName: string | null
  isLoading?: boolean
}

export function DemoBanner({ businessName, isLoading = false }: DemoBannerProps): JSX.Element {
  const displayName = businessName ?? 'This Business'

  return (
    <div
      data-testid="demo-banner"
      role="banner"
      className="z-20 w-full border-b border-brand-100 bg-brand-50 px-4"
      style={{ minHeight: '40px' }}
    >
      <div className="mx-auto flex h-full max-w-2xl items-center justify-center py-2 text-center text-xs text-brand-700 sm:text-sm">
        {isLoading ? (
          <span className="text-brand-500">Loading preview...</span>
        ) : (
          <>
            <span className="mr-1.5 inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-brand-700">
              Preview
            </span>
            <span>
              See what{' '}
              <strong className="font-semibold">{displayName}</strong>
              &apos;s AI receptionist could say to a new customer
            </span>
          </>
        )}
      </div>
    </div>
  )
}
