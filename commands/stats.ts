import { InteractionContextType, MessageFlags, SlashCommandBuilder, time, TimestampStyles } from 'discord.js'
import { currentSessionMs, getPlayer, topPlayers } from '../utils/db'
import { formatDuration, isValidUsername } from '../utils/mc-text'
import { BRAND, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

const MEDALS = ['🥇', '🥈', '🥉']

export const stats: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Playtime, deaths and advancements, for one player or the leaderboard')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('player').setDescription('Minecraft username (leave empty for the leaderboard)').setMinLength(3).setMaxLength(16)),

  async execute(interaction) {
    const name = interaction.options.getString('player')

    if (!name) {
      const top = topPlayers(10)
      const embed = brandEmbed().setTitle(`${BRAND.name} leaderboard`)
      if (!top.length) {
        embed.setDescription('No play sessions recorded yet. Stats start counting from the moment the bot started following the server log.')
      } else {
        embed.setDescription(
          top
            .map((p, i) => {
              const live = currentSessionMs(p.name)
              const playtime = formatDuration(p.playtimeMs + (live ?? 0))
              return `${MEDALS[i] ?? `**${i + 1}.**`} **${p.name}** · ⏱️ ${playtime} · 💀 ${p.deaths} · 🏆 ${p.advancements}${live !== null ? ' · 🟢' : ''}`
            })
            .join('\n'),
        )
      }
      await interaction.reply({ embeds: [embed] })
      return
    }

    if (!isValidUsername(name)) {
      await interaction.reply({ content: 'That is not a valid Minecraft username.', flags: MessageFlags.Ephemeral })
      return
    }
    const player = getPlayer(name)
    if (!player) {
      await interaction.reply({ content: `No stats for **${name}** yet. They show up after the first join the bot sees.`, flags: MessageFlags.Ephemeral })
      return
    }

    const live = currentSessionMs(player.name)
    const embed = brandEmbed()
      .setAuthor({ name: player.name, iconURL: headUrl(player.name) })
      .addFields(
        { name: 'Playtime', value: formatDuration(player.playtimeMs + (live ?? 0)), inline: true },
        { name: 'Deaths', value: String(player.deaths), inline: true },
        { name: 'Advancements', value: String(player.advancements), inline: true },
        { name: 'First seen', value: time(Math.floor(player.firstSeen / 1000), TimestampStyles.RelativeTime), inline: true },
        {
          name: live !== null ? 'Online for' : 'Last seen',
          value: live !== null ? formatDuration(live) : time(Math.floor(player.lastSeen / 1000), TimestampStyles.RelativeTime),
          inline: true,
        },
      )
    await interaction.reply({ embeds: [embed] })
  },
}
