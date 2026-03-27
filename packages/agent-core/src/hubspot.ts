/**
 * HubSpot CRM tools — shared between Clara (chat) and Veya (voice).
 *
 * Simulation guard comes FIRST in every function.
 * Set SIMULATE_APIS=true in test environments to prevent real API calls.
 *
 * HITL gate: CLARA_CONFIRM_HUBSPOT_WRITE=true required to write contacts.
 */

import { Client } from '@hubspot/api-client'
import { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/contacts/models/Filter'
import { AssociationSpecAssociationCategoryEnum } from '@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec'
import type { ContactData, ContactResult } from './types'
import { withRetry } from './utils/retry'

// ── Client singleton ──────────────────────────────────────────────────────────

let _hubspotClient: Client | null = null

function getClient(): Client {
  if (!_hubspotClient) {
    const token = process.env['HUBSPOT_ACCESS_TOKEN']
    if (!token) throw new Error('HUBSPOT_ACCESS_TOKEN env var is required')
    _hubspotClient = new Client({ accessToken: token })
  }
  return _hubspotClient
}

/** Reset the cached client — used in tests to force re-initialization. */
export function _resetHubspotClient(): void {
  _hubspotClient = null
}

// ── Simulation data ───────────────────────────────────────────────────────────

const MOCK_CONTACTS = [
  {
    id: 'mock-contact-1',
    properties: {
      firstname: 'Jane',
      lastname: 'Doe',
      email: 'jane@example.com',
      phone: '+15551112222',
    },
  },
]

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search HubSpot for a contact by email address.
 * Returns the contact ID if found, null otherwise.
 */
export async function findContactByEmail(email: string): Promise<string | null> {
  if (!email) return null

  // 1. SIMULATION GUARD
  if (process.env['SIMULATE_APIS'] === 'true') {
    const found = MOCK_CONTACTS.find((c) => c.properties.email === email)
    return found?.id ?? null
  }

  try {
    const response = await withRetry(() =>
      getClient().crm.contacts.searchApi.doSearch({
        filterGroups: [
          {
            filters: [{ propertyName: 'email', operator: FilterOperatorEnum.Eq, value: email }],
          },
        ],
        properties: ['email', 'firstname', 'lastname', 'phone'],
        limit: 1,
      }),
    )
    return response.results[0]?.id ?? null
  } catch (err) {
    throw new Error(`HubSpot findContactByEmail failed: ${String(err)}`)
  }
}

/**
 * Upsert a HubSpot contact by email.
 * Creates a new contact if not found; updates existing contact otherwise.
 *
 * HITL gate: CLARA_CONFIRM_HUBSPOT_WRITE must be 'true' outside local dev.
 */
export async function upsertContact(data: ContactData): Promise<ContactResult> {
  const { email, firstName, lastName, phone, company, notes } = data

  // 1. SIMULATION GUARD
  if (process.env['SIMULATE_APIS'] === 'true') {
    const existing = MOCK_CONTACTS.find((c) => c.properties.email === email)
    if (existing) {
      return { contactId: existing.id, created: false }
    }
    return { contactId: `sim-contact-${Date.now()}`, created: true }
  }

  // 2. HITL GATE — Tier 3 action (creates/modifies real HubSpot contacts)
  if (process.env['NODE_ENV'] !== 'development' && process.env['CLARA_CONFIRM_HUBSPOT_WRITE'] !== 'true') {
    throw new Error(
      'HubSpot contact write blocked: set CLARA_CONFIRM_HUBSPOT_WRITE=true to enable outside local dev (Tier 3 HITL gate)',
    )
  }

  // 3. Find existing contact
  const existingId = await findContactByEmail(email)

  const properties: Record<string, string> = {
    email,
    ...(firstName && { firstname: firstName }),
    ...(lastName && { lastname: lastName }),
    ...(phone && { phone }),
    ...(company && { company }),
  }

  if (existingId) {
    // Update existing contact
    await withRetry(() =>
      getClient().crm.contacts.basicApi.update(existingId, { properties }),
    )

    if (notes) {
      await createNote(existingId, notes)
    }

    return { contactId: existingId, created: false }
  }

  // Create new contact
  const result = await withRetry(() =>
    getClient().crm.contacts.basicApi.create({ properties }),
  )

  const contactId = result.id

  if (notes) {
    await createNote(contactId, notes)
  }

  return { contactId, created: true }
}

/**
 * Create a note on a HubSpot contact.
 * Not HITL-gated separately — callers must pass the HITL gate before calling this.
 */
export async function createNote(contactId: string, body: string): Promise<string> {
  // 1. SIMULATION GUARD
  if (process.env['SIMULATE_APIS'] === 'true') {
    return `sim-note-${Date.now()}`
  }

  try {
    const note = await withRetry(() =>
      getClient().crm.objects.basicApi.create('notes', {
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
      }),
    )

    await withRetry(() =>
      getClient().crm.associations.v4.basicApi.create(
        'notes',
        note.id,
        'contacts',
        contactId,
        [{ associationCategory: AssociationSpecAssociationCategoryEnum.HubspotDefined, associationTypeId: 202 }],
      ),
    )

    return note.id
  } catch (err) {
    throw new Error(`HubSpot createNote failed: ${String(err)}`)
  }
}
