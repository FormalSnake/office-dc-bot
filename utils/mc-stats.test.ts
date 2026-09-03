import { expect, test } from 'bun:test'
import { countAdvancements, parseStats } from './mc-stats'

test('parseStats reads the custom and mined groups', () => {
  const stats = parseStats({
    stats: {
      'minecraft:custom': {
        'minecraft:play_time': 72_000,
        'minecraft:deaths': 3,
        'minecraft:mob_kills': 10,
        'minecraft:player_kills': 1,
        'minecraft:walk_one_cm': 150_000,
        'minecraft:sprint_one_cm': 50_000,
        'minecraft:jump': 99,
      },
      'minecraft:mined': { 'minecraft:stone': 100, 'minecraft:diamond_ore': 2, 'minecraft:deepslate_diamond_ore': 5 },
    },
  })
  expect(stats).toEqual({ playtimeMs: 3_600_000, deaths: 3, mobKills: 10, playerKills: 1, distanceKm: 2, blocksMined: 107, diamonds: 7 })
})

test('parseStats tolerates empty files', () => {
  expect(parseStats({}).playtimeMs).toBe(0)
  expect(parseStats(null).blocksMined).toBe(0)
})

test('countAdvancements skips recipes and unfinished ones', () => {
  expect(
    countAdvancements({
      DataVersion: 4903,
      'minecraft:story/root': { done: true },
      'minecraft:story/mine_stone': { done: false },
      'minecraft:recipes/misc/stick': { done: true },
      'tpa:first_join': { done: true },
    }),
  ).toBe(2)
  expect(countAdvancements(null)).toBe(0)
})
