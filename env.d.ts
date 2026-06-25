declare namespace NodeJS {
  interface ProcessEnv {
    /** Discord OAuth application client ID. */
    DISCORD_CLIENT_ID: string;
    /** Discord OAuth application client secret. */
    DISCORD_CLIENT_SECRET: string;
    /** Optional explicit OAuth redirect URI; derived from the request when unset. */
    DISCORD_REDIRECT_URI?: string;
    /** Secret used to sign session cookies. */
    SESSION_SECRET: string;
    /** Base URL of the status-coin-bot coin API, e.g. https://bot.example.com */
    BOT_API_BASE: string;
    /** Shared secret matching the bot's CASINO_API_KEY. */
    CASINO_API_KEY: string;
  }
}
