import { InteractionContextType, MessageFlags, SlashCommandBuilder, time, TimestampStyles, type APIEmbedField } from 'discord.js'
import { currentSessionMs, getPlayer, topPlayers } from '../utils/db'
import { readPlayerWorldStats, readWorldStats, type WorldStats } from '../utils/mc-stats'
import { formatDuration, isValidUsername } from '../utils/mc-text'
import { BRAND, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

const MEDALS = ['🥇', '🥈', '🥉']

type SortKey = 'playtimeMs' | 'deaths' | 'advancements' | 'mobKills' | 'playerKills' | 'diamonds' | 'distanceKm' | 'blocksMined'

const SORTS: Record<SortKey, { label: string; emoji: string; format: (s: WorldStats) => string }> = {
  playtimeMs: { label: 'Playtime', emoji: '⏱️', format: (s) => formatDuration(s.playtimeMs) },
  deaths: { label: 'Deaths', emoji: '💀', format: (s) => String(s.deaths) },
  advancements: { label: 'Advancements', emoji: '🏆', format: (s) => String(s.advancements) },
  mobKills: { label: 'Mob kills', emoji: '⚔️', format: (s) => String(s.mobKills) },
  playerKills: { label: 'Player kills', emoji: '🗡️', format: (s) => String(s.playerKills) },
  diamonds: { label: 'Diamonds mined', emoji: '💎', format: (s) => String(s.diamonds) },
  distanceKm: { label: 'Distance', emoji: '🥾', format: (s) => `${s.distanceKm.toFixed(1)} km` },
  blocksMined: { label: 'Blocks mined', emoji: '⛏️', format: (s) => s.blocksMined.toLocaleString('en-US') },
}

// Fields for one player's card, from the server's own statistics when the data
// directory is mounted, otherwise from what the bot has counted itself.
export async function statsFields(name: string): Promise<APIEmbedField[] | null> {
  const live = currentSessionMs(name)
  const world = await readPlayerWorldStats(name)
  if (world) {
    return [
      { name: 'Playtime', value: formatDuration(world.playtimeMs), inline: true },
      { name: 'Deaths', value: String(world.deaths), inline: true },
      { name: 'Advancements', value: String(world.advancements), inline: true },
      { name: 'Mob kills', value: String(world.mobKills), inline: true },
      { name: 'Player kills', value: String(world.playerKills), inline: true },
      { name: 'Diamonds mined', value: String(world.diamonds), inline: true },
      { name: 'Distance', value: `${world.distanceKm.toFixed(1)} km`, inline: true },
      { name: 'Blocks mined', value: world.blocksMined.toLocaleString('en-US'), inline: true },
      {
        name: live !== null ? 'Online for' : 'Last played',
        value: live !== null ? formatDuration(live) : world.lastPlayed ? time(Math.floor(world.lastPlayed / 1000), TimestampStyles.RelativeTime) : 'unknown',
        inline: true,
      },
    ]
  }
  const own = getPlayer(name)
  if (!own) return null
  return [
    { name: 'Playtime', value: formatDuration(own.playtimeMs + (live ?? 0)), inline: true },
    { name: 'Deaths', value: String(own.deaths), inline: true },
    { name: 'Advancements', value: String(own.advancements), inline: true },
    { name: 'First seen', value: time(Math.floor(own.firstSeen / 1000), TimestampStyles.RelativeTime), inline: true },
    {
      name: live !== null ? 'Online for' : 'Last seen',
      value: live !== null ? formatDuration(live) : time(Math.floor(own.lastSeen / 1000), TimestampStyles.RelativeTime),
      inline: true,
    },
  ]
}

export const stats: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Leaderboard, or one player: playtime, deaths, kills, diamonds and more')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('player').setDescription('Minecraft username (leave empty for the leaderboard)').setMinLength(3).setMaxLength(16))
    .addStringOption((o) =>
      o
        .setName('sort')
        .setDescription('Leaderboard order')
        .addChoices(...(Object.keys(SORTS) as SortKey[]).map((key) => ({ name: SORTS[key].label, value: key }))),
    ),

  async execute(interaction) {
    const name = interaction.options.getString('player')

    if (name) {
      if (!isValidUsername(name)) {
        await interaction.reply({ content: 'That is not a valid Minecraft username.', flags: MessageFlags.Ephemeral })
        return
      }
      const fields = await statsFields(name)
      if (!fields) {
        await interaction.reply({ content: `No stats for **${name}** yet. They appear after the first time the server saves their data.`, flags: MessageFlags.Ephemeral })
        return
      }
      const canonical = (await readPlayerWorldStats(name))?.name ?? getPlayer(name)?.name ?? name
      await interaction.reply({ embeds: [brandEmbed().setAuthor({ name: canonical, iconURL: headUrl(canonical) }).addFields(fields)] })
      return
    }

    const sortKey = (interaction.options.getString('sort') as SortKey | null) ?? 'playtimeMs'
    const sort = SORTS[sortKey]
    const world = await readWorldStats()

    if (world.length) {
      const rows = [...world].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 10)
      const embed = brandEmbed().setTitle(`${BRAND.name} leaderboard · ${sort.label}`).setDescription(
        rows
          .map((s, i) => {
            const online = currentSessionMs(s.name) !== null ? ' · 🟢' : ''
            const extra = sortKey === 'playtimeMs' ? ` · 💀 ${s.deaths} · 🏆 ${s.advancements}` : ` · ⏱️ ${formatDuration(s.playtimeMs)}`
            return `${MEDALS[i] ?? `**${i + 1}.**`} **${s.name}** · ${sort.emoji} ${sort.format(s)}${extra}${online}`
          })
          .join('\n'),
      )
      await interaction.reply({ embeds: [embed] })
      return
    }

    const top = topPlayers(10)
    const embed = brandEmbed().setTitle(`${BRAND.name} leaderboard · Playtime`)
    if (!top.length) {
      embed.setDescription('No play sessions recorded yet. Stats start counting from the moment the bot started following the server log.')
    } else {
      embed.setDescription(
        top
          .map((p, i) => {
            const live = currentSessionMs(p.name)
            return `${MEDALS[i] ?? `**${i + 1}.**`} **${p.name}** · ⏱️ ${formatDuration(p.playtimeMs + (live ?? 0))} · 💀 ${p.deaths} · 🏆 ${p.advancements}${live !== null ? ' · 🟢' : ''}`
          })
          .join('\n'),
      )
    }
    await interaction.reply({ embeds: [embed] })
  },
}
