import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// build 468 (stage 2): the section handling of vr-view.js (a WebXR file, not run in node) is checked on its source
const src = readFileSync(new URL('../../docs/vr-view.js', import.meta.url), 'utf8');

describe('vr-view.js: sections are no longer grabbed (one-handed redesign, stage 2)', () => {
  it('the invisible plane board, the 20 cm proximity grab and the guide lines are gone', () => {
    for (const w of ['rayPlane', 'nearestPlane', 'planeDist', 'heldPlanes', 'takePlane', 'fixPlane', 'fixAll', 'userData.guide', 'userData.target', 'heldPlane', 'pl.hit', 'PlaneGeometry(2*h,2*h)']) {
      expect(src.includes(w), w).toBe(false);
    }
  });
  it('the 持ち方 setting is gone', () => {
    for (const w of ['secHold', 'L.hold', 'holdModes', 'helpHold']) expect(src.includes(w), w).toBe(false);
  });
  it('the old trigger resolution and the record button are gone', () => {
    for (const w of ['resolveTriggerMode', 'resolveTrigger(', 'recordPoint(null)', 'L.ptRec', 'L.ptNeed']) expect(src.includes(w), w).toBe(false);
  });
  it('the grip handler only moves the volume', () => {
    const a = src.indexOf("addEventListener('squeezestart'"), b = src.indexOf("addEventListener('selectstart'");
    const grip = src.slice(a, b);
    expect(grip).toContain('grabbing.add(c)');
    expect(grip).not.toMatch(/plane|Plane/);
  });
  it('the trigger uses the pure functions of vr-point.js', () => {
    for (const w of ['resolveTriggerTarget(', 'createTriggerPress()', 'dragShouldStart(', 'sectionDragStep(', 'createHoverPulse(', 'only:idx']) expect(src.includes(w), w).toBe(true);
  });
});
