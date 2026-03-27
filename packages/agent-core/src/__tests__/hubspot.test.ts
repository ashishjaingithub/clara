import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Hoist mock functions so they're available inside vi.mock() factory
const mocks = vi.hoisted(() => ({
  doSearch: vi.fn(),
  contactCreate: vi.fn(),
  contactUpdate: vi.fn(),
  objectCreate: vi.fn(),
  assocCreate: vi.fn(),
}))

vi.mock('@hubspot/api-client', () => ({
  Client: vi.fn().mockImplementation(class MockClient {
    crm = {
      contacts: {
        searchApi: { doSearch: mocks.doSearch },
        basicApi: { create: mocks.contactCreate, update: mocks.contactUpdate },
      },
      objects: {
        basicApi: { create: mocks.objectCreate },
      },
      associations: {
        v4: {
          basicApi: { create: mocks.assocCreate },
        },
      },
    }
  }),
}))

vi.mock('@hubspot/api-client/lib/codegen/crm/contacts/models/Filter', () => ({
  FilterOperatorEnum: { Eq: 'EQ' },
}))

vi.mock('@hubspot/api-client/lib/codegen/crm/associations/v4/models/AssociationSpec', () => ({
  AssociationSpecAssociationCategoryEnum: { HubspotDefined: 'HUBSPOT_DEFINED' },
}))

import { findContactByEmail, upsertContact, createNote, _resetHubspotClient } from '../hubspot.js'

describe('findContactByEmail', () => {
  beforeEach(() => {
    _resetHubspotClient()
    vi.clearAllMocks()
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
  })

  afterEach(() => {
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
  })

  it('returns null for empty email', async () => {
    const result = await findContactByEmail('')
    expect(result).toBeNull()
  })

  it('returns mock contact ID in simulation mode', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await findContactByEmail('jane@example.com')
    expect(result).toBe('mock-contact-1')
  })

  it('returns null when mock contact not found in sim mode', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await findContactByEmail('unknown@example.com')
    expect(result).toBeNull()
  })

  it('returns null when HubSpot returns no results', async () => {
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [] })
    const result = await findContactByEmail('new@example.com')
    expect(result).toBeNull()
  })

  it('returns contact ID when found in HubSpot', async () => {
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [{ id: 'hs-123', properties: {} }] })
    const result = await findContactByEmail('existing@example.com')
    expect(result).toBe('hs-123')
  })

  it('throws when HubSpot API fails', async () => {
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockRejectedValueOnce(new Error('API error'))
    await expect(findContactByEmail('test@example.com')).rejects.toThrow('findContactByEmail failed')
  })

  it('throws when HUBSPOT_ACCESS_TOKEN missing', async () => {
    await expect(findContactByEmail('test@example.com')).rejects.toThrow('HUBSPOT_ACCESS_TOKEN')
  })
})

describe('upsertContact', () => {
  const testContact = {
    email: 'test@acme.com',
    firstName: 'John',
    lastName: 'Smith',
    phone: '+15559990000',
    company: 'Acme Corp',
  }

  beforeEach(() => {
    _resetHubspotClient()
    vi.clearAllMocks()
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
    delete process.env['CLARA_CONFIRM_HUBSPOT_WRITE']
    delete process.env['NODE_ENV']
  })

  afterEach(() => {
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
    delete process.env['CLARA_CONFIRM_HUBSPOT_WRITE']
    delete process.env['NODE_ENV']
  })

  it('returns sim result for new contact in simulation mode', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await upsertContact({ email: 'new@test.com' })
    expect(result.created).toBe(true)
    expect(result.contactId).toMatch(/^sim-contact-/)
  })

  it('returns sim result for existing mock contact in simulation mode', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const result = await upsertContact({ email: 'jane@example.com' })
    expect(result.created).toBe(false)
    expect(result.contactId).toBe('mock-contact-1')
  })

  it('blocks write outside local dev without CLARA_CONFIRM_HUBSPOT_WRITE', async () => {
    process.env['NODE_ENV'] = 'staging'
    await expect(upsertContact(testContact)).rejects.toThrow('CLARA_CONFIRM_HUBSPOT_WRITE')
  })

  it('allows write in development without CLARA_CONFIRM_HUBSPOT_WRITE', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [] })
    mocks.contactCreate.mockResolvedValueOnce({ id: 'new-hs-id' })

    const result = await upsertContact(testContact)
    expect(result.created).toBe(true)
    expect(result.contactId).toBe('new-hs-id')
  })

  it('allows write when CLARA_CONFIRM_HUBSPOT_WRITE=true', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['CLARA_CONFIRM_HUBSPOT_WRITE'] = 'true'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [] })
    mocks.contactCreate.mockResolvedValueOnce({ id: 'prod-id' })

    const result = await upsertContact(testContact)
    expect(result.created).toBe(true)
    expect(result.contactId).toBe('prod-id')
  })

  it('updates existing contact when found', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [{ id: 'existing-id' }] })
    mocks.contactUpdate.mockResolvedValueOnce({})

    const result = await upsertContact(testContact)
    expect(result.created).toBe(false)
    expect(result.contactId).toBe('existing-id')
    expect(mocks.contactUpdate).toHaveBeenCalledWith(
      'existing-id',
      expect.objectContaining({ properties: expect.objectContaining({ email: testContact.email }) }),
    )
  })

  it('attaches note when notes provided on new contact', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [] })
    mocks.contactCreate.mockResolvedValueOnce({ id: 'new-with-note' })
    mocks.objectCreate.mockResolvedValueOnce({ id: 'note-id' })
    mocks.assocCreate.mockResolvedValueOnce({})

    const result = await upsertContact({ email: 'noted@test.com', notes: 'Interested in demo' })
    expect(result.contactId).toBe('new-with-note')
    expect(mocks.objectCreate).toHaveBeenCalled()
    expect(mocks.assocCreate).toHaveBeenCalled()
  })

  it('attaches note when notes provided on existing contact', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [{ id: 'existing' }] })
    mocks.contactUpdate.mockResolvedValueOnce({})
    mocks.objectCreate.mockResolvedValueOnce({ id: 'note-2' })
    mocks.assocCreate.mockResolvedValueOnce({})

    await upsertContact({ email: 'existing@test.com', notes: 'Follow up note' })
    expect(mocks.objectCreate).toHaveBeenCalled()
  })

  it('only includes defined properties in HubSpot create call', async () => {
    process.env['NODE_ENV'] = 'development'
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.doSearch.mockResolvedValueOnce({ results: [] })
    mocks.contactCreate.mockResolvedValueOnce({ id: 'minimal-id' })

    await upsertContact({ email: 'minimal@test.com' })

    const createCall = mocks.contactCreate.mock.calls[0]![0] as { properties: Record<string, string> }
    expect(createCall.properties).toEqual({ email: 'minimal@test.com' })
    expect(createCall.properties['firstname']).toBeUndefined()
  })
})

describe('createNote', () => {
  beforeEach(() => {
    _resetHubspotClient()
    vi.clearAllMocks()
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
  })

  afterEach(() => {
    delete process.env['SIMULATE_APIS']
    delete process.env['HUBSPOT_ACCESS_TOKEN']
  })

  it('returns sim note ID in simulation mode', async () => {
    process.env['SIMULATE_APIS'] = 'true'
    const noteId = await createNote('contact-123', 'Test note body')
    expect(noteId).toMatch(/^sim-note-/)
  })

  it('creates a note and associates it with the contact', async () => {
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.objectCreate.mockResolvedValueOnce({ id: 'note-real-id' })
    mocks.assocCreate.mockResolvedValueOnce({})

    const noteId = await createNote('contact-xyz', 'Note content')
    expect(noteId).toBe('note-real-id')
    expect(mocks.assocCreate).toHaveBeenCalledWith(
      'notes',
      'note-real-id',
      'contacts',
      'contact-xyz',
      [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
    )
  })

  it('throws when note creation fails', async () => {
    process.env['HUBSPOT_ACCESS_TOKEN'] = 'test-token'
    mocks.objectCreate.mockRejectedValueOnce(new Error('HubSpot API down'))
    await expect(createNote('contact-abc', 'test note')).rejects.toThrow('createNote failed')
  })
})
