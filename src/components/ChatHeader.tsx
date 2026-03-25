'use client'

interface ChatHeaderProps {
  businessName: string | null
  isLoading?: boolean
  status?: 'online' | 'connecting' | 'error'
}

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
] as const

function businessAvatarColor(name: string): string {
  const code = name.charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

export function ChatHeader({
  businessName,
  isLoading = false,
  status = 'online',
}: ChatHeaderProps): JSX.Element {
  const displayName = businessName ?? 'This Business'

  const statusConfig = {
    online:     { dotClass: 'bg-green-400',  label: 'Online' },
    connecting: { dotClass: 'bg-yellow-400', label: 'Connecting...' },
    error:      { dotClass: 'bg-red-400',    label: 'Error' },
  } as const

  const { dotClass, label } = statusConfig[status]

  const avatarColor = businessAvatarColor(displayName)
  const avatarLetter = displayName.charAt(0).toUpperCase()

  return (
    <header
      data-testid="chat-header"
      className="z-10 border-b border-gray-200 bg-white px-4 shadow-sm"
      style={{ height: '64px' }}
    >
      <div className="mx-auto flex h-full max-w-2xl items-center gap-3">
        {/* Clara avatar */}
        <div
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
        >
          C
        </div>

        {/* Identity text */}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <>
              <div className="mb-1 h-3.5 w-10 animate-shimmer rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 [background-size:200%_100%]" />
              <div className="h-3 w-32 animate-shimmer rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 [background-size:200%_100%]" />
            </>
          ) : (
            <>
              <p
                role="heading"
                aria-level={1}
                className="text-sm font-semibold text-gray-900"
              >
                Clara
              </p>
              <p className="truncate text-xs text-gray-500">
                AI Receptionist for{' '}
                <span className="font-medium text-brand-700">{displayName}</span>
              </p>
            </>
          )}
        </div>

        {/* Business avatar */}
        {!isLoading && (
          <div
            data-testid="business-avatar"
            aria-hidden="true"
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColor}`}
          >
            {avatarLetter}
          </div>
        )}

        {/* Status */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-500">{label}</span>
        </div>
      </div>
    </header>
  )
}
