import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { getLiveStatus } from '../utils/mc-server'
import { BRAND, SERVER_HOST, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

// One embed per player so every row gets its own head; Discord allows 10 embeds per message.
const MAX_ROWS = 9

export const players: Command = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('Who is on Biggyatia right now')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply()
    const live = await getLiveStatus(SERVER_HOST)

    if (!live.online) {
      await interaction.editReply({
        embeds: [brandEmbed(BRAND.red).setTitle(BRAND.title).setDescription('🔴 Biggyatia is offline.')],
      })
      return
    }

    const header = brandEmbed().setTitle(`${live.players.length}/${live.max} online`)
    if (!live.players.length) {
      header.setDescription('Nobody is on. Be the first ✦')
      await interaction.editReply({ embeds: [header] })
      return
    }

    const rows = live.players.slice(0, MAX_ROWS).map((name) =>
      new EmbedBuilder().setColor(BRAND.gold).setAuthor({ name, iconURL: headUrl(name) }),
    )
    const rest = live.players.slice(MAX_ROWS)
    if (rest.length) rows[rows.length - 1]!.setDescription(`and ${rest.length} more: ${rest.join(', ')}`)

    await interaction.editReply({ embeds: [header, ...rows] })
  },
}
