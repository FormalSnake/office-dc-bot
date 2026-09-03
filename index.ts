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
import { isAdmin } from './utils/access'
import { awaitConfirmation, confirmRow } from './utils/confirm'
import { getSetting, getSettingForAllGuilds } from './utils/db'
import { getLiveStatus, type LiveStatus } from './utils/mc-server'
import { codeBlock } from './utils/mc-text'
import { RconUnavailable, rconConfigured } from './utils/rcon'
import { BRAND, SERVER_HOST, headUrl } from './utils/theme'

// Raw message relay in the console channel needs the Message Content intent,
// which has to be switched on in the Discord developer portal first.
const consoleRelay = process.env.CONSOLE_RELAY === '1'
const POLL_MS = 30_000

const intents = [GatewayIntentBits.Guilds]
if (consoleRelay) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent)

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

function setPresence(c: Client<true>, live: LiveStatus) {
  if (!live.online) {
    c.user.setPresence({
      activities: [{ name: `${BRAND.name} · offline`, type: ActivityType.Watching }],
      status: PresenceUpdateStatus.DoNotDisturb,
    })
    return
  }
  c.user.setPresence({
    activities: [{ name: `${live.players.length}/${live.max} on ${BRAND.name}`, type: ActivityType.Watching }],
    status: PresenceUpdateStatus.Online,
  })
}

let previous: { online: boolean; players: Set<string>; source: LiveStatus['source'] } | null = null

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
  if (!embeds.length) return

  for (const { guildId, value: channelId } of getSettingForAllGuilds('activity_channel')) {
    try {
      const channel = await c.channels.fetch(channelId)
      if (!channel?.isSendable()) continue
      await channel.send({ embeds: embeds.slice(0, 10) })
    } catch (e) {
      console.error(`[activity] failed to post in ${channelId} (guild ${guildId}):`, (e as Error).message)
    }
  }
}

async function poll(c: Client<true>) {
  try {
    const live = await getLiveStatus(SERVER_HOST)
    setPresence(c, live)
    await announce(c, live)
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
  const consoleChannel = getSetting(message.guildId, 'console_channel')
  if (!consoleChannel || message.channelId !== consoleChannel) return

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

if (consoleRelay) {
  client.on(Events.MessageCreate, (message) => {
    if (message.author.bot || !message.inGuild()) return
    relayConsoleMessage(message).catch((e) => console.error('[console relay]', e))
  })
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`)
  console.log(`RCON ${rconConfigured ? `via ${process.env.RCON_HOST}` : 'not configured, using mcsrvstat only'}`)
  await registerCommands(c).catch((e) => console.error('Command registration failed:', e))
  await poll(c)
  setInterval(() => poll(c), POLL_MS)
})

client.login(process.env.DISCORD_TOKEN)
