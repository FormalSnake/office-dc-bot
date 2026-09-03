import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { getServerData } from '../utils/mc-server'
import { BLUEMAP_URL, BRAND, MODPACK_URL, SERVER_HOST, brandEmbed } from '../utils/theme'
import type { Command } from './types'

export const join: Command = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription('How to get on Biggyatia: address, version, whitelist')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply()
    const meta = await getServerData(SERVER_HOST)

    const embed = brandEmbed()
      .setTitle(`Joining ${BRAND.name}`)
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Address', value: `\`${SERVER_HOST}\``, inline: true },
        { name: 'Version', value: meta?.version ? `Minecraft ${meta.version} · Fabric` : 'Fabric (see /status)', inline: true },
        { name: 'Whitelist', value: 'Ask an admin to run `/whitelist add <your name>`' },
        { name: 'Voice chat', value: 'Install the Simple Voice Chat mod to talk in-game.' },
      )

    const row = new ActionRowBuilder<ButtonBuilder>()
    if (MODPACK_URL) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Modpack').setEmoji('📦').setURL(MODPACK_URL))
    if (BLUEMAP_URL) row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('BlueMap').setEmoji('🗺️').setURL(BLUEMAP_URL))

    await interaction.editReply({ embeds: [embed], components: row.components.length ? [row] : [] })
  },
}
