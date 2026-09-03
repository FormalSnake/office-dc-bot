import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PresenceUpdateStatus,
  REST,
  Routes,
  type Message,
} from 'discord.js'
import { commands, commandsByName } from './commands'
import { isDangerous, normalizeCommand, runConsole } from './commands/console'
import { cleanChatText, sendDiscordChat } from './commands/say'
import { isAdmin } from './utils/access'
import { awaitConfirmation, confirmRow } from './utils/confirm'
import { getSetting, reconcileSessions } from './utils/db'
import { handleEvent, postEmbeds } from './utils/events'
import { tailFile } from './utils/log-tail'
import { parseLogLine } from './utils/mc-events'
import { logPath } from './utils/mc-stats'
import { getLiveStatus, type LiveStatus } from './utils/mc-server'
import { codeBlock, dayPhase, ticksToClock } from './utils/mc-text'
import { RconUnavailable, rconConfigured } from './utils/rcon'
import { BRAND, SERVER_HOST, headUrl } from './utils/theme'

// Reading what people type in Discord (console relay, chat bridge) needs the
// Message Content intent, which has to be switched on in the developer portal first.
const messageContent = process.env.MESSAGE_CONTENT === '1'
// With the server data directory mounted (MC_DATA_PATH), chat, deaths, advancements
// and joins come straight from the log instead of the 30 second RCON poll.
const POLL_MS = 30_000

const intents = [GatewayIntentBits.Guilds]
if (messageContent) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent)

const client = new Client({ intents })

async function registerCommands(c: Client<true>) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
  const body = commands.map((cmd) => cmd.data.toJSON())
  const guildId = process.env.DISCORD_GUILD_ID

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(c.application.id, guildId), { body })
    // Guild commands update instantly; drop any global ones so they do not show up twice.
    await rest.put(Routes.applicationCommands(c.application.id), { body: [] })
    console.log(`Registered ${body.length} commands in guild ${guildId}`)
  } else {
    await rest.put(Routes.applicationCommands(c.application.id), { body })
    console.log(`Registered ${body.length} global commands`)
  }
}

let presenceTick = 0

// Rotates through players, world time and tick health, one per poll.
function setPresence(c: Client<true>, live: LiveStatus) {
  if (!live.online) {
    c.user.setPresence({
      activities: [{ name: `${BRAND.name} · offline`, type: ActivityType.Watching }],
      status: PresenceUpdateStatus.DoNotDisturb,
    })
    return
  }
  const lines = [`${live.players.length}/${live.max} on ${BRAND.name}`]
  if (live.dayTicks !== undefined) {
    const phase = dayPhase(live.dayTicks)
    const day = live.gameTime !== undefined ? ` · Day ${Math.floor(live.gameTime / 24000)}` : ''
    lines.push(`${phase.emoji} ${ticksToClock(live.dayTicks)}${day}`)
  }
  if (live.mspt !== undefined) lines.push(`${live.mspt.toFixed(1)} ms/tick · ${live.tickRate ?? 20} TPS`)
  // Always lead with the player count when someone is on.
  const name = live.players.length ? lines[presenceTick++ % lines.length]! : lines[0]!
  c.user.setPresence({
    activities: [{ name, type: ActivityType.Watching }],
    status: PresenceUpdateStatus.Online,
  })
}

let previous: { online: boolean; players: Set<string>; source: LiveStatus['source'] } | null = null

// Poll-based notices, used when the server log is not available.
async function announce(c: Client<true>, live: LiveStatus) {
  const current = new Set(live.players)
  const before = previous
  previous = { online: live.online, players: current, source: live.source }
  if (!before) return

  const embeds: EmbedBuilder[] = []
  if (live.online && !before.online) {
    embeds.push(new EmbedBuilder().setColor(BRAND.green).setDescription(`🟢 **${BRAND.name} is back online**`))
  } else if (!live.online && before.online) {
    embeds.push(new EmbedBuilder().setColor(BRAND.red).setDescription(`🔴 **${BRAND.name} went offline**`))
  }

  // Player diffs only make sense between two live readings from the same source;
  // mcsrvstat lags minutes behind RCON and would produce phantom joins.
  if (live.online && before.online && live.source === before.source) {
    const count = `${current.size}/${live.max} online`
    for (const name of current) {
      if (!before.players.has(name)) {
        embeds.push(new EmbedBuilder().setColor(BRAND.green).setAuthor({ name: `${name} joined`, iconURL: headUrl(name) }).setDescription(count))
      }
    }
    for (const name of before.players) {
      if (!current.has(name)) {
        embeds.push(new EmbedBuilder().setColor(BRAND.grey).setAuthor({ name: `${name} left`, iconURL: headUrl(name) }).setDescription(count))
      }
    }
  }
  if (embeds.length) await postEmbeds(c, 'activity_channel', embeds)
}

async function poll(c: Client<true>) {
  try {
    const live = await getLiveStatus(SERVER_HOST)
    setPresence(c, live)
    if (!logPath) await announce(c, live)
  } catch (e) {
    console.error('[poll]', e)
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return
  const command = commandsByName.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(interaction)
  } catch (e) {
    console.error(`[${interaction.commandName}]`, e)
    const content =
      e instanceof RconUnavailable
        ? 'RCON is not configured on the bot.'
        : `Something went wrong: ${(e as Error).message ?? 'unknown error'}`
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content, embeds: [], components: [] }).catch(() => {})
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {})
    }
  }
})

async function relayConsoleMessage(message: Message<true>) {
  const member = message.member ?? (await message.guild.members.fetch(message.author.id))
  if (!isAdmin(member)) {
    await message.react('🚫').catch(() => {})
    return
  }
  const command = normalizeCommand(message.content)
  if (!command) return

  if (isDangerous(command)) {
    const prompt = await message.reply({ content: `⚠️ About to run \`${command}\` on ${BRAND.name}.`, components: [confirmRow()] })
    if (!(await awaitConfirmation(prompt, message.author.id))) {
      await prompt.edit({ content: `Cancelled \`${command}\`.`, components: [] }).catch(() => {})
      return
    }
  }

  try {
    const output = await runConsole(command, message.author)
    await message.reply({ content: codeBlock(output), allowedMentions: { repliedUser: false } })
  } catch (e) {
    await message.reply({ content: `❌ ${(e as Error).message}`, allowedMentions: { repliedUser: false } })
  }
}

async function relayChatMessage(message: Message<true>) {
  const parts = [cleanChatText(message.cleanContent)]
  if (message.attachments.size) parts.push(`[${message.attachments.size} attachment${message.attachments.size > 1 ? 's' : ''}]`)
  const text = parts.filter(Boolean).join(' ').slice(0, 256)
  if (!text) return
  const name = message.member?.displayName ?? message.author.displayName
  try {
    await sendDiscordChat(name, text)
  } catch (e) {
    console.error('[chat relay]', (e as Error).message)
    await message.react('⚠️').catch(() => {})
  }
}

if (messageContent) {
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || message.webhookId || !message.inGuild()) return
    if (message.channelId === getSetting(message.guildId, 'console_channel')) {
      relayConsoleMessage(message).catch((e) => console.error('[console relay]', e))
    } else if (message.channelId === getSetting(message.guildId, 'chat_channel')) {
      relayChatMessage(message).catch((e) => console.error('[chat relay]', e))
    }
  })
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`)
  console.log(`RCON ${rconConfigured ? `via ${process.env.RCON_HOST}` : 'not configured, using mcsrvstat only'}`)
  await registerCommands(c).catch((e) => console.error('Command registration failed:', e))

  const live = await getLiveStatus(SERVER_HOST).catch(() => null)
  if (live) {
    setPresence(c, live)
    if (live.source === 'rcon') reconcileSessions(live.players)
  }
  setInterval(() => poll(c), POLL_MS)

  if (logPath) {
    console.log(`Following server log ${logPath}`)
    tailFile(logPath, (line) => {
      const event = parseLogLine(line)
      if (event) handleEvent(c, event).catch((e) => console.error('[log event]', e))
    })
  }
})

client.login(process.env.DISCORD_TOKEN)
