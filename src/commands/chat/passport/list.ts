import { type ChatInputCommandInteraction, ComponentType, MessageFlags } from "discord.js"
import { eq } from "drizzle-orm"
import { SlashCommand } from "slashasaurus"
import { passports } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"

async function run(interaction: ChatInputCommandInteraction) {
    try {
        // Get all passports for the user
        const userPassports = await db.select().from(passports).where(eq(passports.userId, interaction.user.id)).orderBy(passports.issuedAt)

        if (userPassports.length === 0) {
            return interaction.reply({
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                components: [
                    {
                        type: ComponentType.TextDisplay,
                        content: "You don't have any passports yet."
                    }
                ]
            })
        }

        // Get guild information for the issuers
        const issuerIds = [...new Set(userPassports.map((p) => p.issuerId))]
        const guilds = interaction.client.guilds.cache.filter((guild) => issuerIds.includes(guild.id))

        const passportList = userPassports
            .map((passport) => {
                const guild = guilds.get(passport.issuerId)
                const guildName = guild ? guild.name : `Unknown Server (${passport.issuerId})`
                const issuedDate = new Date(passport.issuedAt).toLocaleDateString()

                return `• **${guildName}** - Issued on ${issuedDate}`
            })
            .join("\n")

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: `# Your Passports\n\n${passportList}\n\n*You have ${userPassports.length} passport${userPassports.length === 1 ? "" : "s"}*`
                }
            ]
        })
    } catch (error) {
        logger.error("Error listing passports:", { error, userId: interaction.user.id })
        await interaction.reply({
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "❌ An error occurred while listing your passports."
                }
            ]
        })
    }
}

export default new SlashCommand(
    {
        name: "list",
        description: "List all of your passports",
        options: []
    },
    {
        run: run
    }
)
