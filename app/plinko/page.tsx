"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { PlinkoSound } from "@/lib/plinko-sound";
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
  bin: number;
  multiplier: number;
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

/** Compact multiplier label so it always fits inside a narrow bin. */
function fmtMult(m: number): string {
  if (m >= 100) return Math.round(m).toString();
  if (m >= 10) return Math.round(m).toString();
  return parseFloat(m.toFixed(1)).toString();
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
  const [history, setHistory] = useState<number[]>([]);
  const [poppedBins, setPoppedBins] = useState<Set<number>>(new Set());
  const [muted, setMuted] = useState(false);
  const rafRef = useRef<number | null>(null);
  const soundRef = useRef<PlinkoSound | null>(null);
  const tickedRef = useRef<Set<string>>(new Set());
  const landedRef = useRef<Set<number>>(new Set());

  if (soundRef.current === null && typeof window !== "undefined") {
    soundRef.current = new PlinkoSound();
  }

  useEffect(() => {
    const saved = localStorage.getItem("plinko-muted") === "1";
    setMuted(saved);
  }, []);

  useEffect(() => {
    soundRef.current?.setMuted(muted);
  }, [muted]);

  const toggleMuted = () => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("plinko-muted", next ? "1" : "0");
      return next;
    });
  };

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
          if (!landedRef.current.has(b.id)) {
            landedRef.current.add(b.id);
            const m = data.multipliers[b.bin] ?? multipliers[b.bin];
            soundRef.current?.land(m);
            setHistory((h) => [m, ...h].slice(0, 14));
            const bin = b.bin;
            setPoppedBins((s) => new Set(s).add(bin));
            window.setTimeout(
              () =>
                setPoppedBins((s) => {
                  const n = new Set(s);
                  n.delete(bin);
                  return n;
                }),
              200
            );
          }
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
            const tk = `${b.id}-${seg}`;
            if (!tickedRef.current.has(tk)) {
              tickedRef.current.add(tk);
              soundRef.current?.peg();
            }
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
    soundRef.current?.resume();
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setError(null);
    setResult(null);
    setActiveBalls([]);
    setLitPegs(new Set());
    setBinCounts(new Array<number>(rows + 1).fill(0));
    tickedRef.current = new Set();
    landedRef.current = new Set();
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
      const plans = [planBall(0, data.bin as number, 0)];
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
    <div className="relative flex flex-1 flex-col items-center justify-center gap-3">
      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={toggleMuted}
        className="absolute right-1 top-1 z-10 rounded-md border border-[#2f4553] bg-[#0f212e]/80 px-2 py-1 text-sm text-[#b1bad3] hover:text-white"
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <div className="flex w-full flex-1 items-stretch justify-center gap-2">
      <svg
        viewBox={`0 0 100 ${geo.height}`}
        className="h-full max-h-[460px] w-full flex-1"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="ballGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff5d6" />
            <stop offset="45%" stopColor="#ffd34d" />
            <stop offset="100%" stopColor="#f5a300" />
          </radialGradient>
          <filter id="ballGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="0.7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* bins */}
        {multipliers.map((m, i) => {
          const w = geo.gapX * 0.86;
          const x = binX(i) - w / 2;
          const hit = (binCounts[i] ?? 0) > 0;
          const label = fmtMult(m);
          // Shrink the label so the number + "×" always fit within the bin.
          // The "×" renders at 0.7em, so it adds ~0.7 of a glyph in width.
          const glyphs = label.length + 0.8;
          const fitFont = (w * 0.92) / (glyphs * 0.6);
          const fontSize = Math.min(geo.gapX * 0.46, fitFont, 3.4);
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
                  transform: poppedBins.has(i)
                    ? "translateY(6px) scaleY(0.86)"
                    : hit
                      ? "translateY(2px)"
                      : "none",
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
              <text
                x={binX(i)}
                y={geo.boardH + geo.binH * 0.5}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight="700"
                fill="#07131c"
              >
                {label}
                <tspan fontSize={fontSize * 0.7}>×</tspan>
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
            filter="url(#ballGlow)"
          />
        ))}
      </svg>

        {/* recent results — Stake-style multiplier history */}
        <div className="flex w-14 flex-col gap-1 overflow-hidden py-1">
          {history.length === 0 && (
            <span className="text-center text-[10px] text-[#5b7388]">
              recent
            </span>
          )}
          {history.map((m, i) => (
            <div
              key={i}
              className="rounded-md py-1 text-center text-xs font-bold text-[#07131c]"
              style={{ background: binColor(m), opacity: 1 - i * 0.05 }}
            >
              {fmtMult(m)}×
            </div>
          ))}
        </div>
      </div>

      <div className="h-6 text-center">
        {result && (
          <p
            className={cn(
              "text-base font-semibold",
              result.result === "win" ? "text-[#00e701]" : "text-red-400"
            )}
          >
            {result.multiplier}× →{" "}
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
      subtitle="Drop the ball through the pegs — edge bins pay big, the middle pays small."
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
