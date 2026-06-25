// Discord OAuth2 helpers (scope: identify).

const AUTH_BASE = "https://discord.com/api/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const USER_URL = "https://discord.com/api/users/@me";

export function getRedirectUri(origin: string): string {
  return process.env.DISCORD_REDIRECT_URI || `${origin}/api/auth/callback`;
}

export function buildAuthorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `${AUTH_BASE}?${params.toString()}`;
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
}

export async function exchangeCode(
  code: string,
  origin: string
): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID || "",
    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(origin),
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as DiscordTokenResponse;
  return data.access_token;
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export async function fetchDiscordUser(
  accessToken: string
): Promise<DiscordUser> {
  const res = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord user fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as DiscordUser;
  return { id: data.id, username: data.username, avatar: data.avatar };
}

export function avatarUrl(user: {
  id: string;
  avatar: string | null;
}): string {
  if (!user.avatar) {
    const idx = (BigInt(user.id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
}
