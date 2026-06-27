// Real-rules Blackjack engine with stateless, HMAC-signed game state so the
// multi-step hand (deal → hit/stand/double) survives across stateless edge
// requests without a database. House-favorable rules keep an edge without
// "rigging" the odds: single deck, dealer HITS soft 17, blackjack pays 3:2,
// no insurance, no split.

import { floorCoins, secureInt } from "@/lib/games";

/** Blackjack pays 3:2 → 2.5x the stake returned (1.5x profit). */
export const BLACKJACK_PAYS = 2.5;

export interface BlackjackState {
  /** Remaining shoe, as card codes 0..51 (rank = code % 13, 0=Ace..12=King). */
  deck: number[];
  /** Player hand, card codes. */
  player: number[];
  /** Dealer hand, card codes (index 0 is the up card). */
  dealer: number[];
  /** Original stake. */
  bet: number;
  /** Whether the player doubled (stake is then 2x bet). */
  doubled: boolean;
  /** Whether the hand is finished (dealer has played, result is final). */
  done: boolean;
}

/** Rank of a card code: 1 = Ace, 2..10, 11 = J, 12 = Q, 13 = K. */
export function cardRank(code: number): number {
  return (code % 13) + 1;
}

/** Blackjack point value of a single card (Ace counts as 11 here). */
export function cardValue(code: number): number {
  const rank = cardRank(code);
  if (rank === 1) return 11;
  return Math.min(rank, 10);
}

/** Best hand total (treating aces as 1 when 11 would bust) and softness. */
export function handValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    total += v;
    if (v === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards: number[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** Fisher–Yates shuffle of a fresh 52-card deck using the secure RNG. */
export function freshDeck(): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Play the dealer out per house rules: hit until hard 17+ (hits soft 17). */
export function playDealer(state: BlackjackState): void {
  for (;;) {
    const { total, soft } = handValue(state.dealer);
    if (total > 17) break;
    if (total === 17 && !soft) break; // stand on hard 17, hit soft 17
    const card = state.deck.shift();
    if (card === undefined) break;
    state.dealer.push(card);
  }
}

export type BlackjackOutcome =
  | "player_blackjack"
  | "player_bust"
  | "dealer_bust"
  | "player_win"
  | "dealer_win"
  | "push";

/** Determine the outcome of a finished hand (dealer already played). */
export function resolveOutcome(state: BlackjackState): BlackjackOutcome {
  const player = handValue(state.player).total;
  const dealer = handValue(state.dealer).total;
  const playerBJ = isBlackjack(state.player);
  const dealerBJ = isBlackjack(state.dealer);

  if (playerBJ && dealerBJ) return "push";
  if (playerBJ) return "player_blackjack";
  if (dealerBJ) return "dealer_win";
  if (player > 21) return "player_bust";
  if (dealer > 21) return "dealer_bust";
  if (player > dealer) return "player_win";
  if (player < dealer) return "dealer_win";
  return "push";
}

/**
 * Coins returned to the balance for a finished hand (the stake was debited up
 * front). `stake` is bet, doubled to 2x when the player doubled.
 */
export function payoutForOutcome(
  outcome: BlackjackOutcome,
  bet: number,
  stake: number
): number {
  switch (outcome) {
    case "player_blackjack":
      return floorCoins(bet * BLACKJACK_PAYS);
    case "dealer_bust":
    case "player_win":
      return stake * 2;
    case "push":
      return stake;
    case "player_bust":
    case "dealer_win":
    default:
      return 0;
  }
}

// --- Signed state encoding ------------------------------------------------
// The state is JSON, base64url-encoded, and HMAC-signed so the client can hold
// it between requests but cannot tamper with the deck or hands.

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

export async function signState(state: BlackjackState): Promise<string> {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyState(
  token: string
): Promise<BlackjackState | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = await hmac(payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    return JSON.parse(json) as BlackjackState;
  } catch {
    return null;
  }
}
