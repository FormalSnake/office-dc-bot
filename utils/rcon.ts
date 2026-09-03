import { Rcon } from 'rcon-client'
import { stripMcCodes } from './mc-text'

const host = process.env.RCON_HOST
const port = Number(process.env.RCON_PORT ?? 25575)
const password = process.env.RCON_PASSWORD

export const rconConfigured = Boolean(host && password)

export class RconUnavailable extends Error {}

// Commands the bot runs on someone's behalf echo back through the server log as
// "[Rcon: ...]"; the log relay uses this to skip those since the reply already shows them.
let lastBotCommandAt = 0
export const noteBotCommand = () => {
  lastBotCommandAt = Date.now()
}
export const botCommandRecently = (windowMs = 5000) => Date.now() - lastBotCommandAt < windowMs

let client: Rcon | null = null
let connecting: Promise<Rcon> | null = null

async function connect(): Promise<Rcon> {
  if (client) return client
  if (connecting) return connecting
  connecting = (async () => {
    const rcon = new Rcon({ host: host!, port, password: password!, timeout: 5000 })
    rcon.on('end', () => {
      if (client === rcon) client = null
    })
    rcon.on('error', (err) => console.error('[rcon]', err.message))
    await rcon.connect()
    client = rcon
    return rcon
  })().finally(() => {
    connecting = null
  })
  return connecting
}

async function drop() {
  const c = client
  client = null
  if (!c) return
  try {
    await c.end()
  } catch {}
}

export async function rcon(command: string): Promise<string> {
  if (!rconConfigured) throw new RconUnavailable('RCON is not configured (RCON_HOST / RCON_PASSWORD)')
  try {
    const c = await connect()
    return stripMcCodes(await c.send(command)).trim()
  } catch (err) {
    await drop()
    throw err
  }
}
