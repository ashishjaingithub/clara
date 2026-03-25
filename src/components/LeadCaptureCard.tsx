'use client'

import { useEffect, useRef, useState } from 'react'

interface LeadData {
  name: string
  email?: string
  phone?: string
}

interface LeadCaptureCardProps {
  onSubmit: (lead: LeadData) => void
  onDismiss: () => void
  businessName?: string | null
}

interface FormErrors {
  name?: string
  contact?: string
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidPhone(value: string): boolean {
  return /[\d]{7,}/.test(value.replace(/[\s\-().+]/g, ''))
}

export function LeadCaptureCard({
  onSubmit,
  onDismiss,
  businessName,
}: LeadCaptureCardProps): JSX.Element {
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  // Focus name field on mount
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) {
      errs.name = 'Name is required'
    }
    if (!contact.trim()) {
      errs.contact = 'Email or phone is required'
    } else if (!isValidEmail(contact) && !isValidPhone(contact)) {
      errs.contact = 'Enter a valid email address or phone number'
    }
    return errs
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const lead: LeadData = { name: name.trim() }
    if (isValidEmail(contact)) {
      lead.email = contact.trim()
    } else {
      lead.phone = contact.trim()
    }

    setSubmitted(true)
    onSubmit(lead)
  }

  const displayName = businessName ?? 'This Business'

  // Post-submit confirmation state
  if (submitted) {
    return (
      <div
        data-testid="lead-capture-card"
        className="flex gap-3 animate-slide-up"
      >
        <div
          aria-hidden="true"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
        >
          C
        </div>
        <div className="max-w-[80%] rounded-chat rounded-tl-sm border border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-bubble">
          Thanks {name}. The team at {displayName} will reach out within 1 business day.
          In the meantime, feel free to keep asking questions.
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="lead-capture-card"
      className="flex gap-3 animate-slide-up"
    >
      {/* Clara avatar */}
      <div
        aria-hidden="true"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
      >
        C
      </div>

      {/* Card */}
      <div className="w-full max-w-[80%] rounded-chat border border-gray-200 bg-white p-4 shadow-card">
        <p className="mb-3 text-sm font-semibold text-gray-800">
          Leave your info and we&apos;ll get back to you
        </p>

        <form onSubmit={handleSubmit} noValidate aria-label="Lead capture form">
          {/* Name field */}
          <div className="mb-3">
            <label
              htmlFor="lead-name"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Name <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="lead-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
              }}
              placeholder="Your name"
              autoComplete="name"
              style={{ fontSize: '16px' }}
              className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 ${
                errors.name ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-brand-400'
              }`}
              aria-describedby={errors.name ? 'lead-name-error' : undefined}
              aria-required="true"
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name && (
              <p id="lead-name-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Contact field */}
          <div className="mb-3">
            <label
              htmlFor="lead-contact"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Email or phone <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="lead-contact"
              type="text"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value)
                if (errors.contact) setErrors((prev) => ({ ...prev, contact: undefined }))
              }}
              placeholder="you@example.com or 555-1234"
              autoComplete="email"
              style={{ fontSize: '16px' }}
              className={`min-h-[44px] w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand-200 ${
                errors.contact ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-brand-400'
              }`}
              aria-describedby={errors.contact ? 'lead-contact-error' : undefined}
              aria-required="true"
              aria-invalid={errors.contact ? 'true' : 'false'}
            />
            {errors.contact && (
              <p id="lead-contact-error" className="mt-1 text-xs text-red-600" role="alert">
                {errors.contact}
              </p>
            )}
          </div>

          {/* Message field (optional) */}
          <div className="mb-4">
            <label
              htmlFor="lead-message"
              className="mb-1 block text-xs font-medium text-gray-700"
            >
              Message{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="lead-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              placeholder="Anything you'd like us to know..."
              rows={2}
              style={{ fontSize: '16px' }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 resize-none"
              aria-label="Optional message"
              data-testid="lead-capture-notes"
            />
            <p className="mt-0.5 text-right text-2xs text-gray-400">
              {message.length}/1000
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="min-h-[44px] w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            aria-label="Submit contact information"
            data-testid="lead-capture-submit"
          >
            Get a callback
          </button>

          {/* Dismiss */}
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full text-center text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
            aria-label="Dismiss lead capture form"
            data-testid="lead-capture-dismiss"
          >
            No thanks
          </button>
        </form>
      </div>
    </div>
  )
}
