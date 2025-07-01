import { ApplicationCommandOptionType, type ChatInputCommandInteraction, ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { and, eq } from "drizzle-orm"
import { SlashCommand } from "slashasaurus"
import { autoIssueConfigs } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"

async function run(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole("role", true)

    try {
        // Check if this auto-issue config already exists
        const existingConfig = await db
            .select()
            .from(autoIssueConfigs)
            .where(and(eq(autoIssueConfigs.serverId, interaction.guild!.id), eq(autoIssueConfigs.roleId, role.id)))
            .limit(1)

        if (existingConfig.length > 0) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `Auto-issuing passports for the **${role.name}** role is already configured.`
                    }
                ]
            })
        }

        // Add the auto-issue config
        await db.insert(autoIssueConfigs).values({
            serverId: interaction.guild!.id,
            roleId: role.id,
            createdBy: interaction.user.id
        })

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `✅ Passports will now be automatically issued to users with the **${role.name}** role. Users will receive a passport when they get this role and lose it when the role is removed.`
                }
            ]
        })
    } catch (error) {
        logger.error("Error setting up auto-issue:", { error, serverId: interaction.guild?.id, roleId: role.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while setting up auto-issue."
                }
            ]
        })
    }
}

export default new SlashCommand(
    {
        name: "autoissue",
        description: "Automatically issue passports to users with a specific role",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: [
            {
                name: "role",
                description: "The role that will automatically issue passports",
                type: ApplicationCommandOptionType.Role,
                required: true
            }
        ]
    },
    {
        run: run
    }
)
