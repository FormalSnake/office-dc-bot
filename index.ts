// import discord.js
import { Client, Events, GatewayIntentBits, PresenceUpdateStatus } from "discord.js";
const { SlashCreator, GatewayServer } = require('slash-create');
import path from "node:path";

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
  // console.log(c)
  await creator.registerCommandsIn(path.join(__dirname, "commands"));
  creator.syncCommands();
}

// listen for the client to be ready
client.once(Events.ClientReady, c => {
  createCommands(c)
  c.user.setPresence({ activities: [{ name: 'activity' }], status: PresenceUpdateStatus.Idle })
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// login with the token from .env.local
client.login(process.env.DISCORD_TOKEN);
