# office-dc-bot

Discord bot for the Biggyatia Minecraft server. Shows live status in its presence, bridges in-game chat with player heads, posts joins, deaths and advancements, and gives admins a private console channel that talks to the server over RCON.

## Commands

| Command | Who | What |
| --- | --- | --- |
| `/status` | everyone | online state, players, in-game time, tick health, BlueMap button |
| `/players` | everyone | online players with their heads |
| `/player <name>` | everyone | skin render, online, whitelist status and stats |
| `/stats [player]` | everyone | playtime, deaths and advancements, or the leaderboard |
| `/join` | everyone | address, version, how to get whitelisted |
| `/map` | everyone | BlueMap link |
| `/say <message>` | player role (everyone when unset) | broadcast to in-game chat |
| `/whitelist list\|add\|remove` | admins | manage the whitelist over RCON |
| `/console <command>` | admins, console channel only | run any server command; stop/op/ban/kick/kill ask for confirmation |
| `/setup ...` | server administrators | console, activity and chat channels, admin/player roles |
| `/help` | everyone | command overview |

"Admins" are members with the Administrator permission plus whoever holds the role set with `/setup admin-role`.

## Channels

- **activity**: joins (with a first-time celebration) and leaves (with session length), server up and down.
- **chat**: in-game chat as plain text, deaths as red embeds, advancements as gold, aqua or purple embeds. Everything is posted through a webhook as the player, head included. With `MESSAGE_CONTENT=1`, messages typed in this channel go in-game as `[Discord] Name: text`.
- **console**: `/console` only works here. With `MESSAGE_CONTENT=1` plain messages from admins run as commands too.

Chat, deaths, advancements and joins come from the server log under `MC_DATA_PATH`. `/stats` reads the server's own per-player statistics and advancements from the same directory (all-time playtime, deaths, kills, diamonds, distance, blocks mined); the bot keeps its own playtime, death and advancement counters in SQLite as the fallback when the directory is not mounted. Without the log the bot falls back to diffing an RCON `list` every 30 seconds, which gives joins and leaves only.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in. Bun loads it on its own.
2. `bun install`, then `bun run index.ts`.
3. In Discord, as an administrator: `/setup console #private-channel`, `/setup activity #minecraft`, `/setup chat #minecraft`.

Settings live in `$DATA_DIR/bot.sqlite`. In the container that is `/app/data`, so mount a volume there.

`MESSAGE_CONTENT=1` needs the Message Content intent enabled for the application in the Discord developer portal; without it the bot refuses to log in.

Whitelist changes made through the bot persist: the itzg image only seeds `whitelist.json` from the `WHITELIST` env when the file does not exist yet.

## Deploy

The bot runs on superserver as the `bot` service in `/mnt/docker/minecraft/minecraft-26.2/docker-compose.yml`, next to the Minecraft container. It builds straight from this repository at a pinned commit, reads `bot.env` for secrets, reaches RCON over the compose network (`RCON_HOST=minecraft`) and has the server's data directory mounted read-only at `/mc` (`MC_DATA_PATH=/mc`).

To ship a new version: push, put the new commit hash in the `build.context` line, then

```bash
docker compose build bot && docker compose up -d bot
```

## Tests

```bash
bun test
```
