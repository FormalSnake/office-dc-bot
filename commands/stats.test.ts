import { expect, test } from 'bun:test'
import { leaderboard } from './stats'

function countComponents(node: any): number {
  const children: any[] = node.components ?? []
  const accessory = node.accessory ? 1 : 0
  return 1 + accessory + children.reduce((sum, c) => sum + countComponents(c), 0)
}

test('leaderboard stays under the 40 component limit with ten rows', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    name: `Player${i}`,
    head: `<:mc_Player${i}:${1000 + i}>`,
    online: i % 2 === 0,
    stats: [
      { emoji: '⏱️', value: '1h', primary: true },
      { emoji: '💀', value: '2' },
      { emoji: '🏆', value: '3' },
    ],
  }))
  const message = leaderboard('Sorted by playtime', rows)
  const json = message.components[0]!.toJSON()
  expect(countComponents(json)).toBeLessThanOrEqual(40)
  expect(JSON.stringify(json)).toContain('Player9')
})
