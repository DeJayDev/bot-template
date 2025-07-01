declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string
            DATABASE_URL: string
            CLIENT_ID: string
            CLIENT_SECRET: string
            REDIRECT_URI: string
            PORT?: string
        }
    }
}

export {}
