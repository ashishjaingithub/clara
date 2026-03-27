import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import * as schema from './schema'

const databasePath = process.env.DATABASE_PATH ?? './clara.db'

// Lazy-initialized DB connection. During Next.js build (collecting page data),
// the /data volume doesn't exist yet. Deferring initialization until first
// actual query prevents build-time crashes.
let _db: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (_db) return _db

  // Ensure the directory exists (Railway volume mounts at /data)
  const dir = dirname(databasePath)
  if (dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(databasePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  // Run file-based migrations on startup (idempotent — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
  runMigrations(sqlite)

  _db = drizzle(sqlite, { schema })
  return _db
}

function runMigrations(sqliteDb: Database.Database): void {
  // Create migrations tracking table
  sqliteDb.exec(`
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
  } catch (err) {
    // In test environments with :memory: DB, migrations dir may not resolve the same way.
    // Fall back to inline DDL to ensure tests have a working schema.
    process.stderr.write(`[Clara] Migration dir read failed, falling back to inline DDL: ${err}\n`)
    runInlineFallback(sqliteDb)
    return
  }

  for (const filename of migrationFiles) {
    const already = sqliteDb.prepare('SELECT id FROM _migrations WHERE filename = ?').get(filename)
    if (already) continue

    const sql = readFileSync(join(migrationsDir, filename), 'utf-8')
    sqliteDb.exec(sql)
    sqliteDb.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename)
  }
}

/**
 * Fallback DDL for in-memory test databases where file paths may not resolve.
 * Mirrors the full target schema after all migrations.
 */
function runInlineFallback(sqliteDb: Database.Database): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS demo_sessions (
      id                    TEXT PRIMARY KEY,
      hubspot_company_id    TEXT NOT NULL,
      business_name         TEXT,
      business_profile_json TEXT,
      created_at            TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at        TEXT NOT NULL DEFAULT (datetime('now')),
      view_count            INTEGER NOT NULL DEFAULT 0,
      message_count         INTEGER NOT NULL DEFAULT 0,
      deleted_at            TEXT
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

// Proxy object that lazily initializes the DB on first access.
// During Next.js build, API routes are statically analyzed but the /data
// volume doesn't exist yet. The proxy defers initialization until runtime.
type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get(_target, prop: string | symbol) {
    const realDb = getDb()
    const value = (realDb as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return (value as Function).bind(realDb)
    }
    return value
  },
})

export type DB = DrizzleDB
