// VR "direct scale" (experimental, build 487). The resolution is lowered by shrinking what the XR swapchain
// is drawn into, so the volume is still ray-marched straight into the XR framebuffer and the fixed foveated
// rendering (which Meta applies only to the XR swapchain, not to offscreen targets) stays active.
//   dynamic : XRView.requestViewportScale(s) — no reallocation, a different sub-rectangle of the same swapchain
//   fallback: framebufferScaleFactor at session start (three.js cannot change it while presenting)
// Pure logic (no THREE / DOM) so it can be tested.
export const DIRECT_LEVELS = [1, 0.85, 0.7, 0.6]; // coarse steps: each change costs a visible softening, so only a few
export const DIRECT_MIN_INTERVAL_MS = 2000;       // at least this long between two changes (the ladder's hysteresis comes on top)
export const DIRECT_START_AUTO = 0.7;             // fallback (session-start scale) when the resolution is Auto
export const DIRECT_FLOOR = 0.5;                  // a fixed resolution below this is not honoured

// the setting is OFF unless it is exactly 1 (a missing or old saved value keeps the current behaviour)
export const directScaleOn = settings => !!settings && settings.dscale === 1;

// XRView.requestViewportScale is optional in WebXR; without it only the session-start scale remains
export const viewportScaleSupported = (g = globalThis) => typeof g.XRView !== 'undefined' && !!g.XRView.prototype && typeof g.XRView.prototype.requestViewportScale === 'function';

// largest level at or below f (the lowest level when f is below all of them)
export const snapDown = (f, levels = DIRECT_LEVELS) => { let r = levels[levels.length - 1]; for (const l of levels) if (l <= f + 1e-9) { r = l; break; } return r; };
// smallest level above f, or null at the top
export const levelAbove = (f, levels = DIRECT_LEVELS) => { let r = null; for (const l of levels) if (l > f + 1e-6 && (r === null || l < r)) r = l; return r; };

// the scale to use for a fixed resolution choice (vres value 1 / 0.7 / 0.5) or, for Auto (0 / undefined), the given auto value
export const fixedScale = (res, auto = 1) => res ? Math.min(1, Math.max(DIRECT_FLOOR, res)) : auto;
// scale for the session-start fallback: the fixed resolution if one is chosen, else DIRECT_START_AUTO
export const startScale = res => fixedScale(res, DIRECT_START_AUTO);

// spacing of changes: ready(now) is true when at least minMs passed since the last mark()
export function createChangeGate(minMs = DIRECT_MIN_INTERVAL_MS) {
  let last = -Infinity;
  return { ready: now => now - last >= minMs, mark: now => { last = now; }, reset: () => { last = -Infinity; } };
}

// effective linear scale: the widest eye viewport seen is the 100 % reference
export const effectiveScale = (vpWidth, baseWidth) => baseWidth > 0 ? vpWidth / baseWidth : 1;
