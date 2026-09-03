import { expect, test } from 'bun:test'
import { isDangerous, normalizeCommand } from './console'

test('normalizeCommand strips the slash and squashes whitespace', () => {
  expect(normalizeCommand('  /whitelist   add   Bob ')).toBe('whitelist add Bob')
  expect(normalizeCommand('/')).toBe('')
})

test('isDangerous', () => {
  expect(isDangerous('stop')).toBe(true)
  expect(isDangerous('OP FormalSnake')).toBe(true)
  expect(isDangerous('whitelist off')).toBe(true)
  expect(isDangerous('whitelist add Bob')).toBe(false)
  expect(isDangerous('list')).toBe(false)
  expect(isDangerous('time set day')).toBe(false)
})
