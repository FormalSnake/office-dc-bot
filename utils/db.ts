import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'

const dir = process.env.DATA_DIR ?? './data'
const inMemory = dir === ':memory:'
if (!inMemory) mkdirSync(dir, { recursive: true })

const db = new Database(inMemory ? ':memory:' : `${dir}/bot.sqlite`, { create: true })
db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (guild_id, key)
  )
`)
db.run(`
  CREATE TABLE IF NOT EXISTS players (
    name TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    playtime_ms INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    advancements INTEGER NOT NULL DEFAULT 0
  )
`)
// Open play sessions survive bot restarts; reconcileSessions() trims them.
db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    name TEXT PRIMARY KEY,
    started INTEGER NOT NULL
  )
`)

export type SettingKey = 'console_channel' | 'activity_channel' | 'chat_channel' | 'admin_role' | 'player_role'

export const SETTING_KEYS: SettingKey[] = ['console_channel', 'activity_channel', 'chat_channel', 'admin_role', 'player_role']

const selectOne = db.query<{ value: string }, [string, string]>(
  'SELECT value FROM settings WHERE guild_id = ? AND key = ?',
)
const upsert = db.query<void, [string, string, string]>(
  'INSERT INTO settings (guild_id, key, value) VALUES (?, ?, ?) ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value',
)
const remove = db.query<void, [string, string]>('DELETE FROM settings WHERE guild_id = ? AND key = ?')
const selectAllForKey = db.query<{ guild_id: string; value: string }, [string]>(
  'SELECT guild_id, value FROM settings WHERE key = ?',
)

export function getSetting(guildId: string, key: SettingKey): string | null {
  return selectOne.get(guildId, key)?.value ?? null
}

export function setSetting(guildId: string, key: SettingKey, value: string): void {
  upsert.run(guildId, key, value)
}

export function clearSetting(guildId: string, key: SettingKey): void {
  remove.run(guildId, key)
}

export function getSettingForAllGuilds(key: SettingKey): { guildId: string; value: string }[] {
  return selectAllForKey.all(key).map((r) => ({ guildId: r.guild_id, value: r.value }))
}

export interface PlayerStats {
  name: string
  firstSeen: number
  lastSeen: number
  playtimeMs: number
  deaths: number
  advancements: number
}

interface PlayerRow {
  name: string
  first_seen: number
  last_seen: number
  playtime_ms: number
  deaths: number
  advancements: number
}

const toStats = (r: PlayerRow): PlayerStats => ({
  name: r.name,
  firstSeen: r.first_seen,
  lastSeen: r.last_seen,
  playtimeMs: r.playtime_ms,
  deaths: r.deaths,
  advancements: r.advancements,
})

const selectPlayer = db.query<PlayerRow, [string]>('SELECT * FROM players WHERE name = ? COLLATE NOCASE')
const touchPlayer = db.query<void, [string, number, number]>(
  'INSERT INTO players (name, first_seen, last_seen) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET last_seen = excluded.last_seen',
)
const bumpDeaths = db.query<{ deaths: number }, [string]>('UPDATE players SET deaths = deaths + 1 WHERE name = ? RETURNING deaths')
const bumpAdvancements = db.query<{ advancements: number }, [string]>(
  'UPDATE players SET advancements = advancements + 1 WHERE name = ? RETURNING advancements',
)
const addPlaytime = db.query<void, [number, number, string]>('UPDATE players SET playtime_ms = playtime_ms + ?, last_seen = ? WHERE name = ?')
const openSession = db.query<void, [string, number]>('INSERT OR REPLACE INTO sessions (name, started) VALUES (?, ?)')
const getSession = db.query<{ started: number }, [string]>('SELECT started FROM sessions WHERE name = ?')
const closeSession = db.query<void, [string]>('DELETE FROM sessions WHERE name = ?')
const allSessions = db.query<{ name: string; started: number }, []>('SELECT name, started FROM sessions')
const topByPlaytime = db.query<PlayerRow, [number]>('SELECT * FROM players ORDER BY playtime_ms DESC, deaths ASC LIMIT ?')

export function getPlayer(name: string): PlayerStats | null {
  const row = selectPlayer.get(name)
  return row ? toStats(row) : null
}

// Returns true when this is the first time the player was ever seen.
export function recordJoin(name: string, at = Date.now()): boolean {
  const first = selectPlayer.get(name) === null
  touchPlayer.run(name, at, at)
  openSession.run(name, at)
  return first
}

// Returns the length of the session that just ended, or null if none was open.
export function recordLeave(name: string, at = Date.now()): number | null {
  const session = getSession.get(name)
  closeSession.run(name)
  touchPlayer.run(name, at, at)
  if (!session) return null
  const ms = Math.max(0, at - session.started)
  addPlaytime.run(ms, at, name)
  return ms
}

export function recordDeath(name: string, at = Date.now()): number {
  touchPlayer.run(name, at, at)
  return bumpDeaths.get(name)?.deaths ?? 0
}

export function recordAdvancement(name: string, at = Date.now()): number {
  touchPlayer.run(name, at, at)
  return bumpAdvancements.get(name)?.advancements ?? 0
}

// Called at startup with who is online right now: sessions for players who
// are gone are dropped (their end time is unknown), players online without a
// session get one starting now.
export function reconcileSessions(online: string[], at = Date.now()): void {
  const current = new Set(online)
  for (const s of allSessions.all()) if (!current.has(s.name)) closeSession.run(s.name)
  for (const name of online) if (!getSession.get(name)) recordJoin(name, at)
}

export function closeAllSessions(at = Date.now()): void {
  for (const s of allSessions.all()) recordLeave(s.name, at)
}

export function topPlayers(limit = 10): PlayerStats[] {
  return topByPlaytime.all(limit).map(toStats)
}

export function currentSessionMs(name: string, at = Date.now()): number | null {
  const s = getSession.get(name)
  return s ? at - s.started : null
}
