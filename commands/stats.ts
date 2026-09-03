import {
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  time,
  TimestampStyles,
  type APIEmbedField,
} from 'discord.js'
import { currentSessionMs, getPlayer, topPlayers } from '../utils/db'
import { readPlayerWorldStats, readWorldStats, type WorldStats } from '../utils/mc-stats'
import { formatDuration, isValidUsername } from '../utils/mc-text'
import { BRAND, SERVER_HOST, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

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

const MEDALS = ['🥇', '🥈', '🥉']

export interface Row {
  name: string
  online: boolean
  stats: { emoji: string; value: string; primary?: boolean }[]
}

// One section per player with their head as the thumbnail. Components v2 caps a
// message at 40 components, so ten rows leave room for the header and footer only.
export function leaderboard(subtitle: string, rows: Row[]) {
  const container = new ContainerBuilder()
    .setAccentColor(BRAND.gold)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🏆 ${BRAND.name} leaderboard\n-# ${subtitle} · 🟢 online now`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))

  rows.forEach((row, i) => {
    const rank = MEDALS[i] ?? `**${i + 1}.**`
    const stats = row.stats.map((s) => `${s.emoji} ${s.primary ? `**${s.value}**` : s.value}`).join('   ')
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${rank} **${row.name}**${row.online ? ' 🟢' : ''}\n${stats}`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(headUrl(row.name, 64))),
    )
    if (i === 2 && rows.length > 3) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
  })

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${BRAND.name} · ${SERVER_HOST}`))
  return { components: [container], flags: MessageFlags.IsComponentsV2 } as const
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
      await interaction.reply(
        leaderboard(
          `Sorted by ${sort.label.toLowerCase()}`,
          rows.map((s) => ({
            name: s.name,
            online: currentSessionMs(s.name) !== null,
            stats:
              sortKey === 'playtimeMs'
                ? [
                    { emoji: '⏱️', value: formatDuration(s.playtimeMs), primary: true },
                    { emoji: '💀', value: String(s.deaths) },
                    { emoji: '🏆', value: String(s.advancements) },
                  ]
                : [
                    { emoji: sort.emoji, value: sort.format(s), primary: true },
                    { emoji: '⏱️', value: formatDuration(s.playtimeMs) },
                  ],
          })),
        ),
      )
      return
    }

    const top = topPlayers(10)
    if (!top.length) {
      await interaction.reply({
        embeds: [brandEmbed().setTitle(`${BRAND.name} leaderboard`).setDescription('No play sessions recorded yet. Stats start counting from the moment the bot started following the server log.')],
      })
      return
    }
    await interaction.reply(
      leaderboard(
        'Sorted by playtime',
        top.map((p) => {
          const live = currentSessionMs(p.name)
          return {
            name: p.name,
            online: live !== null,
            stats: [
              { emoji: '⏱️', value: formatDuration(p.playtimeMs + (live ?? 0)), primary: true },
              { emoji: '💀', value: String(p.deaths) },
              { emoji: '🏆', value: String(p.advancements) },
            ],
          }
        }),
      ),
    )
  },
}
