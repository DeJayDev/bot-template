import { createHmac } from "node:crypto"
import { RESTJSONErrorCodes } from "discord.js"
import { and, eq } from "drizzle-orm"
import { passports, serverPermissions, userTokens } from "@/db/schema"
import { Bot, db } from "@/index"
import { logger } from "@/util/logger"

/**
 * Check if a user has access to join a server based on their passports
 */
export async function checkUserAccess(
    userId: string,
    serverId: string
): Promise<{
    hasAccess: boolean
    roleId?: string
    issuerId?: string
}> {
    try {
        // Get user's passports
        const userPassports = await db.select().from(passports).where(eq(passports.userId, userId))

        if (userPassports.length === 0) {
            return { hasAccess: false }
        }

        // Check if any of the user's passports are accepted by the target server
        for (const passport of userPassports) {
            const permission = await db
                .select()
                .from(serverPermissions)
                .where(and(eq(serverPermissions.serverId, serverId), eq(serverPermissions.issuerId, passport.issuerId)))
                .limit(1)

            if (permission.length > 0) {
                return {
                    hasAccess: true,
                    roleId: permission[0].roleId || undefined,
                    issuerId: passport.issuerId
                }
            }
        }

        return { hasAccess: false }
    } catch (error) {
        logger.error("Database error checking user access:", { error, userId, serverId })
        return { hasAccess: false }
    }
}

/**
 * Get all servers a user can access with their passports
 */
export async function getUserAccessibleServers(userId: string): Promise<
    Array<{
        serverId: string
        roleId?: string
        issuerId: string
    }>
> {
    try {
        // Get user's passports
        const userPassports = await db.select().from(passports).where(eq(passports.userId, userId))

        if (userPassports.length === 0) {
            return []
        }

        const accessibleServers: Array<{
            serverId: string
            roleId?: string
            issuerId: string
        }> = []

        // For each passport, find servers that accept it
        for (const passport of userPassports) {
            const permissions = await db.select().from(serverPermissions).where(eq(serverPermissions.issuerId, passport.issuerId))

            for (const permission of permissions) {
                accessibleServers.push({
                    serverId: permission.serverId,
                    roleId: permission.roleId || undefined,
                    issuerId: passport.issuerId
                })
            }
        }

        return accessibleServers
    } catch (error) {
        logger.error("Database error getting user accessible servers:", { error, userId })
        return []
    }
}

/**
 * Get all users who have passports from a specific server
 */
export async function getServerPassportHolders(issuerId: string): Promise<
    Array<{
        userId: string
        issuedAt: Date
        issuedBy: string
    }>
> {
    try {
        const passportHolders = await db
            .select({
                userId: passports.userId,
                issuedAt: passports.issuedAt,
                issuedBy: passports.issuedBy
            })
            .from(passports)
            .where(eq(passports.issuerId, issuerId))
            .orderBy(passports.issuedAt)

        return passportHolders
    } catch (error) {
        logger.error("Database error getting server passport holders:", { error, issuerId })
        return []
    }
}

/**
 * Issue a passport to a user from a specific server
 */
export async function issuePassport(userId: string, issuerId: string, issuedBy: string): Promise<boolean> {
    try {
        // Check if user already has a passport from this server
        const existingPassport = await db
            .select()
            .from(passports)
            .where(and(eq(passports.userId, userId), eq(passports.issuerId, issuerId)))
            .limit(1)

        if (existingPassport.length > 0) {
            logger.info("Passport already exists", { userId, issuerId })
            return false // Already has passport
        }

        // Issue the passport
        await db.insert(passports).values({
            userId: userId,
            issuerId: issuerId,
            issuedBy: issuedBy
        })

        logger.info("Passport issued successfully", { userId, issuerId, issuedBy })
        return true
    } catch (error) {
        logger.error("Database error issuing passport:", { error, userId, issuerId, issuedBy })
        return false
    }
}

/**
 * Remove a passport from a user
 */
export async function removePassport(userId: string, issuerId: string): Promise<boolean> {
    try {
        await db.delete(passports).where(and(eq(passports.userId, userId), eq(passports.issuerId, issuerId)))

        logger.info("Passport removal completed", { userId, issuerId })
        return true
    } catch (error) {
        logger.error("Database error removing passport:", { error, userId, issuerId })
        return false
    }
}

/**
 * Generate a secure join URL for a user to join a server if they have access
 */
export async function generateJoinUrl(userId: string, serverId: string): Promise<string | null> {
    try {
        const access = await checkUserAccess(userId, serverId)
        if (!access.hasAccess) {
            logger.warn("User attempted to generate join URL without access", { userId, serverId })
            return null
        }

        // Generate secure HMAC token with timestamp
        const secret = process.env.CLIENT_SECRET
        if (!secret) {
            logger.error("CLIENT_SECRET environment variable is missing")
            throw new Error("CLIENT_SECRET environment variable is required")
        }

        const timestamp = Math.floor(Date.now() / 1000)
        const payload = `${userId}:${serverId}:${timestamp}`
        // Use full HMAC digest instead of truncated version for security
        const signature = createHmac("sha256", secret).update(payload).digest("hex")
        const token = `${timestamp}.${signature}`

        const baseUrl = process.env.REDIRECT_URI?.replace("/callback", "") || "http://localhost:3000"
        const joinUrl = `${baseUrl}/join/${serverId}/${userId}/${token}`

        logger.info("Generated join URL", { userId, serverId })
        return joinUrl
    } catch (error) {
        logger.error("Error generating join URL:", { error, userId, serverId })
        return null
    }
}

/**
 * Directly join a user to a server using their OAuth token
 */
export async function joinUserToServer(
    userId: string,
    serverId: string,
    accessToken?: string
): Promise<{
    success: boolean
    error?: string
    needsAuth?: boolean
    memberInfo?: { username: string; servername: string; sourceServername: string; roleAssigned?: boolean }
}> {
    try {
        // Check if user has access
        const access = await checkUserAccess(userId, serverId)
        if (!access.hasAccess) {
            return { success: false, error: "No valid passport for this server" }
        }

        // Get the destination guild
        const destinationGuild = Bot.guilds.cache.get(serverId)
        if (!destinationGuild) {
            logger.error("Destination guild not found", { serverId })
            return { success: false, error: "Server not found or bot is not in that server" }
        }

        // Get source guild for logging
        const sourceGuild = Bot.guilds.cache.get(access.issuerId)
        const sourceServername = sourceGuild ? sourceGuild.name : `Unknown Server (${access.issuerId})`

        // Check if user is already in the server
        const existingMember = destinationGuild.members.cache.get(userId)
        if (existingMember) {
            return { success: false, error: "User is already a member of this server" }
        }

        let tokenToUse = accessToken

        // If no token provided, get user's stored token
        if (!tokenToUse) {
            const userToken = await db.select().from(userTokens).where(eq(userTokens.userId, userId)).limit(1)

            if (userToken.length === 0) {
                return { success: false, needsAuth: true, error: "Authorization required" }
            }

            // Check if token is expired
            if (userToken[0].expiresAt < new Date()) {
                // Delete expired token
                await db.delete(userTokens).where(eq(userTokens.userId, userId))
                logger.info("Deleted expired token", { userId })
                return { success: false, needsAuth: true, error: "Authorization expired, please re-authorize" }
            }

            tokenToUse = userToken[0].accessToken
        }

        // Add user to guild using their access token
        try {
            const member = await destinationGuild.members.add(userId, {
                accessToken: tokenToUse,
                roles: access.roleId ? [access.roleId] : undefined
            })

            const roleAssigned = !!access.roleId

            logger.info("User successfully joined server via passport", {
                userId,
                username: member.user.username,
                serverId,
                serverName: destinationGuild.name,
                sourceServerId: access.issuerId,
                sourceServerName: sourceServername,
                roleId: access.roleId,
                roleAssigned
            })

            return {
                success: true,
                memberInfo: {
                    username: member.user.username,
                    servername: destinationGuild.name,
                    sourceServername: sourceServername,
                    roleAssigned: roleAssigned
                }
            }
        } catch (discordError: unknown) {
            // If Discord rejects the token, it's likely invalid - delete it
            const error = discordError as { code?: number; status?: number }
            if (error?.code === RESTJSONErrorCodes.MissingAccess || error?.code === RESTJSONErrorCodes.InvalidOAuth2AccessToken || error?.status === 401) {
                await db.delete(userTokens).where(eq(userTokens.userId, userId))
                logger.info("Deleted invalid token after Discord rejection", { userId, discordError: error.code })
                return { success: false, needsAuth: true, error: "Authorization invalid, please re-authorize" }
            }

            // Re-throw other errors to be caught by outer catch
            throw discordError
        }
    } catch (error) {
        logger.error("Error joining user to server:", {
            error:
                error instanceof Error
                    ? {
                          message: error.message,
                          name: error.name,
                          ...(process.env.NODE_ENV !== "production" && { stack: error.stack })
                      }
                    : error,
            userId,
            serverId
        })
        return { success: false, error: "An error occurred while joining the server" }
    }
}
