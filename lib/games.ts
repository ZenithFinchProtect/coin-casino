// Shared game configuration. Win chances are tuned per game so the house keeps
// an edge while staying in a fairer 20-38% range.

/** Default win probability when a game does not specify its own. */
export const WIN_CHANCE = 0.38;

/** Betting limits, in coins. */
export const MIN_BET = 1;
export const MAX_BET = 5;

// --- Coin Flip ---
/** Total return on a winning flip (2x = stake back + equal profit). */
export const COINFLIP_MULTIPLIER = 2;
/** Win probability for a coin flip. */
export const COINFLIP_WIN_CHANCE = 0.38;

// --- Dice (experimental / staging) ---
/** Faces on the die. */
export const DICE_SIDES = 6;
/** Total return on a winning dice roll (2x = stake back + equal profit). */
export const DICE_MULTIPLIER = 2;
/** Win probability for a dice roll. */
export const DICE_WIN_CHANCE = 0.38;

// --- Mines ---
/** Grid is MINES_GRID_SIZE x MINES_GRID_SIZE tiles. */
export const MINES_GRID_SIZE = 5;
/** Total tiles on the board. */
export const MINES_TILES = MINES_GRID_SIZE * MINES_GRID_SIZE;
/** Number of mines shown on the board (cosmetic difficulty indicator). */
export const MINES_COUNT = 5;
/** Safe tiles a player must reveal in a row to win the round. */
export const MINES_TARGET = 3;
/** Total return on a completed mines round (3x = stake back + 2x profit). */
export const MINES_MULTIPLIER = 3;
/** Win probability for a completed mines round (lower since it pays 3x). */
export const MINES_WIN_CHANCE = 0.25;

// --- High / Low (experimental / staging) ---
/** Card ranks: 1 (Ace) .. 13 (King). */
export const HILO_RANKS = 13;
/** Total return on a winning guess (2x = stake back + equal profit). */
export const HILO_MULTIPLIER = 2;
/** Win probability for a high/low guess. */
export const HILO_WIN_CHANCE = 0.38;

// --- Blackjack (experimental / staging) ---
/** Total return on a winning hand (2x = stake back + equal profit). */
export const BLACKJACK_MULTIPLIER = 2;
/** Win probability for a resolved blackjack hand. */
export const BLACKJACK_WIN_CHANCE = 0.38;

// --- Mission Uncrossable (experimental / staging) ---
/** Lanes the chicken must cross to complete a run. */
export const MISSION_LANES = 5;
/** Total return on a completed run (3x = stake back + 2x profit). */
export const MISSION_MULTIPLIER = 3;
/** Win probability for completing a run (lower since it pays 3x). */
export const MISSION_WIN_CHANCE = 0.25;

// --- Crash (experimental / staging) ---
/** Selectable cash-out targets, in multiples of the stake. */
export const CRASH_TARGETS = [2, 3] as const;
/**
 * Numerator for the win chance so the house edge stays constant across targets:
 * winChance = CRASH_HOUSE_FACTOR / target (0.76/2 = 0.38, 0.76/3 ≈ 0.25).
 */
export const CRASH_HOUSE_FACTOR = 0.76;
/** Win probability for cashing out at the given target multiplier. */
export function crashWinChance(target: number): number {
  return CRASH_HOUSE_FACTOR / target;
}

export function isValidBet(bet: unknown): bet is number {
  return (
    typeof bet === "number" &&
    Number.isInteger(bet) &&
    bet >= MIN_BET &&
    bet <= MAX_BET
  );
}

/** True with the given probability (default WIN_CHANCE), using secure randomness. */
export function rollWin(chance: number = WIN_CHANCE): boolean {
  return secureUnitInterval() < chance;
}

/** A secure float in [0, 1). */
export function secureUnitInterval(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

/** A secure integer in [0, maxExclusive). */
export function secureInt(maxExclusive: number): number {
  return Math.floor(secureUnitInterval() * maxExclusive);
}
