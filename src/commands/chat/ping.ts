import type { ChatInputCommandInteraction } from "discord.js"
import { MessageFlags } from "discord.js"
import { SlashCommand } from "slashasaurus"

function run(interaction: ChatInputCommandInteraction) {
    interaction.reply({
        content: "Pong!",
        flags: MessageFlags.Ephemeral
    })
}

export default new SlashCommand(
    {
        name: "ping",
        description: "Pings the bot to make sure everything is working",
        options: []
    },
    {
        run: run
    }
)
