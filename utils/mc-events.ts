export type McEvent =
  | { type: 'chat'; player: string; text: string }
  | { type: 'join'; player: string }
  | { type: 'leave'; player: string }
  | { type: 'death'; player: string; text: string }
  | { type: 'advancement'; player: string; kind: 'advancement' | 'goal' | 'challenge'; title: string }
  | { type: 'admin'; source: string; message: string }
  | { type: 'started' }
  | { type: 'stopping' }

const SERVER_INFO = /^\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: (.*)$/
const NAME = '[A-Za-z0-9_]{3,16}'

// Lines that start with a player name but are not deaths.
const NOT_A_DEATH = new RegExp(
  `^${NAME} (lost connection|logged in with|issued server command|moved too quickly|moved wrongly|has just earned|\\[\\/)`,
)

const ADVANCEMENT_KIND: Record<string, 'advancement' | 'goal' | 'challenge'> = {
  'made the advancement': 'advancement',
  'reached the goal': 'goal',
  'completed the challenge': 'challenge',
}

export function parseLogLine(line: string): McEvent | null {
  const body = line.match(SERVER_INFO)?.[1]
  if (!body) return null

  const chat = body.match(new RegExp(`^(?:\\[Not Secure\\] )?<(${NAME})> (.*)$`))
  if (chat) return { type: 'chat', player: chat[1]!, text: chat[2]! }

  const join = body.match(new RegExp(`^(${NAME}) joined the game$`))
  if (join) return { type: 'join', player: join[1]! }

  const leave = body.match(new RegExp(`^(${NAME}) left the game$`))
  if (leave) return { type: 'leave', player: leave[1]! }

  const adv = body.match(new RegExp(`^(${NAME}) has (made the advancement|reached the goal|completed the challenge) \\[(.+)\\]$`))
  if (adv) return { type: 'advancement', player: adv[1]!, kind: ADVANCEMENT_KIND[adv[2]!]!, title: adv[3]! }

  // Op-level command feedback is broadcast to admins and logged as "[Source: message]".
  const admin = body.match(new RegExp(`^\\[(Rcon|Server|${NAME}): (.+)\\]$`))
  if (admin) return { type: 'admin', source: admin[1]!, message: admin[2]! }

  if (/^Done \([\d.]+s\)! For help, type "help"/.test(body)) return { type: 'started' }
  if (/^Stopping (the )?server/.test(body)) return { type: 'stopping' }

  // Anything else that starts with a player name is a death message
  // ("X was slain by Zombie", "X fell from a high place", ...).
  const death = body.match(new RegExp(`^(${NAME}) (was|fell|drowned|died|blew up|hit the ground|burned|tried|starved|suffocated|withered|froze|went|walked|discovered|experienced|got|left the confines|didn't|succumbed|was killed)\\b.*`))
  if (death && !NOT_A_DEATH.test(body)) return { type: 'death', player: death[1]!, text: body.slice(death[1]!.length + 1) }

  return null
}
