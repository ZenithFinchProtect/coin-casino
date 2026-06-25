// Stateless, HMAC-signed session cookies (edge-runtime compatible via Web Crypto).
import { cookies } from "next/headers";

export const SESSION_COOKIE = "casino_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  /** Discord user ID (snowflake) — maps to the bot's coin balance key. */
  id: string;
  username: string;
  avatar: string | null;
  /** Issued-at, unix seconds. */
  iat: number;
}

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(user: SessionUser): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(user)));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    const user = JSON.parse(json) as SessionUser;
    if (!user || typeof user.id !== "string") return null;
    if (Date.now() / 1000 - user.iat > MAX_AGE_SECONDS) return null;
    return user;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}
