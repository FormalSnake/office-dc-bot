import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { headEmojis } from '../utils/head-emoji'
import { getLiveStatus, getServerData } from '../utils/mc-server'
import { dayPhase, ticksToClock } from '../utils/mc-text'
import { BLUEMAP_URL, BRAND, SERVER_HOST, brandEmbed, headUrl } from '../utils/theme'
import type { Command } from './types'

export function linkButtons() {
  const row = new ActionRowBuilder<ButtonBuilder>()
  if (BLUEMAP_URL) {
    row.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('BlueMap').setEmoji('🗺️').setURL(BLUEMAP_URL))
  }
  return row.components.length ? [row] : []
}

export const status: Command = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Is Biggyatia up? Players, time of day and tick health')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply()

    const [live, meta] = await Promise.all([getLiveStatus(SERVER_HOST), getServerData(SERVER_HOST)])

    if (!live.online) {
      const embed = brandEmbed(BRAND.red)
        .setTitle(BRAND.title)
        .setDescription('🔴 **Offline**\nBiggyatia is not answering right now.')
      await interaction.editReply({ embeds: [embed] })
      return
    }

    const embed = brandEmbed()
      .setTitle(BRAND.title)
      .setDescription(meta?.motd?.split('\n')[1] ?? BRAND.tagline)
      .setThumbnail(interaction.client.user.displayAvatarURL({ size: 128 }))
      .addFields(
        { name: 'Status', value: '🟢 Online', inline: true },
        { name: 'Players', value: `${live.players.length}/${live.max}`, inline: true },
        { name: 'Version', value: meta?.version ? `${meta.version} Fabric` : 'Fabric', inline: true },
      )

    if (live.dayTicks !== undefined) {
      const phase = dayPhase(live.dayTicks)
      const day = live.gameTime !== undefined ? ` · Day ${Math.floor(live.gameTime / 24000)}` : ''
      embed.addFields({ name: 'World', value: `${phase.emoji} ${ticksToClock(live.dayTicks)} ${phase.label}${day}`, inline: true })
    }
    if (live.mspt !== undefined) {
      const tps = live.tickRate ?? 20
      const health = live.mspt < 40 ? '🟢' : live.mspt < 50 ? '🟡' : '🔴'
      embed.addFields({ name: 'Tick', value: `${health} ${live.mspt.toFixed(1)} ms · ${tps} TPS`, inline: true })
    }
    embed.addFields({ name: 'Address', value: `\`${SERVER_HOST}\``, inline: true })

    if (live.players.length) {
      const heads = await headEmojis(interaction.client, live.players)
      embed.addFields({ name: 'Online now', value: live.players.map((p) => `${heads.get(p) ?? ''} **${p}**`.trim()).join('   ') })
    }

    await interaction.editReply({ embeds: [embed], components: linkButtons() })
  },
}
