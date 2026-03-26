'use client'

import { useErrorCapture } from '@/lib/error-capture/error-hooks'

export function ErrorCaptureProvider() {
  useErrorCapture('clara')
  return null
}
