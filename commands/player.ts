import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { getLiveStatus, parseWhitelist } from '../utils/mc-server'
import { isValidUsername } from '../utils/mc-text'
import { statsFields } from './stats'
import { rcon, rconConfigured } from '../utils/rcon'
import { SERVER_HOST, bodyUrl, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

export const player: Command = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Look up a player: skin, online and whitelist status')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('name').setDescription('Minecraft username').setRequired(true).setMinLength(3).setMaxLength(16)),

  async execute(interaction) {
    const name = interaction.options.getString('name', true)
    if (!isValidUsername(name)) {
      await interaction.reply({ content: 'That is not a valid Minecraft username.', flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.deferReply()

    const [live, whitelist] = await Promise.all([
      getLiveStatus(SERVER_HOST),
      rconConfigured ? rcon('whitelist list').then(parseWhitelist).catch(() => null) : Promise.resolve(null),
    ])
    const lower = name.toLowerCase()
    const online = live.players.some((p) => p.toLowerCase() === lower)
    const whitelisted = whitelist ? whitelist.some((p) => p.toLowerCase() === lower) : null

    const embed = brandEmbed()
      .setAuthor({ name, iconURL: headUrl(name) })
      .setImage(bodyUrl(name))
      .addFields(
        { name: 'Online', value: online ? '🟢 Yes' : '⚫ No', inline: true },
        { name: 'Whitelisted', value: whitelisted === null ? '❔ Unknown' : whitelisted ? '✅ Yes' : '❌ No', inline: true },
      )

    const fields = await statsFields(name)
    if (fields) embed.addFields(fields)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('NameMC').setURL(`https://namemc.com/profile/${encodeURIComponent(name)}`),
    )
    await interaction.editReply({ embeds: [embed], components: [row] })
  },
}
