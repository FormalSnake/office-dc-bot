import { readdirSync, statSync } from 'node:fs'

// The server's data directory (the itzg /data volume) mounted read-only.
// Gives the log, the per-player stats and advancements, and the name caches.
const dataPath = process.env.MC_DATA_PATH
export const worldStatsAvailable = Boolean(dataPath)
export const logPath = dataPath ? `${dataPath}/logs/latest.log` : undefined

export interface WorldStats {
  uuid: string
  name: string
  playtimeMs: number
  deaths: number
  advancements: number
  mobKills: number
  playerKills: number
  distanceKm: number
  blocksMined: number
  diamonds: number
  lastPlayed: number
}

const num = (v: unknown) => (typeof v === 'number' ? v : 0)

export function parseStats(json: any): Pick<WorldStats, 'playtimeMs' | 'deaths' | 'mobKills' | 'playerKills' | 'distanceKm' | 'blocksMined' | 'diamonds'> {
  const custom: Record<string, unknown> = json?.stats?.['minecraft:custom'] ?? {}
  const mined: Record<string, unknown> = json?.stats?.['minecraft:mined'] ?? {}
  const distanceCm = Object.entries(custom)
    .filter(([key]) => key.endsWith('_one_cm'))
    .reduce((sum, [, v]) => sum + num(v), 0)
  return {
    // play_time is in ticks, 20 per second.
    playtimeMs: num(custom['minecraft:play_time']) * 50,
    deaths: num(custom['minecraft:deaths']),
    mobKills: num(custom['minecraft:mob_kills']),
    playerKills: num(custom['minecraft:player_kills']),
    distanceKm: distanceCm / 100_000,
    blocksMined: Object.values(mined).reduce<number>((sum, v) => sum + num(v), 0),
    diamonds: num(mined['minecraft:diamond_ore']) + num(mined['minecraft:deepslate_diamond_ore']),
  }
}

// Recipe unlocks are stored as advancements too but never announced; skip them.
export function countAdvancements(json: any): number {
  return Object.entries(json ?? {}).filter(([key, value]) => key !== 'DataVersion' && !key.includes('recipes/') && (value as any)?.done === true).length
}

async function readJson(path: string): Promise<any | null> {
  try {
    return await Bun.file(path).json()
  } catch {
    return null
  }
}

async function levelName(): Promise<string> {
  try {
    const props = await Bun.file(`${dataPath}/server.properties`).text()
    return props.match(/^level-name=(.+)$/m)?.[1]?.trim() || 'world'
  } catch {
    return 'world'
  }
}

// uuid -> name from the whitelist and the user cache; the cache is the fresher of the two.
async function nameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const file of ['whitelist.json', 'usercache.json']) {
    const entries = await readJson(`${dataPath}/${file}`)
    if (!Array.isArray(entries)) continue
    for (const e of entries) if (typeof e?.uuid === 'string' && typeof e?.name === 'string') map.set(e.uuid, e.name)
  }
  return map
}

let cache: { at: number; stats: WorldStats[] } | null = null
const CACHE_MS = 15_000

export async function readWorldStats(): Promise<WorldStats[]> {
  if (!dataPath) return []
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stats

  const world = `${dataPath}/${await levelName()}/players`
  let files: string[]
  try {
    files = readdirSync(`${world}/stats`).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const names = await nameMap()
  const stats: WorldStats[] = []
  for (const file of files) {
    const uuid = file.slice(0, -5)
    const raw = await readJson(`${world}/stats/${file}`)
    if (!raw) continue
    let lastPlayed = 0
    try {
      lastPlayed = statSync(`${world}/stats/${file}`).mtimeMs
    } catch {}
    stats.push({
      uuid,
      name: names.get(uuid) ?? uuid.slice(0, 8),
      advancements: countAdvancements(await readJson(`${world}/advancements/${file}`)),
      lastPlayed,
      ...parseStats(raw),
    })
  }
  cache = { at: Date.now(), stats }
  return stats
}

export async function readPlayerWorldStats(name: string): Promise<WorldStats | null> {
  const lower = name.toLowerCase()
  return (await readWorldStats()).find((s) => s.name.toLowerCase() === lower) ?? null
}
