import type { ChatInputCommandInteraction } from "discord.js"
import { ComponentType, MessageFlags, PermissionFlagsBits } from "discord.js"
import { eq } from "drizzle-orm"
import { SlashCommand } from "slashasaurus"
import { autoIssueConfigs, passports, serverPermissions } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"

async function run(interaction: ChatInputCommandInteraction) {
    try {
        // Get passports issued by this server
        const issuedPassports = await db.select().from(passports).where(eq(passports.issuerId, interaction.guild!.id))

        // Get accepted issuers for this server
        const acceptedIssuers = await db.select().from(serverPermissions).where(eq(serverPermissions.serverId, interaction.guild!.id))

        // Get auto-issue configurations
        const autoIssueRoles = await db.select().from(autoIssueConfigs).where(eq(autoIssueConfigs.serverId, interaction.guild!.id))

        // Get guild information for accepted issuers
        const issuerIds = acceptedIssuers.map((p) => p.issuerId)
        const guilds = interaction.client.guilds.cache.filter((guild) => issuerIds.includes(guild.id))

        const acceptedIssuersList =
            acceptedIssuers.length === 0
                ? "None"
                : acceptedIssuers
                      .map((p) => {
                          const guild = guilds.get(p.issuerId)
                          const guildName = guild ? guild.name : `Unknown Server (${p.issuerId})`
                          const roleText = p.roleId ? ` (Role: <@&${p.roleId}>)` : ""
                          return `• **${guildName}**${roleText}`
                      })
                      .join("\n")

        const autoIssueRolesList = autoIssueRoles.length === 0 ? "None" : autoIssueRoles.map((config) => `• <@&${config.roleId}>`).join("\n")

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `# Passport Information for ${interaction.guild!.name}`
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `## 📤 Passports Issued\n${issuedPassports.length} passport${issuedPassports.length === 1 ? "" : "s"} issued by this server`
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `## 📥 Accepted Issuers\n${acceptedIssuersList}`
                },
                {
                    type: ComponentType.TextDisplay,
                    content: `## 🔄 Auto-Issue Roles\n${autoIssueRolesList}`
                },
                {
                    type: ComponentType.TextDisplay,
                    content: "*Use /passport add to accept passports from other servers*"
                }
            ]
        })
    } catch (error) {
        logger.error("Error fetching passport info:", { error, serverId: interaction.guild?.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while fetching passport information."
                }
            ]
        })
    }
}

export default new SlashCommand(
    {
        name: "info",
        description: "View passport information for this server (server owners only)",
        defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
        dmPermission: false,
        options: []
    },
    {
        run: run
    }
)
