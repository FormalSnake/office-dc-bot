import { rcon, rconConfigured } from './rcon'

export interface McServerData {
  online: boolean
  ip: string
  port: number
  hostname?: string
  version?: string
  software?: string
  motd?: string
  players: { online: number; max: number; list: { name: string; uuid: string }[] }
  plugins?: { name: string; version: string }[]
  mods?: { name: string; version: string }[]
}

// Public status via mcsrvstat.us. Cached upstream for 5 minutes, so player
// lists lag behind; prefer getLiveStatus() for anything time sensitive.
export async function getServerData(server: string): Promise<McServerData | null> {
  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
    const data: any = await response.json()

    if (!data.online) return null

    return {
      online: true,
      ip: data.ip,
      port: data.port,
      hostname: data.hostname,
      version: data.version,
      software: data.software,
      motd: data.motd?.clean?.join('\n'),
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 0,
        list: data.players?.list ?? [],
      },
      plugins: data.plugins,
      mods: data.mods,
    }
  } catch (e) {
    console.error('Failed to fetch server data:', e)
    return null
  }
}

export interface LiveStatus {
  online: boolean
  players: string[]
  max: number
  source: 'rcon' | 'mcsrvstat'
  dayTicks?: number
  gameTime?: number
  mspt?: number
  tickRate?: number
}

export function parseList(output: string): { online: number; max: number; players: string[] } | null {
  const m = output.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/s)
  if (!m) return null
  const players = (m[3] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return { online: Number(m[1]), max: Number(m[2]), players }
}

export function parseTickQuery(output: string): { tickRate?: number; mspt?: number } {
  const rate = output.match(/Target tick rate:\s*([\d.]+)/)?.[1]
  const mspt = output.match(/Average time per tick:\s*([\d.]+)\s*ms/)?.[1]
  return {
    tickRate: rate ? Number(rate) : undefined,
    mspt: mspt ? Number(mspt) : undefined,
  }
}

export function parseTicks(output: string): number | undefined {
  const m = output.match(/(-?\d+)\s*tick/)
  return m ? Number(m[1]) : undefined
}

async function rconStatus(): Promise<LiveStatus | null> {
  const list = parseList(await rcon('list'))
  if (!list) return null
  const status: LiveStatus = { online: true, players: list.players, max: list.max, source: 'rcon' }
  // These are decoration; the server answered `list`, so it is online either way.
  try {
    const [tick, day, gameTime] = await Promise.all([
      rcon('tick query'),
      rcon('time query day'),
      rcon('time query gametime'),
    ])
    Object.assign(status, parseTickQuery(tick))
    status.dayTicks = parseTicks(day)
    status.gameTime = parseTicks(gameTime)
  } catch (e) {
    console.error('[rcon] extra status queries failed:', e)
  }
  return status
}

export async function getLiveStatus(server: string): Promise<LiveStatus> {
  if (rconConfigured) {
    try {
      const status = await rconStatus()
      if (status) return status
    } catch (e) {
      console.error('[rcon] status failed, falling back to mcsrvstat:', (e as Error).message)
    }
  }
  const data = await getServerData(server)
  if (!data) return { online: false, players: [], max: 0, source: 'mcsrvstat' }
  return {
    online: true,
    players: data.players.list.map((p) => p.name),
    max: data.players.max,
    source: 'mcsrvstat',
  }
}

export function parseWhitelist(output: string): string[] {
  const idx = output.indexOf(':')
  if (idx === -1) return []
  return output
    .slice(idx + 1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
