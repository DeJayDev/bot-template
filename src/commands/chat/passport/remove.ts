import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js"
import { ApplicationCommandOptionType, ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { and, eq } from "drizzle-orm"
import { SlashCommand } from "slashasaurus"
import { serverPermissions } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"

async function run(interaction: ChatInputCommandInteraction) {
    const issuer = interaction.options.getString("issuer", true)

    try {
        // Check if this permission exists
        const existingPermission = await db
            .select()
            .from(serverPermissions)
            .where(and(eq(serverPermissions.serverId, interaction.guild!.id), eq(serverPermissions.issuerId, issuer)))
            .limit(1)

        if (existingPermission.length === 0) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `Passports from **${issuer}** are not currently accepted in this server.`
                    }
                ]
            })
        }

        // Remove the permission
        await db.delete(serverPermissions).where(and(eq(serverPermissions.serverId, interaction.guild!.id), eq(serverPermissions.issuerId, issuer)))

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `✅ Users with passports from **${issuer}** can no longer join this server.`
                }
            ]
        })
    } catch (error) {
        logger.error("Error removing passport permission:", { error, serverId: interaction.guild?.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while removing the passport permission."
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

    // Get currently accepted issuers for this server
    const acceptedIssuers = await db.select({ issuerId: serverPermissions.issuerId }).from(serverPermissions).where(eq(serverPermissions.serverId, interaction.guild.id))

    const issuerIds = acceptedIssuers.map((p) => p.issuerId)

    // Get guild information for the accepted issuers
    const mutualGuilds = interaction.client.guilds.cache
        .filter((guild) => issuerIds.includes(guild.id))
        .filter((guild) => {
            if (!focusedValue) return true
            return guild.name.toLowerCase().includes(focusedValue.toLowerCase()) || guild.id.includes(focusedValue)
        })
        .first(25)

    const choices = mutualGuilds.map((guild) => ({
        name: guild.name,
        value: guild.id
    }))

    await interaction.respond(choices)
}

export default new SlashCommand(
    {
        name: "remove",
        description: "Prevent users with passports from a specific server from joining this server",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: [
            {
                name: "issuer",
                description: "The server that issues the passports (use autofill to search)",
                type: ApplicationCommandOptionType.String,
                required: true,
                autocomplete: true
            }
        ]
    },
    {
        run: run,
        autocomplete: autocomplete
    }
)
