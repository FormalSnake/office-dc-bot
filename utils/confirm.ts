import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type Message } from 'discord.js'

export function confirmRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('confirm').setLabel('Run it').setStyle(ButtonStyle.Danger),
  )
}

// Waits for the requesting user to press Run it or Cancel on a message that
// was sent with confirmRow(). Clears the buttons either way.
export async function awaitConfirmation(message: Message, userId: string, timeoutMs = 30_000): Promise<boolean> {
  try {
    const press = await message.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === userId,
      time: timeoutMs,
    })
    const confirmed = press.customId === 'confirm'
    await press.update({ components: [] })
    return confirmed
  } catch {
    await message.edit({ content: `${message.content}\n⏱️ No answer, cancelled.`, components: [] }).catch(() => {})
    return false
  }
}
