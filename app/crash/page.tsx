"use client";

import { useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  CRASH_DEFAULT_TARGET,
  CRASH_MAX_TARGET,
  CRASH_MIN_TARGET,
  MAX_BET,
  MIN_BET,
  crashWinChanceContinuous,
  payoutMultiplier,
  roundMultiplier,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface CrashResult {
  result: "win" | "lose";
  target: number;
  crashPoint: number;
  profit: number;
  balance: number;
}

function CrashGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [targetText, setTargetText] = useState(CRASH_DEFAULT_TARGET.toFixed(2));
  const [running, setRunning] = useState(false);
  const [multi, setMulti] = useState(1);
  const [graph, setGraph] = useState<{
    d: string;
    area: string;
    tipX: number;
    tipY: number;
  } | null>(null);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const clampTarget = (n: number) =>
    Math.max(CRASH_MIN_TARGET, Math.min(CRASH_MAX_TARGET, n));
  const parsed = Number(targetText);
  const target = clampTarget(Number.isFinite(parsed) && parsed > 0 ? parsed : CRASH_MIN_TARGET);

  const winChance = crashWinChanceContinuous(target);
  const potential = roundMultiplier(payoutMultiplier(winChance));
  const canPlay = !running && coins !== null && coins >= bet;

  function animateTo(end: number, data: CrashResult) {
    const start = performance.now();
    const duration = 1200 + Math.min(end, 12) * 320;
    // Graph geometry in SVG user units (viewBox 0 0 100 100).
    const x0 = 8;
    const W = 86;
    const yBase = 90;
    const H = 80;
    const span = Math.max(0.0001, end - 1);
    const yOf = (v: number) => yBase - ((v - 1) / span) * H;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Exponential climb so the curve bends upward like a real crash graph.
      const value = Math.pow(end, t);
      setMulti(value);

      const N = 48;
      let d = "";
      for (let i = 0; i <= N; i++) {
        const s = (t * i) / N;
        const v = Math.pow(end, s);
        const x = x0 + s * W;
        const y = yOf(v);
        d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
      }
      const tipX = x0 + t * W;
      const tipY = yOf(value);
      const area = `${d}L${tipX.toFixed(2)} ${yBase} L${x0} ${yBase} Z`;
      setGraph({ d: d.trim(), area, tipX, tipY });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setMulti(end);
        setResult(data);
        setCoins(data.balance);
        setRunning(false);
        refresh();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setRunning(true);
    setMulti(1);
    setGraph(null);
    try {
      const res = await fetch("/api/games/crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setRunning(false);
        return;
      }
      const end = data.result === "win" ? data.target : data.crashPoint;
      animateTo(end, data);
    } catch {
      setError("Network error. Try again.");
      setRunning(false);
    }
  }

  const busted = result?.result === "lose";
  const won = result?.result === "win";

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={running}
      />

      <div className="mb-4">
        <span className="stake-label">Auto Cashout</span>
        <input
          type="number"
          className="stake-input"
          step={0.01}
          min={CRASH_MIN_TARGET}
          max={CRASH_MAX_TARGET}
          value={targetText}
          disabled={running}
          onChange={(e) => setTargetText(e.target.value)}
          onBlur={() => setTargetText(clampTarget(parsed > 0 ? parsed : CRASH_MIN_TARGET).toFixed(2))}
        />
        <p className="mt-1.5 text-xs text-[#5b7283]">
          Pays {potential.toFixed(2)}× • win chance {(winChance * 100).toFixed(1)}%
        </p>
      </div>

      <button type="button" className="stake-btn" disabled={!canPlay} onClick={play}>
        {running ? "Flying…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const stroke = busted ? "#ff3b3b" : won ? "#00e701" : "#ffd34d";

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="relative w-full max-w-[460px]">
        <svg
          viewBox="0 0 100 100"
          className="h-full max-h-[340px] w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="crashArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* horizontal grid lines */}
          {[18, 36, 54, 72, 90].map((y) => (
            <line
              key={y}
              x1={8}
              x2={94}
              y1={y}
              y2={y}
              stroke="#243447"
              strokeWidth={0.4}
            />
          ))}
          {/* baseline axis */}
          <line x1={8} x2={94} y1={90} y2={90} stroke="#33485e" strokeWidth={0.6} />

          {graph && (
            <>
              <path d={graph.area} fill="url(#crashArea)" />
              <path
                d={graph.d}
                fill="none"
                stroke={stroke}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={graph.tipX}
                cy={graph.tipY}
                r={busted ? 2.6 : 2}
                fill={stroke}
              >
                {running && (
                  <animate
                    attributeName="r"
                    values="1.6;2.4;1.6"
                    dur="0.7s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </>
          )}
        </svg>

        {/* multiplier read-out overlaid on the graph */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-6xl font-bold tabular-nums transition-colors drop-shadow",
              busted ? "text-red-500" : won ? "text-[#00e701]" : "text-white"
            )}
          >
            {multi.toFixed(2)}×
          </span>
        </div>
      </div>

      <div className="h-6 text-center">
        {won && (
          <p className="text-base font-semibold text-[#00e701]">
            Cashed out at {result.target.toFixed(2)}× — won +{result.profit} coins!
          </p>
        )}
        {busted && (
          <p className="text-base font-semibold text-red-400">
            Crashed at {result.crashPoint.toFixed(2)}× — lost{" "}
            {Math.abs(result.profit)} coins.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Crash"
      subtitle="Set your auto-cashout and ride the rocket before it busts."
      panel={panel}
      board={board}
    />
  );
}

export default function CrashPage() {
  return (
    <LoginGate>
      <CrashGame />
    </LoginGate>
  );
}
