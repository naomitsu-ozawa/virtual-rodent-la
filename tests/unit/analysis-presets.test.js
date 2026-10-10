import { describe, it, expect } from 'vitest';
import { FILTER_UNITS } from '../../docs/filter-units.js';
import {
  BUILTIN_PRESETS, FILTER_PARAM_NAMES, normalizeSnapshot, snapshotsEqual, isModified, saveUserPreset, renameUserPreset,
  deleteUserPreset, serializeUserPresets, parseUserPresets, mergeImportedPresets, loadUserPresets, persistUserPresets,
  USER_PRESETS_STORAGE_KEY, builtinPresetById,
} from '../../docs/analysis-presets.js';

const snap = () => normalizeSnapshot({
  filters: [{ key: 'bilateral', params: { strength: '0.80', spatialSigma: 1.2, sigmaHU: 50, passes: 2 } }],
  display: { windowCenter: 40, windowWidth: 400 },
  segments: { soft: { min: -50, max: 350 } },
});

describe('built-in presets', () => {
  it('has lung / fat / bone / soft, each valid and complete', () => {
    expect(BUILTIN_PRESETS.map(p => p.id)).toEqual(['lung', 'fat', 'bone', 'soft']);
    for (const p of BUILTIN_PRESETS) {
      const n = normalizeSnapshot(p);
      expect(n, p.id).toBeTruthy();
      expect(n.filters.length).toBeGreaterThan(0);
      for (const f of n.filters) {
        // every control the filter has is named (none keeps a stale value from before)
        const named = Object.keys(f.params).sort();
        const expected = FILTER_PARAM_NAMES[f.key].filter(x => x !== 'epsHU' && x !== 'mode').sort();
        expect(named.filter(x => x !== 'epsHU' && x !== 'mode'), p.id + ' ' + f.key).toEqual(expected);
        // HU parameters are inside the slider range of the filter
        for (const [name, def] of Object.entries(FILTER_UNITS[f.key]?.params || {})) {
          if (def.min == null) continue;
          expect(f.params[name], `${p.id} ${f.key}.${name}`).toBeGreaterThanOrEqual(def.min);
          expect(f.params[name], `${p.id} ${f.key}.${name}`).toBeLessThanOrEqual(def.max);
        }
      }
      expect(n.display.windowWidth).toBeGreaterThan(0);
      expect(Object.keys(n.segments).length).toBeGreaterThan(0);
    }
  });

  it('every preset starts with the bilateral filter at its own defaults; only the fat preset adds the sigmoid after it', () => {
    const bil = { key: 'bilateral', params: { strength: 0.8, spatialSigma: 1.2, sigmaHU: FILTER_UNITS.bilateral.params.sigmaHU.def, passes: 2 } };
    for (const p of BUILTIN_PRESETS) {
      expect(p.filters[0], p.id).toEqual(bil);
      if (p.id === 'fat') expect(p.filters, p.id).toEqual([bil, { key: 'sigmoid', params: { strength: 0.5, center: 0, width: 300 } }]);
      else expect(p.filters, p.id).toEqual([bil]);
    }
    // each preset holds its own copy (applying / editing one never changes another)
    expect(builtinPresetById('lung').filters[0]).not.toBe(builtinPresetById('fat').filters[0]);
  });

  it('the fat sigmoid leaves the fat mask unchanged: its centre is the fat / soft bound, the other bound lies outside its window', async () => {
    const fat = builtinPresetById('fat'), sig = fat.filters[1].params;
    // the sigmoid is monotonic and keeps its centre and everything outside centre +- width/2, so a bound there is a fixed point
    expect(sig.center).toBe(fat.segments.fat.max);
    expect(fat.segments.fat.min).toBeLessThanOrEqual(sig.center - sig.width / 2);
    const { cpuSigmoid } = await import('../../docs/cpu-filters.js');
    const xs = Float32Array.from({ length: 2001 }, (_, i) => i - 1000);
    const { data: ys } = await cpuSigmoid({ data: xs }, sig);
    const inFat = (v, r = fat.segments.fat) => v >= r.min && v <= r.max;
    for (let i = 0; i < xs.length; i++) expect(inFat(ys[i]), `x=${xs[i]}`).toBe(inFat(xs[i]));
  });

  it('segment ranges follow the measured sample1 valleys (fat / soft at 0, soft / bone at 350)', () => {
    expect(builtinPresetById('fat').segments.fat).toEqual({ min: -250, max: 0 });
    expect(builtinPresetById('soft').segments.soft).toEqual({ min: 0, max: 350 });
    expect(builtinPresetById('bone').segments.bone.min).toBe(350);
    expect(builtinPresetById('lung').segments.lung).toEqual({ min: -700, max: -150 });
    // the fat window brackets the fat (-98) and soft-tissue (+158) peaks
    const fat = builtinPresetById('fat').display;
    expect(fat.windowCenter - fat.windowWidth / 2).toBe(-250);
    expect(fat.windowCenter + fat.windowWidth / 2).toBe(250);
  });

  it('"no upper limit" segments are not capped at 3000 (sample2 bone reaches 6226)', () => {
    expect(builtinPresetById('bone').segments.bone.max).toBeGreaterThan(6226);
    expect(builtinPresetById('soft').segments.contrast.max).toBeGreaterThan(6226);
  });
});

describe('normalizeSnapshot', () => {
  it('turns strings into numbers and drops unknown filters, parameters and segments', () => {
    const s = normalizeSnapshot({
      filters: [{ key: 'evil', params: { a: 1 } }, { key: 'gaussian', params: { mode: 'gaussian', strength: '0.4', passes: 2, bogus: 9 } }],
      display: { windowCenter: '10', windowWidth: '200' }, segments: { bone: { min: 1, max: 2 }, nope: { min: 1, max: 2 }, lung: { min: 5, max: 1 } },
    });
    expect(s.filters).toEqual([{ key: 'gaussian', params: { mode: 'gaussian', strength: 0.4, passes: 2 } }]);
    expect(s.display).toEqual({ windowCenter: 10, windowWidth: 200 });
    expect(s.segments).toEqual({ bone: { min: 1, max: 2 } });
  });
  it('rejects a non-object and a window of zero width', () => {
    expect(normalizeSnapshot(null)).toBe(null);
    expect(normalizeSnapshot({ filters: [], display: { windowCenter: 0, windowWidth: 0 } }).display).toBe(null);
  });
});

describe('modified detection', () => {
  it('equal state is not modified, and tiny float noise is ignored', () => {
    const base = snap(), cur = snap();
    cur.display.windowCenter += 1e-6;
    expect(isModified(base, cur)).toBe(false);
  });
  it('a changed parameter, window, filter list or segment range is modified', () => {
    const base = snap();
    let c = snap(); c.filters[0].params.sigmaHU = 51; expect(isModified(base, c)).toBe(true);
    c = snap(); c.display.windowWidth = 401; expect(isModified(base, c)).toBe(true);
    c = snap(); c.filters.push({ key: 'sigmoid', params: { strength: 0.5, center: 0, width: 300 } }); expect(isModified(base, c)).toBe(true);
    c = snap(); c.filters = []; expect(isModified(base, c)).toBe(true);
    c = snap(); c.segments.soft.max = 340; expect(isModified(base, c)).toBe(true);
  });
  it('filter order matters', () => {
    const a = normalizeSnapshot({ filters: [{ key: 'bilateral', params: {} }, { key: 'sigmoid', params: {} }] });
    const b = normalizeSnapshot({ filters: [{ key: 'sigmoid', params: {} }, { key: 'bilateral', params: {} }] });
    expect(snapshotsEqual(a, b)).toBe(false);
  });
  it('a segment the preset does not name does not count', () => {
    const base = snap(), cur = snap();
    cur.segments.bone = { min: 350, max: 3000 };
    expect(isModified(base, cur)).toBe(false);
    delete cur.segments.soft; // the named one gone: changed
    expect(isModified(base, cur)).toBe(true);
  });
});

describe('user presets', () => {
  it('saves, overwrites by name (case-insensitive) and keeps the id', () => {
    let r = saveUserPreset([], '  My lung ', snap());
    expect(r.preset.name).toBe('My lung');
    const id = r.preset.id;
    const s2 = snap(); s2.display.windowCenter = -600;
    r = saveUserPreset(r.list, 'my LUNG', s2);
    expect(r.overwritten).toBe(true);
    expect(r.list).toHaveLength(1);
    expect(r.list[0].id).toBe(id);
    expect(r.list[0].display.windowCenter).toBe(-600);
  });
  it('refuses an empty name and a useless snapshot', () => {
    expect(saveUserPreset([], '   ', snap()).error).toBe('name');
    expect(saveUserPreset([], 'x', null).error).toBe('snapshot');
  });
  it('renames, refusing duplicates and empty names; deletes', () => {
    let l = saveUserPreset([], 'a', snap()).list;
    l = saveUserPreset(l, 'b', snap()).list;
    expect(renameUserPreset(l, l[0].id, 'B').error).toBe('duplicate');
    expect(renameUserPreset(l, l[0].id, '').error).toBe('name');
    expect(renameUserPreset(l, 'zzz', 'c').error).toBe('missing');
    const r = renameUserPreset(l, l[0].id, 'c');
    expect(r.list.map(p => p.name)).toEqual(['c', 'b']);
    expect(deleteUserPreset(r.list, l[0].id).map(p => p.name)).toEqual(['b']);
  });
});

describe('JSON export / import', () => {
  it('round-trips', () => {
    const l = saveUserPreset(saveUserPreset([], 'a', snap()).list, 'b', normalizeSnapshot(builtinPresetById('soft'))).list;
    const { presets, skipped } = parseUserPresets(serializeUserPresets(l));
    expect(skipped).toBe(0);
    expect(presets.map(p => p.name)).toEqual(['a', 'b']);
    const back = mergeImportedPresets([], presets).list;
    for (let i = 0; i < l.length; i++) expect(snapshotsEqual(back[i], l[i])).toBe(true);
  });
  it('merging overwrites a same name and appends the rest', () => {
    const l = saveUserPreset([], 'a', snap()).list;
    const other = snap(); other.display.windowCenter = 5;
    const r = mergeImportedPresets(l, [{ name: 'A', ...other }, { name: 'n', ...snap() }]);
    expect(r.replaced).toBe(1); expect(r.added).toBe(1);
    expect(r.list.find(p => p.name === 'a' || p.name === 'A').display.windowCenter).toBe(5);
  });
  it('rejects other JSON and skips broken entries', () => {
    expect(() => parseUserPresets('not json')).toThrow('format');
    expect(() => parseUserPresets('{"format":"x","presets":[]}')).toThrow('format');
    expect(() => parseUserPresets(JSON.stringify({ format: 'vrl-analysis-presets', version: 99, presets: [] }))).toThrow('version');
    const text = JSON.stringify({ format: 'vrl-analysis-presets', version: 1, presets: [{ name: '', filters: [] }, { name: 'ok', filters: [], display: { windowCenter: 1, windowWidth: 2 } }, 5] });
    const r = parseUserPresets(text);
    expect(r.presets.map(p => p.name)).toEqual(['ok']);
    expect(r.skipped).toBe(2);
  });
});

describe('localStorage', () => {
  const fake = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
  it('persists and loads', () => {
    const st = fake();
    const l = saveUserPreset([], 'a', snap()).list;
    expect(persistUserPresets(st, l)).toBe(true);
    expect(st.m.has(USER_PRESETS_STORAGE_KEY)).toBe(true);
    expect(loadUserPresets(st).map(p => p.name)).toEqual(['a']);
  });
  it('works without storage: throwing accessors, quota errors, corrupt data', () => {
    const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
    expect(loadUserPresets(boom)).toEqual([]);
    expect(persistUserPresets(boom, [])).toBe(false);
    expect(loadUserPresets(null)).toEqual([]);
    expect(persistUserPresets(null, [])).toBe(false);
    expect(loadUserPresets({ getItem: () => '{oops' })).toEqual([]);
  });
});
