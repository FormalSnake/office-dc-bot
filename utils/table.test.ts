import { expect, test } from 'bun:test'
import { table } from './table'

test('table aligns columns and wraps in a code block', () => {
  const out = table(['#', 'Player', 'Playtime'], [['1', 'CroXTommyXwn', '2d 13h'], ['2', 'Bob', '15m']], ['right', 'left', 'right'])
  expect(out).toBe(
    ['```', '#  Player        Playtime', '-  ------------  --------', '1  CroXTommyXwn    2d 13h', '2  Bob                15m', '```'].join('\n'),
  )
})
