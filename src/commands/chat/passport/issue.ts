import type { ChatInputCommandInteraction } from "discord.js"
import { ApplicationCommandOptionType, ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { SlashCommand } from "slashasaurus"
import { logger } from "@/util/logger"
import { issuePassport } from "@/util/passport"

async function run(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user", true)

    // Prevent issuing passport to self
    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "You cannot issue a passport to yourself."
                }
            ]
        })
    }

    try {
        const issued = await issuePassport(targetUser.id, interaction.guild!.id, interaction.user.id)

        if (!issued) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `**${targetUser.tag}** already has a passport from this server.`
                    }
                ]
            })
        }

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `✅ Successfully issued a passport to **${targetUser.tag}** from **${interaction.guild!.name}**.`
                }
            ]
        })
    } catch (error) {
        logger.error("Error issuing passport:", { error, serverId: interaction.guild?.id, targetUserId: targetUser.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while issuing the passport."
                }
            ]
        })
    }
}

export default new SlashCommand(
    {
        name: "issue",
        description: "Issue a passport to a specific user (server owners only)",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: [
            {
                name: "user",
                description: "The user to issue a passport to",
                type: ApplicationCommandOptionType.User,
                required: true
            }
        ]
    },
    {
        run: run
    }
)
