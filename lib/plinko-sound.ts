/**
 * Lightweight Web Audio sound engine for Plinko. All sounds are synthesized at
 * runtime (no asset files), so it stays tiny and works on the edge runtime.
 * The AudioContext is created lazily on the first user gesture (browsers block
 * audio before then) and can be muted.
 */
export class PlinkoSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastPeg = 0;

  /** Must be called from a user gesture (e.g. the Bet click) to unlock audio. */
  resume() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  /** Short percussive tick when a ball clips a peg. */
  peg() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    // Throttle so a flurry of simultaneous balls doesn't turn into noise.
    const now = ctx.currentTime;
    if (now - this.lastPeg < 0.012) return;
    this.lastPeg = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420 + Math.random() * 180, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Chime when a ball lands in a bin. Higher multipliers play a higher, brighter
   * note so big wins sound rewarding and center/low bins sound dull.
   */
  land(multiplier: number) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const now = ctx.currentTime;

    // Map multiplier (~0.2 .. 1000) to a pitch over roughly two octaves.
    const t = Math.min(1, Math.log10(Math.max(0.2, multiplier) / 0.2) / 3.7);
    const base = 220 * Math.pow(2, t * 2.2);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + 0.32);

    // Sparkle harmonic for big wins.
    if (multiplier >= 2) {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = "triangle";
      o2.frequency.setValueAtTime(base * 2, now + 0.02);
      g2.gain.setValueAtTime(0.0001, now + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      o2.connect(g2).connect(master);
      o2.start(now + 0.02);
      o2.stop(now + 0.3);
    }
  }
}
