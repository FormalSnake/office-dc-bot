import { expect, test } from 'bun:test'
import { codeBlock, dayPhase, isValidUsername, stripMcCodes, ticksToClock } from './mc-text'

test('stripMcCodes', () => {
  expect(stripMcCodes('§6§l✦ B I G G Y A T I A ✦§r')).toBe('✦ B I G G Y A T I A ✦')
  expect(stripMcCodes('\x1b[0mAverage')).toBe('Average')
})

test('ticksToClock', () => {
  expect(ticksToClock(0)).toBe('06:00')
  expect(ticksToClock(6000)).toBe('12:00')
  expect(ticksToClock(18000)).toBe('00:00')
  expect(ticksToClock(11605)).toBe('17:36')
  expect(ticksToClock(24000 + 500)).toBe('06:30')
})

test('dayPhase', () => {
  expect(dayPhase(1000).label).toBe('Day')
  expect(dayPhase(12500).label).toBe('Sunset')
  expect(dayPhase(18000).label).toBe('Night')
  expect(dayPhase(23500).label).toBe('Sunrise')
})

test('codeBlock truncates and escapes fences', () => {
  expect(codeBlock('')).toBe('```\n(no output)\n```')
  expect(codeBlock('a```b')).toBe("```\na'''b\n```")
  const long = codeBlock('x'.repeat(2000), 100)
  expect(long).toContain('… (1900 more chars)')
})

test('isValidUsername', () => {
  expect(isValidUsername('FormalSnake')).toBe(true)
  expect(isValidUsername('GHOST__58')).toBe(true)
  expect(isValidUsername('ab')).toBe(false)
  expect(isValidUsername('bad name')).toBe(false)
})
