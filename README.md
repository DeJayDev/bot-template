# Passport - Discord Bot for Server Access Management

Passport is a Discord bot that enables "open borders" between private friend servers. Servers can issue passports to users, and other servers can accept these passports to allow users to join using Discord's OAuth flow.

## Features

### Passport Management
- **Issue Passports**: Server owners can issue passports to specific users
- **Auto-Issue**: Automatically issue passports to users with specific roles
- **List Passports**: Users can view all their passports
- **View Holders**: Server owners can see who has passports from their server

### Server Access Control
- **Add Accepting Servers**: Allow users with passports from specific servers to join
- **Remove Accepting Servers**: Prevent users with passports from specific servers from joining
- **Role Assignment**: Automatically assign roles to users who join via passport

### Server Information
- **Server Info**: View passport statistics and configurations for a server

## Commands

### User Commands
- `/passport list` - List all of your passports
- `/passport join <server>` - Get a link to join a server using your passport
- `/passport add <issuer> [role]` - Allow users with passports from a server to join (requires Manage Server)
- `/passport remove <issuer>` - Prevent users with passports from a server from joining (requires Manage Server)
- `/passport autoissue <role>` - Automatically issue passports to users with a role (requires Manage Server)
- `/passport issue <user>` - Issue a passport to a specific user (requires Manage Server)
- `/passport info` - View passport information for this server (requires Manage Server)
- `/passport holders` - View all users who have passports from this server (requires Manage Server)

## Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Discord bot token with appropriate permissions

### Bot Permissions
The bot requires the following permissions:
- `guilds.join` - For OAuth server joining
- `manage.roles` - For role assignment
- `guilds` - For server information
- `guild.members` - For member management

### Environment Variables
Create a `.env` file with:
```
TOKEN=your_discord_bot_token
DATABASE_URL=postgresql://username:password@localhost:5432/passport_db
CLIENT_ID=your_discord_application_client_id
CLIENT_SECRET=your_discord_application_client_secret
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

### Installation
```bash
npm install
npm run migrate
npm run build
npm start
```

### Database Setup
The bot uses Drizzle ORM with PostgreSQL. Run migrations to set up the database:
```bash
npm run migrate
```

## How It Works

1. **Issuing Passports**: Server owners can issue passports to users, either manually or automatically based on roles
2. **Accepting Passports**: Servers can configure which other servers' passports they accept
3. **OAuth Flow**: Users use `/passport join` to get a secure OAuth link that allows them to join servers
4. **Role Assignment**: Servers can optionally assign roles to users who join via passport

### OAuth Server Joining Process

1. User runs `/passport join <server>` command
2. Bot checks if user has a valid passport for that server
3. If valid, bot generates a secure OAuth URL 
4. User clicks the link and authorizes with Discord
5. Bot automatically adds user to the server with configured role
6. User receives confirmation and can close the browser tab

## Database Schema

- **passports**: Tracks which users have passports from which servers
- **server_permissions**: Tracks which issuers are allowed in which servers
- **auto_issue_configs**: Tracks which roles automatically issue passports

## Development

This template uses:
- [Slashasaurus](https://rodentman87.gitbook.io/slashasaurus/quick-start) for Discord.js command handling
- [Drizzle ORM](https://orm.drizzle.team/) for database management
- [Biome](https://biomejs.dev/) for linting and formatting

### Running Locally
```bash
npm run dev
```

### Database Development
```bash
# Start PostgreSQL with Docker
docker run -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres

# Run migrations
npm run migrate
```

[Click to learn more about Slashasaurus](https://rodentman87.gitbook.io/slashasaurus/quick-start)

### This template requires a database!

Here's a command to get you started with the default `DATABASE_URL`:

`docker run -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres`

#### Need a Tunnel to Develop Locally?

https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel
