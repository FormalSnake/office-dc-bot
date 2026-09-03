import type { Client } from 'discord.js'
import { headUrl } from './theme'

// Player heads as application emoji, so they render inline at emoji size in any
// text. Uploaded once per player on first use; the app may hold 2000 of them.
const PREFIX = 'mc_'
const cache = new Map<string, string>()
let loaded: Promise<void> | null = null

function load(client: Client<true>): Promise<void> {
  if (!loaded) {
    loaded = client.application.emojis
      .fetch()
      .then((emojis) => {
        for (const emoji of emojis.values()) {
          if (emoji.name?.startsWith(PREFIX)) cache.set(emoji.name.slice(PREFIX.length).toLowerCase(), emoji.toString())
        }
      })
      .catch((e) => {
        console.error('[head-emoji] fetch failed:', (e as Error).message)
        loaded = null
      })
  }
  return loaded
}

// Returns the emoji markup for a player's head, or an empty string when the
// upload fails so callers can render without it.
export async function headEmoji(client: Client<true>, player: string): Promise<string> {
  await load(client)
  const key = player.toLowerCase()
  const hit = cache.get(key)
  if (hit) return hit
  try {
    const emoji = await client.application.emojis.create({ attachment: headUrl(player, 64), name: `${PREFIX}${player}` })
    cache.set(key, emoji.toString())
    return emoji.toString()
  } catch (e) {
    console.error(`[head-emoji] upload for ${player} failed:`, (e as Error).message)
    return ''
  }
}

export async function headEmojis(client: Client<true>, players: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(players.map(async (p) => [p, await headEmoji(client, p)] as const))
  return new Map(entries)
}
