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

describe('vr-view.js: ring menus, undo and the removed left-hand panel (stage 3)', () => {
  it('the left-hand panel and the menu tag as a laser target are gone; the cue stays as a plain plane', () => {
    for (const w of ['panelHit', 'panel.onDraw', 'panelKey', 'badgeHit', 'bd.badge', 'bd.panel', 'makeMenu(640', 'undoDelete', 'vpDeleted']) expect(src.includes(w), w).toBe(false);
    expect(src).toContain("c.add(badge)");
    expect(src).toContain('X：よく使う／長押し：メニュー');
    expect(src).toContain('X: quick / hold: menu');
  });
  it('the 位置 tab no longer has the mode switch or the record button', () => {
    expect(src.includes('L.ptMode,')).toBe(false);
    expect(src.includes('L.ptRec')).toBe(false);
  });
  it('the ring items are saved in the settings with a fallback to the defaults', () => {
    expect(src).toContain('wheel:[...DEFAULT_WHEEL]');
    expect(src).toContain('v.wheel=normalizeWheelItems(v.wheel)');
    expect(src).toContain('saveSettings(settings)');
  });
  it('A/X goes through createButtonPress (short = ring, long = menu)', () => {
    expect(src).toContain('createButtonPress()');
    expect(src).toContain('onAxShort(c)');
    expect(src).toContain('onAxLong(c)');
  });
  it('the point comment is behind a localStorage flag that is off by default', () => {
    expect(src).toMatch(/VR_POINT_COMMENT=\(\(\)=>\{try\{return localStorage\.getItem\('vrl-vr-point-comment'\)==='1'\}catch\{return false\}\}\)\(\)/);
  });
  it('record, delete and move are put on the undo stack', () => {
    for (const w of ["undo.push({type:'add'", "undo.push({type:'delete'", "undo.push({type:'move'", 'createUndoStack()']) expect(src.includes(w), w).toBe(true);
  });
});
