import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { BRAND, brandEmbed } from '../utils/theme'
import type { Command } from './types'

export const help: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('What this bot can do')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const embed = brandEmbed()
      .setTitle(BRAND.title)
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 128 }))
      .addFields(
        {
          name: 'Everyone',
          value: [
            '`/status` server health, time of day, who is on',
            '`/players` online players with their heads',
            '`/player <name>` skin, online and whitelist status',
            '`/stats [player]` playtime, deaths and advancements, or the leaderboard',
            '`/join` address, version and how to get whitelisted',
            '`/map` live BlueMap',
          ].join('\n'),
        },
        { name: 'Players', value: '`/say <message>` talk to everyone in-game' },
        {
          name: 'Admins',
          value: [
            '`/whitelist list|add|remove` manage the whitelist',
            '`/console <command>` run a server command in the console channel',
            '`/setup` channels and roles (administrators)',
          ].join('\n'),
        },
      )
    await interaction.reply({ embeds: [embed] })
  },
}
