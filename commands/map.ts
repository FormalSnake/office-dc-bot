import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { BLUEMAP_URL, BRAND, brandEmbed } from '../utils/theme'
import { linkButtons } from './status'
import type { Command } from './types'

export const map: Command = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Open the live BlueMap of Biggyatia')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!BLUEMAP_URL) {
      await interaction.reply({ content: 'No map link is configured on the bot (BLUEMAP_URL).', flags: MessageFlags.Ephemeral })
      return
    }
    const embed = brandEmbed()
      .setTitle(`🗺️ ${BRAND.name} map`)
      .setDescription(`Overworld, Nether and End, rendered live.\n${BLUEMAP_URL}`)
    await interaction.reply({ embeds: [embed], components: linkButtons() })
  },
}
