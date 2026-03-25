import Link from 'next/link'

export default function HomePage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-white px-4">
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white text-2xl font-bold">
            C
          </div>
          <h1 className="text-4xl font-bold text-gray-900">Clara</h1>
        </div>
        <p className="mx-auto max-w-sm text-lg text-gray-600">
          AI-powered receptionist for local businesses. Answer customer questions 24/7, automatically.
        </p>
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm max-w-sm mx-auto">
          <p className="text-sm font-semibold text-gray-700 mb-3">Try a demo</p>
          <p className="text-sm text-gray-500 mb-4">
            Demo URLs are generated per business. Visit{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/demo/[uuid]</code> with a
            valid session UUID.
          </p>
          <p className="text-xs text-gray-400">
            To create a demo session, POST to{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">/api/demo</code> with a{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">hubspot_company_id</code>.
          </p>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Clara reads business data from Hunter&apos;s API and serves a personalized chat experience.
        </p>
      </div>
    </main>
  )
}
