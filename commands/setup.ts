import { ChannelType, InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { SETTING_KEYS, clearSetting, getSetting, setSetting, type SettingKey } from '../utils/db'
import { BRAND, brandEmbed } from '../utils/theme'
import type { Command } from './types'

const LABELS: Record<SettingKey, string> = {
  console_channel: 'Console channel',
  activity_channel: 'Activity channel',
  chat_channel: 'Chat channel',
  admin_role: 'Admin role',
  player_role: 'Player role',
}

function describe(guildId: string): string {
  return SETTING_KEYS.map((key) => {
    const value = getSetting(guildId, key)
    const shown = value === null ? '*not set*' : key.endsWith('_channel') ? `<#${value}>` : `<@&${value}>`
    return `**${LABELS[key]}** · ${shown}`
  }).join('\n')
}

export const setup: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the Biggyatia bot (administrators only)')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('console')
        .setDescription('Private channel where /console runs server commands')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName('activity')
        .setDescription('Channel that gets join, leave and up/down notices')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName('chat')
        .setDescription('Channel bridged with in-game chat: messages, deaths and advancements')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((s) =>
      s
        .setName('admin-role')
        .setDescription('Role that may use /console and /whitelist next to server administrators')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('player-role')
        .setDescription('Role required for /say (everyone when unset)')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('show').setDescription('Show the current configuration'))
    .addSubcommand((s) =>
      s
        .setName('reset')
        .setDescription('Clear one setting')
        .addStringOption((o) =>
          o
            .setName('setting')
            .setDescription('Which setting')
            .setRequired(true)
            .addChoices(...SETTING_KEYS.map((key) => ({ name: LABELS[key], value: key }))),
        ),
    ),

  async execute(interaction) {
    // Strictly server administrators here: this is where the admin role itself gets handed out.
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: 'Only server administrators can change the setup.', flags: MessageFlags.Ephemeral })
      return
    }

    const guildId = interaction.guildId
    const sub = interaction.options.getSubcommand(true)
    let note: string

    switch (sub) {
      case 'console': {
        const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText])
        setSetting(guildId, 'console_channel', channel.id)
        note = `Console channel is now ${channel}. Everyone who can see it and is an admin can run server commands there, so keep it private.`
        break
      }
      case 'activity': {
        const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText])
        setSetting(guildId, 'activity_channel', channel.id)
        note = `Join and leave notices go to ${channel}.`
        break
      }
      case 'chat': {
        const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText])
        setSetting(guildId, 'chat_channel', channel.id)
        note = `In-game chat, deaths and advancements show up in ${channel}. Messages posted there go in-game once MESSAGE_CONTENT is on.`
        break
      }
      case 'admin-role': {
        const role = interaction.options.getRole('role', true)
        setSetting(guildId, 'admin_role', role.id)
        note = `${role} can now use /console and /whitelist.`
        break
      }
      case 'player-role': {
        const role = interaction.options.getRole('role', true)
        setSetting(guildId, 'player_role', role.id)
        note = `/say now requires ${role}.`
        break
      }
      case 'reset': {
        const key = interaction.options.getString('setting', true) as SettingKey
        clearSetting(guildId, key)
        note = `${LABELS[key]} cleared.`
        break
      }
      default:
        note = ''
    }

    const embed = brandEmbed().setTitle(`${BRAND.name} bot setup`).setDescription(describe(guildId))
    await interaction.reply({ content: note || undefined, embeds: [embed], flags: MessageFlags.Ephemeral })
  },
}
