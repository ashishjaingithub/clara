# Clara — Design Specification

**Version:** 1.0
**Date:** 2026-03-24
**Phase:** Explore (v1 Demo Tool)
**Author:** ArchitectUX Agent
**Input documents:** PRD v1.0, UX Research v1.0, Architecture v1.0, existing `page.tsx`

---

## 1. Information Architecture

### 1.1 Page Structure

Clara v1 is a single-page application with one primary user-facing route. There is no site
navigation — the demo page is a self-contained experience.

```
/demo/[uuid]          — Primary user-facing page (SMB prospect + end customer)
/                     — Redirect to a landing or 404 (no public homepage in v1)
```

All operator functionality (session creation, engagement monitoring) is API-only in v1.
There is no operator UI page.

### 1.2 Page Anatomy

The demo page is composed of five vertical zones stacked full-height. On mobile, all five
zones occupy the full viewport height with the chat area scrollable and the input pinned to
the bottom above the virtual keyboard.

```
+--------------------------------------------+
|  DEMO BANNER (fixed top, 40px)             |
|  "This is a preview of what your AI        |
|   receptionist would look like for         |
|   [Business Name]"                         |
+--------------------------------------------+
|  CHAT HEADER (fixed, 64px)                 |
|  Clara avatar · business name · status     |
+--------------------------------------------+
|                                            |
|  CHAT AREA (scrollable flex-1)             |
|  - Welcome message (before first send)     |
|  - Starter question chips (before first    |
|    send, disappear after first message)    |
|  - Message thread (user + assistant)       |
|  - Typing indicator (while loading)        |
|  - Lead capture card (contextual)          |
|                                            |
+--------------------------------------------+
|  MESSAGE INPUT BAR (fixed bottom, 72px)    |
|  text input + send button                  |
+--------------------------------------------+
|  DEMO FOOTER (fixed bottom below input,    |
|  32px, collapsible)                        |
|  "Want this for [your business]?"          |
|  + operator contact link                   |
+--------------------------------------------+
```

### 1.3 URL Structure

```
/demo/[uuid]
```

- `uuid` is a cryptographically random UUID v4 (122 bits of entropy)
- No business name, company ID, or PII in the URL
- UUID is the capability token — possession grants access to that session
- URLs are designed to be shareable (Maria sends to her husband, James shares with a friend)

### 1.4 Page States

| State | Trigger | What user sees |
|-------|---------|----------------|
| Loading | Page mount, session fetch in-flight | Centered spinner, "Loading demo..." |
| Error / Not Found | Session UUID not found in DB | Error card with explanation |
| Ready — Empty | Session loaded, no prior messages | Welcome message + starter chips |
| Active — Chatting | After first message sent | Message thread, input bar enabled |
| Sending | User message sent, awaiting LLM | Typing indicator in chat, input disabled |
| Lead Capture | Agent triggers or user requests follow-up | Lead capture card slides into chat |
| Rate Limited | 429 from API | Inline error message in chat thread |

---

## 2. Component Inventory

Each component is described with: purpose, visual structure, states, props contract, and
accessibility requirements.

---

### 2.1 DemoBanner

**Purpose:** Frames the experience as a preview/demo for Maria (the SMB prospect). Prevents
confusion — she understands this is not a live deployment yet. Also prevents James (if he
encounters a forwarded link) from thinking he's speaking to a live receptionist.

**Visual structure:** A full-width sticky bar pinned to the top of the viewport, below the
browser chrome. Subtle background, no close button (it stays visible).

**Placement:** Above the ChatHeader. Fixed position, z-index above chat content.

**Height:** 40px on desktop, 44px on mobile (accounts for larger tap targets).

**States:**

| State | Description |
|-------|-------------|
| Default | Shows business name prominently. Soft indigo or amber background. |
| Loading | Shows "Loading preview..." with business name placeholder |
| Fallback | Shows "This Business" if Hunter API is unreachable |

**Content template:**
```
"Preview — See what [Business Name]'s AI receptionist could say to a new customer"
```

The word "Preview" appears in a pill badge with slightly higher contrast. Business name is
bold. The text does not wrap to a second line on any viewport above 320px.

**Props (conceptual):**
```typescript
interface DemoBannerProps {
  businessName: string        // "Maria's Hair Studio" or "This Business"
  isLoading: boolean
}
```

**Accessibility:**
- `role="banner"` on the outer element (landmark)
- Text contrast must meet WCAG AA (4.5:1 minimum for normal text)
- Not dismissible — do not use `aria-live` (not dynamic content)

---

### 2.2 ChatHeader

**Purpose:** Establishes Clara's identity and the business it represents. This is the first
place Maria checks for her business name. Must render the business name prominently and
immediately. The presence of the business name here, before she has typed anything, is the
primary trust signal.

**Visual structure:** Full-width, white background, bordered bottom. Contains:
- Clara avatar (initial or icon, 40px circle)
- Two-line identity text block (Clara name + business name)
- Online status indicator (green dot + "Online" label)

**Height:** 64px on all viewports.

**States:**

| State | Description |
|-------|-------------|
| Default | Business name populated, green "Online" badge |
| Loading | Avatar and text blocks replaced with skeleton shimmer |
| Offline / error | Status shows amber dot + "Connecting..." (shown during fetch) |

**Business name placement:** Line 2 below "Clara" in slightly smaller, muted text. Format:
`AI Receptionist for [Business Name]`. Business name inherits brand color (indigo-700 in
default theme) to provide visual salience — Maria's eye goes there first.

**Props (conceptual):**
```typescript
interface ChatHeaderProps {
  businessName: string
  isLoading: boolean
  status: 'online' | 'connecting' | 'error'
}
```

**Accessibility:**
- `role="heading"` with `aria-level="1"` on the Clara name element — this is the page's H1
- Business name should be included in the `<title>` element: `"Clara — Maria's Hair Studio"`
- Green/amber status dots must have a text label alongside them (color alone is not sufficient
  for colorblind users — WCAG 1.4.1)

---

### 2.3 ChatArea

**Purpose:** The scrollable container for the entire message thread. Manages scroll behavior,
contains all message sub-components, handles the empty state with welcome content.

**Visual structure:** A flex-1 overflow-y-auto container with a light neutral background
(`gray-50` / `#F9FAFB`). Message bubbles are inset with horizontal padding. Max content
width of 640px centered on desktop.

**Scroll behavior:**
- Auto-scrolls to the most recent message when a new message is added
- Smooth scroll (`behavior: 'smooth'`)
- On mobile, when the keyboard opens and the viewport shrinks, the chat area must scroll
  so the most recent message is visible above the input bar (see Section 6 for iOS/Android
  keyboard handling)

**States:**

| State | Content |
|-------|---------|
| Empty | WelcomeMessage + StarterChips |
| Loading session | Skeleton placeholder (2–3 ghost bubbles) |
| Has messages | Message thread + optional typing indicator |
| With lead capture | Lead capture card inserted after most recent assistant message |

**Props (conceptual):**
```typescript
interface ChatAreaProps {
  messages: Message[]
  isLoading: boolean         // LLM response in-flight
  sessionLoading: boolean    // Initial session fetch
  businessName: string
  showLeadCapture: boolean
  onLeadCaptureSubmit: (data: LeadData) => void
  messagesEndRef: React.RefObject<HTMLDivElement>
}
```

**Accessibility:**
- `role="log"` on the message list container (ARIA live region for chat)
- `aria-live="polite"` — new assistant messages announced to screen readers without
  interrupting what the user is currently hearing
- `aria-label="Conversation with Clara"` on the log container
- Scroll region must be keyboard-navigable (focusable, arrow key scroll)

---

### 2.4 WelcomeMessage

**Purpose:** Clara's first message, displayed before the user sends anything. Must establish
the business name, signal competence, and invite engagement — all in 1–2 sentences. This
message is rendered client-side immediately on load; it does not require an LLM call.

**Visual structure:** Identical to an assistant MessageBubble (white bubble, left-aligned,
with Clara avatar). Uses the same component to maintain visual consistency.

**Content template:**
```
"Hi! I'm Clara, the AI receptionist for [Business Name]. Ask me about hours,
services, pricing, or how to book an appointment."
```

Key constraints on copy:
- Business name must appear in this message (trust signal #2 — after the header)
- No filler phrases: not "I'd be happy to help!", not "How can I assist you today?"
- Action-oriented close: tell the user what to ask, not just that they can ask anything

**States:**

| State | Description |
|-------|-------------|
| Default | Populated with business name |
| Fallback | "Hi! I'm Clara, an AI receptionist. Ask me about this business's hours, services, and how to book." |
| Hidden | Not rendered once messages array has length > 0 |

**Accessibility:**
- This is a live region update. When it appears, screen readers announce it.
- Do not mark with `aria-live="assertive"` — polite announcement only

---

### 2.5 StarterChips

**Purpose:** Reduce friction for Maria and James. They should not have to think about what
to type — these chips suggest the most common questions and get the conversation started
with one tap. They disappear permanently after the user sends their first message (chips are
onboarding aids, not persistent controls).

**Visual structure:** A horizontally scrollable row of pill buttons, indented to align with
the WelcomeMessage bubble (not full-width). Each chip is a rounded pill with indigo border
and white background. On mobile, the row scrolls horizontally if chips overflow — chips do
not wrap to a second row (prevents layout shift when keyboard opens).

**Chip content (v1 defaults):**
```
"What are your hours?"
"What services do you offer?"
"How do I book an appointment?"
```

These are intentionally generic because the business type is unknown at design time.
The agent prompt instructs Clara to answer these questions specifically based on the
business profile.

**States:**

| State | Description |
|-------|-------------|
| Default | Three chips, tappable |
| Disabled | Chips fade to 50% opacity while LLM response is in-flight |
| Hidden | Component unmounts after `messages.length > 0` — not just visually hidden |

**Touch target:** Each chip must have a minimum touch target of 44x44px (CSS: minimum
`height: 44px`, `padding: 10px 16px`). Text size: 14px.

**Props (conceptual):**
```typescript
interface StarterChipsProps {
  questions: string[]
  onSelect: (question: string) => void
  disabled: boolean
}
```

**Accessibility:**
- Each chip is a `<button>` element, not a link
- `aria-label` on each button matching its visible text
- When disabled, `disabled` attribute set (not just visual opacity)

---

### 2.6 MessageBubble

**Purpose:** Displays a single message — either from the user (right-aligned, indigo) or
from Clara (left-aligned, white). This is the core repeating unit of the chat interface.

**Visual structure:**

User bubble (right-aligned):
- Background: `--primary-600` (indigo)
- Text: white
- Border radius: `--radius-chat` on all corners except top-right (`--radius-sm`)
- Max width: 75% of container on desktop, 85% on mobile
- No avatar

Assistant bubble (left-aligned):
- Background: white
- Text: `--text-primary`
- Border: `1px solid --border-subtle`
- Border radius: `--radius-chat` on all corners except top-left (`--radius-sm`)
- Max width: 75% of container on desktop, 85% on mobile
- Preceded by Clara avatar (32px circle)

The "snipped corner" (tl or tr-sm radius) creates the speech-bubble tail effect. This is
achieved with a single border-radius value override — no additional pseudo-element required.

**Avatar:** Only rendered for assistant messages. A 32px circle with indigo background and
white "C" initial. Same avatar appears in ChatHeader. Provides visual continuity — Maria
associates "C" with Clara.

**Timestamp:** Not rendered in v1. The conversation is short (10–20 messages typical) and
timestamps add visual noise. If timestamp is needed in future, display on hover/focus only.

**States:**

| State | Description |
|-------|-------------|
| Default | Rendered with content |
| Error | Same bubble structure, but background `--error-bg`, text `--error-text`, with warning icon |

**Props (conceptual):**
```typescript
interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}
```

**Accessibility:**
- Each message group (avatar + bubble) wrapped in a `<div>` with no explicit role — the
  parent `role="log"` provides the semantic context
- Error messages should include `role="alert"` on the error bubble for immediate announcement
- Message content is plain text only in v1 — no markdown rendering (avoids XSS risk from
  LLM output and parsing complexity)

---

### 2.7 TypingIndicator

**Purpose:** Shows that Clara is generating a response. Critical for perceived performance —
research shows users tolerate 3-second waits when there is visible "thinking" activity, but
the same wait without feedback feels like a failure. Groq's typical latency is 1–2 seconds;
this indicator makes that latency feel intentional and human.

**Visual structure:** Rendered as an assistant MessageBubble with three animated dots instead
of text content. Avatar is present (same as regular assistant bubbles). Dots bounce with a
staggered vertical animation.

**Animation specification:**
- Three dots, 8px diameter each, spaced 4px apart
- Each dot performs a `translateY(-4px)` bounce over 600ms with `ease-in-out`
- Delay offset: dot 1 = 0ms, dot 2 = 150ms, dot 3 = 300ms
- Loop: infinite
- Dot color: `--text-tertiary` (`gray-400`)

**Visibility:** Rendered only while `loading === true`. Must appear immediately when a
message is submitted (before the API call completes) to prevent the visual gap where the
user message appears but nothing else is happening.

**States:**

| State | Description |
|-------|-------------|
| Active | Three dots animating, avatar present |
| Hidden | Component not mounted (not just `display: none` — avoid layout thrash) |

**Accessibility:**
- `aria-label="Clara is typing"` on the container
- `aria-live="polite"` — announced when it appears but does not interrupt

---

### 2.8 LeadCaptureCard

**Purpose:** A contextual inline form that appears within the chat thread when:
(a) the visitor asks for follow-up or a callback, or (b) Clara cannot answer a complex
question and offers to connect the visitor with the team.

This must feel like a natural part of the conversation — not a modal, not a page
overlay, not a separate form page. It slides into the chat thread as if Clara placed
it there.

**Visual structure:** Displayed as an assistant-side card (left-aligned, same left margin
as assistant bubbles, but wider — up to 80% of container). White background, subtle shadow,
rounded corners. Contains:
- A brief heading: "Leave your info and we'll get back to you"
- Three fields: Name (required), Contact — email or phone (required, one of the two),
  Message (optional, textarea, max 200 chars)
- A submit button ("Send" or "Get a callback")
- A cancel/dismiss link below the button
- Post-submit confirmation state (replaces form with confirmation message)

**Trigger behavior:** The LeadCaptureCard is inserted into the chat thread programmatically
after the assistant message that triggers it. It does not replace the message — it appears
below it as a new chat item.

**Slide-in animation:** Enters from below with a `translateY(16px)` to `translateY(0)` over
200ms ease-out. This matches the timing of message bubble animations.

**Form validation:**
- Name: required, min 1 character
- Contact: required, one of email (format validated) or phone (7+ digits)
- Message: optional
- Validation is inline — error text appears beneath the relevant field, not in a toast
- Submit is disabled until minimum required fields are valid

**Post-submit state:** Form replaced with a confirmation bubble (same style as assistant
bubble):
```
"Thanks [Name]. The team at [Business Name] will reach out within 1 business day.
In the meantime, feel free to keep asking questions."
```

**States:**

| State | Description |
|-------|-------------|
| Default | Empty form, submit disabled |
| Filling | User typing, validation runs on blur |
| Invalid | Error text under fields, submit still disabled |
| Valid | Submit enabled |
| Submitting | Submit button replaced with spinner, fields disabled |
| Success | Form unmounts, confirmation bubble inserted in thread |
| Error | Inline error: "Something went wrong. Please try again." |

**Props (conceptual):**
```typescript
interface LeadCaptureCardProps {
  businessName: string
  onSubmit: (data: LeadData) => Promise<void>
  onDismiss: () => void
}

interface LeadData {
  name: string
  contact: string       // email or phone — validated client-side
  message?: string
  sessionId: string
}
```

**Accessibility:**
- All form fields have visible `<label>` elements (not placeholder-only)
- Error messages use `aria-describedby` linking field to its error
- Submit button state communicated via `aria-disabled` when disabled
- Focus management: when card appears, focus moves to the Name field
- When dismissed, focus returns to the message input

---

### 2.9 MessageInputBar

**Purpose:** The primary interaction point. Allows the user to compose and send messages.
Must remain accessible and prominent even when the virtual keyboard is open on mobile.

**Visual structure:** Full-width, white background, bordered top. Contains:
- A rounded pill text input (flex-1)
- A circular send button (44px, indigo)

The pill input uses `border-radius: 9999px` to match the message bubble aesthetic. The send
button uses a paper-airplane icon (the same SVG currently in the codebase).

**Input behavior:**
- `placeholder` text: `"Ask anything..."`  (not "Type a message" — "Ask" implies purpose)
- Enter key (no shift) submits the message
- Shift+Enter: no-op in v1 (single-line input only — multi-line is unnecessary for this
  use case and adds complexity)
- Input is cleared immediately on submit (optimistic update)
- Input is disabled while `loading === true`

**Send button behavior:**
- Disabled when input is empty or whitespace-only, or when `loading === true`
- `aria-label="Send message"` (icon-only button)
- Touch target: 44x44px minimum

**States:**

| State | Description |
|-------|-------------|
| Default | Enabled, empty, placeholder visible |
| Has content | Send button enabled (full opacity) |
| Loading | Input and button disabled, button shows spinner icon |
| Rate limited | Input disabled, inline message appears above input bar |
| Message limit reached | Input disabled, message: "This demo has reached its message limit." |

**Props (conceptual):**
```typescript
interface MessageInputBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  isLoading: boolean
}
```

**Accessibility:**
- `<input type="text">` (not `contenteditable`) — ensures browser autocomplete, spell
  check, and virtual keyboard behaviors work correctly
- Input has an associated `<label>` that is visually hidden but present in DOM:
  `<label className="sr-only" htmlFor="message-input">Message Clara</label>`
- Send button has `aria-label="Send message"` and correct `disabled` attribute

---

### 2.10 DemoFooter

**Purpose:** Provides a conversion path for Maria. After she's impressed by the demo, there
needs to be a clear, low-friction next step visible without her having to find the original
cold email. This is the CTA that closes the sales loop for Ashish.

**Visual structure:** Full-width, very subtle background (`gray-50` with `border-t`). Small
text (12px). Contains:
- Copy: "Want this for [Business Name]?"
- A link/button: "Talk to us" (opens `mailto:` or a Calendly link, configurable per session)

**Placement:** Below the MessageInputBar. On mobile, it sits below the input bar in the
scrollable area (it is NOT fixed to the viewport — the input bar is fixed, the footer scrolls
with the page to avoid competing for viewport real estate with the keyboard).

**Visibility:** On mobile viewports, the footer is not shown by default. It appears only when:
(a) the user has sent at least 2 messages, OR (b) the conversation has been idle for 30 seconds.
This prevents it from appearing before Maria has evaluated the demo.

On desktop, the footer is always visible.

**States:**

| State | Description |
|-------|-------------|
| Hidden | Mobile, < 2 messages sent |
| Visible | Mobile after engagement threshold, or always on desktop |

**Accessibility:**
- "Talk to us" link must have descriptive `aria-label`: `"Talk to us about Clara for [businessName]"`
- If it opens a new tab/window, include `target="_blank"` with `rel="noopener noreferrer"`
  and add a screen-reader-visible "(opens in new tab)" suffix

---

### 2.11 LoadingScreen

**Purpose:** Shown during the initial session fetch (before chat UI is rendered). Must be
visually on-brand and not look like a generic browser spinner.

**Visual structure:** Full-viewport centered layout, white/gray-50 background. Contains:
- An animated pulse ring or spinner in `--primary-600` (indigo)
- "Loading demo..." text in `--text-secondary`

**Duration context:** The session fetch involves two parallel requests (`/api/demo` +
`/api/chat`). On a normal mobile connection, this completes in 300–800ms. The loading
screen should feel like a brief transition, not a wait.

**Skeleton alternative (preferred):** Instead of a blank-and-spinner approach, render the
ChatHeader skeleton (gray shimmer blocks where the name and status will be) immediately.
This lets Maria see the "shape" of the interface before content loads, which is perceptually
faster than a spinner + content replacement.

---

### 2.12 ErrorScreen

**Purpose:** Shown when the session UUID is not found or the API returns an unrecoverable error.

**Visual structure:** Full-viewport centered layout. A contained card (white, rounded, shadow)
with:
- An icon (magnifying glass or similar — not an error icon which implies the user did something
  wrong, which they didn't)
- Heading: "Demo not found"
- Body: "This demo link may have expired or the link may be incomplete."
- No action button in v1 (the user has nothing to do — they should contact Ashish)

---

## 3. Design System Tokens

All tokens are defined as CSS custom properties on `:root`. The theme is "neutral professional"
— it works for any SMB vertical (hair salon, auto shop, plumber, accountant) without
suggesting an industry. Indigo is the brand color because it signals technology and trust
without the aggression of red or the passivity of gray.

### 3.1 Color Tokens

```css
:root {
  /* Primary — Indigo (Clara brand) */
  --primary-50:  #EEF2FF;
  --primary-100: #E0E7FF;
  --primary-200: #C7D2FE;
  --primary-500: #6366F1;
  --primary-600: #4F46E5;   /* primary CTA, user bubbles, avatar bg */
  --primary-700: #4338CA;   /* hover state */
  --primary-900: #312E81;

  /* Neutral — Gray */
  --gray-50:  #F9FAFB;      /* page background, chat area bg */
  --gray-100: #F3F4F6;      /* skeleton shimmer base */
  --gray-200: #E5E7EB;      /* borders, dividers */
  --gray-300: #D1D5DB;      /* input borders (default) */
  --gray-400: #9CA3AF;      /* placeholder text, typing dots, muted text */
  --gray-500: #6B7280;      /* secondary text */
  --gray-700: #374151;      /* primary body text */
  --gray-800: #1F2937;      /* high-emphasis text */
  --gray-900: #111827;      /* max contrast text */

  /* Semantic surface tokens */
  --bg-page:          var(--gray-50);
  --bg-surface:       #FFFFFF;         /* chat bubbles, header, input bar */
  --bg-surface-raised: #FFFFFF;        /* cards, modals */
  --bg-demo-banner:   var(--primary-50);

  /* Text tokens */
  --text-primary:     var(--gray-800);
  --text-secondary:   var(--gray-500);
  --text-tertiary:    var(--gray-400);
  --text-inverse:     #FFFFFF;
  --text-link:        var(--primary-600);

  /* Border tokens */
  --border-default:   var(--gray-200);
  --border-subtle:    var(--gray-100);  /* assistant bubble border */
  --border-input:     var(--gray-300);
  --border-input-focus: var(--primary-500);

  /* Status tokens */
  --status-online:    #22C55E;   /* green-500 */
  --status-connecting: #F59E0B;  /* amber-500 */

  /* Banner tokens */
  --banner-bg:        var(--primary-50);
  --banner-border:    var(--primary-100);
  --banner-text:      #3730A3;   /* primary-800 — sufficient contrast on primary-50 bg */

  /* Error tokens */
  --error-bg:         #FEF2F2;   /* red-50 */
  --error-border:     #FECACA;   /* red-200 */
  --error-text:       #DC2626;   /* red-600 */

  /* Shadow tokens */
  --shadow-bubble:    0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-card:      0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --shadow-header:    0 1px 3px 0 rgba(0, 0, 0, 0.05);
}
```

Note: No dark mode is defined for v1. The demo is a sales tool viewed in a single session.
Dark mode adds complexity (contrast verification across all components) without measurable
impact on conversion. Defer to v2 if user research indicates demand.

### 3.2 Typography Tokens

```css
:root {
  /* Font family — system stack, no web font load required */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica,
               Arial, sans-serif, "Apple Color Emoji";

  /* Scale */
  --text-xs:    0.75rem;     /* 12px — footer, captions */
  --text-sm:    0.875rem;    /* 14px — message content, chips, labels */
  --text-base:  1rem;        /* 16px — input placeholder, form fields */
  --text-lg:    1.125rem;    /* 18px — not used in v1 */

  /* Line height */
  --leading-tight:   1.25;
  --leading-snug:    1.375;
  --leading-normal:  1.5;    /* message bubble body */
  --leading-relaxed: 1.625;

  /* Font weight */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;
}
```

**Typography decisions:**

The system font stack is a deliberate choice for v1. It means:
- Zero network requests for fonts (speeds up FCP on mobile — critical for Maria opening on
  iPhone between clients)
- Native rendering on each OS (iOS uses San Francisco, Android uses Roboto, Windows uses
  Segoe UI — all are legible and professional)
- No FOUT (flash of unstyled text) or CLS (cumulative layout shift) from font loading

If a web font is desired in v2, Inter is the recommended choice (optimized for UI text,
variable font available, widely used in SaaS products — establishes the right "tech product"
tone without being distinctive enough to conflict with any SMB's brand).

**Type scale usage:**

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| "Clara" in header | `--text-sm` | `--font-semibold` | `--text-primary` |
| Business name in header | `--text-xs` | `--font-normal` | `--text-secondary` |
| Message bubble content | `--text-sm` | `--font-normal` | `--text-primary` (assistant) / white (user) |
| Demo banner | `--text-sm` | `--font-normal` | `--banner-text` |
| Input placeholder | `--text-sm` | `--font-normal` | `--text-tertiary` |
| Starter chip labels | `--text-xs` | `--font-normal` | `var(--primary-700)` |
| Demo footer | `--text-xs` | `--font-normal` | `--text-secondary` |
| Form labels | `--text-sm` | `--font-medium` | `--text-primary` |
| Error text | `--text-xs` | `--font-normal` | `--error-text` |

### 3.3 Spacing Scale

Based on a 4px grid. All values are multiples of 4.

```css
:root {
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.25rem;   /* 20px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
}
```

**Spacing application:**

| Element | Property | Value |
|---------|----------|-------|
| Chat area horizontal padding | `padding-inline` | `--space-4` (16px) |
| Chat area vertical padding | `padding-block` | `--space-6` (24px) |
| Gap between consecutive messages (same role) | `margin-top` | `--space-2` (8px) |
| Gap between messages (role switch) | `margin-top` | `--space-4` (16px) |
| Message bubble horizontal padding | `padding-inline` | `--space-4` (16px) |
| Message bubble vertical padding | `padding-block` | `--space-3` (12px) |
| Gap between avatar and bubble | `gap` | `--space-3` (12px) |
| Input bar padding | `padding` | `--space-4` (16px) |
| Input internal padding | `padding: --space-2-5 --space-4` | 10px 16px |
| Header padding | `padding` | `--space-4` (16px) |
| Lead capture card padding | `padding` | `--space-4` (16px) |
| Starter chips gap | `gap` | `--space-2` (8px) |

### 3.4 Border Radius Tokens

```css
:root {
  --radius-sm:    0.25rem;    /* 4px — snipped bubble corner */
  --radius-md:    0.5rem;     /* 8px — cards, lead capture */
  --radius-lg:    0.75rem;    /* 12px — not used in v1 */
  --radius-xl:    1rem;       /* 16px — not used in v1 */
  --radius-chat:  1.25rem;    /* 20px — message bubble radius */
  --radius-pill:  9999px;     /* input bar, chips, send button, status badge */
}
```

### 3.5 Shadow Tokens

```css
:root {
  --shadow-none: none;
  --shadow-xs:   0 1px 2px 0 rgba(0, 0, 0, 0.05);      /* bubble shadow */
  --shadow-sm:   0 1px 3px 0 rgba(0, 0, 0, 0.10),
                 0 1px 2px -1px rgba(0, 0, 0, 0.10);   /* card, lead form */
  --shadow-md:   0 4px 6px -1px rgba(0, 0, 0, 0.10),
                 0 2px 4px -2px rgba(0, 0, 0, 0.10);   /* elevated modal (future) */
}
```

### 3.6 Animation Tokens

```css
:root {
  --duration-fast:    150ms;
  --duration-normal:  200ms;
  --duration-slow:    300ms;
  --ease-standard:    cubic-bezier(0.4, 0, 0.2, 1);     /* material standard */
  --ease-decelerate:  cubic-bezier(0, 0, 0.2, 1);       /* enter animations */
  --ease-accelerate:  cubic-bezier(0.4, 0, 1, 1);       /* exit animations */
}
```

### 3.7 Layout Tokens

```css
:root {
  --max-width-chat:    640px;    /* max content width — constrain on wide screens */
  --height-banner:     40px;     /* demo banner */
  --height-header:     64px;     /* chat header */
  --height-input-bar:  72px;     /* input bar + padding */
  --avatar-size-lg:    40px;     /* header avatar */
  --avatar-size-sm:    32px;     /* message thread avatar */
}
```

---

## 4. HTML Prototype and Detailed Component Specs

### 4.1 Page Layout

The page uses a `display: flex; flex-direction: column; height: 100dvh` approach on the root
element. `100dvh` (dynamic viewport height) is critical for mobile — it accounts for the
browser chrome (address bar) collapsing and expanding, and correctly excludes the virtual
keyboard from the viewport calculation when combined with `position: fixed` on the input bar.

```html
<!-- Root layout -->
<div class="demo-page">           <!-- height: 100dvh, display: flex, flex-direction: column -->
  <div class="demo-banner" />     <!-- fixed, 40px, top: 0 -->
  <header class="chat-header" />  <!-- fixed, 64px, top: 40px -->
  <main class="chat-area" />      <!-- flex: 1, overflow-y: auto, pb: height-input-bar -->
  <footer class="input-bar" />    <!-- fixed, 72px, bottom: 0 -->
  <div class="demo-footer" />     <!-- in-flow, below input content (not fixed) -->
</div>
```

**Critical padding calculation for chat area:**
The chat area's bottom padding must equal the combined height of the fixed input bar plus the
demo footer. This ensures the last message is never hidden behind the input bar:

```css
.chat-area {
  padding-bottom: calc(var(--height-input-bar) + 48px); /* 48px = demo footer height */
}
```

On mobile when the keyboard is open, the `100dvh` shrinks and `position: fixed` on the
input bar keeps it anchored to the visible bottom of the viewport above the keyboard. The
chat area does not need to be resized — the fixed positioning handles it. See Section 6 for
iOS-specific caveats.

### 4.2 Message Bubble Layout

```
Assistant message group:
+--------+  +---------------------------+
| Avatar |  | Message content here.     |
| (32px) |  | This is a second line     |
+--------+  | of the message.           |
            +---------------------------+
            ↑ border-radius: radius-chat
              except top-left = radius-sm (tail)

User message group (right-aligned):
                    +---------------------------+
                    | User's message here.      |
                    +---------------------------+
                    ↑ border-radius: radius-chat
                      except top-right = radius-sm (tail)
                    (no avatar for user messages)
```

**CSS implementation pattern:**

```css
/* Assistant bubble */
.bubble-assistant {
  border-radius: var(--radius-chat);
  border-top-left-radius: var(--radius-sm);
}

/* User bubble */
.bubble-user {
  border-radius: var(--radius-chat);
  border-top-right-radius: var(--radius-sm);
}
```

### 4.3 Typing Indicator Animation

```css
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30%           { transform: translateY(-4px); }
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
  background-color: var(--text-tertiary);
  animation: typing-bounce 1.2s var(--ease-standard) infinite;
}

.typing-dot:nth-child(2) { animation-delay: 150ms; }
.typing-dot:nth-child(3) { animation-delay: 300ms; }
```

The animation uses a 1.2s cycle (not 600ms as stated in the component spec — the 600ms
was per-bounce; 1.2s accounts for the full down-up-rest cycle). Adjust to taste.

### 4.4 Lead Capture Slide-In Animation

```css
@keyframes slide-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.lead-capture-card {
  animation: slide-in-up var(--duration-normal) var(--ease-decelerate) both;
}
```

The card uses `animation-fill-mode: both` to hold the final state after animation completes.

### 4.5 Starter Chips Layout

```css
.starter-chips {
  display: flex;
  flex-wrap: nowrap;             /* single row */
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;        /* hide scrollbar on Firefox */
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-1); /* prevent chip shadow clipping */
}

.starter-chips::-webkit-scrollbar {
  display: none;                 /* hide scrollbar on Chrome/Safari */
}
```

On mobile, if all three chips fit (they should at 320px+), no scrolling occurs. If a
fourth chip is added in future, the row scrolls horizontally.

### 4.6 Demo Banner HTML Structure

```html
<div
  class="demo-banner"
  role="banner"
  aria-label="Demo preview notice"
>
  <span class="demo-badge">Preview</span>
  See what <strong class="business-name">{businessName}</strong>'s AI receptionist
  could say to a new customer
</div>
```

### 4.7 Chat Header HTML Structure

```html
<header class="chat-header" role="banner">
  <div class="header-inner">
    <!-- Avatar -->
    <div class="avatar avatar-lg" aria-hidden="true">C</div>

    <!-- Identity -->
    <div class="header-identity">
      <h1 class="header-name">Clara</h1>
      <p class="header-subtitle">
        AI Receptionist for
        <span class="header-business-name">{businessName}</span>
      </p>
    </div>

    <!-- Status indicator -->
    <div class="status-badge" role="status" aria-label="Clara is online">
      <span class="status-dot status-online" aria-hidden="true"></span>
      <span class="status-label">Online</span>
    </div>
  </div>
</header>
```

### 4.8 Message Input Bar HTML Structure

```html
<footer class="input-bar">
  <div class="input-bar-inner">
    <label for="message-input" class="sr-only">Message Clara</label>
    <input
      id="message-input"
      type="text"
      class="message-input"
      placeholder="Ask anything..."
      autocomplete="off"
      autocorrect="on"
      autocapitalize="sentences"
      spellcheck="true"
      aria-label="Message Clara"
    />
    <button
      type="button"
      class="send-button"
      aria-label="Send message"
      disabled
    >
      <!-- Paper airplane SVG icon -->
    </button>
  </div>
</footer>
```

Note on `autocapitalize="sentences"`: this is important for mobile UX. The first word of each
message is auto-capitalized, matching natural text-message behavior. James types in lowercase;
this ensures his messages look natural without requiring him to use shift.

### 4.9 Lead Capture Form HTML Structure

```html
<div class="lead-capture-card" role="region" aria-label="Contact form">
  <h2 class="lead-capture-heading">Leave your info and we'll get back to you</h2>

  <form class="lead-capture-form" novalidate>
    <!-- Name field -->
    <div class="form-field">
      <label for="lead-name" class="field-label">
        Your name <span class="required-mark" aria-hidden="true">*</span>
      </label>
      <input
        id="lead-name"
        name="name"
        type="text"
        class="field-input"
        autocomplete="name"
        required
        aria-required="true"
        aria-describedby="lead-name-error"
      />
      <p id="lead-name-error" class="field-error" role="alert" hidden></p>
    </div>

    <!-- Contact field -->
    <div class="form-field">
      <label for="lead-contact" class="field-label">
        Email or phone <span class="required-mark" aria-hidden="true">*</span>
      </label>
      <input
        id="lead-contact"
        name="contact"
        type="text"
        class="field-input"
        autocomplete="email tel"
        required
        aria-required="true"
        aria-describedby="lead-contact-error lead-contact-hint"
      />
      <p id="lead-contact-hint" class="field-hint">
        We'll use this to follow up with you.
      </p>
      <p id="lead-contact-error" class="field-error" role="alert" hidden></p>
    </div>

    <!-- Optional message -->
    <div class="form-field">
      <label for="lead-message" class="field-label">Message (optional)</label>
      <textarea
        id="lead-message"
        name="message"
        class="field-textarea"
        rows="2"
        maxlength="200"
        aria-describedby="lead-message-count"
      ></textarea>
      <p id="lead-message-count" class="field-hint char-count">0 / 200</p>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <button type="submit" class="btn-primary" aria-disabled="true">
        Get a callback
      </button>
      <button type="button" class="btn-dismiss">
        No thanks
      </button>
    </div>
  </form>
</div>
```

---

## 5. Accessibility Requirements

### 5.1 WCAG 2.1 AA Compliance Targets

All of the following apply to the demo page. These are requirements, not suggestions.

**Perceivable**

| Criterion | ID | Requirement |
|-----------|-----|-------------|
| Non-text content | 1.1.1 | Send button icon has `aria-label="Send message"`. Avatar has `aria-hidden="true"` (decorative). Status dot has `aria-hidden="true"` with adjacent text label. |
| Color contrast (normal text) | 1.4.3 | Minimum 4.5:1 ratio. `--text-primary` on white = 13.6:1. `--banner-text` on `--banner-bg` must be verified (see note below). |
| Color contrast (UI components) | 1.4.11 | Input border (`--border-input` = gray-300 on white) = 1.6:1 — FAILS without focus state. Input border must be at least `gray-400` (2.1:1) to pass. Focus ring must be 3:1 against adjacent colors. |
| Reflow | 1.4.10 | Content must reflow at 400% zoom without horizontal scroll (400% on 1280px viewport = 320px effective). The single-column chat layout naturally meets this. |
| Text spacing | 1.4.12 | No text must be clipped when line-height ≥ 1.5×, letter-spacing ≥ 0.12em, word-spacing ≥ 0.16em. |

Note on banner contrast: `#3730A3` (primary-800) on `#EEF2FF` (primary-50) = 7.2:1. This passes AA
and AAA.

**Actionable fix for input border:** Use `--gray-400` as the default border color, not `--gray-300`.
At `--gray-400` (#9CA3AF on white), the contrast ratio is 2.5:1 which still fails 3:1 for UI components
in isolation. The correct pattern is to provide a visible focus indicator (3:1 ring) rather than relying
on the border alone for identification. Tailwind's `focus:ring-2 focus:ring-indigo-400` provides this.

**Operable**

| Criterion | ID | Requirement |
|-----------|-----|-------------|
| Keyboard accessible | 2.1.1 | All interactive elements must be keyboard-operable: input, send button, starter chips, lead capture form fields, dismiss button. |
| No keyboard trap | 2.1.2 | Focus must not be trapped within the chat area. Verify that the lead capture card's focus management allows Escape to dismiss and return focus to input. |
| Focus visible | 2.4.7 | All interactive elements must have a visible focus indicator. Default browser outlines removed by Tailwind reset must be replaced with `focus-visible:ring-2 focus-visible:ring-indigo-500`. |
| Skip navigation | 2.4.1 | Not required (no repetitive navigation blocks). The page has no navigation — skip link is unnecessary. |

**Understandable**

| Criterion | ID | Requirement |
|-----------|-----|-------------|
| Language | 3.1.1 | `<html lang="en">` set in layout. |
| Focus on error | 3.3.1 | When lead capture form validation fails, error messages appear inline below the field and the first invalid field receives focus on submit attempt. |
| Error suggestion | 3.3.3 | Error messages describe what is wrong and how to fix it: "Please enter a valid email address" not just "Invalid input". |

**Robust**

| Criterion | ID | Requirement |
|-----------|-----|-------------|
| Name, role, value | 4.1.2 | All form controls have accessible names via `<label>` elements or `aria-label`. Status indicators use `role="status"`. Error regions use `role="alert"`. |
| Status messages | 4.1.3 | Typing indicator announcement uses `aria-live="polite"`. Error responses in chat use `role="alert"`. Rate limit messages use `role="alert"`. |

### 5.2 Chat-Specific Accessibility Patterns

**Live region for new messages:**

```html
<div
  class="message-log"
  role="log"
  aria-live="polite"
  aria-label="Conversation with Clara"
  aria-relevant="additions"
>
  <!-- Messages rendered here -->
</div>
```

`aria-relevant="additions"` ensures only new messages are announced, not the full history
on every render. `role="log"` implies `aria-live="polite"` but the explicit attribute is
included for clarity.

**Typing indicator announcement:**

```html
<div aria-live="polite" aria-label="Clara is typing" class="typing-container">
  <!-- Typing dots rendered here while loading -->
</div>
```

When the typing indicator is removed from the DOM, screen readers announce the next
inserted content (the assistant's response) via the log's `aria-live`. No separate
announcement of "done typing" is needed.

**Focus management for lead capture:**

When the lead capture card is inserted into the DOM (programmatically after a chat message):
1. `requestAnimationFrame` is used to wait for layout completion
2. Focus is moved to the first form field (`#lead-name`) using `.focus()`
3. On dismiss (user clicks "No thanks"): focus returns to `#message-input`
4. On submit success (card replaced by confirmation message): focus returns to `#message-input`

### 5.3 Screen Reader Reading Order

The visual and DOM order must match. Ensure:
- Demo banner appears first in DOM (before header)
- ChatHeader appears second
- ChatArea messages in chronological order (oldest to newest top-to-bottom = same as DOM order)
- Input bar appears last in DOM

This means the input bar is at the bottom of the DOM even though it is visually fixed — correct.
Screen readers navigate by DOM order, not visual position.

---

## 6. Mobile-First Specifications

### 6.1 Viewport and Base Styles

```css
/* Base mobile-first reset */
html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;  /* prevent iOS auto font scaling */
}

body {
  min-height: 100dvh;   /* dvh = dynamic viewport height — collapses with mobile browser chrome */
  overflow: hidden;     /* prevent body scroll — only chat-area scrolls */
  overscroll-behavior: none;  /* prevent pull-to-refresh on demo page */
}
```

### 6.2 Virtual Keyboard Handling

This is the most technically complex mobile UX problem for chat interfaces. When the virtual
keyboard opens on iOS or Android:
- The available viewport height shrinks
- Native apps "push up" the chat area so the input stays visible above the keyboard
- Web browsers handle this differently across iOS Safari, Chrome for iOS, Chrome for Android,
  and Samsung Internet

**The `100dvh` approach (recommended):**

`100dvh` (dynamic viewport height) is the correct unit for this use case. It:
- Reflects the visual viewport height (excludes virtual keyboard on iOS 16+, Chrome Android)
- Collapses when browser chrome appears (unlike `100vh` which is fixed to the initial viewport)

Combination with `position: fixed` on the input bar:

```css
.demo-page {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;   /* smooth scroll on iOS */
  overscroll-behavior-y: contain;      /* prevent scroll chaining to body */
}

.input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  /* On iOS Safari, env(safe-area-inset-bottom) adds padding for home indicator */
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
}
```

**The `env(safe-area-inset-bottom)` rule** is critical for iPhone X and newer — it prevents
the input bar from being obscured by the home indicator. Without it, the send button can be
physically obscured on iPhone X/11/12/13/14/15.

**Scroll-to-latest on keyboard open:**

When the virtual keyboard opens, the chat area should scroll to the most recent message. This
happens naturally on iOS when the input receives focus — iOS scrolls the focused element into
view. However, the most recent message (above the input) may not be scrolled to. The existing
`messagesEndRef.current?.scrollIntoView()` call, triggered on every message update, handles
this correctly. No additional keyboard event listener is needed.

**iOS Safari `position: fixed` caveats:**

iOS Safari < 15.4 has a bug where `position: fixed` elements jump when the keyboard opens.
This is fixed in iOS 15.4+. For compatibility:
- Add `transform: translateZ(0)` to `.input-bar` to trigger GPU compositing
- This prevents the jump in iOS < 15.4 without side effects

```css
.input-bar {
  position: fixed;
  bottom: 0;
  transform: translateZ(0);           /* iOS Safari fixed position bug workaround */
  -webkit-transform: translateZ(0);
}
```

### 6.3 Touch Target Specifications

All interactive elements must have a minimum touch target of 44x44px per Apple HIG and
WCAG 2.5.5 (AAA — but recommended for SMB mobile audience):

| Component | Visible size | Touch target strategy |
|-----------|-------------|----------------------|
| Send button | 40px circle | Already 40px — add 2px padding each side to reach 44px |
| Starter chips | Variable width × 32px | Increase to `min-height: 44px`, `padding: 10px 16px` |
| Lead capture dismiss | Text link | Add `padding: 12px 16px`, `display: inline-block` |
| Lead form submit | Full width button | Already large enough |
| Input bar | Full width × 44px effective height | `height: 44px` on input element |

The send button's visual 40px size can remain — achieve 44px touch target via an invisible
tap area using `::before` pseudo-element or additional padding absorbed by the circular
`overflow: hidden` parent.

### 6.4 Responsive Breakpoints

Clara v1 uses a mobile-first approach with one primary breakpoint. The design is optimized
for mobile (320px–767px) with desktop enhancements (768px+).

```css
/* Mobile (default, no media query) — 320px to 767px */
.chat-area-inner {
  max-width: 100%;
  padding-inline: var(--space-4);      /* 16px */
}

.message-bubble {
  max-width: 85%;                       /* wider on mobile — less horizontal space */
}

.demo-footer {
  display: none;                        /* hidden on mobile until engagement threshold */
}

/* Desktop enhancement — 768px+ */
@media (min-width: 768px) {
  .chat-area-inner {
    max-width: var(--max-width-chat);   /* 640px */
    margin-inline: auto;
  }

  .message-bubble {
    max-width: 75%;
  }

  .demo-footer {
    display: block;                     /* always visible on desktop */
  }
}
```

**No intermediate breakpoint for tablet.** The chat layout is simple enough that the mobile
layout adapts gracefully on 768px iPad without a distinct tablet treatment. The `max-width:
640px` + centered approach on desktop means iPad-portrait gets a comfortably readable layout.

### 6.5 Input and Text Entry on Mobile

**Prevent auto-zoom on iOS:**

iOS Safari zooms in when a form input has `font-size` below 16px. The message input must use
`font-size: 16px` to prevent this zoom — which would be jarring and disorienting for Maria.

```css
.message-input {
  font-size: 1rem;   /* 16px — prevents iOS auto-zoom */
}
```

If the design requires smaller visible text, use CSS `zoom` or `transform: scale` on the
parent — do not reduce `font-size` below 16px.

**Input attributes for mobile keyboards:**

```html
<input
  type="text"
  autocomplete="off"     <!-- disable browser autocomplete dropdown -->
  autocorrect="on"       <!-- enable spell correction -->
  autocapitalize="sentences"  <!-- capitalize first word -->
  spellcheck="true"      <!-- enable spell check -->
/>
```

`autocomplete="off"` prevents browser autofill from showing dropdown overlays that obscure
the chat area on mobile. Spell correction and capitalization are kept on — they match how
users expect text messaging to work.

**Return key / Go key behavior:**

On iOS and Android, the virtual keyboard's bottom-right key should say "Send" (not "Return"
or "Go"). This requires using `<form>` submission semantics. Wrap the input and button in a
`<form>` element with `action="javascript:void(0)"` and `onSubmit` handler:

```html
<form class="input-form" onsubmit="handleSubmit(event)">
  <input type="text" ... />
  <button type="submit" ...>Send</button>
</form>
```

The `type="submit"` on the button and the `<form>` wrapper cause iOS/Android to display "Send"
in the keyboard. This is a significant UX improvement for mobile users — "Send" communicates
the action; "Return" does not.

### 6.6 Scroll Behavior on Mobile

**Overscroll behavior:**

```css
.chat-area {
  overscroll-behavior-y: contain;
```

This prevents "scroll chaining" — when the user reaches the top or bottom of the chat area,
the page body does not scroll. Without this, reaching the top of the chat thread causes the
browser chrome (address bar) to snap back into view, which shifts the viewport and causes
layout jump.

**Pull-to-refresh prevention:**

```css
body {
  overscroll-behavior-y: none;
```

The demo page has no meaningful pull-to-refresh action. Preventing it avoids accidental
navigation away from the demo during conversation.

**Scroll anchoring:**

```css
.chat-area {
  overflow-anchor: auto;  /* default — but explicitly set for clarity */
}
```

Browsers automatically anchor scroll position to the bottom-most visible content when new
content is added below the fold. This means when a new message is inserted, the scroll
position stays at the bottom. `overflow-anchor: auto` is the correct behavior for a chat
interface. The `messagesEndRef.scrollIntoView()` call handles cases where the user has
scrolled up to read earlier messages.

---

## 7. Interaction Patterns

### 7.1 Message Send Flow

```
User types in input
  → Input value updates (controlled input)
  → Send button enables (opacity 1, cursor pointer)

User presses Enter or taps Send
  → Input value is captured
  → Input is cleared immediately (optimistic UI)
  → User message bubble appears in thread immediately (optimistic UI)
  → Send button disables
  → Input disables (opacity 0.5)
  → Typing indicator appears (below user bubble)
  → POST /api/chat request sent

LLM responds (1–2s typical):
  → Typing indicator disappears
  → Assistant message bubble appears with slide-in from below (translateY 8px → 0, 150ms ease-out)
  → Input enables
  → Focus returns to input (on desktop — on mobile, keyboard stays open)
  → Chat area scrolls to bottom (smooth)

Error response:
  → Typing indicator disappears
  → Error bubble appears (red-tinted, same bubble layout)
  → Input enables, user can retry
```

### 7.2 Lead Capture Trigger Flow

```
Clara's response includes an escalation offer
  → Assistant message bubble rendered (normal)
  → 400ms pause (let user read the message)
  → Lead capture card slides into chat below the assistant message
  → Focus moves to Name field
  → Keyboard opens on mobile

User fills form and submits:
  → Validation runs on each field blur
  → Submit button enables when form is valid
  → On submit: fields disable, button shows "Sending..."
  → POST /api/leads
  → On success: card unmounts, confirmation bubble inserted
  → Focus returns to message input

User dismisses:
  → Card unmounts (no animation — immediate removal)
  → Focus returns to message input
  → Conversation continues normally
```

### 7.3 Session Loading Flow

```
Page mount
  → Skeleton header rendered immediately (DemoBanner + ChatHeader with shimmer)
  → Parallel fetch: GET /api/demo?uuid + GET /api/chat?sessionId

Both resolve (300–800ms typical):
  → Skeleton replaced with real content
  → Business name populates header and banner
  → If message history exists: messages rendered, scroll to bottom
  → If no history: WelcomeMessage + StarterChips rendered
  → Input bar enables

One or both fail:
  → If session fetch fails: ErrorScreen replaces entire page
  → If history fetch fails: session continues but with empty message history (graceful)
```

---

## 8. Open Design Questions for v2

These are not blocking for v1 but must be answered before v2:

1. **Brand color customization:** Should the demo UI reflect the SMB's brand colors (pulled
   from their website or entered during onboarding)? In v1, all demos use Clara's indigo brand.
   In v2, a hair salon might want pink, an auto shop might want red. This requires a dynamic
   CSS variables system keyed to the session's `hubspot_company_id`.

2. **Lead capture form placement:** The current spec inserts it inline in the chat. An
   alternative is a bottom sheet on mobile. Test both with real users — the bottom sheet may
   feel more natural for form input but breaks the "part of the conversation" metaphor.

3. **Starter chip personalization:** In v2, starter chips could be generated from the business
   profile: "Do you do balayage?" instead of "What services do you offer?" This requires a
   server-side precompute step when the session is created, which adds latency to session
   creation but improves the first impression.

4. **Message read receipts:** A "Delivered" or "Read" indicator below user messages is a
   standard chat UI pattern. Not needed for v1 (adds visual noise), but consider for v2
   when Clara is deployed as a live widget.

5. **Persistent session (localStorage):** If Maria closes the tab and opens the demo link again,
   she currently sees the full conversation history (retrieved from DB). This is good. However,
   if she opens the link on a different device (husband's phone), she sees the same history —
   potentially confusing. v2 should consider a "new session from this link" option.

---

*Clara Design Specification v1.0 — 2026-03-24*
*Author: ArchitectUX Agent*
*Handoff: Ready for LuxuryDeveloper implementation*
*Next review: After first real prospect demo is sent (Phase 1, Week 3)*
