import type { ChatInputCommandInteraction } from "discord.js"
import { ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { SlashCommand } from "slashasaurus"
import { logger } from "@/util/logger"
import { getServerPassportHolders } from "@/util/passport"

async function run(interaction: ChatInputCommandInteraction) {
    try {
        const passportHolders = await getServerPassportHolders(interaction.guild!.id)

        if (passportHolders.length === 0) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: "No users have passports from this server yet."
                    }
                ]
            })
        }

        // Create a list of passport holders with user information
        const holderList = passportHolders
            .map((holder) => {
                const issuedDate = new Date(holder.issuedAt).toLocaleDateString()
                return `• <@${holder.userId}> - Issued on ${issuedDate} by <@${holder.issuedBy}>`
            })
            .join("\n")

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `# Passport Holders for ${interaction.guild!.name}`
                },
                {
                    type: ComponentType.TextDisplay,
                    content: holderList
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `*${passportHolders.length} passport holder${passportHolders.length === 1 ? "" : "s"}*`
                }
            ]
        })
    } catch (error) {
        logger.error("Error fetching passport holders:", { error, serverId: interaction.guild?.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while fetching passport holders."
                }
            ]
        })
    }
}

export default new SlashCommand(
    {
        name: "holders",
        description: "View all users who have passports from this server (server owners only)",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: []
    },
    {
        run: run
    }
)
