import { SlashCommand, CommandOptionType, SlashCreator } from "slash-create";

async function getStatus(server: string) {
  const response = await fetch(`https://api.mcsrvstat.us/3/${server}`)
  const status: any = await response.json()
  console.log(status.motd.clean)
  return status
}

export default class StatusCommand extends SlashCommand {
  constructor(creator: SlashCreator) {
    super(creator, {
      name: "status",
      description: "Returns the status of the Minecraft server",
      // options: [
      // 	{
      // 		type: CommandOptionType.STRING,
      // 		name: "question",
      // 		description: "The question you want to ask the magic 8ball",
      // 		required: true,
      // 	},
      // ],
    });

    // @ts-ignore
    this.filePath = __filename;
  }

  async run() {
    return getStatus("office.kaiiserni.com");
  }
}
