import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ─── demo_sessions ────────────────────────────────────────────────────────────

export const demoSessions = sqliteTable('demo_sessions', {
  id:               text('id').primaryKey(),
  hubspotCompanyId: text('hubspot_company_id').notNull(),
  businessName:     text('business_name'),
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastActiveAt:     text('last_active_at').notNull().$defaultFn(() => new Date().toISOString()),
  viewCount:        integer('view_count').notNull().default(0),
  messageCount:     integer('message_count').notNull().default(0),
  businessProfileJson: text('business_profile_json'),  // Migration 0006: cached Hunter profile
  deletedAt:        text('deleted_at'),    // Migration 0002: NULL = active session
})

// ─── chat_messages ────────────────────────────────────────────────────────────

export const chatMessages = sqliteTable('chat_messages', {
  id:               text('id').primaryKey(),
  sessionId:        text('session_id').notNull().references(() => demoSessions.id),
  role:             text('role', { enum: ['user', 'assistant'] }).notNull(),
  content:          text('content').notNull(),
  langsmithTraceId: text('langsmith_trace_id'),  // Migration 0003: LangSmith run ID for assistant turns
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── leads ────────────────────────────────────────────────────────────────────

// Migration 0004: PII table for visitor contact info captured during demo
export const leads = sqliteTable('leads', {
  id:               text('id').primaryKey(),
  sessionId:        text('session_id').notNull().references(() => demoSessions.id),
  hubspotCompanyId: text('hubspot_company_id').notNull(),  // denormalised for tenant-scoped queries
  name:             text('name').notNull(),
  contact:          text('contact').notNull(),  // email or phone — single field, visitor's choice
  message:          text('message'),            // optional note; NULL if not provided
  createdAt:        text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── TypeScript types ─────────────────────────────────────────────────────────

export type DemoSession    = typeof demoSessions.$inferSelect
export type NewDemoSession = typeof demoSessions.$inferInsert
export type ChatMessage    = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type Lead           = typeof leads.$inferSelect
export type NewLead        = typeof leads.$inferInsert
