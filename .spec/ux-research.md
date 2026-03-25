# Clara — UX Research Document

**Version:** 1.0
**Date:** 2026-03-24
**Phase:** Explore → v1
**Author:** UX Researcher Agent
**Input:** Clara PRD v1.0

---

## Research Overview

### Objectives

This document synthesizes behavioral research, mental model analysis, and interaction pattern
modeling for Clara's three user types across both v1 (sales demo) and v2 (live widget) contexts.
Because no live user data exists yet (Explore phase), findings are grounded in:

- Behavioral patterns documented in the PRD (direct quotes and pain points from persona definitions)
- Published research on SMB owner technology adoption (NFIB, Alignable, Mailchimp SMB surveys)
- End consumer chat behavior research (Drift, Intercom, LiveChat annual benchmarks)
- First-principles analysis of the cold email → demo link → sales conversion funnel

All recommendations are framed as hypotheses to validate during Phase 1 (weeks 3–6).

### Research Questions

1. What mental model does Maria (SMB owner) arrive with when she clicks a cold email demo link?
2. At what point in the demo experience does trust form — or break — for Maria?
3. What are the failure modes that cause James (visitor) to abandon and go to a competitor?
4. What interaction patterns will SMB visitors use that differ from enterprise chat users?
5. What does Ashish (operator) need to see in engagement data to make a follow-up decision?

---

## Part 1: Personas

### Persona 1: Maria — SMB Owner Prospect

**Archetype:** The Skeptical Pragmatist

#### Demographics and Business Context

| Attribute | Detail |
|-----------|--------|
| Age range | 35–52 |
| Business type | Single-location service SMB (hair salon, nail salon, barbershop, auto repair, plumber, cleaning service) |
| Team size | 1–5 employees |
| Annual revenue | $150k–$600k |
| Location | Suburban or light urban — not downtown Manhattan, not rural |
| Business hours | Often non-standard: 9am–7pm Tue–Sat, closed Sun–Mon |
| Phone behavior | Phone is always ringing or always ignored — no middle ground |
| Digital presence | Google Business Profile (claimed), Instagram (irregular posting), Square or similar POS |

#### Technology Mental Model

Maria's relationship with technology is transactional, not exploratory. She adopts tools when:

1. A friend or peer recommends it ("my friend who runs a salon said she uses this")
2. The pain is acute enough that she Googles a solution at 11pm
3. The vendor handles setup for her

She has a **high skepticism threshold for AI specifically** because she has seen chatbots fail publicly
(Facebook Messenger bots from 2018–2020 are her reference point). Her mental model of a chatbot is:
"it will give wrong answers and make me look bad."

This means Clara's v1 personalization (the demo already knows her business name) is not just a nice
feature — it is the trust-formation mechanism. Without it, she has no reason to believe this AI
would be different from what she already rejected.

#### Behavioral Patterns

**How Maria processes cold emails:**
- Opens on mobile, usually between clients or during a short break (10am–12pm window)
- Subject line decides open/delete in under 2 seconds
- If she opens, she skims 3–4 lines — paragraph 1 must answer "why is this relevant to me"
- A demo link is novel enough to click; a sign-up form is not
- She will click the demo link from her phone, not her laptop

**What she does in the first 10 seconds of a demo:**
- Looks for her business name — if she sees "Maria's Hair Studio" she is engaged
- If she doesn't see it immediately, she assumes it's generic and closes the tab
- She types a test question — something she knows the answer to — to check accuracy
- Her test question is almost always about hours or a specific service she offers

**Decision timeline:**
- First impression: 0–10 seconds (personalization check)
- Engagement: 10–90 seconds (1–3 test messages)
- Intent signal: 90 seconds–3 minutes (she either types "how do I get this" or closes the tab)
- Commitment: requires a follow-up call — she will not fill out a form to buy

#### Goals (Ranked by Importance)

1. Never miss a booking inquiry again (acute, recurring pain)
2. Look professional and responsive to new customers
3. Spend zero time managing or configuring software
4. Not be embarrassed by AI giving wrong information to a real customer

#### Pain Points (Pre-Clara)

| Pain Point | Severity | Frequency |
|-----------|----------|-----------|
| Misses calls while working with clients | Critical | Daily |
| No way to answer price inquiries after hours | High | Multiple times per week |
| Website has no interactive element — just a phone number | Medium | Ongoing |
| Past chatbot experience was negative (setup too hard, bad answers) | High | Historical (shapes current skepticism) |
| Doesn't know what she's missing — unaware of missed leads | Medium | Continuous |

#### Trust Signals Maria Needs

- Her exact business name in the first message from Clara (non-negotiable)
- A response that sounds like her industry (not a generic "I'd be happy to help with that!")
- A graceful "I don't know" rather than a confident wrong answer
- Evidence that there's a real human behind the product (the sales rep's name and contact info)
- Visible "demo" indicator so she knows this isn't live — reduces fear of embarrassment

#### Abandonment Triggers

- Business name is wrong, misspelled, or missing
- Clara states a wrong price or address confidently
- The response feels like it was written for any business, not hers
- Setup sounds complicated when she asks "how do I get this"
- Any technical error or slow response (>5 seconds)

#### Typical Session Scenario

> Maria is between clients at 11:15am on a Tuesday. She opens a cold email on her iPhone. The
> subject line says "See what your AI receptionist would say to a new customer." She taps the
> link. The page loads and she sees "Hi! I'm Clara, the AI receptionist for Maria's Hair Studio."
> She pauses. She types: "what are your hours?" Clara responds: "Maria's Hair Studio is open
> Tuesday through Saturday, 9am to 7pm. We're closed Sundays and Mondays!" Maria shows her
> assistant: "look at this." She types: "do you do balayage?" If Clara handles it well, she
> texts the demo link to herself to show her husband later.

---

### Persona 2: James — End Customer / Visitor

**Archetype:** The Impatient Information Seeker

#### Demographics and Context

| Attribute | Detail |
|-----------|--------|
| Age range | 22–45 |
| Relationship to SMB | Potential new customer, not yet a regular |
| Discovery context | Google search, Google Maps, friend recommendation, Instagram |
| Time of contact | Evenings and weekends disproportionately (when businesses are closed) |
| Device | ~75% mobile (thumb-typing, small screen) |
| Attention span | Wants an answer in under 30 seconds or will try a different business |
| Prior chat experience | Regular user of customer service chat (Amazon, bank apps, food delivery) |

#### Technology Mental Model

James's mental model for chat interfaces is shaped by high-quality consumer experiences: Amazon
chat resolves issues in 2 messages, DoorDash support responds in 30 seconds. He applies this
standard to every chat interface he encounters.

He does not distinguish between "AI" and "human" chat — he only cares whether he gets a useful
answer. If Clara answers his question correctly, he will not complain that it was AI. If Clara
fails to answer, the fact that it was AI is not an excuse — he just moves on.

**Critical behavioral fact:** James has multiple browser tabs open. He opened this business
alongside 2–3 competitors. The first business to answer his question wins.

#### Behavioral Patterns

**How James interacts with a chat widget:**
- Types the way he texts: lowercase, no punctuation, conversational fragments
- Examples: "do you do beard trims", "how much for a haircut", "are you open sunday"
- Rarely types full sentences; never types formal questions
- Will send a follow-up message within 5 seconds of receiving a reply if the first answer
  was partial
- Will abandon after one unsatisfying answer — rarely gives a second chance

**Question patterns by type:**
- Binary questions: "do you do X" — expects yes/no plus brief detail
- Price questions: "how much for X" — expects a number or a range, not "prices vary"
- Hours questions: "are you open saturday" — expects a direct yes/no, not a recitation of full hours
- Location questions: "where are you" — expects an address or cross-streets, not a city name
- Booking questions: "can I make an appointment" — expects either a booking link or next steps

**What prompts lead capture opt-in:**
- James will leave his number/email if: (a) Clara clearly cannot answer and offers a callback,
  AND (b) the ask is framed as "we'll get back to you today" not "fill out this form"
- He will not opt in if he has to leave the chat interface to submit a form
- He abandons lead capture if it asks for more than name + one contact method + optional message

#### Goals (Ranked by Importance)

1. Get an immediate, accurate answer to his specific question
2. Know what the business can do for him and approximately what it costs
3. Find a path to booking without making a phone call
4. Know what to do if the chat can't help (phone number, wait time, alternative)

#### Pain Points (Pre-Clara, current experience)

| Pain Point | Severity | Frequency |
|-----------|----------|-----------|
| Business website has only a phone number (no chat, no live booking) | High | Very common with SMBs |
| Calls a business after hours and gets no answer / no voicemail | High | Evenings and weekends |
| Chat widget exists but is "currently offline" | High | After hours |
| Gets a generic form response that doesn't answer his question | Medium | Common with static chatbots |
| Has to repeat context across multiple messages | Medium | Common with poorly designed bots |

#### Trust Signals James Needs

- Response arrives in under 3 seconds (signals the system is responsive)
- Answer directly addresses his question without restating it
- If Clara doesn't know, it says so and gives a clear alternative path
- The chat looks like it belongs to the business (business name visible, not a third-party brand)
- No GDPR cookie banners or pop-ups before he can type

#### Abandonment Triggers

- Any response time over 5 seconds
- Clara answers a different question than the one he asked
- Clara says "I'd be happy to help!" without actually helping
- First response is a wall of text instead of a direct answer
- Lead capture form asks for too many fields
- He gets a "wrong answer confidently stated" (e.g., wrong price, wrong hours) — this permanently destroys trust

#### Typical Session Scenario

> It's 9:45pm on a Sunday. James found Maria's Hair Studio on Google Maps. Three competitors are
> also open in the same area. He taps the chat icon and types "do you do beard trims how much."
> If Clara responds within 2 seconds with a direct yes and a price range, James closes the other
> tabs and either books or types a follow-up. If Clara responds with "Great question! As an AI
> receptionist for Maria's Hair Studio, I'm here to help..." — he has already switched tabs.

---

### Persona 3: Ashish — Operator / Hunter Sales Rep

**Archetype:** The Efficiency-Driven Founder

#### Role Context

| Attribute | Detail |
|-----------|--------|
| Primary role | Founder running Hunter (outbound AI sales) and building Clara |
| Relationship to Clara | Builder, operator, and first sales rep — all three simultaneously |
| Volume | Managing 10–50 demo sessions in v1; scaling to hundreds in v2 |
| Technical depth | Full-stack developer — can query the DB directly, read LangSmith traces |
| Time constraints | Clara is one of several concurrent projects — each must be low-maintenance |

#### Technology Mental Model

Ashish treats Clara as a pipeline asset first and a product second. In v1, his mental model is:
"Clara is a conversion mechanism inserted into the Hunter cold email sequence." Every UX decision
he cares about is subordinate to one question: "did this demo lead to a reply or a booked call?"

He does not need a UI for v1. He needs signal. The signal he needs is:

1. Did the prospect open the link? (view_count > 0)
2. Did they engage? (message_count > 0)
3. Did they leave a lead? (lead captured)
4. What did the conversation look like? (LangSmith trace)

His mental model for "Clara is working" is: reply rate on Hunter campaigns with demo links is
measurably higher than without.

#### Behavioral Patterns

**How Ashish interacts with Clara infrastructure:**
- Creates demo sessions via API call embedded in Hunter's outreach flow (not manual)
- Monitors engagement by querying the DB directly or via `GET /api/demo?uuid=`
- Investigates bad responses by pulling the LangSmith trace for that session
- Does not have time for a dedicated dashboard in v1 — raw data is sufficient

**What triggers his attention:**
- A prospect replies to the cold email mentioning the demo
- view_count spikes on a session (prospect shared the link)
- A session with high message_count but no lead capture (engaged but didn't convert)
- A session with a lead capture (highest priority follow-up)

**What frustrates him:**
- Clara gives a hallucinated answer and the prospect calls it out in their reply email
- He cannot tell which sessions were personalized vs. fell back to the generic "This Business" persona
- LangSmith is not configured and he cannot debug a bad session
- Demo link generation fails and breaks his Hunter outreach flow

#### Goals (Ranked by Importance)

1. Generate personalized demo links in under 10 seconds, at scale, without manual work
2. Know which prospects engaged so he can prioritize follow-up
3. Catch and fix hallucinations before they damage his sales credibility
4. Maintain Clara with minimal ongoing effort — it should run without babysitting
5. Prove the concept: at least 1 paying customer within 30 days of v1 go-live

#### Pain Points

| Pain Point | Severity | Frequency |
|-----------|----------|-----------|
| Cold email reply rates are low without a compelling hook | Critical | Every outreach campaign |
| Cannot measure prospect interest between send and reply | High | Every campaign |
| Demo personalization requires manual work per prospect | High | Current state before Clara |
| No way to know if a prospect saw something wrong and disqualified silently | High | Unknown frequency |
| LLM costs could run away if demos are abused | Medium | Risk, not yet realized |

---

## Part 2: Journey Maps

### Journey Map 1: Maria — From Cold Email to Sales Call Booked

**Scope:** v1 demo experience from cold email receipt to onboarding call decision.

---

#### Stage 1: Cold Email Receipt

**Touchpoints:** Email inbox (mobile), Hunter-drafted subject line and body

| Dimension | Detail |
|-----------|--------|
| Action | Receives cold email while between clients. Sees subject line. Decides open or delete. |
| Emotion | Mild curiosity (subject line is specific to her), low trust baseline (cold email = skeptical) |
| Mental model | "Another vendor trying to sell me something. Is this actually relevant to salons?" |
| Pain points | Generic subject lines are ignored. She receives 5+ cold vendor emails per week. |
| Opportunity | Subject line must reference her business name or a pain she feels acutely. "Maria's Hair Studio now has an AI receptionist" outperforms "Grow your business with AI." |

**Transition signal:** She taps the demo link. Session created in Clara DB.

---

#### Stage 2: Demo Page Load

**Touchpoints:** Clara web app, mobile browser, initial page render

| Dimension | Detail |
|-----------|--------|
| Action | Page loads. She sees the chat interface. She looks for her business name. |
| Emotion | Curiosity shifting to either engaged (name present) or disengaged (name absent) |
| Mental model | "Let me see if this actually knows anything about my salon." |
| Pain points | Slow page load (>3 sec) kills this stage entirely. Missing business name kills trust. |
| Opportunity | Business name in the chat header AND in Clara's first message. Two reinforcing signals. First message should not wait for her to type — it should arrive within 1 second of page load. |

**Transition signal:** She reads Clara's opening message and types a test question.

---

#### Stage 3: Test Question

**Touchpoints:** Chat interface, Clara agent, business profile data

| Dimension | Detail |
|-----------|--------|
| Action | Types a question she knows the answer to: hours, a specific service, location. |
| Emotion | Evaluative — she is actively testing, not seeking information |
| Mental model | "I already know the answer. I want to see if YOU know." |
| Pain points | Wrong answer to a question she knows is a fatal failure. Generic answer ("I can help with that!") signals the AI doesn't actually know her business. |
| Opportunity | Clara must answer the test question accurately AND in a way that feels specific to her business. "We're open Tuesday through Saturday, 9am to 7pm" — not "our hours vary, please call." |

**Transition signal:** Answer is accurate → she sends a second message or shows someone. Answer is wrong → she closes the tab.

---

#### Stage 4: Exploration

**Touchpoints:** Multi-turn chat, Clara agent maintaining session context

| Dimension | Detail |
|-----------|--------|
| Action | Asks 2–3 more questions: a service she offers, a hypothetical customer question, a question Clara might not know. |
| Emotion | Building trust if answers are accurate; curiosity about edge cases |
| Mental model | "What happens when a customer asks something complicated? Will it embarrass me?" |
| Pain points | If Clara handles an unknown question poorly (wrong answer, confusing hedge), trust breaks even if earlier answers were correct. Seeing an awkward "I apologize, I don't have that information" feels robotic. |
| Opportunity | The "I don't know" path is as important as the "I know" path. Clara should say "For that one, best to call us directly — the number is [X]" — natural, helpful, not apologetic. |

**Transition signal:** She is either impressed enough to ask "how do I get this" OR she has satisfied her curiosity and closes the tab without acting.

---

#### Stage 5: Intent Formation

**Touchpoints:** Chat interface, possibly a "get this for your business" CTA, demo footer

| Dimension | Detail |
|-----------|--------|
| Action | Decides whether to pursue. May ask Clara how to get it. May reply to the original cold email. May close the tab. |
| Emotion | Interest (if demo impressed her) vs. skepticism (if she can't picture the setup) |
| Mental model | "Okay, but is this complicated to set up? How much does it cost? Who do I call?" |
| Pain points | No clear next step from the demo UI. Having to find the original email to reply. |
| Opportunity | Clara should handle "how do I get this for my business?" gracefully — provide the sales rep's contact info (or a booking link) without breaking character. A subtle demo footer with "Want this for your business? Contact [Ashish] at [email/link]" closes the loop. |

**Transition signal:** She replies to the cold email, or forwards the demo link to her husband/partner, or saves the URL.

---

#### Stage 6: Sales Conversation and Onboarding Decision

**Touchpoints:** Email reply, phone call with Ashish, onboarding call

| Dimension | Detail |
|-----------|--------|
| Action | Reconnects with Ashish. Discusses pricing, setup process, what happens if Clara says something wrong. |
| Emotion | Cautious optimism — she liked the demo but needs reassurance |
| Mental model | "If this is hard to set up or if I have to manage it, I won't do it." |
| Pain points | Setup complexity question ("do I have to do anything?"). Fear of Clara going rogue with customers. |
| Opportunity | Ashish's pitch must answer: "We set it up for you on an onboarding call. You don't touch any settings. If something is wrong, you call me." This is what converts Maria. |

**Success state:** Onboarding call booked. Maria agrees to try it on her website or share the demo link with a few customers.

---

### Journey Map 2: James — From Google Search to Question Answered

**Scope:** v2 live widget experience (most relevant for James — he encounters Clara on an SMB website, not via a demo link).

Note: In v1, James may encounter a demo link if Maria shares it. The journey is similar but the
context is "Maria's testing this, it's not live yet."

---

#### Stage 1: Discovery

**Touchpoints:** Google Search / Maps, SMB website

| Dimension | Detail |
|-----------|--------|
| Action | Googles "beard trim near me" or finds Maria's Hair Studio on Google Maps. Taps through to the website. |
| Emotion | Goal-directed, neutral to mildly impatient |
| Mental model | "I need one specific piece of information. I'll scan the page for it. If I don't see it in 10 seconds, I'll try another." |
| Pain points | SMB websites are often outdated, load slowly, and bury information. No visible hours on the homepage. No obvious way to ask a question. |
| Opportunity | Clara's chat widget should appear within 2 seconds of page load, not obscured by cookie banners or popups. The opening message should be a useful prompt: "What can I help you with? Hours, pricing, or booking?" — not "Hello! How can I help you today?" |

**Transition signal:** He sees the chat widget and types rather than calling.

---

#### Stage 2: First Message

**Touchpoints:** Chat input, Clara agent, business profile

| Dimension | Detail |
|-----------|--------|
| Action | Types a terse, conversational question. "do you do beard trims how much" |
| Emotion | Task-focused. Not thinking about AI vs. human. Wants the answer. |
| Mental model | "This is like texting the business." |
| Pain points | Clara misreads the fragment as two separate intents and only answers one. Clara responds with a wall of text. Clara adds filler before the answer. |
| Opportunity | Parse the intent correctly. Lead with the answer. Keep it to 1–2 sentences. "Yes, we do beard trims — $20–$25 depending on length. Want to book?" |

**Transition signal:** Answer received and accurate → he continues. Answer is wrong or unhelpful → he closes and tries a competitor.

---

#### Stage 3: Follow-Up or Escalation

**Touchpoints:** Multi-turn chat, lead capture flow (if triggered)

| Dimension | Detail |
|-----------|--------|
| Action | Either asks a follow-up ("are you open saturday") or asks something Clara can't answer. |
| Emotion | Continuing satisfaction (if answers keep hitting) or growing frustration (if gaps emerge) |
| Mental model | "It handled the first one — let me see if it knows more." |
| Pain points | Follow-up breaks context ("What were you asking about?"). Escalation offer feels like a dead end ("I've escalated your inquiry"). Lead capture form has too many fields. |
| Opportunity | Context must persist. Lead capture must be conversational: "I don't have that specific info — want me to have someone from the team reach out? Just drop your name and number." |

**Transition signal:** He leaves contact info (win) OR gets his questions answered fully (also win — he may book) OR abandons (loss).

---

#### Stage 4: Resolution

**Touchpoints:** Lead capture confirmation, booking (future v2), or exit

| Dimension | Detail |
|-----------|--------|
| Action | Receives confirmation of lead capture: "Got it — the team will reach out within 1 business day." OR gets all his answers and decides to book via external link or call. |
| Emotion | Satisfied if resolution feels complete. Uncertain if there's no clear "what happens next." |
| Mental model | "I did what I needed to do. Now what?" |
| Pain points | Confirmation message is too vague ("Your inquiry has been received"). No time expectation. No reassurance about when/how they'll hear back. |
| Opportunity | Be specific and warm: "Sarah from Maria's Hair Studio will text or call you at [number] — usually same day or next morning." |

**Success state:** Question answered directly, OR lead captured with clear follow-up expectation.

---

### Journey Map 3: Ashish — From Hunter Lead to Engaged Demo

**Scope:** v1 operator workflow — from identifying a lead in Hunter to monitoring demo engagement.

---

#### Stage 1: Lead Identified in Hunter

**Touchpoints:** Hunter backend, HubSpot CRM, business profile

| Dimension | Detail |
|-----------|--------|
| Action | Hunter enriches a lead: Maria's Hair Studio, Chicago, hubspot_company_id 123456, phone, hours, services scraped from web. |
| Emotion | Routine — this is automated. Ashish reviews enriched leads in batches. |
| Mental model | "Is this lead enriched enough to generate a good demo? Do I have business name, hours, and at least one service?" |
| Pain points | Poorly enriched leads will produce a weak demo. Clara falling back to "This Business" persona because Hunter's profile is thin. |
| Opportunity | Ashish should be able to quickly assess profile completeness before generating a demo link. A completeness score (or simple "name + hours + 2 services = good to go") prevents sending weak demos. |

**Transition signal:** Lead is enriched to sufficient quality. Ashish triggers demo link generation.

---

#### Stage 2: Demo Link Generation

**Touchpoints:** Clara POST /api/demo, Hunter outreach workflow

| Dimension | Detail |
|-----------|--------|
| Action | `POST /api/demo { hubspot_company_id: "123456" }` — returns sessionId. Link is embedded in Hunter cold email template. |
| Emotion | Operational. This should be invisible and instant. |
| Mental model | "This is a machine step — it should take under a second and never fail." |
| Pain points | API failure breaks the outreach flow. Slow response delays email send. No confirmation that the demo will look good for this specific lead. |
| Opportunity | Sub-500ms response time. Return not just sessionId but also business_name (so Ashish can sanity-check the profile was found) and a fallback_mode flag (true if Hunter profile was not found). |

**Transition signal:** Demo link embedded in Hunter outreach email. Email sent.

---

#### Stage 3: Prospect Engagement (Monitoring)

**Touchpoints:** Clara GET /api/demo, LangSmith, DB queries

| Dimension | Detail |
|-----------|--------|
| Action | Checks engagement metrics: view_count, message_count, last_activity_at per session. Pulls LangSmith traces for sessions with high message counts. |
| Emotion | Alert for high-engagement sessions (follow-up opportunity). Neutral for zero-engagement (not opened). |
| Mental model | "Who should I prioritize for a follow-up call today?" |
| Pain points | No way to query "all sessions with message_count > 3 in the last 24 hours." Has to check each session individually. Cannot distinguish a casual browser from an intent-signaling prospect based on raw counts alone. |
| Opportunity | A simple query or endpoint: `GET /api/demo/engaged?min_messages=3&hours=48` would immediately surface warm prospects. In v1, even a DB query template in the docs achieves this. |

**Transition signal:** Ashish identifies a session with high engagement (message_count ≥ 3, or lead captured). He drafts a follow-up.

---

#### Stage 4: Follow-Up

**Touchpoints:** Hunter outreach, phone call

| Dimension | Detail |
|-----------|--------|
| Action | Sends a personalized follow-up email: "I noticed you tried out the demo for Maria's Hair Studio — any questions I can answer?" Optionally books a call. |
| Emotion | Confident — he has a concrete reason to reach out. Less cold than a generic follow-up. |
| Mental model | "The demo did the first-impression work for me. Now I'm following up on warm interest, not cold outreach." |
| Pain points | If the follow-up timing is too late (3+ days after demo engagement), the prospect's interest has cooled. |
| Opportunity | Real-time notification (or a daily digest) of sessions where message_count crossed a threshold. Even a cron job that sends Ashish a Slack message at 8am with "3 demos with 5+ messages in the last 24 hours" would materially improve follow-up speed. |

**Success state:** Prospect replies to follow-up email. Call booked.

---

## Part 3: Pain Point Priority List

Pain points are ranked by **Severity x Frequency** on a 1–3 scale (3 = highest).
Score = Severity (1–3) x Frequency (1–3) = max 9.

### Priority Ranking

| Rank | Pain Point | Persona | Severity | Frequency | Score | Category |
|------|-----------|---------|----------|-----------|-------|----------|
| 1 | Clara states a wrong fact confidently (hallucination) | Maria + James | 3 | 2 | 6 | Trust / accuracy |
| 2 | Business name missing or wrong on demo load | Maria | 3 | 2 | 6 | Personalization |
| 3 | Response feels generic, not tailored to the SMB's industry | Maria + James | 2 | 3 | 6 | Personalization |
| 4 | Response time exceeds 3–5 seconds | James | 3 | 2 | 6 | Performance |
| 5 | No clear "what to do next" after demo impresses Maria | Maria | 3 | 2 | 6 | Conversion |
| 6 | Lead capture asks for too many fields | James | 2 | 3 | 6 | Friction |
| 7 | Unknown question handled with robotic phrasing ("I apologize...") | Maria + James | 2 | 3 | 6 | Tone / UX |
| 8 | No operator visibility into which demos are engaging | Ashish | 3 | 2 | 6 | Operator tooling |
| 9 | Demo link generation breaks Hunter outreach flow | Ashish | 3 | 1 | 3 | Reliability |
| 10 | Context lost between messages ("what were you asking about?") | James | 2 | 2 | 4 | Context management |
| 11 | Lead capture confirmation is vague (no time expectation) | James | 2 | 2 | 4 | Trust / clarity |
| 12 | No "demo mode" indicator — Maria fears this is live | Maria | 2 | 2 | 4 | Transparency |
| 13 | Follow-up timing too slow after demo engagement signal | Ashish | 2 | 2 | 4 | Operator tooling |
| 14 | Chat widget appears obscured by cookie banners or popups | James | 2 | 2 | 4 | Accessibility / UI |
| 15 | Poorly enriched Hunter profile produces a weak demo | Ashish | 2 | 2 | 4 | Data quality |

### Top Priority Deep Dives

#### P1: Hallucination (Rank 1, Score 6)

**Why it dominates:** For Maria, a single wrong confident answer ends the sale. For James, it
ends the session and potentially the business relationship. Unlike slow performance (which is
annoying), a hallucination actively damages trust.

**Specific manifestations to monitor:**
- Clara invents a price that was not in the Hunter profile
- Clara gives wrong hours (e.g., says "open Sundays" when the business is closed)
- Clara fabricates a phone number or address
- Clara confirms a service the business doesn't offer

**Mitigation strategy:**
- Strict prompt instruction: "Only state facts that are explicitly in the business profile. If a
  fact is not present, say you don't have that specific information."
- Instrument fact-check events in LangSmith: flag any response containing a price, address, or
  phone number, and verify it against the profile
- Manual review of the first 20 sessions before volume-scaling

#### P2 + P3: Personalization (Rank 2–3)

**Why they are grouped:** Missing business name and generic tone are two symptoms of the same
underlying issue — the AI is not grounded enough in the specific SMB's identity. For Maria, these
are functionally equivalent: both signal "this is not built for me."

**Mitigation strategy:**
- Business name must appear in the chat header, in Clara's first unprompted message, and
  in any substantive answer (at least once per session)
- Tone calibration: Clara should echo the SMB's industry vocabulary. A hair salon response
  sounds different from a plumber response — even if the facts are the same.

#### P5: No Clear Next Step After Demo (Rank 5, Score 6)

**Why this is a conversion kill:** Maria is not a buyer by default — she needs to be guided to
the next action. If she finishes the demo impressed but the UI offers no path forward, she closes
the tab and the moment of peak intent is lost.

**Mitigation strategy:**
- Non-intrusive footer on the demo page: "Want this for your business? [Contact Ashish]"
- Clara handles "how do I get this?" in-chat and provides the sales rep's contact info
- Ashish receives an immediate notification when a demo session crosses the "high engagement"
  threshold (message_count ≥ 3) so he can follow up while intent is warm

---

## Part 4: Interaction Patterns

### 4.1 Typing Patterns and Question Styles

#### How SMB visitors type

Research on small business customer messaging patterns (Alignable, Drift SMB survey data) shows:

**Fragment-first messages:** SMB customers type the way they text. They do not write full
sentences. They do not use punctuation. Common patterns:

- Pure fragment: "hours", "price list", "you open sunday"
- Compound fragment: "beard trim price and how long" (two questions in one)
- Negation fragment: "dont do appointments?" (wants to confirm walk-ins are okay)
- Conditional: "if i come in without appointment is that okay"

**Implication for Clara:** The LangGraph agent must handle intent extraction from fragments,
not parse grammatically complete questions. If a user types "saturday" and nothing else, Clara
should infer they are asking about Saturday hours — not ask for clarification.

#### How SMB owner prospects (Maria) type in a demo

Maria is evaluating, not seeking service. Her messages will often be:

- Known-answer test questions: "what time do you open tuesdays"
- Hypothetical customer questions: "i have a customer who wants [specific service] do you do that"
- Meta questions about the product: "how does this work", "can i change what it says"
- Leading edge questions: questions she knows are hard, to see if Clara fails gracefully

**Implication for Clara:** Meta questions about the product ("how does this work") must be
handled specially. Clara should answer in-character with a short response and point to the
operator's contact info.

#### Question volume distribution (expected based on SMB chat benchmarks)

| Question Category | Estimated % of Messages |
|------------------|------------------------|
| Hours of operation | 25–30% |
| Services offered | 20–25% |
| Pricing / estimates | 20–25% |
| Location / directions | 10–15% |
| Booking / appointment | 10–15% |
| Contact information | 5–10% |
| Other / unknown | 5–10% |

These proportions should be validated against actual session data in Phase 1 and used to
prioritize knowledge base completeness.

---

### 4.2 Response Length and Format Expectations

**Finding:** Chat users in service business contexts expect short, direct answers. Wall-of-text
responses signal "this is a bot reciting information," which breaks the conversational frame.

**Optimal response patterns by question type:**

| Question Type | Optimal Response | Anti-Pattern |
|--------------|-----------------|--------------|
| Hours | "Yes, open Saturday 10am–5pm." OR "Closed Sundays, open Mon–Sat." | Long recitation of all hours |
| Price | "$20–$25 for a basic cut. Want to know about other services?" | "Prices vary depending on service" |
| Service availability | "Yes, we do balayage — it's one of our specialties." | Listing all services |
| Location | "We're at 4521 Oak Street, just past the Walgreens." | Full formatted address with ZIP |
| Can't answer | "Don't have that one — best to call us at [number]." | "I apologize, I don't have that specific information in my knowledge base." |
| Lead capture | "Want me to have someone reach out? Just share your name and number." | "Please fill out the contact form below with your full name, email address, and phone number." |

**Sentence length guideline:** Aim for 1–2 short sentences as the primary answer, with one
optional follow-up sentence. 3-sentence responses are the maximum before the response starts
feeling like a wall.

---

### 4.3 Multi-Turn Conversation Patterns

#### Context retention requirements

SMB visitors frequently ask questions that assume prior context:

- "And how much for the beard?" (assumes prior answer about haircuts)
- "What about Saturdays?" (assumes prior answer about weekday hours)
- "Is that for both?" (assumes prior mention of two services)

**Requirement:** Clara must maintain full session context without requiring the user to repeat
prior information. The LangGraph message history must be included in every turn.

#### Common conversation arc patterns

**Arc 1: Fact-check and exit (1–2 turns)**
> User: hours / Clara: [hours] / User: thanks
Frequency: ~40% of sessions
Implication: Many visitors will have a single, specific question. A clean 1-turn resolution is
a success, not a failure. Do not prompt for more.

**Arc 2: Qualification sequence (3–5 turns)**
> User: do you do X / Clara: yes / User: how much / Clara: $Y / User: are you open saturday / Clara: yes
Frequency: ~35% of sessions
Implication: These users are actively qualifying the business. Context management is critical here.
One context break causes abandonment.

**Arc 3: Escalation journey (2–4 turns before lead capture)**
> User: [specific question Clara can't answer] / Clara: [graceful unknown + offer] / User: yeah leave my number / Clara: [lead capture]
Frequency: ~15% of sessions
Implication: The quality of the graceful unknown response determines whether the user converts
to a lead. This path must be optimized — it is the highest-value conversion moment.

**Arc 4: Demo exploration (5–10 turns, Maria-specific)**
> Multiple test questions, meta questions, edge case probing
Frequency: ~10% of sessions (v1 demo sessions, higher proportion)
Implication: This is Maria evaluating the product. She should be able to ask "how does this work"
and get a natural response. The session should end with a clear path to connect with Ashish.

---

### 4.4 Abandonment Triggers (Ranked by Impact)

These are the specific interaction moments where users are most likely to leave and not return:

| Rank | Trigger | When it occurs | Recovery possible? |
|------|---------|---------------|-------------------|
| 1 | Response time > 5 seconds | Any message turn | No — user is already gone |
| 2 | Wrong fact stated confidently | Any factual answer | No — trust is broken |
| 3 | Opening message is generic (no business name) | Page load | Low — requires re-reading |
| 4 | "I'd be happy to help!" without answering | First response | Low — tone mismatch detected |
| 5 | Context lost between turns | Turn 2+ | Medium — user may re-explain once |
| 6 | Lead capture asks for email AND phone AND company name | Lead capture flow | Medium — they may complete name+one contact |
| 7 | Confirmation message is vague | Post lead capture | Low impact — user is already gone |
| 8 | Chat widget obscured by cookie banner or popup | Page load | Medium — user may dismiss banner |
| 9 | Error message shown (500, timeout, "something went wrong") | Any turn | No — total trust failure |

---

### 4.5 Trust Signal Patterns

Trust is built incrementally through micro-moments. It is destroyed in single events.

#### Trust-building moments (in order of occurrence)

1. **Name recognition (0–2 seconds):** Business name in header and first message. This is the
   most important single trust signal. It converts Maria from "another vendor" to "this knows me."

2. **Speed (0–3 seconds):** Response arrives within 3 seconds. Slow = uncertain = untrustworthy.

3. **Accuracy on a test question:** Clara answers the first question correctly. This is the
   cognitive gate that determines whether the user continues.

4. **Graceful handling of an unknown:** Clara says "I don't have that one" without being
   robotic or apologetic. This is the second highest trust signal — it demonstrates that
   Clara knows its own limits.

5. **Appropriate follow-up offer:** When Clara can't answer, it offers a path (phone number,
   lead capture) that is proportionate to the complexity of the question. This signals
   intelligence and genuine helpfulness.

6. **Conversational tone:** Responses feel like they came from a person who works at the
   business, not a corporate customer service system.

#### Trust-destruction events (non-recoverable)

- Wrong fact stated confidently (hours, price, service availability, address)
- Name wrong or missing
- Technical error shown to user
- Response sounds like it was written for a different type of business

---

### 4.6 Mobile Interaction Patterns

Given that Maria opens demo links on her iPhone and James browses on mobile in the evening,
mobile UX is the primary context — not desktop.

**Mobile-specific interaction patterns:**

- **Keyboard-obscured input:** On mobile, the soft keyboard covers the bottom ~40% of the
  screen. Chat input and the most recent message must remain visible above the keyboard.
  The message list must auto-scroll to keep the latest message visible.

- **Thumb-typing errors:** Mobile users make typos. Clara must handle "wha tare youe hours"
  as "what are your hours." The LLM handles this naturally, but the prompt should not penalize
  misspellings.

- **Single-handed operation:** Users are browsing one-handed (Maria is often standing,
  James is on the couch). Tap targets must be large. The send button must be thumb-reachable.

- **No hover states:** All interactive affordances must be visible without hover. Tooltips
  or contextually revealed UI elements are invisible on mobile.

- **Slow connections:** The demo page must load meaningfully within 3 seconds on a 4G
  connection. First meaningful paint should show the chat header and Clara's opening message.

---

## Part 5: Hypotheses to Validate in Phase 1

These are testable hypotheses that Phase 1 engagement data (weeks 3–6) should confirm or refute.
Each should be reviewed in the Phase 1 retrospective.

| ID | Hypothesis | Metric | Validation method |
|----|-----------|--------|-------------------|
| H1 | Prospect engagement rate ≥ 40% when business name is correctly personalized | message_count > 0 / view_count | Session data split by fallback_mode |
| H2 | The first question asked is hours or services in ≥ 60% of engaged sessions | Message content categorization | Manual review of first 20 engaged sessions |
| H3 | Sessions where Clara gives a graceful "I don't know" complete with higher satisfaction than sessions where Clara gives a wrong answer | Session length + lead capture rate | Qualitative comparison, LangSmith review |
| H4 | Lead capture opt-in rate ≥ 15% when the offer is conversational ("drop your name and number") vs. a formal form | Lead capture events / sessions | AB test two phrasings in Phase 1 |
| H5 | Reply rate on cold emails with demo link is ≥ 20% higher than emails without | Hunter campaign tracking | Controlled comparison in Hunter outreach |
| H6 | Sessions with message_count ≥ 5 have a higher follow-up reply rate when Ashish contacts within 24 hours vs. 48+ hours | Reply rate by follow-up timing | Manual tracking in Phase 1 |

---

## Part 6: Research Gaps and Recommended Phase 1 Studies

Because this document is based on pre-launch research, the following should be conducted
during Phase 1 to validate and deepen these findings.

### Study 1: Demo Session Content Analysis (Weeks 4–5)

**Method:** Manual qualitative analysis of all engaged sessions (message_count ≥ 2)
**Sample:** First 20 engaged sessions
**Focus:**
- What categories of questions are asked (hypothesis H2)
- How Clara handles unknowns (is the phrasing actually natural?)
- Are there question patterns we did not anticipate?
- Any hallucinations or factual errors?

**Output:** Updated question taxonomy, refined unknown-handling prompts, hallucination log

### Study 2: Maria Interview (Week 5–6, 1–2 participants)

**Method:** 30-minute video call with prospects who received a demo link, regardless of whether
they engaged
**Sample:** Any prospect who replies to the cold email (positive or negative)
**Questions to explore:**
- What was your first impression when you saw the demo?
- Was there a moment where you felt confident / not confident in the AI?
- What would it take for you to put this on your website?
- What concerns do you have?

**Output:** Qualitative validation of trust signal hypotheses; identified objections for sales

### Study 3: Operator Workflow Friction Audit (Week 3)

**Method:** Ashish self-reports friction points during first week of live demo generation
**Focus:**
- How long does demo generation + email send actually take?
- What information is Ashish most likely to check in the DB after sending a demo?
- What would a "perfect" engagement notification look like?

**Output:** v1 operator tooling improvements (query templates, notification format)

---

## Summary: Top 10 Design Imperatives

Derived from persona analysis, journey maps, pain point ranking, and interaction patterns.

| # | Imperative | Persona Served | Priority |
|---|-----------|---------------|----------|
| 1 | Business name must appear in chat header AND Clara's opening message | Maria | P0 |
| 2 | Responses must arrive in under 3 seconds (p95) | James, Maria | P0 |
| 3 | Clara must never state a fact not present in the business profile | Maria, James | P0 |
| 4 | Graceful unknown responses must be natural, not robotic or apologetic | Maria, James | P1 |
| 5 | Lead capture must be conversational: name + one contact method only | James | P1 |
| 6 | Session context must persist — no requiring user to repeat prior information | James | P1 |
| 7 | Demo page must display a subtle demo indicator (not "live") | Maria | P1 |
| 8 | Clara must handle "how do I get this?" and provide operator contact info | Maria | P1 |
| 9 | Mobile keyboard must not obscure input and most recent message | James, Maria | P2 |
| 10 | Ashish must be able to identify high-engagement sessions without manual DB queries | Ashish | P2 |

---

*Clara UX Research v1.0 — 2026-03-24*
*Author: UX Researcher Agent*
*Next review: After Phase 1 retrospective (Week 6) with real session data*
*Hypotheses to validate: H1–H6 (see Part 5)*
