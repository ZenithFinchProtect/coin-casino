"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  MAX_BET,
  MIN_BET,
  hiloHigherChance,
  hiloLowerChance,
  payoutMultiplier,
  roundMultiplier,
} from "@/lib/games";
import { cn } from "@/lib/utils";

type Pick = "higher" | "lower";

const LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function Card({
  rank,
  flipped,
  tone,
}: {
  rank: number | null;
  flipped?: boolean;
  tone?: "win" | "lose" | null;
}) {
  return (
    <div
      className={cn(
        "flex h-40 w-28 items-center justify-center rounded-xl border-2 text-5xl font-bold transition-all",
        tone === "win"
          ? "border-[#00e701] bg-[#00e701]/10 text-[#00e701]"
          : tone === "lose"
            ? "border-red-500 bg-red-500/10 text-red-400"
            : "border-[#2f4553] bg-[#0f212e] text-white",
        flipped && "opacity-60"
      )}
    >
      {rank === null || flipped ? "?" : LABELS[rank]}
    </div>
  );
}

function HighLowGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [current, setCurrent] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deal() {
    setError(null);
    setOutcome(null);
    setNext(null);
    setMsg(null);
    try {
      const res = await fetch("/api/games/highlow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setCurrent(data.rank);
    } catch {
      setError("Network error. Try again.");
    }
  }

  useEffect(() => {
    deal();
  }, []);

  const higherMult = roundMultiplier(
    payoutMultiplier(hiloHigherChance(current ?? 7))
  );
  const lowerMult = roundMultiplier(
    payoutMultiplier(hiloLowerChance(current ?? 7))
  );
  const canPlay = !busy && current !== null && coins !== null && coins >= bet;

  async function guess(pick: Pick) {
    if (!canPlay || current === null) return;
    setError(null);
    setOutcome(null);
    setNext(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/games/highlow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, pick, rank: current }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setBusy(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 350));
      setNext(data.next);
      setOutcome(data.result);
      setCoins(data.balance);
      refresh();
      setMsg(
        data.result === "win"
          ? `${pick === "higher" ? "Higher" : "Lower"} hit — won +${data.profit} coins!`
          : `Missed — lost ${Math.abs(data.profit)} coins.`
      );
      // On a win the revealed card becomes the new base; on a loss redeal.
      setTimeout(() => {
        if (data.result === "win") {
          setCurrent(data.next);
          setNext(null);
          setOutcome(null);
        } else {
          deal();
        }
      }, 1400);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={busy}
      />
      <div className="grid grid-cols-1 gap-2.5">
        <button
          type="button"
          className="stake-btn flex items-center justify-center gap-2"
          disabled={!canPlay}
          onClick={() => guess("higher")}
        >
          <ArrowUp className="h-4 w-4" /> Higher · {higherMult.toFixed(2)}×
        </button>
        <button
          type="button"
          className="stake-btn stake-btn-secondary flex items-center justify-center gap-2"
          disabled={!canPlay}
          onClick={() => guess("lower")}
        >
          <ArrowDown className="h-4 w-4" /> Lower · {lowerMult.toFixed(2)}×
        </button>
      </div>
      <p className="mt-3 text-xs text-[#5b7283]">
        Higher wins if the next card is the same or higher; lower if same or
        lower.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold text-[#b1bad3]">Current</p>
          <Card rank={current} />
        </div>
        <div className="text-center">
          <p className="mb-2 text-xs font-semibold text-[#b1bad3]">Next</p>
          <Card rank={next} flipped={next === null} tone={outcome} />
        </div>
      </div>
      <div className="h-6 text-center">
        {msg && (
          <p
            className={cn(
              "text-base font-semibold",
              outcome === "win" ? "text-[#00e701]" : "text-red-400"
            )}
          >
            {msg}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="High / Low"
      subtitle="Call the next card higher or lower. Real card odds, house edge baked in."
      panel={panel}
      board={board}
    />
  );
}

export default function HighLowPage() {
  return (
    <LoginGate>
      <HighLowGame />
    </LoginGate>
  );
}
