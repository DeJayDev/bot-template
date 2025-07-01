# Discord Bot Template

A Discord bot template using Slashasaurus, Drizzle ORM, and Biome.

## Stack

- [Slashasaurus](https://rodentman87.gitbook.io/slashasaurus/quick-start) for Discord.js command handling
- [Drizzle ORM](https://orm.drizzle.team/) for database management
- [Biome](https://biomejs.dev/) for linting and formatting

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Discord bot token

### Environment Variables

Create a `.env` file based on `.env.example`:

```
TOKEN=your_discord_bot_token
DATABASE_URL=postgresql://username:password@localhost:5432/your_bot
```

### Installation

```bash
npm install
npm run migrate
npm run build
npm start
```

## Development

```bash
npm run dev
```

### Database

Start a local PostgreSQL instance with Docker:

```bash
docker run -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres
```

Then run migrations:

```bash
npm run migrate
```

#### Need a Tunnel to Develop Locally?

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel
