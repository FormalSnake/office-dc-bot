import type { Client, Webhook } from 'discord.js'
import { headUrl } from './theme'

const WEBHOOK_NAME = 'Biggyatia'
const cache = new Map<string, Promise<Webhook>>()

// One webhook per channel, created on first use. Messages sent through it can
// carry any name and avatar, which is how chat lines show up as the player.
function webhookFor(client: Client<true>, channelId: string): Promise<Webhook> {
  let pending = cache.get(channelId)
  if (!pending) {
    pending = (async () => {
      const channel = await client.channels.fetch(channelId)
      if (!channel || !('createWebhook' in channel) || !('fetchWebhooks' in channel)) {
        throw new Error(`channel ${channelId} cannot hold webhooks`)
      }
      const existing = (await channel.fetchWebhooks()).find((w) => w.owner?.id === client.user.id && w.name === WEBHOOK_NAME)
      return existing ?? channel.createWebhook({ name: WEBHOOK_NAME, avatar: client.user.displayAvatarURL({ size: 256 }) })
    })()
    pending.catch(() => cache.delete(channelId))
    cache.set(channelId, pending)
  }
  return pending
}

export async function sendAsPlayer(client: Client<true>, channelId: string, player: string, content: string) {
  const webhook = await webhookFor(client, channelId)
  await webhook.send({
    content,
    username: player,
    avatarURL: headUrl(player, 128),
    allowedMentions: { parse: [] },
  })
}
