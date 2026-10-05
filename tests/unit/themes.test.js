import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N } from '../../docs/i18n.js';
import {
  THEMES, THEME_IDS, THEME_STORAGE_KEY, DEFAULT_LIGHT_THEME, DEFAULT_DARK_THEME,
  isThemeId, themeMode, resolveInitialTheme, readStoredTheme, writeStoredTheme, applyTheme, createThemeController,
} from '../../docs/theme.js';

const read = p => readFileSync(p, 'utf8');
const themesCss = read('docs/themes.css'), styleCss = read('docs/style.css');

// ---- helpers: tokens of each theme from themes.css ----
const block = sel => {
  const i = themesCss.indexOf(sel + '{'); expect(i, sel).toBeGreaterThanOrEqual(0);
  return themesCss.slice(i, themesCss.indexOf('}', i));
};
const tokensOf = text => Object.fromEntries([...text.matchAll(/--ui-([\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const standard = tokensOf(block(':root,\n.viewport-card,\n.view-card'));
const themeTokens = id => id === 'dark-standard' ? standard : { ...standard, ...tokensOf(block('html[data-theme="' + id + '"]')) };
const rgbOf = v => v.split(/\s+/).map(Number);
const lum = ([r, g, b]) => { const f = c => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const x = lum(rgbOf(a)), y = lum(rgbOf(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---- fakes ----
const fakeStorage = (init = {}, { failGet = false, failSet = false } = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => { if (failGet) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; }, setItem: (k, v) => { if (failSet) throw new Error('blocked'); m.set(k, String(v)); }, _m: m };
};
const fakeDoc = () => { const meta = { content: '', setAttribute(k, v) { this.content = v; } }; return { documentElement: { dataset: {} }, querySelector: s => (s === 'meta[name="theme-color"]' ? meta : null), _meta: meta }; };
const fakeMedia = light => { const l = []; const mq = { matches: light, addEventListener: (t, f) => l.push(f), _fire(v) { mq.matches = v; l.forEach(f => f({ matches: v })); } }; return { fn: () => mq, mq }; };

describe('theme list', () => {
  it('has three light and three dark themes with unique ids and a name in both languages', () => {
    expect(THEMES.length).toBe(6);
    expect(new Set(THEME_IDS).size).toBe(6);
    expect(THEMES.filter(t => t.mode === 'light').length).toBe(3);
    expect(THEMES.filter(t => t.mode === 'dark').length).toBe(3);
    for (const t of THEMES) {
      expect(t.id.startsWith(t.mode + '-'), t.id).toBe(true);
      expect(t.ja.length).toBeGreaterThan(0); expect(t.en.length).toBeGreaterThan(0);
      const k = t.id.replace(/-/g, '_');
      expect(I18N.ja['theme_' + k], t.id).toBe(t.ja); expect(I18N.en['theme_' + k], t.id).toBe(t.en);
      expect(I18N.ja['themeDesc_' + k]).toBeTruthy(); expect(I18N.en['themeDesc_' + k]).toBeTruthy();
    }
    expect(THEMES.find(t => t.id === DEFAULT_DARK_THEME).mode).toBe('dark');
    expect(THEMES.find(t => t.id === DEFAULT_LIGHT_THEME).mode).toBe('light');
  });
  it('the UI has an option for every theme', () => {
    const ui = read('docs/ui-shell.js');
    for (const id of THEME_IDS) expect(ui).toContain('<option value="' + id + '" data-i18n="theme_' + id.replace(/-/g, '_') + '">');
  });
});

describe('saving and loading the choice', () => {
  it('round-trips through storage and ignores unknown values', () => {
    const s = fakeStorage();
    expect(readStoredTheme(s)).toBeNull();
    for (const id of THEME_IDS) { expect(writeStoredTheme(id, s)).toBe(true); expect(readStoredTheme(s)).toBe(id); }
    expect(s._m.get(THEME_STORAGE_KEY)).toBe(THEME_IDS.at(-1));
    expect(readStoredTheme(fakeStorage({ [THEME_STORAGE_KEY]: 'rainbow' }))).toBeNull();
  });
  it('never throws when storage is blocked (private window, cleared site data)', () => {
    expect(readStoredTheme(fakeStorage({}, { failGet: true }))).toBeNull();
    expect(writeStoredTheme('light-paper', fakeStorage({}, { failSet: true }))).toBe(false);
    expect(readStoredTheme(null)).toBeNull();
    const ctl = createThemeController({ storage: fakeStorage({}, { failGet: true, failSet: true }), matchMedia: fakeMedia(false).fn, doc: fakeDoc() });
    expect(ctl.get()).toBe('dark-standard');
    expect(ctl.set('light-cool')).toBe(true); // still applied for this session
    expect(ctl.get()).toBe('light-cool');
  });
});

describe('first visit follows the OS setting', () => {
  it('light OS -> light standard, dark or unknown OS -> dark standard, a saved choice always wins', () => {
    expect(resolveInitialTheme(null, true)).toBe('light-standard');
    expect(resolveInitialTheme(null, false)).toBe('dark-standard');
    expect(resolveInitialTheme('dark-navy', true)).toBe('dark-navy');
    expect(resolveInitialTheme('light-paper', false)).toBe('light-paper');
    expect(resolveInitialTheme('nonsense', true)).toBe('light-standard');
  });
  it('the controller applies the OS theme, then follows OS changes until the user chooses', () => {
    const doc = fakeDoc(), media = fakeMedia(true), storage = fakeStorage();
    const ctl = createThemeController({ storage, matchMedia: media.fn, doc });
    expect(ctl.get()).toBe('light-standard'); expect(doc.documentElement.dataset).toEqual({ theme: 'light-standard', themeMode: 'light' });
    expect(ctl.isChosen()).toBe(false); expect(storage._m.size).toBe(0); // following the OS stores nothing
    const seen = []; ctl.onChange((id, chosen) => seen.push([id, chosen]));
    media.mq._fire(false);
    expect(ctl.get()).toBe('dark-standard'); expect(doc.documentElement.dataset.themeMode).toBe('dark');
    ctl.set('light-paper');
    expect(storage._m.get(THEME_STORAGE_KEY)).toBe('light-paper'); expect(doc._meta.content).toBe(THEMES.find(t => t.id === 'light-paper').preview[0]);
    media.mq._fire(true); media.mq._fire(false); // the OS no longer matters
    expect(ctl.get()).toBe('light-paper');
    expect(seen).toEqual([['dark-standard', false], ['light-paper', true]]);
    expect(ctl.set('rainbow')).toBe(false);
  });
  it('a later visit starts from the saved choice', () => {
    const doc = fakeDoc();
    const ctl = createThemeController({ storage: fakeStorage({ [THEME_STORAGE_KEY]: 'dark-reading' }), matchMedia: fakeMedia(true).fn, doc });
    expect(ctl.get()).toBe('dark-reading'); expect(ctl.isChosen()).toBe(true); expect(doc.documentElement.dataset.theme).toBe('dark-reading');
  });
  it('applyTheme rejects unknown ids and themeMode follows the id', () => {
    expect(applyTheme('nope', fakeDoc())).toBe(false);
    expect(isThemeId('light-cool')).toBe(true); expect(themeMode('light-cool')).toBe('light'); expect(themeMode('dark-navy')).toBe('dark');
  });
  it('the inline script in index.html (set before the CSS loads) accepts every theme id and falls back like theme.js', () => {
    for (const f of ['docs/index.html', 'index.html']) {
      const html = read(f); const m = html.match(/<script>(try\{var t=localStorage[^<]*)<\/script>/); expect(m, f).toBeTruthy();
      const run = (stored, light) => {
        const root = { dataset: {} };
        new Function('localStorage', 'matchMedia', 'document', m[1])({ getItem: () => stored }, () => ({ matches: light }), { documentElement: root });
        return root.dataset;
      };
      for (const id of THEME_IDS) expect(run(id, false)).toEqual({ theme: id, themeMode: themeMode(id) });
      expect(run(null, true).theme).toBe('light-standard'); expect(run(null, false).theme).toBe('dark-standard'); expect(run('x', true).theme).toBe('light-standard');
      expect(html).toMatch(/themes\.css\?v=|\/docs\/themes\.css/);
    }
  });
});

describe('tokens', () => {
  it('every theme overrides the same tokens (nothing is left from another theme)', () => {
    const all = Object.keys(standard).filter(k => k !== 'img-bg' && k !== 'img-surround');
    for (const t of THEME_IDS) { const own = Object.keys(themeTokens(t)); for (const k of all) expect(own, t + ' ' + k).toContain(k); }
    for (const t of THEME_IDS.filter(x => x !== 'dark-standard')) {
      const own = tokensOf(block('html[data-theme="' + t + '"]'));
      for (const k of all) expect(own[k], t + ' ' + k).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });
  it('the preview colours in theme.js are the real tokens', () => {
    for (const t of THEMES) { const tk = themeTokens(t.id); const hex = ['s0', 's1', 'blue-bd', 't1'].map(k => '#' + rgbOf(tk[k]).map(n => n.toString(16).padStart(2, '0')).join('')); expect(t.preview, t.id).toEqual(hex); }
  });
  it('every var(--ui-*) in style.css is defined', () => {
    for (const m of (styleCss + read('docs/analysis-results.js')).matchAll(/var\(--ui-([\w-]+)\)/g)) expect(standard, m[1]).toHaveProperty(m[1]);
  });
});

describe('contrast (WCAG AA, 4.5:1) in all six themes', () => {
  // (text, background) pairs taken from the rules of style.css that set both, plus text-only rules against the surfaces
  const rules = [...styleCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));
  const pairs = new Map();
  const surfaces = ['s0', 's1', 's2', 's3'];
  for (const { sel, body } of rules) {
    const t = [...body.matchAll(/(?<![\w-])color\s*:\s*rgb\(var\(--ui-([\w-]+)\)/g)].map(m => m[1]);
    const b = [...body.matchAll(/(?<![\w-])background(?:-color)?\s*:[^;]*?rgb\(var\(--ui-([\w-]+)\)/g)].map(m => m[1]);
    for (const x of t) for (const y of b) pairs.set(x + '|' + y, sel);
    if (t.length && !b.length) for (const x of t) for (const s of surfaces) if (!pairs.has(x + '|' + s)) pairs.set(x + '|' + s, sel + ' (text on the surface)');
  }
  it('finds the pairs', () => { expect(pairs.size).toBeGreaterThan(30); });
  it.each(THEME_IDS)('%s: every text colour on its background is at least 4.5:1', id => {
    const tk = themeTokens(id), bad = [];
    for (const [k, sel] of pairs) { const [x, y] = k.split('|'); const c = contrast(tk[x], tk[y]); if (c < 4.5) bad.push(x + ' on ' + y + ' = ' + c.toFixed(2) + ' (' + sel.slice(0, 60) + ')'); }
    expect(bad).toEqual([]);
  });
  it.each(THEME_IDS)('%s: all five text levels on all five surfaces (strong text on raised surfaces)', id => {
    const tk = themeTokens(id);
    for (const t of ['t1', 't2', 't3', 't4', 't5']) for (const s of ['s0', 's1', 's2', 's3']) expect(contrast(tk[t], tk[s]), t + ' on ' + s).toBeGreaterThanOrEqual(4.5);
    for (const t of ['t1', 't2', 't3']) expect(contrast(tk[t], tk.s4), t + ' on s4').toBeGreaterThanOrEqual(4.5);
  });
  it.each(THEME_IDS)('%s: the themes differ from each other (not the same palette under another name)', id => {
    const tk = themeTokens(id); for (const o of THEME_IDS.filter(x => x !== id)) expect(tk.s1 + tk.t1, id + ' vs ' + o).not.toBe(themeTokens(o).s1 + themeTokens(o).t1);
  });
});

describe('the image area does not change with the theme', () => {
  it('view cards re-declare the standard tokens (so everything in them looks the same in every theme)', () => {
    const sel = themesCss.slice(0, themesCss.indexOf('{', themesCss.indexOf(':root,'))).split('*/').pop();
    expect(sel).toMatch(/:root,\s*\.viewport-card,\s*\.view-card/);
    expect(standard['img-bg']).toBe('15 18 20');
    // the html[data-theme] rules never set the image background
    for (const id of THEME_IDS.filter(x => x !== 'dark-standard')) expect(tokensOf(block('html[data-theme="' + id + '"]'))).not.toHaveProperty('img-bg');
  });
  it('the surround of the view cards is dark in every theme (a bright surround changes how grey levels look)', () => {
    const tk = id => tokensOf(block('html[data-theme="' + id + '"]'));
    for (const id of THEME_IDS.filter(x => x !== 'dark-standard')) {
      const sur = tk(id)['img-surround']; expect(sur, id).toBeTruthy();
      expect(lum(rgbOf(sur)), id).toBeLessThan(0.03);
    }
    expect(standard['img-surround']).toBe(standard.s0);
    expect(styleCss).toMatch(/\.viewer-grid\{background:rgb\(var\(--ui-img-surround\)\)/);
  });
  it('the canvases and the image backdrop use fixed colours, not theme tokens', () => {
    expect(styleCss).toMatch(/\.mpr-canvas\{[^}]*background:#020304/);
    expect(styleCss).toMatch(/\.viewport-card\{[^}]*background:rgb\(var\(--ui-img-bg\)\)/);
  });
  it('the code that draws images, segments and overlays knows nothing about themes', () => {
    for (const f of ['mpr-render', 'medical-volume', 'mpr3d-overlay', 'mpr-orthogonal', 'segments', 'segment-runs', 'scene3d', 'scene-view', 'surface-build', 'surface-mesh', 'gpu-shaders', 'gpu-compute', 'volume-io', 'vr-view', 'section-view']) {
      const t = read('docs/' + f + '.js');
      expect(t, f).not.toMatch(/data-theme|themeMode|theme\.js|theme-ui|--ui-|getComputedStyle/);
    }
    // the theme code touches only <html> attributes and the theme-color meta
    const th = (read('docs/theme.js') + read('docs/theme-ui.js')).replace(/\/\/[^\n]*/g, ''); // code, not comments
    expect(th).not.toMatch(/canvas|getContext|WebGL|gpu|segment|window.?level|windowCenter/i);
  });
  it('segment preset colours are data, not theme colours', () => {
    const seg = read('docs/segments.js');
    for (const c of ['#f3f0e8', '#d97f7f', '#e7c85d', '#6fb8d6']) expect(seg).toContain(c);
  });
});

describe('colours left as literals in style.css are the intended ones', () => {
  it('only overlay scrims, shadows, spinners and image-area colours stay literal', () => {
    const css = styleCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const lits = new Set([...css.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)].map(m => m[0].toLowerCase().replace(/\s/g, '')).filter(x => !/^rgba?\(var/.test(x)));
    const allowed = ['#020304', '#fff', '#0a84ff', '#3d8bfd', '#00b8d4', '#9bd7ee', 'rgba(5,8,10,.28)', 'rgba(5,8,10,.54)', 'rgba(5,8,10,.55)', 'rgba(93,141,255,.24)', 'rgba(0,229,255,.8)', 'rgba(0,229,255,.45)', 'rgba(255,255,255,.2)', 'rgba(255,255,255,.22)', 'rgba(255,255,255,.42)', 'rgba(255,255,255,.08)', 'rgba(105,184,216,.18)', 'rgba(128,128,128,.45)'];
    const extra = [...lits].filter(x => !allowed.includes(x) && !/^rgba\(0,0,0,[\d.]+\)$/.test(x) && !/^rgba\((118,141,151|110,130,140|216,230,236),[\d.]+\)$/.test(x));
    expect(extra).toEqual([]);
  });
});
