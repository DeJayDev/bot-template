import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js"
import { ApplicationCommandOptionType, ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { and, eq } from "drizzle-orm"
import { SlashCommand } from "slashasaurus"
import { serverPermissions } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"

async function run(interaction: ChatInputCommandInteraction) {
    const issuer = interaction.options.getString("issuer", true)
    const role = interaction.options.getRole("role")

    try {
        // Check if this permission already exists
        const existingPermission = await db
            .select()
            .from(serverPermissions)
            .where(and(eq(serverPermissions.serverId, interaction.guild!.id), eq(serverPermissions.issuerId, issuer)))
            .limit(1)

        if (existingPermission.length > 0) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `Passports from **${issuer}** are already accepted in this server.`
                    }
                ]
            })
        }

        // Add the permission
        await db.insert(serverPermissions).values({
            serverId: interaction.guild!.id,
            issuerId: issuer,
            roleId: role?.id || null,
            addedBy: interaction.user.id
        })

        const roleText = role ? ` and will be given the **${role.name}** role` : ""

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `✅ Users with passports from **${issuer}** can now join this server${roleText}.`
                }
            ]
        })
    } catch (error) {
        logger.error("Error adding passport permission:", { error, serverId: interaction.guild?.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while adding the passport permission."
                }
            ]
        })
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused()

    if (!interaction.guild) {
        return interaction.respond([])
    }

    // Get mutual servers with the bot
    const mutualGuilds = interaction.client.guilds.cache
        .filter((guild) => guild.id !== interaction.guild!.id) // Exclude current server
        .filter((guild) => {
            if (!focusedValue) return true
            return guild.name.toLowerCase().includes(focusedValue.toLowerCase()) || guild.id.includes(focusedValue)
        })
        .first(25) // Discord limits to 25 choices

    const choices = mutualGuilds.map((guild) => ({
        name: guild.name,
        value: guild.id
    }))

    await interaction.respond(choices)
}

export default new SlashCommand(
    {
        name: "add",
        description: "Allow users with passports from a specific server to join this server",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: [
            {
                name: "issuer",
                description: "The server that issues the passports (use autofill to search)",
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            },
            {
                name: "role",
                description: "Role to assign when users join (optional)",
                type: ApplicationCommandOptionType.Role,
                required: false
            }
        ]
    },
    {
        run: run,
        autocomplete: autocomplete
    }
)
