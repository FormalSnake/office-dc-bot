export type Align = 'left' | 'right'

// Renders rows as an aligned monospace table inside a code block. Keep it to
// plain ASCII and a few symbols: emoji have unpredictable widths in monospace.
export function table(headers: string[], rows: string[][], align: Align[] = []): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (cells: string[]) =>
    cells
      .map((cell, i) => {
        const width = widths[i] ?? 0
        return align[i] === 'right' ? cell.padStart(width) : cell.padEnd(width)
      })
      .join('  ')
      .trimEnd()
  const body = [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n')
  return `\`\`\`\n${body}\n\`\`\``
}
