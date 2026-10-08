import { describe, it, expect } from 'vitest';
import { SAMPLE_SETS, DEFAULT_SAMPLE, sampleCacheKey, sampleSliceUrl, sampleIndexUrl, sampleProjectUrl } from '../../docs/sample-sets.js';

describe('practice dataset paths and cache keys', () => {
  it('keeps sample1 URLs and its existing cache key unchanged', () => {
    expect(DEFAULT_SAMPLE).toBe('sample1');
    expect(sampleIndexUrl('sample1')).toBe('demo/sample1/index.json');
    expect(sampleProjectUrl('sample1')).toBe('demo/sample1/project.vrlab');
    expect(sampleSliceUrl('sample1', 'a b.dcm')).toBe('demo/sample1/a%20b.dcm');
    expect(sampleCacheKey('https://x.io', 'sample1', 'a b.dcm')).toBe('https://x.io/__vrl-sample/v1/a%20b.dcm');
  });
  it('puts the folder in the sample2 key so equal file names do not collide', () => {
    const n = 'Sample_2_20250707_145808_0001.dcm';
    expect(sampleIndexUrl('sample2')).toBe('demo/sample2/index.json');
    expect(sampleProjectUrl('sample2')).toBe('demo/sample2/project.vrlab');
    expect(sampleSliceUrl('sample2', n)).toBe('demo/sample2/' + n);
    expect(sampleCacheKey('https://x.io', 'sample2', n)).toBe('https://x.io/__vrl-sample/v1/sample2/' + n);
    expect(sampleCacheKey('https://x.io', 'sample2', 'z.dcm')).not.toBe(sampleCacheKey('https://x.io', 'sample1', 'z.dcm'));
  });
  it('key prefixes are distinct across sets and an unknown set throws', () => {
    const prefixes = Object.values(SAMPLE_SETS).map(s => s.keyPrefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(() => sampleCacheKey('o', 'nope', 'a')).toThrow();
  });
});
