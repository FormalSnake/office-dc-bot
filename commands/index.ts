import { consoleCommand } from './console'
import { help } from './help'
import { join } from './join'
import { map } from './map'
import { player } from './player'
import { players } from './players'
import { say } from './say'
import { setup } from './setup'
import { stats } from './stats'
import { status } from './status'
import type { Command } from './types'
import { whitelist } from './whitelist'

export const commands: Command[] = [status, players, player, stats, join, map, say, whitelist, consoleCommand, setup, help]

export const commandsByName = new Map(commands.map((c) => [c.data.name, c]))
