import { PermissionFlagsBits, type GuildMember } from 'discord.js'
import { getSetting } from './db'

export function isAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true
  const role = getSetting(member.guild.id, 'admin_role')
  return role !== null && member.roles.cache.has(role)
}

// Players are admins plus whoever holds the configured player role.
// With no player role configured everyone counts as a player.
export function isPlayer(member: GuildMember): boolean {
  if (isAdmin(member)) return true
  const role = getSetting(member.guild.id, 'player_role')
  return role === null || member.roles.cache.has(role)
}
