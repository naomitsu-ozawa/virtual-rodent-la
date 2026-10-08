// GPU diagnostics helpers (pure, no imports): platform detection, GPU preference, error log, report text.
// The UI lives in gpu-diagnostics-ui.js. Everything here must stay importable from unit tests without a DOM.

// 'linux' | 'windows' | 'mac' | 'ios' | 'android' | 'other'. iPadOS reports a Macintosh UA, told apart by touch.
export function gpuPlatformOs(nav = globalThis.navigator) {
  try {
    const ua = String(nav?.userAgent || ''), p = String(nav?.userAgentData?.platform || nav?.platform || '');
    const touch = Number(nav?.maxTouchPoints) > 1;
    if (/iPhone|iPad|iPod/.test(ua) || (/Mac/.test(p + ua) && touch)) return 'ios';
    if (/Android/i.test(ua) || /^Android$/i.test(p)) return 'android';
    if (/CrOS/.test(ua)) return 'other';
    if (/^mac/i.test(p) || /Macintosh|Mac OS X/.test(ua)) return 'mac';
    if (/^win/i.test(p) || /Windows/.test(ua)) return 'windows';
    if (/linux|x11/i.test(p) || /Linux|X11/.test(ua)) return 'linux';
  } catch {}
  return 'other';
}
// The GPU choice is offered (and honoured) only on Linux / Windows desktops; Mac, iPad and others stay on 'auto'.
export function gpuPreferenceSupported(nav = globalThis.navigator) {
  const os = gpuPlatformOs(nav);
  return os === 'linux' || os === 'windows';
}
// 'auto' | 'high-performance' | 'low-power'; the stored value is ignored where the choice is not supported.
export function gpuEffectivePreference(stored, nav = globalThis.navigator) {
  if (!gpuPreferenceSupported(nav)) return 'auto';
  return stored === 'high-performance' || stored === 'low-power' ? stored : 'auto';
}

// requestAdapter option sets, tried in order. 'auto' is the historical list (high-performance first); an explicit
// preference only swaps the powerPreference that is asked for first.
export function gpuAdapterRequestOptions(forceCompat = false, preference = 'auto') {
  const pp = preference === 'low-power' ? 'low-power' : 'high-performance';
  const hp = { powerPreference: pp };
  return [...(forceCompat ? [] : [{ ...hp, featureLevel: 'core' }, hp, undefined]), { ...hp, featureLevel: 'compatibility' }, { featureLevel: 'compatibility' }];
}

// Small in-memory log of WebGPU failures (adapter / device / lost / uncaptured error) for the diagnostics view.
const GPU_LOG_MAX = 40;
const gpuLog = [];
export function logGpuError(source, error) {
  try {
    const e = error;
    const message = String(e?.message ?? e?.reason ?? e ?? '');
    const stack = typeof e?.stack === 'string' ? e.stack.split('\n').slice(0, 8).join('\n') : '';
    gpuLog.push({ time: new Date().toISOString(), source: String(source), message: message.slice(0, 600), stack });
    while (gpuLog.length > GPU_LOG_MAX) gpuLog.shift();
  } catch {}
}
export const getGpuErrorLog = () => gpuLog.slice();
export const clearGpuErrorLog = () => { gpuLog.length = 0; };

// Hint for adapters that look integrated / software (null when it looks discrete or unknown)
export function gpuAdapterKind(info) {
  if (!info) return '';
  const t = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ').toLowerCase();
  if (!t) return '';
  if (/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/.test(t)) return 'software';
  if (/intel|\bgen-?\d|xe-?lp|uhd|iris/.test(t) && !/arc\b|nvidia|amd|radeon|geforce/.test(t)) return 'integrated';
  return '';
}
// Honest note when the user asked for the high-performance GPU but got an integrated / software one
export function gpuPreferenceNote(preference, info) {
  const kind = gpuAdapterKind(info);
  return preference === 'high-performance' && kind ? kind : '';
}

const val = v => (v === undefined || v === null || v === '' ? '-' : String(v));
// data: {navigatorGpu, platform, userAgent, os, requested:{stored,effective,option,optionIndex}, adapter:{info,isFallback,limits,features}|null,
// mode, backend, errors:[{time,source,message,stack}], lastError, hint}. t: key -> label. Returns plain text.
const clip = (v, n) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// One-line essentials (no UA) so a truncated paste still keeps the key facts. Always < 180 chars.
export function buildGpuSummary(data) {
  const r = data.requested || {}, a = data.adapter, i = a?.info || {};
  const dev = clip(i.device || i.description || i.architecture, 32);
  const got = a ? (clip(i.vendor, 14) || '-') + (dev ? ' ' + dev : '') + ' fallback:' + (a.isFallback === undefined ? '?' : a.isFallback ? 'yes' : 'no') : 'なし';
  const err = data.lastError ? clip(data.lastError, 40) : 'なし';
  return ('GPU要約 b' + clip(data.build ?? '-', 8) + ' | WebGPU:' + (data.navigatorGpu ? '有' : '無') + ' | 要求:' + clip(r.effective || '-', 16) + ' | 取得:' + got + ' | 直近エラー:' + err).slice(0, 179);
}
export function buildGpuReport(data, t = k => k) {
  const L = [buildGpuSummary(data)], add = (k, v) => L.push(t(k) + ': ' + val(v));
  L.push('Virtual Rodent Lab - ' + t('gpuReportTitle'));
  add('gpuRepTime', data.time || new Date().toISOString());
  add('gpuRepBuild', data.build);
  add('gpuRepUa', data.userAgent);
  add('gpuRepPlatform', data.platform + (data.os ? ' (' + data.os + ')' : ''));
  add('gpuRepAvail', data.navigatorGpu ? t('gpuYes') : t('gpuNo'));
  const r = data.requested || {};
  add('gpuRepPrefStored', r.stored);
  add('gpuRepPrefEffective', r.effective);
  add('gpuRepPrefOption', r.option === undefined ? '-' : (r.option ? JSON.stringify(r.option) : '(no options)') + (r.optionIndex >= 0 ? ' #' + (r.optionIndex + 1) : ''));
  const a = data.adapter;
  if (a) {
    const i = a.info || {};
    add('gpuRepVendor', i.vendor); add('gpuRepArch', i.architecture); add('gpuRepDevice', i.device); add('gpuRepDesc', i.description);
    add('gpuRepFallback', a.isFallback === undefined ? '-' : (a.isFallback ? t('gpuYes') : t('gpuNo')));
    const lim = a.limits || {};
    add('gpuRepLimits', Object.keys(lim).map(k => k + '=' + lim[k]).join(', '));
    add('gpuRepFeatures', (a.features || []).join(', '));
  } else add('gpuRepAdapter', t('gpuNone'));
  add('gpuRepBackend', data.backend);
  add('gpuRepMode', data.mode);
  if (data.hint) add('gpuRepNote', data.hint);
  add('gpuRepLastError', data.lastError);
  const errs = data.errors || [];
  L.push(t('gpuRepErrors') + ' (' + errs.length + '):');
  for (const e of errs) { L.push('  [' + e.time + '] ' + e.source + ': ' + e.message); if (e.stack) L.push(e.stack.split('\n').map(s => '    ' + s).join('\n')); }
  return L.join('\n');
}
