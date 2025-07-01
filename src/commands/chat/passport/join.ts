import type { AutocompleteInteraction, ChatInputCommandInteraction } from "discord.js"
import { ApplicationCommandOptionType, ButtonStyle, ComponentType, MessageFlags } from "discord.js"
import { SlashCommand } from "slashasaurus"
import { logger } from "@/util/logger"
import { generateJoinUrl, getUserAccessibleServers, joinUserToServer } from "@/util/passport"

async function run(interaction: ChatInputCommandInteraction) {
    const serverId = interaction.options.getString("server", true)

    try {
        // Attempt to join the user directly
        const result = await joinUserToServer(interaction.user.id, serverId)

        if (result.success) {
            const memberInfo = result.memberInfo!
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `✅ Successfully joined **${memberInfo.servername}** using your passport from **${memberInfo.sourceServername}**!${memberInfo.roleAssigned ? " You have been assigned the appropriate role." : ""} You should now see it in your server list.`
                    }
                ]
            })
        }

        // If user needs authorization, provide OAuth link
        if (result.needsAuth) {
            const joinUrl = await generateJoinUrl(interaction.user.id, serverId)

            if (!joinUrl) {
                return interaction.reply({
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                    components: [
                        {
                            type: ComponentType.TextDisplay,
                            content: "❌ Unable to generate authorization link. Please check your passport access."
                        }
                    ]
                })
            }

            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: `🔐 **Authorization Required**\n\nTo join servers, you need to authorize the bot first.\n\n*This is a one-time setup. After authorizing, you can join servers directly with this command.*`
                    },
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            {
                                type: ComponentType.Button,
                                style: ButtonStyle.Link,
                                label: "🔗 Authorize & Join Server",
                                url: joinUrl
                            }
                        ]
                    }
                ]
            })
        }

        // Handle other errors
        return interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `❌ ${result.error || "Unable to join server"}`
                }
            ]
        })
    } catch (error) {
        logger.error("Error in join command:", { error, userId: interaction.user.id, serverId })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while trying to join the server."
                }
            ]
        })
    }
}

async function autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused()

    try {
        // Get servers the user can access
        const accessibleServers = await getUserAccessibleServers(interaction.user.id)

        if (accessibleServers.length === 0) {
            return interaction.respond([])
        }

        // Get guild information for accessible servers, excluding ones they're already in
        const choices = accessibleServers
            .map((server) => {
                const guild = interaction.client.guilds.cache.get(server.serverId)
                if (!guild) return null

                // Skip if user is already a member
                if (guild.members.cache.has(interaction.user.id)) return null

                return {
                    name: guild.name,
                    value: server.serverId
                }
            })
            .filter((choice) => choice !== null)
            .filter((choice) => {
                if (!focusedValue) return true
                return choice.name.toLowerCase().includes(focusedValue.toLowerCase()) || choice.value.includes(focusedValue)
            })
            .slice(0, 25) // Discord limits to 25 choices

        await interaction.respond(choices)
    } catch (error) {
        logger.error("Error in join command autocomplete:", { error, userId: interaction.user.id })
        await interaction.respond([])
    }
}

export default new SlashCommand(
    {
        name: "join",
        description: "Join a server using your passport",
        dmPermission: true,
        options: [
            {
                name: "server",
                description: "The server you want to join (use autofill to search)",
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
