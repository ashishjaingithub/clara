'use client'

const DEFAULT_CHIPS = [
  "What are your hours?",
  "Where are you located?",
  "What services do you offer?",
  "How do I get in touch?",
]

interface StarterChipsProps {
  chips?: string[]
  onSelect: (chip: string) => void
  disabled?: boolean
}

export function StarterChips({
  chips = DEFAULT_CHIPS,
  onSelect,
  disabled = false,
}: StarterChipsProps): JSX.Element {
  return (
    <div
      data-testid="starter-chips"
      className="ml-11 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      aria-label="Suggested questions"
      role="group"
    >
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          disabled={disabled}
          aria-label={chip}
          className="min-h-[44px] flex-shrink-0 rounded-pill border border-brand-200 bg-white px-4 py-2.5 text-sm text-brand-700 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
