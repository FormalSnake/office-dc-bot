import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type User } from 'discord.js'
import { isAdmin } from '../utils/access'
import { awaitConfirmation, confirmRow } from '../utils/confirm'
import { getSetting } from '../utils/db'
import { codeBlock } from '../utils/mc-text'
import { noteBotCommand, rcon, rconConfigured } from '../utils/rcon'
import type { Command } from './types'

// Commands that kick people, hand out power or take the server down get a confirm step.
const DANGEROUS = new Set(['stop', 'restart', 'op', 'deop', 'ban', 'ban-ip', 'kill', 'kick'])

export function isDangerous(command: string): boolean {
  const [head = '', tail = ''] = command.trim().toLowerCase().split(/\s+/, 2)
  if (DANGEROUS.has(head)) return true
  return head === 'whitelist' && (tail === 'off' || tail === 'on')
}

export function normalizeCommand(input: string): string {
  return input.trim().replace(/^\//, '').replace(/\s+/g, ' ')
}

export async function runConsole(command: string, user: User): Promise<string> {
  console.log(`[console] ${user.tag} (${user.id}): ${command}`)
  noteBotCommand()
  const output = await rcon(command)
  return `> ${command}\n${output}`
}

export const consoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('console')
    .setDescription('Run a server console command (admins, in the console channel)')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) => o.setName('command').setDescription('Command without the leading slash').setRequired(true).setMaxLength(500)),

  async execute(interaction) {
    const ephemeral = { flags: MessageFlags.Ephemeral } as const

    if (!isAdmin(interaction.member)) {
      await interaction.reply({ content: 'Only admins can use the console.', ...ephemeral })
      return
    }
    const consoleChannel = getSetting(interaction.guildId, 'console_channel')
    if (!consoleChannel) {
      await interaction.reply({ content: 'No console channel is configured. An administrator can set one with `/setup console`.', ...ephemeral })
      return
    }
    if (interaction.channelId !== consoleChannel) {
      await interaction.reply({ content: `Console commands only work in <#${consoleChannel}>.`, ...ephemeral })
      return
    }
    if (!rconConfigured) {
      await interaction.reply({ content: 'RCON is not configured on the bot.', ...ephemeral })
      return
    }

    const command = normalizeCommand(interaction.options.getString('command', true))
    if (!command) {
      await interaction.reply({ content: 'Empty command.', ...ephemeral })
      return
    }

    await interaction.deferReply()

    if (isDangerous(command)) {
      const message = await interaction.editReply({
        content: `⚠️ About to run \`${command}\` on Biggyatia.`,
        components: [confirmRow()],
      })
      if (!(await awaitConfirmation(message, interaction.user.id))) {
        await interaction.editReply({ content: `Cancelled \`${command}\`.`, components: [] })
        return
      }
    }

    const output = await runConsole(command, interaction.user)
    await interaction.editReply({ content: codeBlock(output), components: [] })
  },
}
