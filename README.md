# Nordic Casino

A Discord-login coin gambling site that shares balances with
[`status-coin-bot`](https://github.com/dogyrust/status-coin-bot). Players log in
with Discord and wager the coins they earned with the bot on **Coin Flip** and
**Mines**.

- **20% win chance** on every round (the house keeps the edge).
- **Max bet 5 coins** per round.
- Built with Next.js 15 (App Router, edge runtime), Tailwind, and deployed to
  Cloudflare Pages — same stack/theme as the docs site.

## How coin sync works

The bot remains the single source of truth for balances. It exposes an
authenticated HTTP API (`/api/coins/balance`, `/api/coins/adjust`). This site
calls that API **server-side only** (the API key is never sent to the browser):

1. Player logs in with Discord → their Discord user ID identifies their balance.
2. On each bet, the server debits the stake via `/api/coins/adjust` (which
   refuses to overdraw), rolls the outcome, and credits winnings on a win.

## Environment variables

| Variable | Description |
| --- | --- |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret |
| `DISCORD_REDIRECT_URI` | Optional. OAuth callback URL; derived from the request when unset (`<origin>/api/auth/callback`) |
| `SESSION_SECRET` | Long random string used to sign session cookies |
| `BOT_API_BASE` | Public base URL of the bot's coin API, e.g. `https://your-bot.up.railway.app` |
| `CASINO_API_KEY` | Must match the bot's `CASINO_API_KEY` |

In the Discord Developer Portal, add `<origin>/api/auth/callback` as an OAuth2
redirect and enable the `identify` scope.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the variables above
npm run dev
```

## Deploy (Cloudflare Pages)

```bash
npx @cloudflare/next-on-pages
npx wrangler pages deploy .vercel/output/static --project-name=coin-casino
```

Set the environment variables in the Cloudflare Pages project settings.
