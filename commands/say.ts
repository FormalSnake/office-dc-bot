import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { isPlayer } from '../utils/access'
import { rcon, rconConfigured } from '../utils/rcon'
import type { Command } from './types'

export function cleanChatText(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Shows in-game as "[Discord] Name: text" in the MOTD gold.
export async function sendDiscordChat(name: string, text: string) {
  const component = [
    { text: '[Discord] ', color: 'gold' },
    { text: `${name}: `, color: 'yellow' },
    { text, color: 'white' },
  ]
  await rcon(`tellraw @a ${JSON.stringify(component)}`)
}

export const say: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message to everyone in-game')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName('message').setDescription('What to say').setRequired(true).setMaxLength(200)),

  async execute(interaction) {
    if (!isPlayer(interaction.member)) {
      await interaction.reply({ content: 'You need the player role to talk in-game.', flags: MessageFlags.Ephemeral })
      return
    }
    if (!rconConfigured) {
      await interaction.reply({ content: 'RCON is not configured on the bot.', flags: MessageFlags.Ephemeral })
      return
    }

    const text = cleanChatText(interaction.options.getString('message', true))
    if (!text) {
      await interaction.reply({ content: 'Nothing to say.', flags: MessageFlags.Ephemeral })
      return
    }

    const name = interaction.member.displayName
    await interaction.deferReply()
    await sendDiscordChat(name, text)
    console.log(`[say] ${interaction.user.tag}: ${text}`)
    await interaction.editReply({ content: `📣 **${name}**: ${text}`, allowedMentions: { parse: [] } })
  },
}
