import { expect, test } from 'bun:test'
import {
  closeAllSessions,
  currentSessionMs,
  getPlayer,
  reconcileSessions,
  recordAdvancement,
  recordDeath,
  recordJoin,
  recordLeave,
  topPlayers,
} from './db'

const T0 = 1_700_000_000_000

test('join, leave and playtime', () => {
  expect(recordJoin('Alice', T0)).toBe(true)
  expect(recordJoin('Alice', T0)).toBe(false)
  expect(currentSessionMs('Alice', T0 + 60_000)).toBe(60_000)
  expect(recordLeave('Alice', T0 + 90_000)).toBe(90_000)
  expect(recordLeave('Alice', T0 + 95_000)).toBeNull()
  expect(getPlayer('alice')?.playtimeMs).toBe(90_000)
})

test('deaths and advancements count up', () => {
  expect(recordDeath('Bob', T0)).toBe(1)
  expect(recordDeath('Bob', T0)).toBe(2)
  expect(recordAdvancement('Bob', T0)).toBe(1)
  expect(getPlayer('Bob')).toMatchObject({ deaths: 2, advancements: 1 })
})

test('reconcile drops stale sessions and opens missing ones', () => {
  recordJoin('Carol', T0)
  reconcileSessions(['Dave'], T0 + 10_000)
  expect(currentSessionMs('Carol', T0 + 20_000)).toBeNull()
  expect(currentSessionMs('Dave', T0 + 20_000)).toBe(10_000)
  closeAllSessions(T0 + 30_000)
  expect(getPlayer('Dave')?.playtimeMs).toBe(20_000)
})

test('leaderboard orders by playtime', () => {
  const names = topPlayers(10).map((p) => p.name)
  expect(names[0]).toBe('Alice')
  expect(names).toContain('Dave')
})
