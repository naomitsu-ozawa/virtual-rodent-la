import { describe, it, expect } from 'vitest';
import {
  WHEEL_SLOTS, WHEEL_ITEMS, DEFAULT_WHEEL, normalizeWheelItems, serializeWheelItems, parseWheelItems, setWheelItem, moveWheelItem, clearWheelItem,
  wheelAngles, wheelSlotFromAngle, wheelSlotFromLocal, createWheelStick, createButtonPress,
} from '../../docs/vr-ring.js';

describe('normalizeWheelItems', () => {
  const def = [...DEFAULT_WHEEL];
  it('bad input gives the default, as a new array', () => {
    for (const raw of [null, undefined, 'x', 5, {}, [null, null, null, null, null, null], ['nope', 'x', 3, null, null, null]]) {
      const r = normalizeWheelItems(raw); expect(r).toEqual(def); expect(r).not.toBe(DEFAULT_WHEEL);
    }
    expect(normalizeWheelItems(null)).not.toBe(normalizeWheelItems(null));
  });
  it('length 3 is padded, length 9 cut', () => {
    expect(normalizeWheelItems(['undo', 'home', 'menu'])).toEqual(['undo', 'home', 'menu', null, null, null]);
    expect(normalizeWheelItems(['undo', 'home', 'menu', 'screenshot', 'section-add', 'section-next', 'snap-axial', 'snap-coronal', 'menu'])).toHaveLength(WHEEL_SLOTS);
  });
  it('unknown ids and later duplicates become null', () => {
    expect(normalizeWheelItems(['undo', 'zzz', 'undo', 'home', null, null])).toEqual(['undo', null, null, 'home', null, null]);
  });
  it('catalog ids are unique', () => expect(new Set(WHEEL_ITEMS.map(i => i.id)).size).toBe(WHEEL_ITEMS.length));
});
describe('settings (de)serialization', () => {
  it('round trip', () => { const a = ['home', null, 'undo', null, null, 'menu']; expect(parseWheelItems(serializeWheelItems(a))).toEqual(a); });
  it('broken text or values fall back to the default', () => {
    for (const t of ['{bad', '', 'null', '"x"', undefined]) expect(parseWheelItems(t)).toEqual([...DEFAULT_WHEEL]);
    expect(serializeWheelItems('x')).toBe(JSON.stringify([...DEFAULT_WHEEL]));
  });
});
describe('edit helpers', () => {
  const a = ['undo', 'home', null, null, null, 'menu'];
  it('setWheelItem swaps a duplicate', () => {
    expect(setWheelItem(a, 2, 'menu')).toEqual(['undo', 'home', 'menu', null, null, null]);
    expect(setWheelItem(a, 3, 'screenshot')[3]).toBe('screenshot');
    expect(setWheelItem(a, 0, 'undo')).toEqual(a);
    expect(a[2]).toBeNull(); // input untouched
  });
  it('moveWheelItem wraps round', () => {
    expect(moveWheelItem(a, 5, 1)).toEqual(['menu', 'home', null, null, null, 'undo']);
    expect(moveWheelItem(a, 0, -1)).toEqual(['menu', 'home', null, null, null, 'undo']);
    expect(moveWheelItem(a, 0, 1)).toEqual(['home', 'undo', null, null, null, 'menu']);
  });
  it('clearWheelItem', () => expect(clearWheelItem(a, 1)).toEqual(['undo', null, null, null, null, 'menu']));
});
describe('wheelAngles', () => {
  it('6, 2, 3', () => {
    expect(wheelAngles(6)).toEqual([0, 60, 120, 180, 240, 300]); expect(wheelAngles(2)).toEqual([270, 90]); expect(wheelAngles(3)).toEqual([0, 120, 240]);
  });
});
describe('createWheelStick', () => {
  const en = [true, true, true, true, true, false];
  // stick vector at angle a (0 = up, clockwise) and magnitude m -> axes (ax, ay); up is negative ay
  const ax = (a, m) => [m * Math.sin(a * Math.PI / 180), -m * Math.cos(a * Math.PI / 180)];
  const feed = (s, a, m) => s.update(...ax(a, m), en);
  it('does not select until it has been at rest', () => {
    const s = createWheelStick();
    expect(feed(s, 0, 1)).toMatchObject({ highlight: null, changed: false, confirm: null });
    expect(feed(s, 0, 1).highlight).toBeNull();
    s.update(0, 0, en); expect(feed(s, 0, 1).highlight).toBe(0);
  });
  it('up = slot 0, 120 deg = slot 2', () => {
    const s = createWheelStick(); s.update(0, 0, en);
    expect(feed(s, 0, 1)).toMatchObject({ highlight: 0, changed: true });
    expect(feed(s, 120, 1).highlight).toBe(2);
  });
  it('hysteresis: +5 deg stays, +15 deg changes', () => {
    const s = createWheelStick(); s.update(0, 0, en); feed(s, 0, 1);
    expect(feed(s, 35, 1)).toMatchObject({ highlight: 0, changed: false });
    expect(feed(s, 45, 1)).toMatchObject({ highlight: 1, changed: true });
    expect(feed(s, 25, 1).highlight).toBe(1); // 30 - 5 stays
    expect(feed(s, 15, 1).highlight).toBe(0);
  });
  it('an empty sector clears the light and releasing there confirms nothing', () => {
    const s = createWheelStick(); s.update(0, 0, en); feed(s, 0, 1);
    expect(feed(s, 180 + 60 + 60, 1).highlight).toBeNull(); // 300 = empty slot 5 (more than 40 deg from slot 4)
    expect(feed(s, 300, 1).highlight).toBeNull();
    expect(s.update(0, 0, en).confirm).toBeNull();
  });
  it('keeps the light between 0.25 and 0.5, confirms once below 0.25', () => {
    const s = createWheelStick(); s.update(0, 0, en); feed(s, 120, 1);
    expect(feed(s, 120, 0.4).highlight).toBe(2);
    expect(feed(s, 120, 0.3).confirm).toBeNull();
    const r = feed(s, 120, 0.1); expect(r.confirm).toBe(2); expect(r.highlight).toBeNull();
    expect(feed(s, 120, 0.1).confirm).toBeNull();
  });
  it('changed on every new item', () => {
    const s = createWheelStick(); s.update(0, 0, en);
    let n = 0; for (const a of [0, 60, 120, 120, 180]) if (feed(s, a, 1).changed) n++;
    expect(n).toBe(4);
  });
});
describe('wheelSlotFromAngle / wheelSlotFromLocal', () => {
  it('angles', () => { const e = Array(6).fill(true); expect(wheelSlotFromAngle(359, 6, e)).toBe(0); expect(wheelSlotFromAngle(200, 6, e)).toBe(3); expect(wheelSlotFromAngle(200, 6, [true, true, true, false, true, true])).toBeNull(); });
  it('local: hole and margin are null, each angle maps', () => {
    const R = 0.055;
    expect(wheelSlotFromLocal(0, 0, 6, R)).toBeNull(); expect(wheelSlotFromLocal(0, 0.3 * R, 6, R)).toBeNull(); expect(wheelSlotFromLocal(0, 2 * R, 6, R)).toBeNull();
    wheelAngles(6).forEach((a, k) => expect(wheelSlotFromLocal(R * Math.sin(a * Math.PI / 180), R * Math.cos(a * Math.PI / 180), 6, R)).toBe(k));
    expect(wheelSlotFromLocal(-R, 0, 2, R)).toBe(0); expect(wheelSlotFromLocal(R, 0, 2, R)).toBe(1);
  });
});
describe('createButtonPress', () => {
  it('short before 500 ms', () => { const b = createButtonPress(); expect(b.update(true, 0)).toBeNull(); expect(b.update(true, 499)).toBeNull(); expect(b.update(false, 499)).toBe('short'); });
  it('long once at 500 ms, nothing on release', () => {
    const b = createButtonPress(); b.update(true, 0);
    expect(b.update(true, 500)).toBe('long'); expect(b.update(true, 900)).toBeNull(); expect(b.update(false, 1000)).toBeNull();
  });
  it('release at exactly 500 without a frame in between is not short; idle is null', () => {
    const b = createButtonPress(); expect(b.update(false, 0)).toBeNull(); b.update(true, 0); expect(b.update(false, 500)).toBeNull();
  });
});
