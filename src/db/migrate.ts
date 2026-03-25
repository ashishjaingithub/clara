/**
 * Standalone migration runner.
 * Run via: npm run db:migrate
 *
 * Reads SQL files from src/db/migrations/ in alphabetical order and applies
 * any that have not been recorded in the _migrations tracking table.
 */
import Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const databasePath = process.env.DATABASE_PATH ?? './clara.db'
const sqlite = new Database(databasePath)

sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Create migrations tracking table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

const migrationsDir = join(__dirname, 'migrations')
const migrationFiles = readdirSync(migrationsDir)
  .filter((f: string) => f.endsWith('.sql'))
  .sort()

let applied = 0
for (const filename of migrationFiles) {
  const already = sqlite.prepare('SELECT id FROM _migrations WHERE filename = ?').get(filename)
  if (already) {
    console.log(`[migrate] Skipping (already applied): ${filename}`)
    continue
  }

  const sql = readFileSync(join(migrationsDir, filename), 'utf-8')
  sqlite.exec(sql)
  sqlite.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename)
  console.log(`[migrate] Applied: ${filename}`)
  applied++
}

sqlite.close()
console.log(`Clara DB migrations complete. ${applied} new migration(s) applied.`)
