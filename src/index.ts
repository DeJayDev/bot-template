import { IntentsBitField } from "discord.js"
import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { SlashasaurusClient } from "slashasaurus"
import * as schema from "./db/schema.js"
import { logger } from "./util/logger.js"

const client = new SlashasaurusClient(
    {
        intents: [
            IntentsBitField.Flags.Guilds
            // others
        ]
    },
    {
        logger: logger
    }
)

const db = drizzle(process.env.PG_URI, { schema, casing: "snake_case" })

client.once("ready", async () => {
    const p = dirname(fileURLToPath(import.meta.url))

    client.registerCommandsFrom(join(p, "commands"), true, process.env.TOKEN)

    logger.info(`Client ready and logged in as ${client.user?.tag}`)
})

client.login(process.env.TOKEN)

export { client as Adapto, db }
