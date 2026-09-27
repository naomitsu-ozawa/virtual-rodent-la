// Device-local cache of per-segment filtered runs for volume analysis, so the
// first analysis click after reopening the same data with the same filter and
// segment settings needs no re-filtering. Stored in the GPU volume cache
// database (same LRU budget, cleared by the same "clear cache" button) as one
// packed blob per entry. Browser storage can be evicted; this is only a cache.
import { cacheKey } from './gpu-volume-cache.js?v=20260927-build238';
import { datasetFingerprint } from './project-file.js?v=20260927-build238';
import { volumeCache, volumeCacheBudget } from './gpu-volume-data.js?v=20260927-build238';
import { RUNS_FORMAT, packRuns, unpackRuns } from './run-pack.js?v=20260927-build238';

// Stable across sessions: dataset identity + filter + segment settings.
export function segmentRunsCacheKey(series,filterSignature,seg){
 return cacheKey({kind:'segment-runs',runsFormat:RUNS_FORMAT,dataset:datasetFingerprint(series),filter:filterSignature||'',
  segment:{min:seg.min,max:seg.max,opening:seg.opening,closing:seg.closing,minComponent:seg.minComponent,holeFill:!!seg.holeFill}});
}
export async function loadCachedSegmentRuns(key,slices){
 const cache=await volumeCache();if(!cache)return null;
 const hit=await cache.lookup(key);if(!hit||hit.info?.kind!=='segment-runs')return null;
 const bytes=await cache.read(key,0);if(!bytes)return null;
 const runs=unpackRuns(bytes,slices);if(!runs){try{await cache.remove(key)}catch{}}
 return runs;
}
export async function storeCachedSegmentRuns(key,runs){
 try{
  const cache=await volumeCache();if(!cache)return false;
  const bytes=packRuns(runs),writer=await cache.begin(key,{slices:1,bytesPerSlice:bytes.byteLength,info:{kind:'segment-runs'}});
  try{await writer.write(0,bytes);await writer.commit()}catch(e){await writer.abort();throw e}
  await cache.prune(await volumeCacheBudget(),{keep:key});return true;
 }catch(e){console.warn('Segment runs cache store failed.',e);return false}
}
