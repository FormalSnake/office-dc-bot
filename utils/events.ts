import { EmbedBuilder, escapeMarkdown, type Client } from 'discord.js'
import {
  closeAllSessions,
  getSettingForAllGuilds,
  recordAdvancement,
  recordDeath,
  recordJoin,
  recordLeave,
  type SettingKey,
} from './db'
import type { McEvent } from './mc-events'
import { parseList } from './mc-server'
import { formatDuration } from './mc-text'
import { readPlayerWorldStats } from './mc-stats'
import { botCommandRecently, rcon, rconConfigured } from './rcon'
import { BRAND } from './theme'
import { sendAsPlayer } from './webhook'

const ADVANCEMENT_STYLE = {
  advancement: { emoji: '🏆', label: 'has made the advancement', color: BRAND.gold },
  goal: { emoji: '🎯', label: 'has reached the goal', color: 0x55ffff },
  challenge: { emoji: '🏅', label: 'has completed the challenge', color: 0xaa00aa },
} as const

export async function postEmbeds(c: Client<true>, key: SettingKey, embeds: EmbedBuilder[]) {
  for (const { guildId, value: channelId } of getSettingForAllGuilds(key)) {
    try {
      const channel = await c.channels.fetch(channelId)
      if (!channel?.isSendable()) continue
      await channel.send({ embeds: embeds.slice(0, 10) })
    } catch (e) {
      console.error(`[${key}] failed to post in ${channelId} (guild ${guildId}):`, (e as Error).message)
    }
  }
}

async function postAsPlayer(c: Client<true>, key: SettingKey, player: string, payload: { content?: string; embeds?: EmbedBuilder[] }) {
  for (const { value: channelId } of getSettingForAllGuilds(key)) {
    try {
      await sendAsPlayer(c, channelId, player, payload)
    } catch (e) {
      console.error(`[${key}] webhook post in ${channelId} failed:`, (e as Error).message)
    }
  }
}

async function onlineCount(): Promise<string | null> {
  if (!rconConfigured) return null
  try {
    const list = parseList(await rcon('list'))
    return list ? `${list.online}/${list.max} online` : null
  } catch {
    return null
  }
}

function footer(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter(Boolean).join(' · ')
  return text || null
}

// Console and RCON feedback can come in bursts (chunk pregeneration progress, for
// one); cap what reaches Discord.
const rconRelay = { windowStart: 0, count: 0 }
const RCON_RELAY_PER_MINUTE = 10

async function relayAdmin(c: Client<true>, source: string, message: string) {
  if (source === 'Rcon' || source === 'Server') {
    if (botCommandRecently()) return
    const now = Date.now()
    if (now - rconRelay.windowStart > 60_000) Object.assign(rconRelay, { windowStart: now, count: 0 })
    if (++rconRelay.count > RCON_RELAY_PER_MINUTE) return
    return postEmbeds(c, 'console_channel', [new EmbedBuilder().setColor(BRAND.grey).setDescription(`🖥️ **${source}** · ${escapeMarkdown(message)}`)])
  }
  return postAsPlayer(c, 'console_channel', source, { content: `🛠️ ${escapeMarkdown(message)}` })
}

export async function handleEvent(c: Client<true>, event: McEvent) {
  switch (event.type) {
    case 'chat':
      return postAsPlayer(c, 'chat_channel', event.player, { content: escapeMarkdown(event.text) })

    case 'death': {
      const own = recordDeath(event.player)
      const world = await readPlayerWorldStats(event.player)
      const count = world ? Math.max(world.deaths + 1, own) : own
      const embed = new EmbedBuilder().setColor(BRAND.red).setDescription(`💀 ${event.text}`)
      const text = footer(`Death #${count}`)
      if (text) embed.setFooter({ text })
      return postAsPlayer(c, 'chat_channel', event.player, { embeds: [embed] })
    }

    case 'advancement': {
      const own = recordAdvancement(event.player)
      const world = await readPlayerWorldStats(event.player)
      const count = world ? Math.max(world.advancements + 1, own) : own
      const style = ADVANCEMENT_STYLE[event.kind]
      const embed = new EmbedBuilder()
        .setColor(style.color)
        .setTitle(`${style.emoji} ${event.title}`)
        .setDescription(style.label)
      const text = footer(`Advancement #${count}`)
      if (text) embed.setFooter({ text })
      return postAsPlayer(c, 'chat_channel', event.player, { embeds: [embed] })
    }

    case 'join': {
      const known = await readPlayerWorldStats(event.player)
      const first = recordJoin(event.player) && known === null
      const embed = new EmbedBuilder()
        .setColor(BRAND.green)
        .setDescription(first ? `➡️ joined the game\n🎉 **First time on ${BRAND.name}!**` : '➡️ joined the game')
      const text = footer(await onlineCount())
      if (text) embed.setFooter({ text })
      return postAsPlayer(c, 'activity_channel', event.player, { embeds: [embed] })
    }

    case 'leave': {
      const ms = recordLeave(event.player)
      const embed = new EmbedBuilder().setColor(BRAND.grey).setDescription('⬅️ left the game')
      const text = footer(ms !== null ? `played ${formatDuration(ms)}` : null, await onlineCount())
      if (text) embed.setFooter({ text })
      return postAsPlayer(c, 'activity_channel', event.player, { embeds: [embed] })
    }

    case 'admin':
      return relayAdmin(c, event.source, event.message)

    case 'started':
      return postEmbeds(c, 'activity_channel', [new EmbedBuilder().setColor(BRAND.green).setDescription(`🟢 **${BRAND.name} is online**`)])

    case 'stopping':
      closeAllSessions()
      return postEmbeds(c, 'activity_channel', [new EmbedBuilder().setColor(BRAND.red).setDescription(`🔴 **${BRAND.name} is stopping**`)])
  }
}
