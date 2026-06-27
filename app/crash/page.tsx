"use client";

import { useEffect, useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  CRASH_DEFAULT_TARGET,
  CRASH_MAX_TARGET,
  CRASH_MIN_TARGET,
  DEFAULT_BET,
  MAX_BET,
  MIN_BET,
  crashWinChanceContinuous,
  formatCoins,
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

type CrashPhase = "idle" | "running" | "win" | "lose";

/* ---------------------------------------------------------------------
   ROCKET SPRITES
   Drop idle.png / takeoff.png / flying.png into  public/crash/.
   If a file is missing, the premium glowing sphere is drawn instead.
--------------------------------------------------------------------- */
const ROCKET_SRC = {
  idle: "/crash/idle.png",
  takeoff: "/crash/takeoff.png",
  flying: "/crash/flying.png",
};
const ROCKET_LOOK = {
  idle: { h: 132, anchor: 0.34 },
  takeoff: { h: 104, anchor: 0.18 },
  flying: { h: 74, anchor: 0.0 },
};

/* =====================================================================
   CrashBoard — night-sky visual layer (DESIGN ONLY).
   It is driven entirely by the `multi` + `phase` props that come from the
   existing game logic; it never touches betting, fetching or payouts.
   ===================================================================== */
function CrashBoard({
  multi,
  phase,
}: {
  multi: number;
  phase: CrashPhase;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ multi, phase });
  stateRef.current = { multi, phase };

  useEffect(() => {
    const wrap = wrapRef.current;
    const bg = bgRef.current;
    const fg = fgRef.current;
    if (!wrap || !bg || !fg) return;
    const bgx = bg.getContext("2d");
    const fgx = fg.getContext("2d");
    if (!bgx || !fgx) return;

    let raf = 0;
    let W = 0,
      H = 0,
      DPR = 1;
    let stars: any[] = [];
    let dust: any[] = [];
    let shooting: any[] = [];
    let trail: any[] = [];
    let burst: any[] = [];
    let viewMaxY = 2;
    let shootTimer = 220;
    let prevPhase: CrashPhase = stateRef.current.phase;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // rocket images (optional)
    const imgs: Record<string, HTMLImageElement> = {};
    const ready: Record<string, boolean> = {
      idle: false,
      takeoff: false,
      flying: false,
    };
    (["idle", "takeoff", "flying"] as const).forEach((k) => {
      const im = new Image();
      im.onload = () => (ready[k] = true);
      im.src = ROCKET_SRC[k];
      imgs[k] = im;
    });

    const PAD = { l: 46, r: 24, t: 26, b: 34 };

    function initStars() {
      const count = Math.round((W * H) / 5200);
      stars = [];
      for (let i = 0; i < count; i++) {
        const layer = Math.random();
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: lerp(0.4, 1.7, layer),
          base: rand(0.25, 0.9),
          tw: rand(0.4, 1.6),
          ph: rand(0, Math.PI * 2),
          hue: Math.random() < 0.2 ? "cyan" : Math.random() < 0.25 ? "violet" : "white",
        });
      }
    }
    function initDust() {
      const count = Math.round((W * H) / 22000);
      dust = [];
      for (let i = 0; i < count; i++) {
        dust.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rand(0.6, 2.2),
          vx: rand(-0.12, 0.12),
          vy: rand(-0.25, -0.05),
          a: rand(0.05, 0.4),
          ph: rand(0, Math.PI * 2),
          tw: rand(0.3, 1.1),
          hue: Math.random() < 0.4 ? "cyan" : "blue",
        });
      }
    }

    function resize() {
      const r = wrap!.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      [bg!, fg!].forEach((cv) => {
        cv.width = W * DPR;
        cv.height = H * DPR;
      });
      bgx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      fgx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      initStars();
      initDust();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // ---- background ----
    function drawBg(t: number) {
      bgx!.clearRect(0, 0, W, H);
      for (const s of stars) {
        const tw = s.base + Math.sin(t * 0.001 * s.tw + s.ph) * 0.35;
        const a = Math.max(0.05, Math.min(1, tw));
        let col = `rgba(234,242,255,${a})`;
        if (s.hue === "cyan") col = `rgba(120,232,255,${a})`;
        if (s.hue === "violet") col = `rgba(176,150,255,${a})`;
        bgx!.beginPath();
        bgx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        bgx!.fillStyle = col;
        bgx!.shadowBlur = s.r * 4;
        bgx!.shadowColor = col;
        bgx!.fill();
      }
      bgx!.shadowBlur = 0;
      for (const p of dust) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) {
          p.y = H + 5;
          p.x = Math.random() * W;
        }
        if (p.x < -5) p.x = W + 5;
        if (p.x > W + 5) p.x = -5;
        const a = p.a * (0.6 + 0.4 * Math.sin(t * 0.001 * p.tw + p.ph));
        const col = p.hue === "cyan" ? `rgba(120,232,255,${a})` : `rgba(110,165,255,${a})`;
        bgx!.beginPath();
        bgx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        bgx!.fillStyle = col;
        bgx!.shadowBlur = 8;
        bgx!.shadowColor = col;
        bgx!.fill();
      }
      bgx!.shadowBlur = 0;
      // shooting stars
      if (--shootTimer <= 0) {
        const fromLeft = Math.random() < 0.5;
        shooting.push({
          x: fromLeft ? rand(-40, W * 0.4) : rand(W * 0.6, W + 40),
          y: rand(0, H * 0.5),
          vx: (fromLeft ? 1 : -1) * rand(6, 10),
          vy: rand(3, 5),
          life: 0,
          max: rand(45, 75),
        });
        shootTimer = rand(220, 520);
      }
      for (let i = shooting.length - 1; i >= 0; i--) {
        const sh = shooting[i];
        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.life++;
        const a = Math.sin((sh.life / sh.max) * Math.PI);
        const tx = sh.x - sh.vx * 6,
          ty = sh.y - sh.vy * 6;
        const g = bgx!.createLinearGradient(sh.x, sh.y, tx, ty);
        g.addColorStop(0, `rgba(180,240,255,${a})`);
        g.addColorStop(1, "rgba(180,240,255,0)");
        bgx!.strokeStyle = g;
        bgx!.lineWidth = 2;
        bgx!.lineCap = "round";
        bgx!.beginPath();
        bgx!.moveTo(sh.x, sh.y);
        bgx!.lineTo(tx, ty);
        bgx!.stroke();
        if (sh.life >= sh.max) shooting.splice(i, 1);
      }
    }

    // ---- graph helpers ----
    const multToY = (m: number) => {
      const t = (m - 1) / (viewMaxY - 1);
      return H - PAD.b - t * (H - PAD.b - PAD.t);
    };
    const fracToX = (f: number) => PAD.l + f * (W - PAD.l - PAD.r);

    function drawGrid() {
      fgx!.lineWidth = 1;
      fgx!.font = "11px Inter, system-ui, sans-serif";
      fgx!.textAlign = "right";
      fgx!.textBaseline = "middle";
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const m = 1 + (viewMaxY - 1) * (i / steps);
        const y = multToY(m);
        fgx!.strokeStyle = "rgba(120,160,255,0.08)";
        fgx!.beginPath();
        fgx!.moveTo(PAD.l, y);
        fgx!.lineTo(W - PAD.r, y);
        fgx!.stroke();
        fgx!.fillStyle = "rgba(142,162,204,0.55)";
        fgx!.fillText(m.toFixed(1) + "x", PAD.l - 8, y);
      }
    }

    function drawCurve(top: number, color: "blue" | "red" | "green") {
      const N = 60;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        const v = Math.pow(top, f);
        pts.push([fracToX(f), multToY(v)]);
      }
      const last = pts[pts.length - 1];
      // glow fill
      const baseCol =
        color === "red" ? "255,93,115" : color === "green" ? "70,240,168" : "69,230,255";
      const fill = fgx!.createLinearGradient(0, PAD.t, 0, H - PAD.b);
      fill.addColorStop(0, `rgba(${baseCol},0.22)`);
      fill.addColorStop(1, `rgba(${baseCol},0)`);
      fgx!.beginPath();
      fgx!.moveTo(pts[0][0], H - PAD.b);
      for (const p of pts) fgx!.lineTo(p[0], p[1]);
      fgx!.lineTo(last[0], H - PAD.b);
      fgx!.closePath();
      fgx!.fillStyle = fill;
      fgx!.fill();
      // line
      const lg = fgx!.createLinearGradient(PAD.l, 0, W - PAD.r, 0);
      if (color === "red") {
        lg.addColorStop(0, "rgba(255,93,115,0.5)");
        lg.addColorStop(1, "rgba(255,120,90,1)");
      } else if (color === "green") {
        lg.addColorStop(0, "rgba(70,240,168,0.6)");
        lg.addColorStop(1, "rgba(120,255,200,1)");
      } else {
        lg.addColorStop(0, "rgba(77,155,255,0.7)");
        lg.addColorStop(0.6, "rgba(69,230,255,1)");
        lg.addColorStop(1, "rgba(154,107,255,1)");
      }
      fgx!.lineJoin = "round";
      fgx!.lineCap = "round";
      fgx!.strokeStyle = lg;
      fgx!.lineWidth = 4;
      fgx!.shadowBlur = 18;
      fgx!.shadowColor = `rgba(${baseCol},0.7)`;
      fgx!.beginPath();
      fgx!.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) fgx!.lineTo(p[0], p[1]);
      fgx!.stroke();
      fgx!.shadowBlur = 0;
      return last;
    }

    function drawTrail() {
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const k = i / trail.length;
        const a = k * 0.5 * p.life;
        const r = lerp(1, 4, k) * p.life;
        fgx!.beginPath();
        fgx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        fgx!.fillStyle = `rgba(120,232,255,${a})`;
        fgx!.shadowBlur = 10;
        fgx!.shadowColor = "rgba(120,232,255,.6)";
        fgx!.fill();
        p.life *= 0.94;
      }
      fgx!.shadowBlur = 0;
      trail = trail.filter((p) => p.life > 0.05);
    }

    function spawnBurst(x: number, y: number) {
      for (let i = 0; i < 46; i++) {
        const ang = rand(0, Math.PI * 2),
          sp = rand(1, 7);
        burst.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 1,
          hue: Math.random() < 0.5 ? "255,93,115" : "255,150,90",
          r: rand(1.5, 3.5),
        });
      }
    }
    function drawBurst() {
      for (const b of burst) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.05;
        b.life *= 0.95;
        fgx!.beginPath();
        fgx!.arc(b.x, b.y, b.r * b.life, 0, Math.PI * 2);
        fgx!.fillStyle = `rgba(${b.hue},${b.life})`;
        fgx!.shadowBlur = 12;
        fgx!.shadowColor = `rgba(${b.hue},${b.life})`;
        fgx!.fill();
      }
      fgx!.shadowBlur = 0;
      burst = burst.filter((b) => b.life > 0.04);
    }

    function drawRocket(x: number, y: number, key: string, t: number) {
      const R = 17;
      const halo = fgx!.createRadialGradient(x, y, 0, x, y, R * 4);
      halo.addColorStop(0, "rgba(69,230,255,0.42)");
      halo.addColorStop(0.4, "rgba(77,155,255,0.16)");
      halo.addColorStop(1, "rgba(77,155,255,0)");
      fgx!.fillStyle = halo;
      fgx!.beginPath();
      fgx!.arc(x, y, R * 4, 0, Math.PI * 2);
      fgx!.fill();

      if (ready[key]) {
        const img = imgs[key];
        const ar = img.height ? img.width / img.height : 1;
        const look = (ROCKET_LOOK as any)[key] || { h: R * 4, anchor: 0 };
        const h = look.h,
          w = h * ar;
        fgx!.save();
        fgx!.shadowBlur = 24;
        fgx!.shadowColor = "rgba(69,230,255,.55)";
        fgx!.drawImage(img, x - w / 2, y - h / 2 - look.anchor * h, w, h);
        fgx!.restore();
        return;
      }
      // fallback: premium glowing sphere
      fgx!.save();
      fgx!.shadowBlur = 30;
      fgx!.shadowColor = "rgba(69,230,255,.8)";
      const body = fgx!.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.2, x, y, R);
      body.addColorStop(0, "#eaffff");
      body.addColorStop(0.25, "#9be8ff");
      body.addColorStop(0.6, "#3f9bff");
      body.addColorStop(1, "#1c4bd6");
      fgx!.fillStyle = body;
      fgx!.beginPath();
      fgx!.arc(x, y, R, 0, Math.PI * 2);
      fgx!.fill();
      fgx!.restore();
      const hi = fgx!.createRadialGradient(x - R * 0.4, y - R * 0.5, 0, x - R * 0.4, y - R * 0.5, R * 0.7);
      hi.addColorStop(0, "rgba(255,255,255,.9)");
      hi.addColorStop(1, "rgba(255,255,255,0)");
      fgx!.fillStyle = hi;
      fgx!.beginPath();
      fgx!.arc(x - R * 0.4, y - R * 0.5, R * 0.7, 0, Math.PI * 2);
      fgx!.fill();
    }

    function loop(now: number) {
      const st = stateRef.current;
      drawBg(now);

      // auto-zoom Y toward current multiplier
      const top = Math.max(1.0001, st.multi);
      const targetY =
        st.phase === "idle" ? 2.0 : Math.max(2.0, top * 1.18);
      viewMaxY = lerp(viewMaxY, targetY, 0.08);

      fgx!.clearRect(0, 0, W, H);
      drawGrid();

      // crash burst on transition into "lose"
      if (st.phase === "lose" && prevPhase !== "lose") {
        const tip = [fracToX(1), multToY(top)] as [number, number];
        spawnBurst(tip[0], tip[1]);
      }
      if (st.phase === "running" && prevPhase !== "running") {
        trail = [];
      }
      prevPhase = st.phase;

      if (st.phase === "idle") {
        const fy = Math.sin(now * 0.0025) * 6;
        drawTrail();
        drawRocket(fracToX(0), multToY(1) + fy, "idle", now);
      } else {
        const color = st.phase === "lose" ? "red" : st.phase === "win" ? "green" : "blue";
        const tip = drawCurve(top, color as any);
        if (st.phase === "running") {
          trail.push({ x: tip[0], y: tip[1], life: 1 });
          if (trail.length > 40) trail.shift();
        }
        drawTrail();
        if (st.phase === "lose") {
          drawBurst();
        } else {
          const key = st.phase === "running" && top < 1.18 ? "takeoff" : "flying";
          drawRocket(tip[0], tip[1], key, now);
        }
      }

      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const multColor =
    phase === "lose"
      ? "#ff5d73"
      : phase === "win"
      ? "#46f0a8"
      : phase === "running"
      ? "#9be8ff"
      : "#eaf2ff";
  const statusText =
    phase === "lose"
      ? "CRASHED"
      : phase === "win"
      ? "CASHED OUT"
      : phase === "running"
      ? "IN FLIGHT"
      : "PLACE YOUR BET";

  return (
    <div ref={wrapRef} className="crash-board">
      <div className="crash-grad" />
      <div className="crash-nebula" />
      <canvas ref={bgRef} className="crash-layer" />
      <canvas ref={fgRef} className="crash-game" />
      <div className="crash-rays" />
      <div className="crash-vignette" />
      <div className="crash-overlay">
        <span
          className="crash-mult tabular-nums"
          style={{ color: multColor }}
        >
          {multi.toFixed(2)}×
        </span>
        <span className={cn("crash-status", phase === "lose" && "crash-status-bad")}>
          {statusText}
        </span>
      </div>
    </div>
  );
}

function CrashGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(DEFAULT_BET);
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
  const phase: CrashPhase = running ? "running" : busted ? "lose" : won ? "win" : "idle";

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

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <CrashBoard multi={multi} phase={phase} />

      <div className="h-6 text-center">
        {won && result && (
          <p className="text-base font-semibold text-[#46f0a8]">
            Cashed out at {result.target.toFixed(2)}× — won +{formatCoins(result.profit)} coins!
          </p>
        )}
        {busted && result && (
          <p className="text-base font-semibold text-red-400">
            Crashed at {result.crashPoint.toFixed(2)}× — lost{" "}
            {formatCoins(Math.abs(result.profit))} coins.
          </p>
        )}
      </div>
    </div>
  );

  // `graph` is still computed by the existing logic; the visual layer reads
  // `multi`/`phase` instead, so the underlying game flow is unchanged.
  void graph;

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
