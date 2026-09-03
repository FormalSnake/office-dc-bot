import { expect, test } from 'bun:test'
import { parseLogLine } from './mc-events'

const info = (body: string) => `[18:14:43] [Server thread/INFO]: ${body}`

test('chat, signed and unsigned', () => {
  expect(parseLogLine(info('<GHOST__58> I need 2 non farmland crops'))).toEqual({ type: 'chat', player: 'GHOST__58', text: 'I need 2 non farmland crops' })
  expect(parseLogLine(info('[Not Secure] <FormalSnake> esto: /trigger TPA'))).toEqual({ type: 'chat', player: 'FormalSnake', text: 'esto: /trigger TPA' })
})

test('join and leave', () => {
  expect(parseLogLine(info('FormalSnake joined the game'))).toEqual({ type: 'join', player: 'FormalSnake' })
  expect(parseLogLine(info('FormalSnake left the game'))).toEqual({ type: 'leave', player: 'FormalSnake' })
})

test('advancements', () => {
  expect(parseLogLine(info('CroXTommyXwn has made the advancement [The City at the End of the Game]'))).toEqual({
    type: 'advancement',
    player: 'CroXTommyXwn',
    kind: 'advancement',
    title: 'The City at the End of the Game',
  })
  expect(parseLogLine(info("FormalSnake has reached the goal [Sky's the Limit]"))?.type).toBe('advancement')
})

test('deaths', () => {
  expect(parseLogLine(info('GHOST__58 was slain by Zombie'))).toEqual({ type: 'death', player: 'GHOST__58', text: 'was slain by Zombie' })
  expect(parseLogLine(info('GHOST__58 drowned'))).toEqual({ type: 'death', player: 'GHOST__58', text: 'drowned' })
  expect(parseLogLine(info('FormalSnake was doomed to fall by CroXTommyXwn'))?.type).toBe('death')
})

test('server lifecycle', () => {
  expect(parseLogLine(info('Done (12.345s)! For help, type "help"'))).toEqual({ type: 'started' })
  expect(parseLogLine(info('Stopping server'))).toEqual({ type: 'stopping' })
})

test('noise is ignored', () => {
  expect(parseLogLine(info('FormalSnake lost connection: Disconnected'))).toBeNull()
  expect(parseLogLine(info('FormalSnake[/1.2.3.4:5555] logged in with entity id 1 at (1.0, 2.0, 3.0)'))).toBeNull()
  expect(parseLogLine(info('FormalSnake issued server command: /tpa Bob'))).toBeNull()
  expect(parseLogLine(info('player FormalSnake ready for LOD streaming, protocol 1'))).toBeNull()
  expect(parseLogLine(info('Saving chunks for level'))).toBeNull()
  expect(parseLogLine('[18:14:43] [Render thread/INFO]: <Bob> hi')).toBeNull()
})

test('admin feedback lines', () => {
  expect(parseLogLine(info('[FormalSnake: Set own game mode to Creative Mode]'))).toEqual({ type: 'admin', source: 'FormalSnake', message: 'Set own game mode to Creative Mode' })
  expect(parseLogLine(info('[Rcon: Made FormalSnake a server operator]'))).toEqual({ type: 'admin', source: 'Rcon', message: 'Made FormalSnake a server operator' })
  expect(parseLogLine(info('[Not Secure] <FormalSnake> [hi]'))?.type).toBe('chat')
})
