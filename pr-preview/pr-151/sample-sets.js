// Practice datasets hosted on this site (pure: no DOM, unit-tested).
// sample1 (rat) keeps its original base path and Cache Storage key, so users who already
// downloaded it do not download it again; later sets put their folder in the key.
export const SAMPLE_CACHE='virtual-rodent-sample-v1';
export const SAMPLE_SETS={
 sample1:{base:'demo/sample1/',keyPrefix:'/__vrl-sample/v1/'},
 sample2:{base:'demo/sample2/',keyPrefix:'/__vrl-sample/v1/sample2/'},
};
export const DEFAULT_SAMPLE='sample1';
export function sampleSet(id){return SAMPLE_SETS[id]||null}
function need(id){const s=sampleSet(id);if(!s)throw new Error('Unknown sample set: '+id);return s}
// slice URL (relative to the page) and the page-path-independent Cache Storage key
export function sampleSliceUrl(id,name){return need(id).base+encodeURIComponent(name)}
export function sampleCacheKey(origin,id,name){return origin+need(id).keyPrefix+encodeURIComponent(name)}
export function sampleIndexUrl(id){return need(id).base+'index.json'}
export function sampleProjectUrl(id){return need(id).base+'project.vrlab'}
