import "dotenv/config"

import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Events, GatewayIntentBits } from "discord.js"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { SlashasaurusClient } from "slashasaurus"
import * as schema from "@/db/schema"
import { autoIssueConfigs } from "@/db/schema"
import { startOAuthServer } from "@/oauth"
import { logger } from "@/util/logger"
import { issuePassport, removePassport } from "@/util/passport"

const client = new SlashasaurusClient(
    {
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
    },
    {
        logger: logger
    }
)

const db = drizzle(process.env.DATABASE_URL, { schema, casing: "snake_case" })

client.once("ready", async () => {
    const p = dirname(fileURLToPath(import.meta.url))

    client.registerCommandsFrom(join(p, "commands"), true, process.env.TOKEN)

    // Start OAuth server
    startOAuthServer()

    logger.info(`Client ready and logged in as ${client.user?.tag}`)
})

// Autoissue event listeners
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        // Check if any of the member's roles are configured for autoissue
        const autoIssueRoles = await db.select().from(autoIssueConfigs).where(eq(autoIssueConfigs.serverId, member.guild.id))

        for (const config of autoIssueRoles) {
            if (member.roles.cache.has(config.roleId)) {
                const issued = await issuePassport(member.user.id, member.guild.id, config.createdBy)
                if (issued) {
                    logger.info(`Auto-issued passport to ${member.user.tag} in ${member.guild.name} for role ${config.roleId}`)
                }
            }
        }
    } catch (error) {
        logger.error("Error in guildMemberAdd autoissue handler:", error)
    }
})

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
        // Get autoissue configurations for this server
        const autoIssueRoles = await db.select().from(autoIssueConfigs).where(eq(autoIssueConfigs.serverId, newMember.guild.id))

        for (const config of autoIssueRoles) {
            const hadRole = oldMember.roles.cache.has(config.roleId)
            const hasRole = newMember.roles.cache.has(config.roleId)

            // Role was added
            if (!hadRole && hasRole) {
                const issued = await issuePassport(newMember.user.id, newMember.guild.id, config.createdBy)
                if (issued) {
                    logger.info(`Auto-issued passport to ${newMember.user.tag} in ${newMember.guild.name} for role ${config.roleId}`)
                }
            }
            // Role was removed
            else if (hadRole && !hasRole) {
                const removed = await removePassport(newMember.user.id, newMember.guild.id)
                if (removed) {
                    logger.info(`Auto-removed passport from ${newMember.user.tag} in ${newMember.guild.name} for role ${config.roleId}`)
                }
            }
        }
    } catch (error) {
        logger.error("Error in guildMemberUpdate autoissue handler:", error)
    }
})

client.login(process.env.TOKEN)

export { client as Bot, db }
