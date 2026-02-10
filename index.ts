// import discord.js
import { Client, Events, GatewayIntentBits } from "discord.js";

// create a new Client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getStatus() {
  const response = await fetch("https://api.mcsrvstat.us/3/office.kaiiserni.com")
  return response.text()
}

// listen for the client to be ready
client.once(Events.ClientReady, c => {
  console.log(getStatus())
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

// login with the token from .env.local
client.login(process.env.DISCORD_TOKEN);
