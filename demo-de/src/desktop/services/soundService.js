/* soundService — UI sounds. Reads volume from the store at call
 * time, so every producer agrees on the level (growth rule 2). */

import { store } from "../core/store.js";

export function playTestTone() {
  try {
    const volume = store.get().settings.volume;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.value = Math.max(0.02, (volume / 100) * 0.18);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    o.stop(ctx.currentTime + 0.5);
    return volume;
  } catch (err) {
    return store.get().settings.volume;
  }
}
