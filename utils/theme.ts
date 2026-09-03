import { EmbedBuilder } from 'discord.js'

export const SERVER_HOST = process.env.MINECRAFT_SERVER!
export const BLUEMAP_URL = process.env.BLUEMAP_URL
export const MODPACK_URL = process.env.MODPACK_URL

export const BRAND = {
  name: 'Biggyatia',
  title: '✦ B I G G Y A T I A ✦',
  tagline: 'De nieuwe nieuwe superserver server!',
  // Minecraft §6 gold, matches the MOTD.
  gold: 0xffaa00,
  red: 0xaa0000,
  green: 0x55ff55,
  grey: 0x555555,
}

export function brandEmbed(color: number = BRAND.gold) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: `${BRAND.name} · ${SERVER_HOST}` })
    .setTimestamp()
}

export const headUrl = (name: string, size = 64) =>
  `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`

export const bodyUrl = (name: string) => `https://mc-heads.net/body/${encodeURIComponent(name)}/right`
