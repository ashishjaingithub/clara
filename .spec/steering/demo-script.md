# Clara Demo Script — SMB Prospect Call

**Audience:** You (the operator/founder), on a discovery or follow-up call with an SMB owner
**Duration:** 10–15 minutes for the Clara portion of the call
**Goal:** Move the prospect from "I received a weird link" to "I want this on my website"

---

## Before the Call

**Preparation (2 minutes)**

1. Confirm the demo session exists and Clara is responding. Open the prospect's demo URL
   in your own browser and send one test message. You should see Clara address the business
   by name in the first reply.
2. Pull up the prospect's HubSpot record in Hunter to confirm what profile data Clara has
   (business name, services, hours, phone).
3. Open a second tab with the Railway dashboard. If anything looks wrong, you'll want to
   address it before the call — not during.

**What to know about the prospect before the call**

- Their business name and primary service category
- Whether Hunter enriched a phone number and hours (this determines how specific Clara's
  answers will be)
- Whether they opened the demo link (check `view_count` via `GET /api/demo?uuid=<id>`)
- Whether they sent any messages (check `message_count` — if they already chatted, they've
  already had the experience; adjust your script accordingly)

---

## Opening (1–2 minutes)

**What you say:**

"Before I jump into what we do, I want to show you something I built specifically for your
business. Did you get a chance to click the link in my email?"

**If they say yes (they opened it):**

"Great — so you've already seen Clara introduce herself as [Business Name]'s AI receptionist.
What did you think? Did you try asking her anything?"

*Listen. Let them describe their reaction. If they were impressed, use that energy. If they
were confused ("what is this?"), walk them through it now.)*

**If they say no (they didn't open it):**

"No problem — can you open it now while we're on the call? I'll walk you through it live.
It's the link in the email, should take two seconds on your phone or computer."

*Wait for them to open it. Don't rush. The visual "aha" moment is more powerful than
any description you could give.*

---

## Live Demo Walk-Through (5–7 minutes)

### Step 1 — The first impression (30 seconds)

**What they'll see:**

A clean chat interface. Clara's first message introduces herself using the actual business
name: "Hi! I'm Clara, [Business Name]'s AI receptionist. How can I help you today?"

**What you say:**

"You'll notice she already knows your business name. I didn't set that up manually — my
system pulled it from your Google Business profile and LinkedIn when I was researching
your business last week. She already knows who you are."

*Pause. Let the personalization land.*

### Step 2 — Ask a customer question (2 minutes)

**What you say:**

"Ask her something a real customer would ask. A question you get on a busy Tuesday when
you can't pick up the phone."

*Common questions that work well:*
- "What are your hours?"
- "Do you do [specific service]?"
- "Where are you located?"
- "How much does [service] cost?"

**What Clara will do:**

If Hunter enriched the relevant data, Clara will answer specifically: "We're open Monday
through Saturday, 9am to 6pm!" or "Yes, we offer [service] — give us a call at [phone]
to book an appointment."

If the data isn't in the profile, Clara will say something like: "I don't have that specific
information right now — the best thing would be to call us directly at [phone] and we'll
get you sorted."

**What you say after:**

"That answer came from your own business profile — not from a template. She's not a generic
chatbot saying 'contact us for more information.' She's answering as your receptionist,
because she knows your business."

### Step 3 — Demonstrate the escalation behavior (2 minutes)

**What you say:**

"Ask her something she can't know — something specific like pricing that you haven't
published anywhere, or a technical question about your service."

*Wait for Clara to respond. She should gracefully acknowledge she doesn't have that
information and offer to have someone call them back, or invite them to leave their contact.*

**What you say after:**

"This is the key thing. She's not going to make up an answer. If she doesn't know, she
says so — and she immediately gives the customer a next step. They don't hit a dead end.
They either get their answer or they get a path to a real human."

*This directly addresses the SMB owner's biggest fear: the AI will say something wrong
and embarrass them in front of a customer.*

### Step 4 — Show the lead capture (optional, 1 minute)

*Use this step if the prospect is interested in capturing leads, not just answering questions.*

**What you say:**

"One more thing — if a customer shows up after hours with a question you can't answer,
they don't have to just leave. Try saying something like 'I'd like someone to call me
about a quote.'"

*Clara should offer to take their name and contact info.*

**What you say after:**

"When that happens, their contact info goes into a list I can show you. You'd follow up
the next morning. No missed lead — even if it came in at 11pm on a Saturday."

---

## The Pivot (1–2 minutes)

**What you say:**

"What you just used is essentially a personalized demo — it knows your business, but it's
not live on your website yet. The next step is a 30-minute call where we go through your
actual services, hours, and the kinds of questions your customers ask. I make a few tweaks
to Clara's knowledge, and then you have an AI receptionist you can point customers to
directly."

*If they're skeptical:* "The setup call is free. You're not committing to anything — you're
just making sure Clara represents your business accurately before she talks to real customers."

*If they're enthusiastic:* "It usually takes about a week from the time we do the onboarding
call to when Clara is live and running. You don't have to do anything technical — I handle
the whole setup."

---

## Objection Handling

### "What if she says something wrong about my business?"

"That's the most common concern I hear, and it's the right one. Clara only says what's in
her profile — she doesn't guess. If she doesn't know something, she says so and offers a
phone number. During the onboarding call, we go through everything she knows and you correct
anything that's wrong before any real customer talks to her."

### "My customers won't want to talk to a bot."

"Most people can't tell they're talking to an AI if the responses are relevant and fast.
What your customers care about is getting their question answered at 10pm when you're not
available. Clara does that. If they want a real human, she escalates — she doesn't try to
be a wall between the customer and you."

### "I already have a chatbot on my website."

"What does it say when someone asks what time you close on Saturday? Walk me through that
experience."

*Usually the answer is: 'It says contact us.' Clara gives a real answer. That's the difference.*

### "How much does this cost?"

"I don't have a published price yet — I'm working with a small number of businesses right
now to get the pricing right. The onboarding call is free, and if you decide to go forward,
I'll give you a number that reflects the actual value it's delivering. The question I'd ask
is: what's one missed booking worth to your business?"

### "I need to think about it."

"Completely fair. While you're thinking — the demo link stays live. Forward it to someone
who works with you and see what they think. You can come back to it any time."

*Always leave them with the demo link active. The link does selling while you're not on the call.*

---

## Closing the Call

**If they want to move forward:**

"Let's get 30 minutes on the calendar for the onboarding call. I'll send you a short
questionnaire beforehand — about 5 questions — so we don't waste time on things I can
already look up."

**If they need more time:**

"The demo link stays live — share it with anyone you'd like. When you're ready to take
the next step, reply to that original email and we'll set up the call."

**Always end with:**

"Is there anything Clara said today that surprised you, positively or negatively? I want
to make sure she's representing your business the way you'd want."

*This question surfaces both objections you haven't addressed and genuine enthusiasm you
can use as a closing signal.*

---

## After the Call

**Immediately (within 10 minutes):**

1. Note the call outcome in Hunter's CRM: "Demo shown live on call — [reaction notes]."
2. If they expressed interest: create a follow-up task in HubSpot for the onboarding call.
3. Check `message_count` on the session after the call. If they keep exploring after you
   hung up, that's a strong buying signal — follow up same day.

**If they booked an onboarding call:**

Review the onboarding process in the PRD (Phase 2). You'll need to:
- Confirm the Hunter profile data with them
- Ask for anything Hunter didn't capture (specific prices, special policies, staff names
  they want Clara to know)
- Update the session's profile data via direct DB edit or a forthcoming admin endpoint

---

*Clara Demo Script v1.0 — 2026-03-24*
*For internal operator use only. Not for distribution.*
