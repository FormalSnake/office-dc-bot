import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { isAdmin } from '../utils/access'
import { parseWhitelist } from '../utils/mc-server'
import { isValidUsername } from '../utils/mc-text'
import { noteBotCommand, rcon } from '../utils/rcon'
import { BRAND, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

export const whitelist: Command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage who may join Biggyatia')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('list').setDescription('Show everyone on the whitelist'))
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Whitelist a player')
        .addStringOption((o) => o.setName('name').setDescription('Minecraft username').setRequired(true).setMinLength(3).setMaxLength(16)),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a player from the whitelist')
        .addStringOption((o) => o.setName('name').setDescription('Minecraft username').setRequired(true).setMinLength(3).setMaxLength(16)),
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      await interaction.reply({ content: 'Only admins can manage the whitelist.', flags: MessageFlags.Ephemeral })
      return
    }

    const sub = interaction.options.getSubcommand(true)

    if (sub === 'list') {
      await interaction.deferReply()
      const names = parseWhitelist(await rcon('whitelist list')).sort((a, b) => a.localeCompare(b))
      const embed = brandEmbed()
        .setTitle(`${BRAND.name} whitelist · ${names.length}`)
        .setDescription(names.length ? names.map((n) => `• ${n}`).join('\n') : 'Nobody is whitelisted.')
      await interaction.editReply({ embeds: [embed] })
      return
    }

    const name = interaction.options.getString('name', true)
    if (!isValidUsername(name)) {
      await interaction.reply({ content: 'That is not a valid Minecraft username.', flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.deferReply()

    noteBotCommand()
    const output = await rcon(`whitelist ${sub} ${name}`)
    console.log(`[whitelist] ${interaction.user.tag}: whitelist ${sub} ${name} -> ${output}`)

    const ok = /^(Added|Removed)/.test(output)
    const embed = brandEmbed(ok ? BRAND.gold : BRAND.red)
      .setAuthor({ name, iconURL: headUrl(name) })
      .setDescription(`${ok ? '✅' : '⚠️'} ${output}`)
    await interaction.editReply({ embeds: [embed] })
  },
}
