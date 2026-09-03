# office-dc-bot

Discord bot for the Biggyatia Minecraft server. Shows live status in its presence, posts join/leave notices, and gives admins a private console channel that talks to the server over RCON.

## Commands

| Command | Who | What |
| --- | --- | --- |
| `/status` | everyone | online state, players, in-game time, tick health, BlueMap button |
| `/players` | everyone | online players with their heads |
| `/player <name>` | everyone | skin render, online and whitelist status |
| `/join` | everyone | address, version, how to get whitelisted |
| `/map` | everyone | BlueMap link |
| `/say <message>` | player role (everyone when unset) | broadcast to in-game chat |
| `/whitelist list\|add\|remove` | admins | manage the whitelist over RCON |
| `/console <command>` | admins, console channel only | run any server command; stop/op/ban/kick/kill ask for confirmation |
| `/setup ...` | server administrators | pick the console and activity channels and the admin/player roles |
| `/help` | everyone | command overview |

"Admins" are members with the Administrator permission plus whoever holds the role set with `/setup admin-role`.

## Setup

1. Copy `.env.example` to `.env.local` and fill it in. Bun loads it on its own.
2. `bun install`, then `bun run index.ts`.
3. In Discord, as an administrator: `/setup console #private-channel`, `/setup activity #minecraft`.

Settings live in `$DATA_DIR/bot.sqlite`. In the container that is `/app/data`, so mount a volume there.

### RCON

The server exposes RCON only inside its Docker network. On superserver the compose stack has an `rcon-proxy` (socat) service that forwards `192.168.86.2:25575` to the Minecraft container, so the bot on the LAN can reach it. Anything RCON-backed degrades to the cached mcsrvstat.us status when the host is unreachable.

Whitelist changes made through the bot persist: the itzg image only seeds `whitelist.json` from the `WHITELIST` env when the file does not exist yet.

### Console relay

With `CONSOLE_RELAY=1` every plain message an admin posts in the console channel runs as a server command and the output comes back as a reply. That needs the Message Content intent enabled for the application in the Discord developer portal; without it the bot refuses to log in.

## Deploy

The macbook runs the bot from a launchd agent defined in `~/.config/nix/modules/darwin/mixins/office-dc-bot.nix`. It builds the image from a pinned git revision and passes the agenix secret `office-dc-bot` as the env file, so a deploy is: push, bump `rev` and `hash` there, `just rebuild`.

## Tests

```bash
bun test
```
