// Cache key of a segment's runs. Kept free of DOM-bound imports so the unit tests can use it directly.
// `filterSignature` (sourceFilterSignature) already carries every filter parameter, including the bilateral
// sigmaHU and the algorithm version (build 445), so changing either gives a different key.
import { cacheKey } from './gpu-volume-cache.js?v=20261007-build476';
import { datasetFingerprint } from './project-file.js?v=20261007-build476';
import { RUNS_FORMAT } from './run-pack.js?v=20261007-build476';

export function segmentRunsCacheKey(series,filterSignature,seg,extra=null){
 return cacheKey({kind:'segment-runs',runsFormat:RUNS_FORMAT,dataset:datasetFingerprint(series),filter:filterSignature||'',...(extra?{extra}:{}),
  segment:{min:seg.min,max:seg.max,opening:seg.opening,closing:seg.closing,minComponent:seg.minComponent,holeFill:!!seg.holeFill,surfaceMm:+seg.surfaceMm||0,thicknessMm:+seg.thicknessMm||0}});
}
