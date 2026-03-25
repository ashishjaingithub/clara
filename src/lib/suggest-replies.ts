/**
 * Suggest contextual quick-reply chips based on Clara's last message.
 * Returns 2-3 suggestions or an empty array when chips should not be shown.
 */
export function suggestReplies(assistantMessage: string, messageCount: number): string[] {
  const msg = assistantMessage.toLowerCase()

  // Don't show chips after too many exchanges
  if (messageCount > 8) return []

  // Appointment/booking signals
  if (/appointment|book|schedul|availab/.test(msg)) {
    return ['What times are available?', 'How do I book?', 'What should I bring?']
  }
  // Hours signals
  if (/hours|open|close|monday|weekend|saturday|sunday/.test(msg)) {
    return ['Are you open on weekends?', 'What about holidays?', 'Can I book online?']
  }
  // Pricing/cost signals
  if (/price|cost|fee|charge|\$|free|consult/.test(msg)) {
    return ['Do you take insurance?', 'Is there a payment plan?', 'Can I get a quote?']
  }
  // Location signals
  if (/locat|address|parking|direction|near|map/.test(msg)) {
    return ['Is there parking?', 'How far are you?', "What's the best way to get there?"]
  }
  // Contact/follow-up signals
  if (/call|phone|email|contact|reach|team|someone/.test(msg)) {
    return ["I'd like a callback", "What's your email?", 'Can I leave my number?']
  }
  // Service-general (early in conversation)
  if (messageCount <= 2) {
    return ['What are your hours?', 'Where are you located?', 'How do I get started?']
  }

  return []
}
