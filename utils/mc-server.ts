export async function getStatus(server: string) {
  const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
  var statusString: string
  try {
    const status: any = await response.json()
    if (status.online) {
      statusString = `Players online: ${status.players.online}`
    } else {
      statusString = "Server offline"
    }
  } catch (e) {
    console.log(e)
    statusString = "Could not fetch data"
  }
  return statusString
}

