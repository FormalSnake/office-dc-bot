import { statSync } from 'node:fs'

// Follows a log file the way `tail -F` does: only new bytes are read, and a
// shrinking file (rotation at server restart) restarts from the top.
export function tailFile(path: string, onLine: (line: string) => void, intervalMs = 500): () => void {
  let offset = size(path) ?? 0
  let partial = ''
  let reading = false

  async function poll() {
    if (reading) return
    reading = true
    try {
      const current = size(path)
      if (current === null) return
      if (current < offset) {
        offset = 0
        partial = ''
      }
      if (current === offset) return
      const chunk = await Bun.file(path).slice(offset, current).text()
      offset = current
      const lines = (partial + chunk).split('\n')
      partial = lines.pop() ?? ''
      for (const line of lines) if (line) onLine(line)
    } catch (e) {
      console.error('[log-tail]', (e as Error).message)
    } finally {
      reading = false
    }
  }

  const timer = setInterval(poll, intervalMs)
  return () => clearInterval(timer)
}

function size(path: string): number | null {
  try {
    return statSync(path).size
  } catch {
    return null
  }
}
