import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import * as schema from './schema'

const databasePath = process.env.DATABASE_PATH ?? './clara.db'

const sqlite = new Database(databasePath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

// Run file-based migrations on startup (idempotent — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
runMigrations(sqlite)

function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Resolve migrations directory — works for both dev and test environments
  // In :memory: databases, __dirname is the module directory
  const migrationsDir = join(__dirname, 'migrations')

  let migrationFiles: string[] = []
  try {
    migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
  } catch {
    // In test environments with :memory: DB, migrations dir may not resolve the same way.
    // Fall back to inline DDL to ensure tests have a working schema.
    runInlineFallback(db)
    return
  }

  for (const filename of migrationFiles) {
    const already = db.prepare('SELECT id FROM _migrations WHERE filename = ?').get(filename)
    if (already) continue

    const sql = readFileSync(join(migrationsDir, filename), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename)
  }
}

/**
 * Fallback DDL for in-memory test databases where file paths may not resolve.
 * Mirrors the full target schema after all migrations.
 */
function runInlineFallback(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_sessions (
      id                  TEXT PRIMARY KEY,
      hubspot_company_id  TEXT NOT NULL,
      business_name       TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at      TEXT NOT NULL DEFAULT (datetime('now')),
      view_count          INTEGER NOT NULL DEFAULT 0,
      message_count       INTEGER NOT NULL DEFAULT 0,
      deleted_at          TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id                  TEXT PRIMARY KEY,
      session_id          TEXT NOT NULL REFERENCES demo_sessions(id),
      role                TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content             TEXT NOT NULL,
      langsmith_trace_id  TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id                  TEXT PRIMARY KEY,
      session_id          TEXT NOT NULL REFERENCES demo_sessions(id),
      hubspot_company_id  TEXT NOT NULL,
      name                TEXT NOT NULL,
      contact             TEXT NOT NULL,
      message             TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

export const db = drizzle(sqlite, { schema })
export type DB = typeof db
