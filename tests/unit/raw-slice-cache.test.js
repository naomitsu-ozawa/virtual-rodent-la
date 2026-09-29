import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openVolumeCache } from '../../docs/gpu-volume-cache.js';
import { attachRawSliceCache, getRawSlice, putRawSlice, rawSliceCacheState } from '../../docs/raw-slice-cache.js';

let idb;
beforeEach(() => { idb = new IDBFactory(); });
const series = n => ({ slices: Array.from({ length: n }, (_, i) => ({ i })) });
const bytes = (n, v) => new Uint8Array(n).fill(v);
const settle = () => new Promise(r => setTimeout(r, 30));

describe('raw slice cache (build 320)', () => {
  it('first pass stores every slice, the next session reads them back in chunks', async () => {
    const cache = await openVolumeCache({ indexedDB: idb }), s = series(37);
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 8, budget: 1e9, info: { kind: 'raw' } });
    expect(rawSliceCacheState(s)).toBe('writing');
    expect(await getRawSlice(s.slices[0])).toBeNull();
    for (const m of s.slices) { putRawSlice(m, bytes(8, m.i)); await settle(); }
    expect(rawSliceCacheState(s)).toBe('hit');
    const s2 = series(37);
    await attachRawSliceCache(s2, { cache, key: 'k', sliceBytes: 8, budget: 1e9, info: { kind: 'raw' } });
    expect(rawSliceCacheState(s2)).toBe('hit');
    for (const i of [0, 15, 16, 36, 5]) expect([...await getRawSlice(s2.slices[i])]).toEqual([...bytes(8, i)]);
  });
  it('does not publish an incomplete entry, and skips slices while the write queue is full', async () => {
    const cache = await openVolumeCache({ indexedDB: idb }), s = series(40);
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: { kind: 'raw' } });
    for (const m of s.slices) putRawSlice(m, bytes(4, 1)); // 40 at once: only 16 are queued
    await settle();
    expect(rawSliceCacheState(s)).toBe('writing');
    expect(await cache.lookup('k')).toBeNull();
    for (const m of s.slices) { putRawSlice(m, bytes(4, 1)); await settle(); } // a later pass fills the gaps
    expect(rawSliceCacheState(s)).toBe('hit');
  });
  it('stays off when the data does not fit the budget', async () => {
    const cache = await openVolumeCache({ indexedDB: idb }), s = series(10);
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 100, budget: 500, info: {} });
    expect(rawSliceCacheState(s)).toBe('off');
  });
  it('a removed entry turns the cache off instead of failing the read', async () => {
    const cache = await openVolumeCache({ indexedDB: idb }), s = series(3);
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 2, budget: 1e9, info: {} });
    for (const m of s.slices) { putRawSlice(m, bytes(2, 7)); await settle(); }
    const s2 = series(3);await attachRawSliceCache(s2, { cache, key: 'k', sliceBytes: 2, budget: 1e9, info: {} });
    await cache.remove('k');
    expect(await getRawSlice(s2.slices[1])).toBeNull();
    expect(rawSliceCacheState(s2)).toBe('off');
  });
});
describe('raw slice cache resume (build 322)', () => {
  it('an incomplete entry is resumed when the data is opened again', async () => {
    const cache = await openVolumeCache({ indexedDB: idb }), s = series(20);
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: {} });
    for (const m of s.slices.slice(0, 12)) { putRawSlice(m, bytes(4, m.i)); await settle(); }
    expect(rawSliceCacheState(s)).toBe('writing');
    const s2 = series(20);
    await attachRawSliceCache(s2, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: {} });
    expect(s2.rawSliceCache.written.size).toBe(12);
    for (const m of s2.slices.slice(12)) { putRawSlice(m, bytes(4, m.i)); await settle(); }
    expect(rawSliceCacheState(s2)).toBe('hit');
    const s3 = series(20);
    await attachRawSliceCache(s3, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: {} });
    for (const i of [0, 11, 12, 19]) expect([...await getRawSlice(s3.slices[i])]).toEqual([...bytes(4, i)]);
  });
});
describe('raw slice cache backfill (build 323)', () => {
  it('reads and stores the missing slices in the background', async () => {
    const cache = await openVolumeCache({ indexedDB: idb });
    const mk = () => ({ slices: Array.from({ length: 10 }, (_, i) => ({ i, pixelOffset: 2, file: new Blob([new Uint8Array([9, 9, i, i, i, i])]) })) });
    const s = mk();
    await attachRawSliceCache(s, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: {} });
    putRawSlice(s.slices[3], bytes(4, 3));
    await new Promise(r => setTimeout(r, 4000));
    expect(rawSliceCacheState(s)).toBe('hit');
    const s2 = mk();
    await attachRawSliceCache(s2, { cache, key: 'k', sliceBytes: 4, budget: 1e9, info: {} });
    expect([...await getRawSlice(s2.slices[7])]).toEqual([7, 7, 7, 7]);
  }, 10000);
});
