// import discord.js
import { Client, Events, GatewayIntentBits } from "discord.js";

type ResponseType = {
  ip: string,
  port: string,
  debug: any,
  motd: any
  players: any,
  version: string,
  online: boolean,
  protocol: any,
  hostname: string,
  eula_blocked: boolean
}

// create a new Client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getStatus(server: string) {
  const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
  console.log(response.json())
  return response
}

// listen for the client to be ready
client.once(Events.ClientReady, c => {
  getStatus("office.kaiiserni.com")
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// login with the token from .env.local
client.login(process.env.DISCORD_TOKEN);
