import { createHmac, timingSafeEqual } from "node:crypto"
import { serve } from "@hono/node-server"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { userTokens } from "@/db/schema"
import { db } from "@/index"
import { logger } from "@/util/logger"
import { checkUserAccess, joinUserToServer } from "@/util/passport"

const app = new Hono()

const oauthStates = new Map<string, { serverId: string; userId: string; timestamp: number }>()

// Verify security token
function verifySecurityToken(userId: string, serverId: string, token: string): boolean {
    try {
        const secret = process.env.CLIENT_SECRET
        if (!secret) return false

        const [timestampStr, providedSignature] = token.split(".")
        if (!timestampStr || !providedSignature) return false

        const timestamp = parseInt(timestampStr)
        if (Number.isNaN(timestamp)) return false

        const now = Math.floor(Date.now() / 1000)

        // Token expires after 10 minutes
        if (now - timestamp > 600) return false

        const payload = `${userId}:${serverId}:${timestamp}`
        // Use full HMAC digest instead of truncated version for security
        const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex")

        return timingSafeEqual(Buffer.from(providedSignature, "hex"), Buffer.from(expectedSignature, "hex"))
    } catch {
        return false
    }
}

// Clean up expired states every 10 minutes
setInterval(
    () => {
        const now = Date.now()
        for (const [state, data] of oauthStates.entries()) {
            if (now - data.timestamp > 10 * 60 * 1000) {
                // 10 minutes
                oauthStates.delete(state)
            }
        }
    },
    10 * 60 * 1000
)

// Generate join URL for a user to join a server (with security token)
app.get("/join/:serverId/:userId/:token", async (c) => {
    const serverId = c.req.param("serverId")
    const userId = c.req.param("userId")
    const token = c.req.param("token")

    try {
        // Verify the security token
        if (!verifySecurityToken(userId, serverId, token)) {
            return c.json({ error: "Invalid or expired join link" }, 403)
        }

        // Check if user has access to this server
        const access = await checkUserAccess(userId, serverId)
        if (!access.hasAccess) {
            return c.json({ error: "No valid passport for this server" }, 403)
        }

        // Generate state for OAuth
        const state = crypto.randomUUID()
        oauthStates.set(state, { serverId, userId, timestamp: Date.now() })

        // Discord OAuth URL
        const oauthUrl = new URL("https://discord.com/api/oauth2/authorize")
        oauthUrl.searchParams.set("client_id", process.env.CLIENT_ID)
        oauthUrl.searchParams.set("redirect_uri", process.env.REDIRECT_URI)
        oauthUrl.searchParams.set("response_type", "code")
        oauthUrl.searchParams.set("scope", "guilds.join")
        oauthUrl.searchParams.set("state", state)

        return c.redirect(oauthUrl.toString())
    } catch (error) {
        logger.error("Error generating join URL:", error)
        return c.json({ error: "Internal server error" }, 500)
    }
})

// OAuth callback
app.get("/callback", async (c) => {
    const code = c.req.query("code")
    const state = c.req.query("state")

    // Validate required parameters
    if (!code || !state || typeof code !== "string" || typeof state !== "string") {
        logger.warn("OAuth callback missing or invalid parameters", { code: !!code, state: !!state })
        return c.json({ error: "Missing or invalid code or state" }, 400)
    }

    const stateData = oauthStates.get(state)
    if (!stateData) {
        logger.warn("OAuth callback with invalid or expired state", { state })
        return c.json({ error: "Invalid or expired state" }, 400)
    }

    oauthStates.delete(state) // Clean up state

    try {
        // Exchange code for access token
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.REDIRECT_URI
            })
        })

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            logger.error("Discord token exchange failed", {
                status: tokenResponse.status,
                statusText: tokenResponse.statusText,
                error: errorText
            })
            throw new Error(`Token exchange failed: ${tokenResponse.status}`)
        }

        const tokenData = (await tokenResponse.json()) as {
            access_token: string
            refresh_token?: string
            expires_in: number
        }

        // Validate token response structure
        if (!tokenData.access_token || !tokenData.expires_in) {
            logger.error("Invalid token response from Discord", { tokenData: Object.keys(tokenData) })
            throw new Error("Invalid token response from Discord")
        }

        // Store the user's token for future use
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        try {
            await db.insert(userTokens).values({
                userId: stateData.userId,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || null,
                expiresAt: expiresAt
            })
        } catch {
            // If insert fails due to conflict, update instead
            await db
                .update(userTokens)
                .set({
                    accessToken: tokenData.access_token,
                    refreshToken: tokenData.refresh_token || null,
                    expiresAt: expiresAt,
                    updatedAt: new Date()
                })
                .where(eq(userTokens.userId, stateData.userId))
        }

        // Use centralized join function
        const joinResult = await joinUserToServer(stateData.userId, stateData.serverId, tokenData.access_token)

        if (!joinResult.success) {
            logger.warn("Failed to join user to server after OAuth", {
                userId: stateData.userId,
                serverId: stateData.serverId,
                error: joinResult.error
            })
            return c.json({ error: joinResult.error || "Failed to join server" }, 400)
        }

        logger.info("Successful OAuth join", {
            userId: stateData.userId,
            serverId: stateData.serverId,
            serverName: joinResult.memberInfo?.servername
        })

        return c.html(`
            <html>
                <head>
                    <title>Passport - Success</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                        .success { color: #28a745; }
                        .info { color: #6c757d; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h1 class="success">✅ Successfully Joined!</h1>
                    <p>You have successfully joined <strong>${joinResult.memberInfo?.servername || "the server"}</strong> using your passport from <strong>${joinResult.memberInfo?.sourceServername || "another server"}</strong>.</p>
                    ${joinResult.memberInfo?.roleAssigned ? '<p class="info">You have been assigned the appropriate role.</p>' : ""}
                    <p class="info">You can now close this tab and return to Discord.</p>
                </body>
            </html>
        `)
    } catch (error) {
        logger.error("Error in OAuth callback:", error)
        return c.html(`
            <html>
                <head>
                    <title>Passport - Error</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
                        .error { color: #dc3545; }
                    </style>
                </head>
                <body>
                    <h1 class="error">❌ Error</h1>
                    <p>There was an error joining the server. Please try again later.</p>
                </body>
            </html>
        `)
    }
})

// Health check
app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

export function startOAuthServer() {
    const port = parseInt(process.env.PORT || "3000")

    serve({
        fetch: app.fetch,
        port: port
    })

    logger.info(`OAuth server started on port ${port}`)
}

export { app }
