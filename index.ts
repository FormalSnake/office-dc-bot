// import discord.js
import { Client, Events, GatewayIntentBits, PresenceUpdateStatus } from "discord.js";
const { SlashCreator, GatewayServer } = require('slash-create');
import path from "node:path";
import { getStatus } from './utils/mc-server'

// create a new Client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const creator = new SlashCreator({
  applicationID: '1470828681088864419',
  publicKey: '7039b81d45417564cff04ec3e032cc2bce20d99fe9b9d36425c907ecdba67229',
  token: process.env.DISCORD_TOKEN,
  client
});

creator
  .withServer(
    new GatewayServer(
      (handler: any) => client.ws.on('INTERACTION_CREATE', handler)
    )
  );

async function createCommands(c: Client) {
  console.log("registering commands")
  console.log(path.join(__dirname, "commands"))
  await creator.registerCommandsIn(path.join(__dirname, "commands"));
  creator.syncCommands();
}

async function setStatus(c: Client) {
  if (c == null) return
  const status = await getStatus("office.kaiiserni.com")
  console.log(status)
  c.user.setPresence({ activities: [{ name: status[0] }], status: PresenceUpdateStatus.Idle })
}

// listen for the client to be ready
client.once(Events.ClientReady, c => {
  createCommands(c)
  setStatus(c)
  // console.log(getStatus("office.kaiiserni.com"))
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// login with the token from .env.local
client.login(process.env.DISCORD_TOKEN);
