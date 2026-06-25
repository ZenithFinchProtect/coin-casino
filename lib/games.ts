// Shared game configuration. The house always wins ~80% of the time.

/** Probability that any single round is a win. */
export const WIN_CHANCE = 0.2;

/** Betting limits, in coins. */
export const MIN_BET = 1;
export const MAX_BET = 5;

// --- Coin Flip ---
/** Total return on a winning flip (2x = stake back + equal profit). */
export const COINFLIP_MULTIPLIER = 2;

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

export function isValidBet(bet: unknown): bet is number {
  return (
    typeof bet === "number" &&
    Number.isInteger(bet) &&
    bet >= MIN_BET &&
    bet <= MAX_BET
  );
}

/** True with probability WIN_CHANCE, using cryptographically secure randomness. */
export function rollWin(): boolean {
  return secureUnitInterval() < WIN_CHANCE;
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
