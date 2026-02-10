import { SlashCommand, CommandOptionType, SlashCreator } from "slash-create";
import { getStatus } from '../../utils/mc-server'

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
