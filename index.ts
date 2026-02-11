import {
  Client,
  Events,
  GatewayIntentBits,
  PresenceUpdateStatus,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActivityType,
} from 'discord.js'
import { getServerData, getStatus } from './utils/mc-server'

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

const server = process.env.MINECRAFT_SERVER!

async function registerCommands(c: Client<true>) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
  const statusCommand = new SlashCommandBuilder()
    .setName('status')
    .setDescription('Returns the status of the Minecraft server')

  await rest.put(Routes.applicationCommands(c.application.id), {
    body: [statusCommand.toJSON()],
  })
  console.log('Commands registered')
}

async function setStatus(c: Client<true>) {
  const data = await getServerData(server)
  let activity: string
  if (data) {
    activity = `${data.players.online}/${data.players.max} players`
    if (data.version) activity += ` | ${data.version}`
  } else {
    activity = 'Server offline'
  }
  console.log(activity)
  c.user.setPresence({
    activities: [{ name: activity, type: ActivityType.Watching }],
    status: PresenceUpdateStatus.Online,
  })
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  if (interaction.commandName !== 'status') return

  await interaction.deferReply()

  const data = await getServerData(server)

  if (data) {
    const embed = new EmbedBuilder()
      .setColor(0x00c853)
      .setTitle(data.hostname ?? server)
      .setThumbnail(`https://api.mcsrvstat.us/icon/${server}`)
      .addFields(
        { name: 'Status', value: ':green_circle: Online', inline: true },
        { name: 'Players', value: `${data.players.online}/${data.players.max}`, inline: true },
      )
      .setFooter({ text: `IP: ${data.ip}:${data.port}` })
      .setTimestamp()

    if (data.motd) embed.setDescription(data.motd)
    if (data.version) embed.addFields({ name: 'Version', value: data.version, inline: true })

    if (data.players.list.length > 0) {
      embed.addFields({
        name: 'Player List',
        value: data.players.list.map((p) => p.name).join(', '),
      })
    }

    if (data.software) embed.addFields({ name: 'Software', value: data.software })

    if (data.plugins?.length) {
      embed.addFields({
        name: 'Plugins',
        value: data.plugins.map((p) => `${p.name} v${p.version}`).join(', '),
      })
    }

    if (data.mods?.length) {
      embed.addFields({
        name: 'Mods',
        value: data.mods.map((m) => `${m.name} v${m.version}`).join(', '),
      })
    }

    await interaction.editReply({ embeds: [embed] })
  } else {
    const embed = new EmbedBuilder()
      .setColor(0xff1744)
      .setTitle('Minecraft Server')
      .setDescription('The server is currently offline.')
      .setFooter({ text: server })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  }
})

client.once(Events.ClientReady, (c) => {
  registerCommands(c)
  setStatus(c)
  setInterval(() => setStatus(c), 30000)
  console.log(`Ready! Logged in as ${c.user.tag}`)
})

client.login(process.env.DISCORD_TOKEN)
