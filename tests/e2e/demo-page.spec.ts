/**
 * E2E: /demo/[uuid] — chat UI page
 *
 * Flow coverage (desktop + mobile viewports):
 *   - Demo page loads without JS errors and renders chat interface
 *   - Welcome message and starter chips are visible on fresh session
 *   - Message input field and send button are present and interactive
 *   - Typing in the input does not crash the page
 *   - Invalid / unknown UUID shows error state ("Demo not found")
 *   - Mobile viewport: chat UI renders correctly, input is accessible
 *
 * The production build is used for the E2E server (see playwright.config.ts).
 * Groq API calls are intercepted via page.route() on /api/chat so tests do not
 * depend on real Groq availability.
 */

import { test, expect, type Page } from '@playwright/test'
import { operatorHeaders } from './helpers'

/**
 * Create a demo session via the API and return the UUID so we can navigate to the page.
 */
async function createDemoSession(page: Page, companyId = 'ui-test-company'): Promise<string> {
  const response = await page.request.post('/api/demo', {
    headers: operatorHeaders(),
    data: { hubspot_company_id: companyId },
  })
  expect(response.status()).toBe(201)
  const body = await response.json() as { sessionId: string }
  return body.sessionId
}

/**
 * Navigate to /demo/[uuid] and wait for the chat interface to become interactive.
 * Waits for the message input to appear — this confirms React has hydrated and the
 * session API call completed successfully.
 */
async function navigateToDemoPage(page: Page, sessionId: string): Promise<void> {
  await page.goto(`/demo/${sessionId}`)
  // Wait for the message input — proxy for "page fully loaded and session fetched"
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 20000 })
}

/**
 * Intercept /api/chat POST and return a canned response so tests are deterministic.
 */
async function mockChatRoute(page: Page, reply = 'Thank you for your message!'): Promise<void> {
  await page.route('/api/chat', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          reply,
          messageId: 'mock-msg-id-' + Math.random().toString(36).slice(2),
        }),
      })
    } else {
      await route.continue()
    }
  })
}

// ─── Desktop tests ────────────────────────────────────────────────────────────

test.describe('Demo page — desktop', () => {
  test('loads chat interface with no JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const sessionId = await createDemoSession(page, 'desktop-load-test')
    await navigateToDemoPage(page, sessionId)

    await expect(page).toHaveURL(`/demo/${sessionId}`)

    // No uncaught JS errors — log them if present for diagnosability
    if (errors.length > 0) {
      console.log('[E2E] JS errors on page:', errors)
    }
    expect(errors).toHaveLength(0)

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-loaded.png' })
  })

  test('shows welcome message and starter chips before first message', async ({ page }) => {
    const sessionId = await createDemoSession(page, 'welcome-chips-test')
    await navigateToDemoPage(page, sessionId)

    // Welcome message is rendered in the assistant bubble
    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    await expect(messageLog).toBeVisible()

    // The welcome text should mention "Clara"
    await expect(messageLog).toContainText('Clara')

    // Starter chips should be visible (rendered as buttons with topic keywords)
    const chips = page.getByRole('button').filter({ hasText: /hours|appointment|book|services/i })
    await expect(chips.first()).toBeVisible()

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-welcome.png' })
  })

  test('message input field and send button are present', async ({ page }) => {
    const sessionId = await createDemoSession(page, 'input-test')
    await navigateToDemoPage(page, sessionId)

    // Text input for chat messages
    const input = page.getByRole('textbox')
    await expect(input).toBeVisible()
    await expect(input).toBeEnabled()

    // Send button
    const sendBtn = page.getByRole('button', { name: /send/i })
    await expect(sendBtn).toBeVisible()

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-input.png' })
  })

  test('user can type a message and see it appear in the chat', async ({ page }) => {
    await mockChatRoute(page, 'Our hours are 9am to 5pm, Monday through Friday.')

    const sessionId = await createDemoSession(page, 'send-message-test')
    await navigateToDemoPage(page, sessionId)

    const input = page.getByRole('textbox')
    await input.fill('What are your hours?')

    const sendBtn = page.getByRole('button', { name: /send/i })
    await sendBtn.click()

    // User message should appear in the conversation log
    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    await expect(messageLog).toContainText('What are your hours?')

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-sent.png' })
  })

  test('assistant reply appears after sending a message', async ({ page }) => {
    const replyText = 'Our hours are 9am to 5pm, Monday through Friday.'
    await mockChatRoute(page, replyText)

    const sessionId = await createDemoSession(page, 'reply-appears-test')
    await navigateToDemoPage(page, sessionId)

    const input = page.getByRole('textbox')
    await input.fill('What are your hours?')
    await page.keyboard.press('Enter')

    // Wait for the mocked reply to show up — 15s allows for typing indicator animation
    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    await expect(messageLog).toContainText(replyText, { timeout: 15000 })

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-reply.png' })
  })

  test('pressing Enter sends the message', async ({ page }) => {
    await mockChatRoute(page, 'Sure, I can help with that!')

    const sessionId = await createDemoSession(page, 'enter-send-test')
    await navigateToDemoPage(page, sessionId)

    const input = page.getByRole('textbox')
    await input.fill('Do you offer free consultations?')
    await page.keyboard.press('Enter')

    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    await expect(messageLog).toContainText('Do you offer free consultations?')
  })

  test('starter chip click sends a message', async ({ page }) => {
    await mockChatRoute(page, 'We are open Monday to Friday.')

    const sessionId = await createDemoSession(page, 'chip-click-test')
    await navigateToDemoPage(page, sessionId)

    // Find and click any starter chip
    const chips = page.getByRole('button').filter({ hasText: /hours|appointment|book|services/i })
    const firstChip = chips.first()
    const chipText = await firstChip.textContent()
    await firstChip.click()

    // The chip text should appear as a user message
    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    if (chipText) {
      await expect(messageLog).toContainText(chipText.trim(), { timeout: 10000 })
    }
  })

  test('shows error state for a non-existent session UUID', async ({ page }) => {
    await page.goto('/demo/00000000-0000-4000-8000-000000000099')
    await page.waitForLoadState('networkidle')

    // Error alert should be shown — filter out Next.js's hidden route announcer alert element
    const alert = page.getByRole('alert').filter({ hasText: /not found|expired|invalid/i })
    await expect(alert).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-desktop-404.png' })
  })
})

// ─── Mobile tests ─────────────────────────────────────────────────────────────

test.describe('Demo page — mobile', () => {
  test('renders chat UI correctly on mobile viewport', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    const sessionId = await createDemoSession(page, 'mobile-render-test')
    await navigateToDemoPage(page, sessionId)

    if (errors.length > 0) {
      console.log('[E2E mobile] JS errors on page:', errors)
    }
    expect(errors).toHaveLength(0)

    // Message input must be visible and not overflow
    const input = page.getByRole('textbox')
    await expect(input).toBeVisible()

    // Input should be within viewport bounds
    const inputBox = await input.boundingBox()
    const viewportSize = page.viewportSize()

    if (inputBox && viewportSize) {
      expect(inputBox.x).toBeGreaterThanOrEqual(0)
      expect(inputBox.x + inputBox.width).toBeLessThanOrEqual(viewportSize.width + 1)
    }

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-mobile-loaded.png' })
  })

  test('send button is within viewport and tappable on mobile', async ({ page }) => {
    const sessionId = await createDemoSession(page, 'mobile-send-btn-test')
    await navigateToDemoPage(page, sessionId)

    const sendBtn = page.getByRole('button', { name: /send/i })
    await expect(sendBtn).toBeVisible()

    const btnBox = await sendBtn.boundingBox()
    const viewportSize = page.viewportSize()

    if (btnBox && viewportSize) {
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(viewportSize.width + 1)
      // Touch target minimum: at least 36px (with slight tolerance below 44px WCAG recommendation)
      expect(btnBox.width).toBeGreaterThanOrEqual(36)
      expect(btnBox.height).toBeGreaterThanOrEqual(36)
    }

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-mobile-send-btn.png' })
  })

  test('user can send a message on mobile', async ({ page }) => {
    await mockChatRoute(page, 'Hello! I can help you with that.')

    const sessionId = await createDemoSession(page, 'mobile-send-test')
    await navigateToDemoPage(page, sessionId)

    const input = page.getByRole('textbox')
    await input.click()
    await input.fill('Hello!')

    const sendBtn = page.getByRole('button', { name: /send/i })
    await sendBtn.click()

    const messageLog = page.getByRole('log', { name: /conversation with clara/i })
    await expect(messageLog).toContainText('Hello!')

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-mobile-sent.png' })
  })

  test('shows "Demo not found" error on mobile for invalid UUID', async ({ page }) => {
    await page.goto('/demo/00000000-0000-4000-8000-000000000098')
    await page.waitForLoadState('networkidle')

    // Filter out Next.js's hidden route announcer which also has role="alert"
    const alert = page.getByRole('alert').filter({ hasText: /not found|expired|invalid/i })
    await expect(alert).toBeVisible({ timeout: 10000 })

    await page.screenshot({ path: 'playwright-report/screenshots/demo-page-mobile-404.png' })
  })
})
