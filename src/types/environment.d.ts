declare global {
    namespace NodeJS {
        interface ProcessEnv {
            TOKEN: string
            PG_URI: string
        }
    }
}

export {}
