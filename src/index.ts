import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { GatewayIntentBits } from "discord.js"
import { drizzle } from "drizzle-orm/node-postgres"
import { SlashasaurusClient } from "slashasaurus"
import * as schema from "@/db/schema"
import { logger } from "@/util/logger"

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

    logger.info(`Ready and logged in as ${client.user?.tag}`)
})

client.login(process.env.TOKEN)

export { client as Bot, db }
