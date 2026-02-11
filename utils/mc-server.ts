export interface McServerData {
  online: boolean
  ip: string
  port: number
  hostname?: string
  version?: string
  software?: string
  motd?: string
  players: { online: number; max: number; list: { name: string; uuid: string }[] }
  plugins?: { name: string; version: string }[]
  mods?: { name: string; version: string }[]
}

export async function getServerData(server: string): Promise<McServerData | null> {
  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
    const data: any = await response.json()

    if (!data.online) return null

    return {
      online: true,
      ip: data.ip,
      port: data.port,
      hostname: data.hostname,
      version: data.version,
      software: data.software,
      motd: data.motd?.clean?.join('\n'),
      players: {
        online: data.players?.online ?? 0,
        max: data.players?.max ?? 0,
        list: data.players?.list ?? [],
      },
      plugins: data.plugins,
      mods: data.mods,
    }
  } catch (e) {
    console.error('Failed to fetch server data:', e)
    return null
  }
}

export async function getStatus(server: string): Promise<string> {
  const data = await getServerData(server)
  if (!data) return 'Server offline'
  return `${data.players.online}/${data.players.max} players`
}
