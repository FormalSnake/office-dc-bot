export async function getStatus(server: string) {
  const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
  const status: any = await response.json()
  // console.log(status.motd.clean)
  return status.motd.clean
}

