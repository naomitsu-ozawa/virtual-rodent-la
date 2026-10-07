// VR automatic quality: a degradation ladder for the Auto resolution (build 482).
// Owner: Auto fell to 25 % and the picture became hard to see, worst with
// complex fat. Order of degradation: resolution down to MID (0.7), then the
// ray-march step 1 -> 1.5 -> 2 (the manual Detail setting is the lowest rung),
// and only then resolution down to the floor. Recovery runs in reverse.
// Pure logic (no THREE / DOM) so it can be tested with mocked timings.
export const AUTO_MAX = 1;
export const AUTO_MID = 0.7;
export const AUTO_FLOORS = [0.5, 0.35, 0.25]; // settings.autoMin index: 最低 50 % (default) / 35 % / 25 %
export const STEP_LEVELS = [1, 1.5, 2];
const OVER = 0.9;   // GPU time above this share of the frame budget counts as over
const UNDER = 0.8;  // a move up needs the predicted time at or below this share (dead band 0.8 .. 0.9)
const DOWN_N = 2;   // consecutive over samples before anything is lowered
const UP_N = 3;     // consecutive samples with headroom before anything is raised (GPU timer present)
const UP_N_BLIND = 6; // same with the wall-clock interval only (it is capped by the refresh rate: no headroom information)
const FAIL_MARGIN = 0.03; // a level this close to (or better than) one that failed under the same view is not retried
const FAIL_LAPSE = 120;   // samples (60 s) after which a failed level may be tried again

export const autoFloor = idx => AUTO_FLOORS[idx] ?? AUTO_FLOORS[0];

export function createAutoQuality({ min = AUTO_FLOORS[0], baseStep = 0, f = AUTO_MAX } = {}) {
  // build 487: optional discrete resolution levels (descending, for the direct-scale mode); null = continuous, exactly as before
  let levels = null;
  const lvDown = x => { for (const l of levels) if (l <= x + 1e-9) return l; return levels[levels.length - 1]; };
  const lvUp = x => { let r = null; for (const l of levels) if (l > x + 1e-6 && (r === null || l < r)) r = l; return r; };
  const st = { f, stepIdx: baseStep, min, baseStep, over: 0, good: 0, penalty: 1, sinceUp: 99, stable: 0, failPos: null, sinceFail: 0, ctx: null };
  const maxIdx = () => Math.max(STEP_LEVELS.length - 1, st.baseStep);
  const clampState = () => {
    st.min = Math.min(AUTO_MID, Math.max(0.05, st.min));
    st.stepIdx = Math.min(maxIdx(), Math.max(st.baseStep, st.stepIdx));
    st.f = Math.min(AUTO_MAX, Math.max(st.min, st.f));
  };
  clampState();
  // position on the ladder, growing with the load saved: resolution first (1 - f), then one unit per step level
  const posOf = c => (1 - c.f) + (c.stepIdx - st.baseStep);
  const mid = () => Math.max(st.min, AUTO_MID);
  // the next rung down from the present state, or null at the bottom
  const down = scale => {
    if (levels) return downLv(scale);
    if (st.stepIdx < maxIdx()) {
      if (st.f > mid() + 1e-6) return { f: Math.max(mid(), st.f * scale), stepIdx: st.stepIdx };
      return { f: st.f, stepIdx: st.stepIdx + 1 };
    }
    if (st.f > st.min + 1e-6) return { f: Math.max(st.min, st.f * scale), stepIdx: st.stepIdx };
    return null;
  };
  // levels mode: the same order of rungs, resolution moving to the next level at or below the wanted value (never to the same one)
  const downLv = scale => {
    const to = (lo) => { const f = Math.max(lo, lvDown(st.f * scale)); return f < st.f - 1e-9 ? { f, stepIdx: st.stepIdx } : null; };
    if (st.stepIdx < maxIdx()) {
      if (st.f > mid() + 1e-6) return to(mid());
      return { f: st.f, stepIdx: st.stepIdx + 1 };
    }
    return st.f > st.min + 1e-6 ? to(0) : null;
  };
  // the next rung up (reverse order), or null at the top
  const up = () => {
    if (levels) return upLv();
    if (st.stepIdx >= maxIdx() && st.f < mid() - 1e-6) return { f: Math.min(mid(), st.f * 1.15), stepIdx: st.stepIdx };
    if (st.stepIdx > st.baseStep) return { f: Math.max(st.f, mid()), stepIdx: st.stepIdx - 1 };
    if (st.f < AUTO_MAX - 1e-6) return { f: Math.min(AUTO_MAX, st.f * 1.15), stepIdx: st.stepIdx };
    return null;
  };
  const upLv = () => {
    const nx = lvUp(st.f);
    if (st.stepIdx >= maxIdx() && st.f < mid() - 1e-6) return nx !== null ? { f: Math.min(mid(), nx), stepIdx: st.stepIdx } : null;
    if (st.stepIdx > st.baseStep) return { f: Math.max(st.f, mid()), stepIdx: st.stepIdx - 1 };
    return nx !== null && st.f < AUTO_MAX - 1e-6 ? { f: nx, stepIdx: st.stepIdx } : null;
  };
  // predicted GPU time of a candidate state: the volume part scales with the
  // pixel count (f^2) and with 1/step; the rest of the frame stays
  const predict = (c, vol, rest) => {
    const px = (c.f / st.f) ** 2, stepR = STEP_LEVELS[st.stepIdx] / STEP_LEVELS[c.stepIdx];
    return rest + vol * px * stepR;
  };
  return {
    get f() { return st.f; },
    get stepIdx() { return st.stepIdx; },
    get state() { return { f: st.f, stepIdx: st.stepIdx, over: st.over, good: st.good, penalty: st.penalty }; },
    setFloor(m) { st.min = m; clampState(); },
    setBaseStep(i) { st.baseStep = i; clampState(); },
    // build 487: switch the resolution between continuous (null) and a descending list of levels; the present f is moved onto a level
    setLevels(l) { levels = l && l.length ? l : null; if (levels) { st.f = lvDown(st.f); clampState(); } },
    get levels() { return levels; },
    // sample: one 0.5 s window. volMs = GPU time of the low-resolution volume pass (0 when drawn directly),
    // mainMs = GPU time of the main pass (0 = no timer query: wall-clock interval only), interval = mean frame interval, budget = frame budget (ms)
    update({ volMs = 0, mainMs = 0, interval = 0, budget, ctx = null }) {
      // the view changed (size, shown segments, section): what failed before says nothing about it
      if (ctx !== st.ctx) { st.ctx = ctx; st.failPos = null; }
      if (st.failPos !== null && ++st.sinceFail >= FAIL_LAPSE) st.failPos = null;
      const gpu = mainMs > 0;
      const total = mainMs + (st.f < AUTO_MAX ? volMs : 0);
      const vol = st.f < AUTO_MAX && volMs > 0 ? volMs : total, rest = st.f < AUTO_MAX && volMs > 0 ? mainMs : 0;
      const dropping = interval > budget * 1.5; // frames are being dropped anyway
      const isOver = gpu ? (total > budget * OVER || dropping) : interval > budget * 1.12;
      const before = { f: st.f, stepIdx: st.stepIdx };
      let changed = false;
      st.sinceUp++;
      if (isOver) {
        st.over++; st.good = 0; st.stable = 0;
        if (st.over >= DOWN_N) {
          let scale = gpu ? Math.sqrt(Math.max(1, budget * UNDER - rest) / vol) : Math.sqrt(budget / interval);
          scale = Math.min(0.92, Math.max(0.7, scale));
          if (dropping) scale = Math.min(scale, 0.85);
          const c = down(scale);
          if (c) {
            st.failPos = posOf(before); st.sinceFail = 0; // this level is too heavy for the present view: do not climb back to it
            if (st.sinceUp <= 4) st.penalty = Math.min(4, st.penalty * 2); // a rise just before was too optimistic: wait longer next time
            st.f = c.f; st.stepIdx = c.stepIdx; changed = true;
          }
          st.over = 0;
        }
      } else {
        st.over = 0; st.stable++;
        if (st.stable >= 40 && st.penalty > 1) { st.penalty = 1; st.stable = 0; }
        const c = up();
        const blocked = c && st.failPos !== null && posOf(c) < st.failPos + FAIL_MARGIN;
        const ok = c && !blocked && (gpu ? predict(c, vol, rest) <= budget * UNDER : interval < budget * 1.04);
        if (ok) {
          st.good++;
          if (st.good >= Math.ceil((gpu ? UP_N : UP_N_BLIND) * st.penalty)) {
            st.f = c.f; st.stepIdx = c.stepIdx; changed = true; st.sinceUp = 0;
            st.good = c.stepIdx === before.stepIdx && gpu ? Math.ceil(UP_N * st.penalty) - 1 : 0; // small resolution rises chain (the prediction guards them); a step change waits
          }
        } else st.good = 0;
      }
      clampState();
      return { f: st.f, stepIdx: st.stepIdx, changed, stepChanged: st.stepIdx !== before.stepIdx };
    },
  };
}
