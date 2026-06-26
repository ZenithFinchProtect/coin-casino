// Shared game configuration. Win chances are tuned per game so the house keeps
// an edge while staying in a fairer 20-38% range.

/** Default win probability when a game does not specify its own. */
export const WIN_CHANCE = 0.34;

/** Betting limits, in coins. */
export const MIN_BET = 1;
export const MAX_BET = 5;

// --- Stake-style payout math ---------------------------------------------
/**
 * Casino-wide return-to-player. Stake-style games derive their multipliers
 * from real win probabilities times this factor, so the gameplay/odds feel
 * authentic while the house keeps a fixed edge of (1 - HOUSE_RTP). Stake runs
 * ~0.99; we keep a fatter edge. Tune this single constant to rig the house
 * harder or softer across every Stake-style game.
 */
export const HOUSE_RTP = 0.9;

/**
 * Fair-with-edge multiplier for an event of probability `winChance`.
 * payout = HOUSE_RTP / winChance, so the expected return is exactly HOUSE_RTP.
 */
export function payoutMultiplier(
  winChance: number,
  rtp: number = HOUSE_RTP
): number {
  if (winChance <= 0) return 0;
  return rtp / winChance;
}

/** Round a multiplier to 2 decimals for display/credit. */
export function roundMultiplier(m: number): number {
  return Math.round(m * 100) / 100;
}

/** Coins credited for a stake at a multiplier (floored to whole coins). */
export function payoutCoins(bet: number, multiplier: number): number {
  return Math.floor(bet * multiplier);
}

// --- Coin Flip ---
/** Total return on a winning flip (2x = stake back + equal profit). */
export const COINFLIP_MULTIPLIER = 2;
/** Win probability for a coin flip. */
export const COINFLIP_WIN_CHANCE = 0.34;

// --- Dice (experimental / staging) ---
/** Faces on the die. */
export const DICE_SIDES = 6;
/** Total return on a winning dice roll (2x = stake back + equal profit). */
export const DICE_MULTIPLIER = 2;
/** Win probability for a dice roll. */
export const DICE_WIN_CHANCE = 0.34;

// --- Dice (Stake-style slider) -------------------------------------------
// Player rolls a 0.00-100.00 result and wins if it lands above their target.
// Win chance = (100 - target) / 100, payout = HOUSE_RTP / winChance.
/** Minimum roll-over target (>=2 keeps multipliers finite & sane). */
export const DICE_MIN_TARGET = 2;
/** Maximum roll-over target (keeps win chance above ~2%). */
export const DICE_MAX_TARGET = 98;
/** Default roll-over target → 34% win chance. */
export const DICE_DEFAULT_TARGET = 66;

/** Win chance for "roll over `target`" on a 0-100 scale. */
export function diceWinChance(target: number): number {
  return (100 - target) / 100;
}

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
/** Win probability for a completed mines round. */
export const MINES_WIN_CHANCE = 0.34;

// --- High / Low (experimental / staging) ---
/** Card ranks: 1 (Ace) .. 13 (King). */
export const HILO_RANKS = 13;
/** Total return on a winning guess (2x = stake back + equal profit). */
export const HILO_MULTIPLIER = 2;
/** Win probability for a high/low guess. */
export const HILO_WIN_CHANCE = 0.34;

// --- Blackjack (experimental / staging) ---
/** Total return on a winning hand (2x = stake back + equal profit). */
export const BLACKJACK_MULTIPLIER = 2;
/** Win probability for a resolved blackjack hand. */
export const BLACKJACK_WIN_CHANCE = 0.34;

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
 * winChance = CRASH_HOUSE_FACTOR / target (0.68/2 = 0.34, 0.68/3 ≈ 0.23).
 */
export const CRASH_HOUSE_FACTOR = 0.68;
/** Win probability for cashing out at the given target multiplier. */
export function crashWinChance(target: number): number {
  return CRASH_HOUSE_FACTOR / target;
}

// --- Crash (Stake-style continuous auto-cashout) -------------------------
// The player sets an auto-cashout target and watches the rocket climb live.
// Win chance = HOUSE_RTP / target, so EV is HOUSE_RTP at every target.
export const CRASH_MIN_TARGET = 1.01;
export const CRASH_MAX_TARGET = 100;
export const CRASH_DEFAULT_TARGET = 2.65;
/** Win probability for auto-cashing at `target` (Stake-style edge). */
export function crashWinChanceContinuous(target: number): number {
  return Math.min(1, HOUSE_RTP / target);
}

// --- High / Low (Stake-style, real card odds) ----------------------------
// A card 1 (Ace) .. 13 (King) is shown. "Higher" wins if the next card is the
// same or higher; "Lower" wins if it is the same or lower. The multiplier is
// derived from the true probability so the odds are authentic (with edge).
/** Probability the next card is >= the shown rank. */
export function hiloHigherChance(rank: number): number {
  return (HILO_RANKS - rank + 1) / HILO_RANKS;
}
/** Probability the next card is <= the shown rank. */
export function hiloLowerChance(rank: number): number {
  return rank / HILO_RANKS;
}

// --- Mission "Chicken" (Stake-style, pick how far to cross) ---------------
// The player picks how many lanes to cross. Each lane has a fixed survival
// chance, so completing `lanes` lanes has probability MISSION_SURVIVE^lanes and
// the multiplier grows the further they commit. EV stays at HOUSE_RTP.
export const MISSION_MAX_LANES = 8;
export const MISSION_DEFAULT_LANES = 3;
/** Per-lane survival probability (tuned so default 3 lanes ≈ 34% win). */
export const MISSION_SURVIVE = 0.698;
/** Win chance for safely crossing `lanes` lanes. */
export function missionWinChance(lanes: number): number {
  return Math.pow(MISSION_SURVIVE, lanes);
}
/** Cumulative cash-out multiplier after surviving `lanes` lanes. */
export function missionMultiplier(lanes: number): number {
  return roundMultiplier(payoutMultiplier(missionWinChance(lanes)));
}

// --- Plinko (Stake-style) -------------------------------------------------
// A ball drops through `rows` rows of pegs, bouncing left/right at each peg
// with equal probability, and lands in one of `rows + 1` bins. The landing bin
// is Binomial(rows, 0.5). Each bin pays a multiplier; the tables below mirror
// Stake's recognizable shape (low edges/high center risk vs. huge edges) and
// are then scaled so the expected return is exactly HOUSE_RTP.
export type PlinkoRisk = "low" | "medium" | "high";
export const PLINKO_RISKS: PlinkoRisk[] = ["low", "medium", "high"];
export const PLINKO_ROW_OPTIONS = [8, 12, 16] as const;
export type PlinkoRows = (typeof PLINKO_ROW_OPTIONS)[number];
export const PLINKO_DEFAULT_ROWS: PlinkoRows = 12;

// Unscaled, Stake-like base multiplier tables (symmetric, length rows + 1).
const PLINKO_BASE: Record<number, Record<PlinkoRisk, number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [24, 5, 3, 1.6, 1, 0.5, 0.3, 0.5, 1, 1.6, 3, 5, 24],
    high: [58, 11, 4, 2, 1.1, 0.6, 0.2, 0.6, 1.1, 2, 4, 11, 58],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [
      110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110,
    ],
    high: [
      1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000,
    ],
  },
};

/** Binomial(rows, 0.5) probability mass for each bin index (0..rows). */
export function plinkoBinProbabilities(rows: number): number[] {
  // C(rows, k) / 2^rows, built with a numerically stable running ratio.
  const probs: number[] = [];
  let coeff = 1; // C(rows, 0)
  const denom = Math.pow(2, rows);
  for (let k = 0; k <= rows; k++) {
    probs.push(coeff / denom);
    coeff = (coeff * (rows - k)) / (k + 1);
  }
  return probs;
}

/**
 * Multiplier table for a (rows, risk) combination, scaled so the expected
 * return equals HOUSE_RTP exactly (modulo 2-decimal rounding).
 */
export function plinkoMultipliers(rows: number, risk: PlinkoRisk): number[] {
  const base = PLINKO_BASE[rows]?.[risk] ?? PLINKO_BASE[12].medium;
  const probs = plinkoBinProbabilities(rows);
  const rawEv = base.reduce((sum, m, i) => sum + m * probs[i], 0);
  const scale = HOUSE_RTP / rawEv;
  return base.map((m) => roundMultiplier(m * scale));
}

export function isValidPlinkoRows(rows: unknown): rows is PlinkoRows {
  return (
    typeof rows === "number" &&
    (PLINKO_ROW_OPTIONS as readonly number[]).includes(rows)
  );
}

export function isValidPlinkoRisk(risk: unknown): risk is PlinkoRisk {
  return typeof risk === "string" && PLINKO_RISKS.includes(risk as PlinkoRisk);
}

/** Land a ball: returns the bin index (0..rows) from `rows` fair coin flips. */
export function plinkoDrop(rows: number): number {
  let bin = 0;
  for (let i = 0; i < rows; i++) {
    if (secureUnitInterval() < 0.5) bin++;
  }
  return bin;
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
