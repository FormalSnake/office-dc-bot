import { expect, test } from 'bun:test'
import { parseList, parseTickQuery, parseTicks, parseWhitelist } from './mc-server'

test('parseList with players', () => {
  expect(parseList('There are 2 of a max of 20 players online: FormalSnake, kaiiserni')).toEqual({
    online: 2,
    max: 20,
    players: ['FormalSnake', 'kaiiserni'],
  })
})

test('parseList empty server', () => {
  expect(parseList('There are 0 of a max of 20 players online: ')).toEqual({ online: 0, max: 20, players: [] })
})

test('parseList garbage', () => {
  expect(parseList('Unknown command')).toBeNull()
})

test('parseTickQuery', () => {
  const output =
    'The game is running normallyTarget tick rate: 20.0 per second.\nAverage time per tick: 4.8ms (Target: 50.0ms)Percentiles: P50: 4.4ms P95: 7.7ms P99: 10.6ms. Sample: 100'
  expect(parseTickQuery(output)).toEqual({ tickRate: 20, mspt: 4.8 })
})

test('parseTicks handles both time query formats', () => {
  expect(parseTicks('Timeline minecraft:day is at 11605 tick(s)')).toBe(11605)
  expect(parseTicks('The game time is 7431904 tick(s)')).toBe(7431904)
  expect(parseTicks('nope')).toBeUndefined()
})

test('parseWhitelist', () => {
  expect(parseWhitelist('There are 3 whitelisted player(s): KwintenGamer, FormalSnake, GHOST__58')).toEqual([
    'KwintenGamer',
    'FormalSnake',
    'GHOST__58',
  ])
  expect(parseWhitelist('There are no whitelisted players')).toEqual([])
})
