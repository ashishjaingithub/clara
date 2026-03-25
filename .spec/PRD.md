# Clara — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-24
**Phase:** Explore → v1 (Demo Tool)
**Status:** Draft — Awaiting Founder Approval

---

## 1. Problem Statement

### The Core Problem

Local SMBs lose leads around the clock — after hours, during busy periods, when the phone goes unanswered — because they have no scalable way to respond to inbound questions in real time. A prospect who gets silence moves on to the next result. The SMB owner never even knows the opportunity existed.

Existing solutions fail in two ways:

1. **Generic chatbot builders** (Intercom, Tidio, ManyChat) require the SMB to configure the bot themselves — write FAQs, set up flows, integrate their knowledge. For a hair salon owner or a plumber, this is a multi-hour task they will never complete.
2. **Enterprise AI assistants** are too expensive, too complex, and not designed for single-location SMBs with word-of-mouth businesses.

### The Sales Problem (v1 Priority)

Before Clara can be deployed anywhere, it must be sold. The current sales workflow for AI services requires the prospect to *imagine* what the product would look like for them. This imagination gap kills deals. Demo videos are generic. Screenshots are abstract.

Hunter (the outbound sales engine) researches and enriches every prospect's business profile. That data exists — but it has never been used to generate a personalized, live demo experience for the prospect themselves.

### The Opportunity

Clara closes this imagination gap. A prospect receives a link that already knows their business name, their likely services, and their context. They interact with a chat receptionist that feels like it was built for them — before any sales call, before any setup work, before any money changes hands.

The prospect does not have to ask "could this work for my business?" — they experience it directly.

---

## 2. Personas

### Persona 1: The SMB Owner Prospect (Primary)

**Name:** Maria
**Business:** Maria's Hair Studio — a 3-chair salon in suburban Chicago
**Tech comfort:** Moderate. Uses Instagram, Square for payments, Google Business Profile.
**Discovery:** Received a cold email from Hunter with a personalized demo link.
**Pain points:**
- Misses calls when she's with a client (which is most of the day)
- Has no way to answer "what are your prices?" at midnight
- Tried a Facebook chatbot once — gave up after 30 minutes of setup
- Skeptical of AI: "will it embarrass me in front of my customers?"

**Goals:**
- Never miss a booking inquiry again
- Look professional without hiring a receptionist
- Spend zero time on setup

**What makes her convert:**
- The demo link already knows it's "Maria's Hair Studio" — she's immediately impressed
- She can see her future customers interacting with it in real time
- The handoff to a human (her) feels natural, not robotic

**What makes her bounce:**
- The bot says something wrong about her business (hallucination)
- Setup feels complicated
- She doesn't trust the AI to represent her brand

---

### Persona 2: The End Customer / Visitor (Secondary)

**Name:** James
**Context:** A potential new customer who found Maria's Hair Studio on Google at 10pm on a Sunday, wondering if they do beard trims and how much it costs.
**Tech comfort:** High. Expects instant answers — a phone number is a last resort.
**Pain points:**
- Doesn't want to call a business at night
- Hates filling out contact forms
- Will move to a competitor if he can't get a quick answer

**Goals:**
- Get his question answered immediately
- Book or get a price range without speaking to anyone
- Know what to do if his question is too specific

**What success looks like:**
- Gets a clear answer to "do you do beard trims and how much?"
- If Clara doesn't know the exact price, gets a phone number or offer to leave contact info
- Feels like the business is professional and responsive

**What failure looks like:**
- Gets a wrong answer confidently stated
- Gets stuck in a loop with no path to a real human
- The chat feels robotic and generic

---

### Persona 3: The Operator / Hunter Sales Rep (Internal)

**Name:** Ashish (founder) — currently the only operator
**Context:** Running Hunter to source and enrich SMB leads. Wants to convert those leads into Clara customers. Clara is both a sales asset and a future product.
**Pain points:**
- Cold outreach has low reply rates — needs a hook that creates a "wow" moment
- Manual personalization of demos doesn't scale
- No way to measure whether prospects engaged with a demo after receiving the link

**Goals:**
- Generate personalized demo links for any Hunter-enriched lead in under 10 seconds
- Track whether a prospect opened and interacted with their demo
- Convert demo engagement into booked onboarding calls
- Maintain Clara infrastructure with zero downtime and no runaway costs

**What success looks like:**
- Reply rate to cold emails increases when a demo link is included
- At least 1 prospect converts to a paid onboarding within the first 30 days of v1
- Can see engagement metrics (view count, message count) per demo session

---

## 3. Success Metrics

### v1 — Demo Tool (Operator-Focused)

| Metric | Definition | Target | Measurement |
|--------|-----------|--------|-------------|
| Demo creation time | Time from Hunter lead → live demo link available | < 30 seconds | API response time logging |
| Demo personalization accuracy | Prospect's business name correctly displayed in first response | 100% | Manual spot-check on first 20 demos |
| Hallucination rate | Responses making factually wrong claims about the business (vs. graceful "I don't know") | < 5% of sessions | Manual review of flagged sessions |
| Cold email reply rate lift | Reply rate on emails with demo link vs. emails without | ≥ 20% relative lift | A/B via Hunter campaign tracking |
| Prospect engagement rate | % of demo links opened that result in ≥ 1 chat message | ≥ 40% | Session view_count vs. message_count |
| Lead capture rate | % of sessions where visitor leaves name/contact info | ≥ 15% of engaged sessions | DB count of lead capture events |
| Session error rate | % of chat requests returning 5xx or unhandled exception | < 1% | Server error logs |
| LLM cost per session | Average Groq token spend per demo session | < $0.005/session | LangSmith token logs |

### v2 — Live Widget (SMB-Focused, future)

| Metric | Definition | Target |
|--------|-----------|--------|
| SMB activation rate | % of onboarded SMBs with ≥ 50 visitor sessions in first 30 days | ≥ 60% |
| Answered question rate | % of visitor sessions where question is resolved without human escalation | ≥ 70% |
| Human escalation rate | % of sessions where visitor requests or is offered a human handoff | 10–25% (healthy range) |
| SMB retention (30-day) | % of paying SMBs still active at 30 days | ≥ 80% |
| Lead capture → booked conversion | % of captured leads that result in a scheduled appointment | Baseline TBD in v2 |

---

## 4. User Stories with Acceptance Criteria

### Persona 1: SMB Owner Prospect (Maria)

---

**US-01: Receive a personalized demo link**

> As an SMB owner prospect, I want to click a demo link and immediately see a chat interface that knows my business name, so that I understand this is built for me and not a generic demo.

**Acceptance Criteria:**
- [ ] The URL format is `/demo/[uuid]` — no business name in the URL (obscurity by UUID)
- [ ] The chat header displays the business name pulled from Hunter within 500ms of page load
- [ ] The first message from Clara references the business by name (e.g., "Hi! I'm Clara, Maria's Hair Studio's AI receptionist...")
- [ ] If Hunter API is unreachable, fallback displays "This Business" — no 500 error, no empty name
- [ ] Page loads and first message renders in under 3 seconds on a standard connection

---

**US-02: Ask common questions and get useful answers**

> As an SMB owner prospect, I want to ask questions a real customer would ask (hours, location, services, pricing), so that I can evaluate whether Clara can handle my customers' actual needs.

**Acceptance Criteria:**
- [ ] Clara correctly handles at least: hours of operation, location/address, services offered, pricing (when available), contact information
- [ ] For questions where data is not available (e.g., specific price not in Hunter profile), Clara says so gracefully and offers a phone number or human follow-up
- [ ] Responses arrive in under 3 seconds (Groq latency target)
- [ ] Clara never fabricates specific facts (prices, addresses, phone numbers) that were not in the business profile
- [ ] Clara handles multi-turn conversation — remembers context within the session

---

**US-03: Understand the product concept from the demo**

> As an SMB owner prospect, I want the demo experience to make clear what Clara would do for my real business, so that I can picture it deployed on my website or shared with my customers.

**Acceptance Criteria:**
- [ ] A subtle, non-intrusive UI element (e.g., footer note or info tooltip) explains this is a demo of Clara
- [ ] Clara's responses are professional and appropriate to the business's apparent industry
- [ ] The UI looks polished enough that the prospect would not be embarrassed to share it with their own customers

---

### Persona 2: End Customer / Visitor (James)

---

**US-04: Get an immediate answer to a simple question**

> As a visitor to a demo, I want to type a simple question and get a clear, useful answer, so that I don't have to call the business.

**Acceptance Criteria:**
- [ ] Single message round-trip completes in under 3 seconds (p95)
- [ ] Answer is in plain, conversational English — no jargon, no bullet-point walls
- [ ] If the question is answerable from business profile data, the answer is accurate
- [ ] Follow-up questions within the same session maintain context (no need to repeat "I was asking about...")

---

**US-05: Know what to do when Clara can't help**

> As a visitor, when my question is too specific or complex for Clara to answer, I want to be offered a clear next step (phone number or leave my contact info), so that I'm not left hanging.

**Acceptance Criteria:**
- [ ] Simple unknowns (e.g., "do you carry brand X?") trigger a response with the business phone number if available, or a generic "best to call us"
- [ ] Complex/specific unknowns (e.g., "can you fix a 2019 Ford F-150 transmission?") trigger an offer to capture contact info for a human follow-up
- [ ] Lead capture flow asks for: name (required), phone or email (at least one required), optional message
- [ ] Lead capture confirmation tells the visitor when to expect a response (e.g., "The team will reach out within 1 business day")
- [ ] Captured lead data is stored in the database and triggers an operator notification (email or log — v1: log to DB, notification TBD)

---

**US-06: Choose anonymity — no forced identification**

> As a visitor, I want to use the demo anonymously without being asked to identify myself unless I want to, so that I feel safe exploring without commitment.

**Acceptance Criteria:**
- [ ] No login, no account creation, no email required to start chatting
- [ ] Contact info is only requested when the visitor explicitly triggers an escalation or requests follow-up
- [ ] Session is tracked by UUID only — no PII collected passively
- [ ] No cookies or tracking beyond session UUID for conversation continuity

---

### Persona 3: Operator (Ashish)

---

**US-07: Generate a demo link for any Hunter lead**

> As the operator, I want to create a demo session for any Hunter-enriched lead using their HubSpot company ID, so that I can include a personalized link in cold outreach.

**Acceptance Criteria:**
- [ ] `POST /api/demo { hubspot_company_id }` returns a `sessionId` (UUID) within 500ms
- [ ] The demo link is immediately usable: `http://localhost:3002/demo/{uuid}` (or production URL)
- [ ] Hunter API is called at first visitor message, not at session creation (avoids wasted calls for unopened links)
- [ ] If the same `hubspot_company_id` is used multiple times, a new session is created each time (sessions are not deduplicated — A/B use case)
- [ ] Rate limiting: max 20 demo creation requests per minute per IP

---

**US-08: Monitor demo engagement**

> As the operator, I want to see how many people opened and interacted with each demo, so that I can follow up with engaged prospects.

**Acceptance Criteria:**
- [ ] `GET /api/demo?uuid={sessionId}` returns: `view_count`, `message_count`, `created_at`, `last_activity_at`, `business_name`
- [ ] `view_count` increments on every page load (not just first)
- [ ] `message_count` increments on every user message
- [ ] Operator can query all sessions for a given `hubspot_company_id` (via direct DB query in v1; UI in v2)

---

**US-09: Observe and debug Clara's behavior**

> As the operator, I want every LLM call traced in LangSmith, so that I can debug bad responses, track costs, and catch regressions.

**Acceptance Criteria:**
- [ ] All Groq LLM calls are traced in LangSmith with: session_id, hubspot_company_id, input tokens, output tokens, model name, latency
- [ ] LangSmith project is named `clara-{NODE_ENV}` (e.g., `clara-production`)
- [ ] App startup fails (process.exit(1)) if `LANGSMITH_API_KEY` or `LANGSMITH_TRACING=true` is missing in production
- [ ] In development/test, tracing is optional (no startup failure)
- [ ] Cost per session is queryable from LangSmith (token counts * model pricing)

---

**US-10: Run Clara without runaway costs or abuse**

> As the operator, I want rate limiting and session controls in place before going live, so that Clara cannot be abused to rack up LLM costs or degrade for real prospects.

**Acceptance Criteria:**
- [ ] `/api/chat` rate limited: max 20 messages per session per hour, max 10 requests per minute per IP
- [ ] `/api/demo` rate limited: max 20 session creations per minute per IP
- [ ] Sessions older than 30 days are eligible for cleanup (soft-delete or archive, not hard delete — retain for analytics)
- [ ] A single session cannot accumulate more than 200 messages (hard cap — new session required beyond that)
- [ ] Rate limit responses return HTTP 429 with a user-friendly message ("This demo has reached its message limit. Please contact us directly.")

---

## 5. Out-of-Scope

### v1 Out-of-Scope (explicitly excluded from current build)

| Item | Reason |
|------|--------|
| **Embeddable widget / `<script>` tag** | v2 feature — requires iframe/shadow DOM sandboxing, CORS configuration, and multi-tenant session isolation |
| **SMB self-serve onboarding portal** | v1 uses an onboarding call with the operator. Portal is a v2 investment after pricing model is validated. |
| **Pricing / billing / subscriptions** | Pricing model is TBD — deferred until real customer data exists |
| **Voice channel (Veya integration)** | Veya handles voice. Clara handles chat. Integration deferred to shared knowledgebase milestone. |
| **Multi-language support** | English only for v1 |
| **SMB knowledge base editing UI** | Hunter pre-fills, operator edits during onboarding call — no self-serve UI in v1 |
| **Appointment booking / calendar integration** | Capture lead and escalate to human — no live booking in v1 |
| **CRM write-back of lead captures** | Leads stored in Clara DB only — Hunter/HubSpot write-back is a v2 integration |
| **Real-time notifications to SMB owner** | Lead captures logged to DB in v1 — push/email notification deferred to v2 |
| **A/B testing framework** | Operator can create multiple sessions per company ID for manual A/B; no automated framework |
| **Analytics dashboard UI** | Raw DB queries sufficient for v1 operator; UI deferred to v2 |
| **Postgres / multi-tenant database** | SQLite sufficient for single-tenant demo scale in v1. Migration to Postgres is a v2 prerequisite. |
| **GDPR / CCPA compliance controls** | Minimal PII collected in v1 (lead capture is opt-in). Full compliance controls required before v2 live deployment. |
| **SSO / auth for operator panel** | No operator UI in v1 — API + direct DB access only |

### v2 Scope (deferred, not forgotten)

- Embeddable `<script>` widget for SMB websites
- SMB self-serve portal: onboarding, knowledge base editing, lead view
- HubSpot/CRM write-back for captured leads
- Postgres migration for multi-tenant live deployment
- Real-time SMB owner notifications (email/SMS) on lead capture
- Shared knowledgebase architecture (Veya + Clara share one SMB knowledge source)
- Pricing model and subscription management
- Analytics dashboard (sessions, engagement, lead conversion by SMB)
- GDPR/CCPA consent management and data erasure flows

---

## 6. Phased Rollout Plan

### Phase 0 — Foundation Hardening (Pre-v1 Gate)

**Duration:** 1–2 weeks
**Goal:** Resolve the three production gaps that block v1 go-live
**Deliverables:**

1. **Rate limiting** — implement on `/api/chat` (20 msg/session/hour, 10 req/min/IP) and `/api/demo` (20 sessions/min/IP) using in-memory or Redis-backed rate limiter
2. **Session expiry** — soft-delete sessions older than 30 days via a cron job or scheduled cleanup; hard cap at 200 messages/session
3. **LangSmith tracing** — wire all Groq LLM calls through LangSmith; enforce at startup in production; include session_id, hubspot_company_id, token counts

**Exit criteria:**
- All three gaps resolved
- Unit tests pass for rate limiting and session lifecycle
- LangSmith traces visible for a test session
- No TypeScript errors (`npm run typecheck` clean)

---

### Phase 1 — v1: Closed Demo Tool (Weeks 3–6)

**Goal:** Clara is a Hunter sales asset. Personalized demos go out with cold outreach emails. Operator tracks engagement.
**Distribution:** Closed — demo links generated by operator only, shared via Hunter outreach
**Scale:** 10–50 demo sessions

**Milestones:**

| Week | Milestone |
|------|-----------|
| 3 | Phase 0 complete. First real demo link sent to a real prospect. |
| 4 | 10 demo links generated. Engagement data being tracked. First feedback from prospects. |
| 5 | Lead capture flow live and tested. At least 1 lead captured via demo. |
| 6 | Retrospective: reply rate lift measured, at least 1 onboarding call booked, decision point for v2. |

**Go/No-Go Criteria for v2:**
- At least 1 prospect books an onboarding call as a result of receiving a demo link
- Demo engagement rate ≥ 40% (prospects who open the link and send ≥ 1 message)
- No critical hallucinations reported by prospects
- Operator can sustain the workflow without additional tooling

---

### Phase 2 — v1 Refinement: Onboarding + Live Deployment (Weeks 7–10)

**Goal:** First live deployment — one real SMB website has Clara running for real visitors
**Trigger:** At least 1 onboarding call booked and completed

**Deliverables:**

1. **Onboarding call process** — operator runs a structured call with the SMB owner:
   - Verify/correct Hunter-enriched business profile data
   - Confirm services, hours, pricing to include
   - Set escalation behavior (what to do when Clara can't answer)
   - Configure the SMB's demo session for live use (or create a dedicated live session)
2. **Knowledge base editing** — operator updates Clara's `demo_sessions` data based on onboarding call output (direct DB edit or simple admin endpoint — no UI required)
3. **Live session stability** — verify rate limiting, session caps, and LangSmith tracing are holding under real traffic

**Exit criteria:**
- 1 SMB running Clara live for 2+ weeks
- 0 critical incidents (wrong information, system errors shown to visitors)
- Operator can confidently replicate the process for a second SMB

---

### Phase 3 — v2 Planning Gate (Week 11+)

**Trigger:** v1 live deployment stable for 2 weeks AND at least 1 more onboarding call in pipeline

**Decisions Required Before v2 Build:**
1. Pricing model finalized (monthly SaaS? Per-session? Revenue share?)
2. Postgres migration scoped and scheduled (SQLite → Postgres before multi-tenant)
3. Shared knowledgebase architecture decision (ADR required — Veya + Clara joint KB)
4. Embeddable widget design approved (iframe vs. shadow DOM vs. hosted page)
5. GDPR/CCPA compliance scope defined for live visitor data

**v2 Build sequence (high-level):**
1. Postgres migration + multi-tenant data isolation
2. SMB self-serve onboarding portal (knowledge base editor, lead view)
3. Embeddable `<script>` widget
4. HubSpot write-back for lead captures
5. Real-time SMB owner notifications

---

## Architecture Notes / Future Considerations

### Shared Knowledgebase (Strategic)

The most significant architectural decision deferred from v1 is the **shared SMB knowledgebase**. Currently:

- **Veya** (voice channel) maintains its own business context per call
- **Clara** (chat channel) reads from Hunter's enriched profile + operator edits stored in `demo_sessions`

The strategic goal is for both channels to connect to a single, authoritative knowledgebase per SMB — so that the owner edits their hours once, and both Veya and Clara reflect the change immediately.

This shared knowledgebase is a **v2 architectural prerequisite** before Clara is positioned as a standalone product. It requires:

1. A dedicated knowledgebase service (or table in a shared DB) owned by neither Veya nor Clara
2. An API that both services query at inference time
3. A UI for the SMB owner to manage their knowledge without operator intervention
4. A decision on ownership: is this a new microservice, or does Hunter's business profile become the canonical source?

An ADR must be written before any v2 build begins on this topic.

### SQLite → Postgres Migration Path

SQLite is appropriate for v1 (single-operator, demo-scale traffic, < 50 sessions). Before v2 live deployment with multiple SMBs and concurrent visitors:

- Postgres migration is required (concurrent writes, multi-tenant isolation, connection pooling)
- Drizzle ORM is already in use — the migration should be schema-compatible with minor adapter changes
- Migration ADR required before v2 build starts
- Target: migrate during Phase 3 planning gate, before any v2 code is written

---

*Clara PRD v1.0 — Written 2026-03-24*
*Owner: Ashish Jain (founder/operator)*
*Next review: After Phase 1 retrospective (Week 6)*
