"use client";

import { useMemo, useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  MAX_BET,
  MIN_BET,
  PLINKO_DEFAULT_ROWS,
  PLINKO_RISKS,
  PLINKO_ROW_OPTIONS,
  PlinkoRisk,
  plinkoMultipliers,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface PlinkoResult {
  result: "win" | "lose";
  bins: number[];
  multipliers: number[];
  bet: number;
  payout: number;
  profit: number;
  balance: number;
}

function binColor(m: number): string {
  if (m >= 5) return "#ff003f";
  if (m >= 2) return "#ff7a00";
  if (m >= 1) return "#ffb800";
  return "#00e701";
}

interface ActiveBall {
  id: number;
  x: number;
  y: number;
}

interface BallPlan {
  id: number;
  delay: number;
  bin: number;
  // x position at each level (0 = apex .. rows = bin), and the peg column hit.
  xAt: number[];
  kAt: number[];
  jitter: number;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const FALL_TIME = 1.05; // seconds to fall through the peg field
const SETTLE_TIME = 0.38; // seconds to bounce/settle into the bin
const STAGGER = 0.16; // seconds between successive balls

function PlinkoGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [rows, setRows] = useState<number>(PLINKO_DEFAULT_ROWS);
  const [dropping, setDropping] = useState(false);
  const [activeBalls, setActiveBalls] = useState<ActiveBall[]>([]);
  const [litPegs, setLitPegs] = useState<Set<string>>(new Set());
  const [binCounts, setBinCounts] = useState<number[]>([]);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const multipliers = plinkoMultipliers(rows, risk);
  const canPlay = !dropping && coins !== null && coins >= bet;

  // Board geometry in SVG user units (viewBox is 0 0 100 H).
  const geo = useMemo(() => {
    const cx = 50;
    const topY = 6;
    const gapX = 90 / rows;
    const gapY = gapX;
    const pegR = Math.max(0.8, gapX * 0.13);
    const ballR = gapX * 0.32;
    const boardH = topY + rows * gapY;
    const binH = Math.max(8, gapX * 1.25);
    const height = boardH + binH + 2;
    return { cx, topY, gapX, gapY, pegR, ballR, boardH, binH, height };
  }, [rows]);

  const pegs = useMemo(() => {
    const out: { L: number; k: number; x: number; y: number }[] = [];
    for (let L = 0; L < rows; L++) {
      for (let k = 0; k <= L; k++) {
        out.push({
          L,
          k,
          x: geo.cx + (k - L / 2) * geo.gapX,
          y: geo.topY + L * geo.gapY,
        });
      }
    }
    return out;
  }, [rows, geo]);

  const binX = (b: number) => geo.cx + (b - rows / 2) * geo.gapX;

  function planBall(id: number, bin: number, delay: number): BallPlan {
    const dirs = new Array<number>(rows).fill(0);
    const idx = shuffle(Array.from({ length: rows }, (_, i) => i));
    for (let i = 0; i < bin; i++) dirs[idx[i]] = 1;
    const xAt: number[] = [];
    const kAt: number[] = [];
    let k = 0;
    xAt.push(geo.cx);
    kAt.push(0);
    for (let L = 0; L < rows; L++) {
      k += dirs[L];
      const level = L + 1;
      xAt.push(geo.cx + (k - level / 2) * geo.gapX);
      kAt.push(k);
    }
    return { id, delay, bin, xAt, kAt, jitter: (id % 5) * 0.6 - 1.2 };
  }

  function runAnimation(plans: BallPlan[], data: PlinkoResult) {
    const fallDist = rows * geo.gapY;
    const g = (2 * fallDist) / (FALL_TIME * FALL_TIME);
    const totalDur = FALL_TIME + SETTLE_TIME;
    const restY = geo.boardH + geo.binH * 0.5;
    const start = performance.now();

    const frame = (now: number) => {
      const tg = (now - start) / 1000;
      const render: ActiveBall[] = [];
      const lit = new Set<string>();
      let done = 0;

      for (const b of plans) {
        const t = tg - b.delay;
        if (t <= 0) {
          render.push({ id: b.id, x: geo.cx, y: geo.topY });
          continue;
        }
        if (t >= totalDur) {
          done++;
          render.push({ id: b.id, x: binX(b.bin) + b.jitter, y: restY });
          continue;
        }
        if (t <= FALL_TIME) {
          const fallen = Math.min(fallDist, 0.5 * g * t * t);
          const Lc = fallen / geo.gapY;
          const seg = Math.min(rows - 1, Math.floor(Lc));
          const p = Lc - seg;
          const ss = p * p * (3 - 2 * p);
          const x0 = b.xAt[seg];
          const x1 = b.xAt[Math.min(seg + 1, rows)];
          const x = x0 + (x1 - x0) * ss;
          // small hop over each peg for a lively bounce
          const y = geo.topY + fallen - Math.sin(p * Math.PI) * geo.gapY * 0.16;
          render.push({ id: b.id, x, y });
          if (seg >= 0 && seg < rows && p > 0.45) {
            lit.add(`${seg}-${b.kAt[seg]}`);
          }
        } else {
          // settle into the bin with a damped bounce
          const st = (t - FALL_TIME) / SETTLE_TIME;
          const bounce =
            Math.abs(Math.sin(st * Math.PI * 1.5)) * (1 - st) * geo.gapX * 0.7;
          render.push({ id: b.id, x: binX(b.bin) + b.jitter, y: restY - bounce });
        }
      }

      setActiveBalls(render);
      setLitPegs(lit);
      setBinCounts(() => {
        const c = new Array<number>(rows + 1).fill(0);
        for (const b of plans) {
          if (tg - b.delay >= totalDur) c[b.bin]++;
        }
        return c;
      });

      if (done >= plans.length) {
        setResult(data);
        setCoins(data.balance);
        setDropping(false);
        refresh();
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  }

  async function play() {
    if (!canPlay) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setError(null);
    setResult(null);
    setActiveBalls([]);
    setLitPegs(new Set());
    setBinCounts(new Array<number>(rows + 1).fill(0));
    setDropping(true);
    try {
      const res = await fetch("/api/games/plinko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, risk, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setDropping(false);
        return;
      }
      const plans = (data.bins as number[]).map((bin, i) =>
        planBall(i, bin, i * STAGGER)
      );
      runAnimation(plans, data);
    } catch {
      setError("Network error. Try again.");
      setDropping(false);
    }
  }

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={dropping}
      />
      <p className="-mt-2 mb-4 text-xs text-[#7a91a8]">
        Drops <span className="font-semibold text-[#b1bad3]">{bet}</span>{" "}
        {bet === 1 ? "ball" : "balls"} — one per coin.
      </p>
      <div className="mb-4">
        <span className="stake-label">Risk</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PLINKO_RISKS.map((r) => (
            <button
              key={r}
              type="button"
              className="stake-chip capitalize"
              data-active={risk === r}
              disabled={dropping}
              onClick={() => setRisk(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <span className="stake-label">Rows</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PLINKO_ROW_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className="stake-chip"
              data-active={rows === r}
              disabled={dropping}
              onClick={() => setRows(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="stake-btn" disabled={!canPlay} onClick={play}>
        {dropping ? "Dropping…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <svg
        viewBox={`0 0 100 ${geo.height}`}
        className="h-full max-h-[460px] w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="ballGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff5d6" />
            <stop offset="45%" stopColor="#ffd34d" />
            <stop offset="100%" stopColor="#f5a300" />
          </radialGradient>
        </defs>

        {/* bins */}
        {multipliers.map((m, i) => {
          const w = geo.gapX * 0.86;
          const x = binX(i) - w / 2;
          const hit = (binCounts[i] ?? 0) > 0;
          return (
            <g key={i}>
              <rect
                x={x}
                y={geo.boardH}
                width={w}
                height={geo.binH}
                rx={geo.gapX * 0.16}
                fill={binColor(m)}
                opacity={hit ? 1 : 0.92}
                style={{
                  transition: "transform 120ms",
                  transform: hit ? "translateY(2px)" : "none",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
              <text
                x={binX(i)}
                y={geo.boardH + geo.binH * 0.62}
                textAnchor="middle"
                fontSize={Math.min(geo.gapX * 0.42, 3.4)}
                fontWeight="700"
                fill="#07131c"
              >
                {m}×
              </text>
            </g>
          );
        })}

        {/* pegs */}
        {pegs.map((p) => {
          const lit = litPegs.has(`${p.L}-${p.k}`);
          return (
            <circle
              key={`${p.L}-${p.k}`}
              cx={p.x}
              cy={p.y}
              r={lit ? geo.pegR * 1.7 : geo.pegR}
              fill={lit ? "#ffffff" : "#7d97ac"}
              style={{ transition: "r 80ms, fill 80ms" }}
            />
          );
        })}

        {/* balls */}
        {activeBalls.map((b) => (
          <circle
            key={b.id}
            cx={b.x}
            cy={b.y}
            r={geo.ballR}
            fill="url(#ballGrad)"
            stroke="#fff3c4"
            strokeWidth={geo.ballR * 0.12}
          />
        ))}
      </svg>

      <div className="h-6 text-center">
        {result && (
          <p
            className={cn(
              "text-base font-semibold",
              result.result === "win" ? "text-[#00e701]" : "text-red-400"
            )}
          >
            {result.bet} {result.bet === 1 ? "ball" : "balls"} →{" "}
            {result.profit >= 0
              ? `won +${result.profit} coins!`
              : `lost ${Math.abs(result.profit)} coins.`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Plinko"
      subtitle="One ball per coin. Drop them through the pegs — edge bins pay big, the middle pays small."
      panel={panel}
      board={board}
    />
  );
}

export default function PlinkoPage() {
  return (
    <LoginGate>
      <PlinkoGame />
    </LoginGate>
  );
}
