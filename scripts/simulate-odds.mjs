#!/usr/bin/env node
/**
 * Simulates 200 rounds of each game using the actual game logic from lib/games.ts
 * and reports win rates to verify they are around 34%.
 *
 * Run: node scripts/simulate-odds.mjs
 */

import { webcrypto } from "node:crypto";

// Polyfill crypto.getRandomValues for Node (needed by secureUnitInterval)
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

// ---- Inline the game logic (ES module, can't import TS directly) ----

const WIN_CHANCE = 0.34;
const HOUSE_RTP = 0.9;
const COINFLIP_WIN_CHANCE = 0.34;
const MINES_WIN_CHANCE = 0.34;
const DICE_DEFAULT_TARGET = 66;
const CRASH_DEFAULT_TARGET = 2.65;
const MISSION_SURVIVE = 0.698;
const MISSION_DEFAULT_LANES = 3;
const HILO_RANKS = 13;
const PLINKO_DEFAULT_ROWS = 12;

function secureUnitInterval() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x100000000;
}

function rollWin(chance = WIN_CHANCE) {
  return secureUnitInterval() < chance;
}

function secureInt(maxExclusive) {
  return Math.floor(secureUnitInterval() * maxExclusive);
}

function diceWinChance(target) {
  return (100 - target) / 100;
}

function crashWinChanceContinuous(target) {
  return Math.min(1, HOUSE_RTP / target);
}

function missionWinChance(lanes) {
  return Math.pow(MISSION_SURVIVE, lanes);
}

function hiloHigherChance(rank) {
  return (HILO_RANKS - rank + 1) / HILO_RANKS;
}

function hiloLowerChance(rank) {
  return rank / HILO_RANKS;
}

function plinkoBinProbabilities(rows) {
  const probs = [];
  let coeff = 1;
  const denom = Math.pow(2, rows);
  for (let k = 0; k <= rows; k++) {
    probs.push(coeff / denom);
    coeff = (coeff * (rows - k)) / (k + 1);
  }
  return probs;
}

function roundMultiplier(m) {
  return Math.round(m * 100) / 100;
}

const PLINKO_BASE = {
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [24, 5, 3, 1.6, 1, 0.5, 0.3, 0.5, 1, 1.6, 3, 5, 24],
    high: [58, 11, 4, 2, 1.1, 0.6, 0.2, 0.6, 1.1, 2, 4, 11, 58],
  },
};

function plinkoMultipliers(rows, risk) {
  const base = PLINKO_BASE[rows]?.[risk] ?? PLINKO_BASE[12].medium;
  const probs = plinkoBinProbabilities(rows);
  const rawEv = base.reduce((sum, m, i) => sum + m * probs[i], 0);
  const scale = HOUSE_RTP / rawEv;
  return base.map((m) => roundMultiplier(m * scale));
}

function plinkoDrop(rows) {
  let bin = 0;
  for (let i = 0; i < rows; i++) {
    if (secureUnitInterval() < 0.5) bin++;
  }
  return bin;
}

// ---- Blackjack logic ----
function cardRank(code) { return (code % 13) + 1; }
function cardValue(code) { const r = cardRank(code); return r === 1 ? 11 : Math.min(r, 10); }
function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { const v = cardValue(c); total += v; if (v === 11) aces++; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}
function isBlackjack(cards) { return cards.length === 2 && handValue(cards).total === 21; }
function freshDeck() {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) { const j = secureInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function playDealer(state) {
  for (;;) {
    const { total, soft } = handValue(state.dealer);
    if (total > 17) break;
    if (total === 17 && !soft) break;
    const card = state.deck.shift();
    if (card === undefined) break;
    state.dealer.push(card);
  }
}
function resolveOutcome(state) {
  const p = handValue(state.player).total;
  const d = handValue(state.dealer).total;
  if (isBlackjack(state.player) && isBlackjack(state.dealer)) return "push";
  if (isBlackjack(state.player)) return "player_blackjack";
  if (isBlackjack(state.dealer)) return "dealer_win";
  if (p > 21) return "player_bust";
  if (d > 21) return "dealer_bust";
  if (p > d) return "player_win";
  if (p < d) return "dealer_win";
  return "push";
}

// ---- Simulation ----

const ROUNDS = 200;

function simulateCoinflip() {
  let wins = 0;
  for (let i = 0; i < ROUNDS; i++) {
    if (rollWin(COINFLIP_WIN_CHANCE)) wins++;
  }
  return wins;
}

function simulateMines() {
  let wins = 0;
  for (let i = 0; i < ROUNDS; i++) {
    if (rollWin(MINES_WIN_CHANCE)) wins++;
  }
  return wins;
}

function simulateDice() {
  let wins = 0;
  const target = DICE_DEFAULT_TARGET;
  const winChance = diceWinChance(target);
  for (let i = 0; i < ROUNDS; i++) {
    if (rollWin(winChance)) wins++;
  }
  return wins;
}

function simulateHighLow() {
  let wins = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const rank = 1 + secureInt(HILO_RANKS);
    // pick "higher" if rank <= 7, "lower" otherwise (simple strategy)
    const pick = rank <= 7 ? "higher" : "lower";
    const winChance = pick === "higher" ? hiloHigherChance(rank) : hiloLowerChance(rank);
    if (secureUnitInterval() < winChance) wins++;
  }
  return wins;
}

function simulateBlackjack() {
  let wins = 0;
  for (let i = 0; i < ROUNDS; i++) {
    const deck = freshDeck();
    const state = {
      deck,
      player: [deck.shift(), deck.shift()],
      dealer: [deck.shift(), deck.shift()],
      bet: 1,
      doubled: false,
      done: false,
    };
    // Simple strategy: hit until 17+
    while (handValue(state.player).total < 17 && handValue(state.player).total <= 21) {
      state.player.push(state.deck.shift());
    }
    if (handValue(state.player).total <= 21) {
      playDealer(state);
    }
    state.done = true;
    const outcome = resolveOutcome(state);
    if (outcome === "player_blackjack" || outcome === "player_win" || outcome === "dealer_bust") {
      wins++;
    }
  }
  return wins;
}

function simulateMission() {
  let wins = 0;
  const lanes = MISSION_DEFAULT_LANES;
  for (let i = 0; i < ROUNDS; i++) {
    let survived = true;
    for (let lane = 0; lane < lanes; lane++) {
      if (secureUnitInterval() >= MISSION_SURVIVE) {
        survived = false;
        break;
      }
    }
    if (survived) wins++;
  }
  return wins;
}

function simulateCrash() {
  let wins = 0;
  const target = CRASH_DEFAULT_TARGET;
  const winChance = crashWinChanceContinuous(target);
  for (let i = 0; i < ROUNDS; i++) {
    if (secureUnitInterval() < winChance) wins++;
  }
  return wins;
}

function simulatePlinko() {
  let wins = 0;
  const rows = PLINKO_DEFAULT_ROWS;
  const risk = "medium";
  const multipliers = plinkoMultipliers(rows, risk);
  const bet = 1;
  for (let i = 0; i < ROUNDS; i++) {
    const bin = plinkoDrop(rows);
    const mult = multipliers[bin];
    const payout = Math.floor(bet * mult);
    if (payout >= bet) wins++;
  }
  return wins;
}

// ---- Run all ----

console.log(`\nSimulating ${ROUNDS} rounds per game...\n`);
console.log("Game                  | Wins | Rate   | Target");
console.log("----------------------|------|--------|-------");

const games = [
  { name: "Coin Flip",           sim: simulateCoinflip,  target: "34%" },
  { name: "Mines",               sim: simulateMines,     target: "34%" },
  { name: "Dice (target=66)",    sim: simulateDice,      target: "34%" },
  { name: "High/Low (mixed)",    sim: simulateHighLow,   target: "~50% (variable)" },
  { name: "Blackjack (hit<17)",  sim: simulateBlackjack, target: "~40% (card game)" },
  { name: "Mission (3 lanes)",   sim: simulateMission,   target: "34%" },
  { name: "Crash (target=2.65)", sim: simulateCrash,     target: "34%" },
  { name: "Plinko (12r/med)",    sim: simulatePlinko,    target: "~39% (multiplier)" },
];

let allClose = true;
for (const g of games) {
  const wins = g.sim();
  const rate = ((wins / ROUNDS) * 100).toFixed(1);
  const padName = g.name.padEnd(21);
  const padWins = String(wins).padStart(4);
  const padRate = `${rate}%`.padStart(6);
  console.log(`${padName} | ${padWins} | ${padRate} | ${g.target}`);

  // For fixed-probability games, flag if way off
  if (g.target === "34%") {
    const r = wins / ROUNDS;
    if (r < 0.20 || r > 0.48) {
      console.log(`  ⚠  ${g.name} win rate ${rate}% is far from 34% target`);
      allClose = false;
    }
  }
}

console.log("\n" + (allClose ? "All fixed-probability games within expected range." : "Some games outside expected range — see warnings above."));
console.log("Note: High/Low and Blackjack have variable odds based on card logic.");
console.log("Note: Plinko win rate depends on multiplier tables, not a fixed probability.\n");
