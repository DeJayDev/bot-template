//=> https://orm.drizzle.team/docs/column-types/pg

import { createId } from "@paralleldrive/cuid2"
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const passports = pgTable(
    "passports",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),
        userId: text("user_id").notNull(),
        issuerId: text("issuer_id").notNull(),
        issuedAt: timestamp("issued_at").defaultNow().notNull(),
        issuedBy: text("issued_by").notNull()
    },
    (table) => [index("passports_user_id_idx").on(table.userId), index("passports_issuer_id_idx").on(table.issuerId), index("passports_user_issuer_idx").on(table.userId, table.issuerId)]
)

export const serverPermissions = pgTable(
    "server_permissions",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),
        serverId: text("server_id").notNull(),
        issuerId: text("issuer_id").notNull(),
        roleId: text("role_id"),
        addedAt: timestamp("added_at").defaultNow().notNull(),
        addedBy: text("added_by").notNull()
    },
    (table) => [index("server_permissions_server_id_idx").on(table.serverId), index("server_permissions_issuer_id_idx").on(table.issuerId)]
)

export const autoIssueConfigs = pgTable(
    "auto_issue_configs",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => createId()),
        serverId: text("server_id").notNull(),
        roleId: text("role_id").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        createdBy: text("created_by").notNull()
    },
    (table) => [index("auto_issue_configs_server_id_idx").on(table.serverId), index("auto_issue_configs_role_id_idx").on(table.roleId)]
)

export const userTokens = pgTable("user_tokens", {
    userId: text("user_id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
})
