export function stripMcCodes(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '').replace(/\x1b\[[0-9;]*m/g, '')
}

// A Minecraft day is 24000 ticks and tick 0 is 06:00.
export function ticksToClock(ticks: number): string {
  const t = ((ticks % 24000) + 24000) % 24000
  const hours = (Math.floor(t / 1000) + 6) % 24
  const minutes = Math.floor(((t % 1000) / 1000) * 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function dayPhase(ticks: number): { emoji: string; label: string } {
  const t = ((ticks % 24000) + 24000) % 24000
  if (t < 12000) return { emoji: '☀️', label: 'Day' }
  if (t < 13000) return { emoji: '🌇', label: 'Sunset' }
  if (t < 23000) return { emoji: '🌙', label: 'Night' }
  return { emoji: '🌅', label: 'Sunrise' }
}

export function codeBlock(text: string, limit = 1900): string {
  const clean = text.replace(/```/g, "'''").trim()
  const body = clean.length > limit ? `${clean.slice(0, limit)}\n… (${clean.length - limit} more chars)` : clean
  return `\`\`\`\n${body || '(no output)'}\n\`\`\``
}

// Minecraft usernames: 3-16 chars, letters, digits and underscore.
export function isValidUsername(name: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(name)
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}
