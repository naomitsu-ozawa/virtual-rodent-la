import { describe, it, expect, beforeEach } from 'vitest';
import { gpuPlatformOs, gpuPreferenceSupported, gpuEffectivePreference, gpuAdapterRequestOptions, logGpuError, getGpuErrorLog, clearGpuErrorLog, buildGpuReport, buildGpuSummary, gpuPreferenceNote } from '../../docs/gpu-diagnostics.js';

const LINUX = { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130', userAgentData: { platform: 'Linux' }, maxTouchPoints: 0 };
const WIN = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', platform: 'Win32', maxTouchPoints: 0 };
const MAC = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 0 };
const IPAD = { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', platform: 'MacIntel', maxTouchPoints: 5 };
const IPHONE = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 };
const ANDROID = { userAgent: 'Mozilla/5.0 (Linux; Android 14)', userAgentData: { platform: 'Android' }, maxTouchPoints: 5 };

// the list of requestAdapter arguments before this setting existed
const HISTORIC = forceCompat => {
  const hp = { powerPreference: 'high-performance' };
  return [...(forceCompat ? [] : [{ ...hp, featureLevel: 'core' }, hp, undefined]), { ...hp, featureLevel: 'compatibility' }, { featureLevel: 'compatibility' }];
};

describe('platform detection', () => {
  it('classifies the common platforms', () => {
    expect(gpuPlatformOs(LINUX)).toBe('linux');
    expect(gpuPlatformOs(WIN)).toBe('windows');
    expect(gpuPlatformOs(MAC)).toBe('mac');
    expect(gpuPlatformOs(IPAD)).toBe('ios');
    expect(gpuPlatformOs(IPHONE)).toBe('ios');
    expect(gpuPlatformOs(ANDROID)).toBe('android');
  });
  it('offers the choice only on Linux / Windows', () => {
    expect([LINUX, WIN].map(gpuPreferenceSupported)).toEqual([true, true]);
    expect([MAC, IPAD, IPHONE, ANDROID, {}].map(gpuPreferenceSupported)).toEqual([false, false, false, false, false]);
  });
});

describe('gpuEffectivePreference', () => {
  it('defaults to auto everywhere', () => {
    for (const n of [LINUX, WIN, MAC, IPAD, IPHONE, ANDROID]) { expect(gpuEffectivePreference(undefined, n)).toBe('auto'); expect(gpuEffectivePreference('auto', n)).toBe('auto'); }
  });
  it('ignores a stored value on Mac / iPad', () => {
    for (const n of [MAC, IPAD, IPHONE]) for (const v of ['high-performance', 'low-power']) {
      expect(gpuEffectivePreference(v, n)).toBe('auto');
      expect(gpuAdapterRequestOptions(false, gpuEffectivePreference(v, n))).toEqual(HISTORIC(false));
    }
  });
  it('honours it on Linux / Windows and rejects junk', () => {
    expect(gpuEffectivePreference('low-power', LINUX)).toBe('low-power');
    expect(gpuEffectivePreference('high-performance', WIN)).toBe('high-performance');
    expect(gpuEffectivePreference('bogus', LINUX)).toBe('auto');
  });
});

describe('gpuAdapterRequestOptions with a preference', () => {
  it('auto reproduces the historic list exactly', () => {
    expect(gpuAdapterRequestOptions(false)).toEqual(HISTORIC(false));
    expect(gpuAdapterRequestOptions(true)).toEqual(HISTORIC(true));
    expect(gpuAdapterRequestOptions(false, 'auto')).toEqual(HISTORIC(false));
  });
  it('passes the chosen powerPreference first', () => {
    expect(gpuAdapterRequestOptions(false, 'low-power')[0]).toEqual({ powerPreference: 'low-power', featureLevel: 'core' });
    expect(gpuAdapterRequestOptions(false, 'low-power')[1]).toEqual({ powerPreference: 'low-power' });
    expect(gpuAdapterRequestOptions(false, 'high-performance')[0]).toEqual({ powerPreference: 'high-performance', featureLevel: 'core' });
    expect(gpuAdapterRequestOptions(true, 'low-power')[0]).toEqual({ powerPreference: 'low-power', featureLevel: 'compatibility' });
  });
});

describe('error log', () => {
  beforeEach(clearGpuErrorLog);
  it('records message and stack, capped', () => {
    logGpuError('requestDevice', new Error('boom'));
    logGpuError('x', 'plain string');
    const l = getGpuErrorLog();
    expect(l[0]).toMatchObject({ source: 'requestDevice', message: 'boom' });
    expect(l[0].stack).toContain('Error: boom');
    expect(l[1].message).toBe('plain string');
    for (let i = 0; i < 100; i++) logGpuError('s', i);
    expect(getGpuErrorLog().length).toBe(40);
    expect(getGpuErrorLog().at(-1).message).toBe('99');
  });
  it('never throws on odd values', () => { expect(() => { logGpuError('a', null); logGpuError('b', undefined); logGpuError('c', { get message() { throw new Error('x'); } }); }).not.toThrow(); });
});

describe('buildGpuReport', () => {
  const t = k => k;
  const data = {
    build: '503', userAgent: 'UA', platform: 'Linux', os: 'linux', navigatorGpu: true,
    requested: { stored: 'high-performance', effective: 'high-performance', option: { powerPreference: 'high-performance' }, optionIndex: 1 },
    adapter: { info: { vendor: 'intel', architecture: 'gen-12lp', device: '', description: 'UHD' }, isFallback: false, limits: { maxBufferSize: 123 }, features: ['a', 'b'] },
    backend: 'WEBGPU', mode: 'CORE', lastError: 'oops', hint: 'note', errors: [{ time: 'T', source: 'requestDevice', message: 'boom', stack: 'Error: boom\n at f' }]
  };
  it('contains the main facts as plain text', () => {
    const r = buildGpuReport(data, t);
    for (const s of ['UA', 'Linux (linux)', 'intel', 'gen-12lp', 'UHD', 'maxBufferSize=123', 'a, b', 'high-performance', '#2', 'oops', 'note', '[T] requestDevice: boom', 'Error: boom']) expect(r).toContain(s);
  });
  it('puts a compact summary on the first line', () => {
    const first = buildGpuReport(data, t).split('\n')[0];
    expect(first).toBe(buildGpuSummary(data));
    expect(first).toBe('GPU要約 b503 | WebGPU:有 | 要求:high-performance | 取得:intel UHD fallback:no | 直近エラー:oops');
    expect(first).not.toContain('UA');
    expect(first.length).toBeLessThan(180);
  });
  it('caps summary length with long values', () => {
    const long = 'x'.repeat(500);
    const s = buildGpuSummary({ ...data, build: long, lastError: long, requested: { effective: long }, adapter: { info: { vendor: long, device: long }, isFallback: true } });
    expect(s.length).toBeLessThan(180);
    expect(s).toContain('fallback:yes');
  });
  it('summary covers no-adapter / no-gpu', () => {
    const s = buildGpuSummary({ navigatorGpu: false, requested: {}, adapter: null, errors: [] });
    expect(s).toContain('WebGPU:無');
    expect(s).toContain('取得:なし');
    expect(s).toContain('直近エラー:なし');
  });
  it('works with no adapter and no gpu', () => {
    const r = buildGpuReport({ navigatorGpu: false, requested: {}, adapter: null, errors: [] }, t);
    expect(r).toContain('gpuRepAvail: gpuNo');
    expect(r).toContain('gpuRepAdapter: gpuNone');
  });
});

describe('gpuPreferenceNote', () => {
  it('flags high-performance requests that got integrated / software GPUs', () => {
    expect(gpuPreferenceNote('high-performance', { vendor: 'intel', architecture: 'gen-12lp' })).toBe('integrated');
    expect(gpuPreferenceNote('high-performance', { vendor: 'nvidia' })).toBe('');
    expect(gpuPreferenceNote('auto', { vendor: 'intel', architecture: 'gen-12lp' })).toBe('');
  });
});
