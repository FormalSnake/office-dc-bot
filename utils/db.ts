import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'

const dir = process.env.DATA_DIR ?? './data'
mkdirSync(dir, { recursive: true })

const db = new Database(`${dir}/bot.sqlite`, { create: true })
db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (guild_id, key)
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
