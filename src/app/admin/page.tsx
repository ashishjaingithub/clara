import { headers } from 'next/headers'
import { timingSafeEqual, createHash } from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionRow {
  id: string
  hubspotCompanyId: string
  businessName: string | null
  messageCount: number
  createdAt: string
  lastActiveAt: string
  leadCount: number
}

interface LeadRow {
  id: string
  sessionId: string
  hubspotCompanyId: string
  businessName: string | null
  name: string
  contact: string
  message: string | null
  createdAt: string
}

interface StatsPayload {
  totalSessions: number
  activeSessions: number
  totalMessages: number
  totalLeads: number
  recentSessions: SessionRow[]
  recentLeads: LeadRow[]
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorized(key: string | null): boolean {
  const expected = process.env.CLARA_OPERATOR_API_KEY ?? ''

  // Dev/test: if key not configured, allow through (mirrors API behaviour)
  if (!expected) {
    if (process.env.NODE_ENV === 'production') return false
    return true
  }

  if (!key) return false

  const a = Buffer.from(createHash('sha256').update(key).digest('hex'))
  const b = Buffer.from(createHash('sha256').update(expected).digest('hex'))
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—'
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  )
}

function AccessDenied() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-red-600">Access denied</p>
          <p className="mt-1 text-sm text-gray-500">
            Provide a valid key via <code className="rounded bg-gray-100 px-1">?key=</code> or{' '}
            <code className="rounded bg-gray-100 px-1">Authorization: Bearer</code> header.
          </p>
        </div>
      </body>
    </html>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}): Promise<JSX.Element> {
  // 1. Auth — check ?key= query param OR Authorization header
  const headersList = await headers()
  const authHeader = headersList.get('authorization') ?? ''
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const queryKey = typeof searchParams.key === 'string' ? searchParams.key : null

  const key = queryKey ?? bearerKey

  if (!isAuthorized(key)) {
    return <AccessDenied />
  }

  // 2. Fetch stats — call our own API
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3002}`

  const apiKey = process.env.CLARA_OPERATOR_API_KEY ?? 'dev'

  let stats: StatsPayload | null = null
  let fetchError: string | null = null

  try {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      fetchError = `Stats API returned ${res.status}`
    } else {
      stats = (await res.json()) as StatsPayload
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown fetch error'
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-baseline justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Clara Admin</h1>
              <p className="mt-0.5 text-sm text-gray-500">{today}</p>
            </div>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
              Operator
            </span>
          </div>

          {fetchError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load stats: {fetchError}
            </div>
          )}

          {stats && (
            <>
              {/* Stat cards */}
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard label="Total Sessions" value={stats.totalSessions} />
                <StatCard label="Active Sessions" value={stats.activeSessions} />
                <StatCard label="Total Messages" value={stats.totalMessages} />
                <StatCard label="Total Leads" value={stats.totalLeads} />
              </div>

              {/* Recent Sessions */}
              <section className="mb-8">
                <h2 className="mb-3 text-base font-semibold text-gray-800">Recent Sessions</h2>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Business Name
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">
                          Messages
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Leads</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Last Active
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.recentSessions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                            No sessions yet.
                          </td>
                        </tr>
                      )}
                      {stats.recentSessions.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {truncate(s.businessName ?? s.hubspotCompanyId, 40)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                            {s.messageCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span
                              className={
                                s.leadCount > 0
                                  ? 'font-semibold text-green-700'
                                  : 'text-gray-400'
                              }
                            >
                              {s.leadCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatDate(s.lastActiveAt)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(s.createdAt)}</td>
                          <td className="px-4 py-3">
                            <a
                              href={`/demo/${s.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              View session
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Leads */}
              <section>
                <h2 className="mb-3 text-base font-semibold text-gray-800">Recent Leads</h2>
                <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Business
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">
                          Visitor Name
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Contact</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Message</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {stats.recentLeads.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                            No leads captured yet.
                          </td>
                        </tr>
                      )}
                      {stats.recentLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {truncate(l.businessName ?? l.hubspotCompanyId, 30)}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{truncate(l.name, 30)}</td>
                          <td className="px-4 py-3 text-gray-700">{truncate(l.contact, 30)}</td>
                          <td className="px-4 py-3 text-gray-500 italic">
                            {truncate(l.message, 60)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {formatDate(l.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
