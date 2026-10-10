// App wiring of effective-hu.js (build 538): the real readers. Raw = the source slice (or the resident array); filtered = the
// filtered axial plane from source-filters.js (cached by filter signature / plane / index, the same path the MPR cards use).
import { sourceVolume, volume } from './state.js?v=20261010-build538';
import { sourceFilterStages, getFilteredSourcePlaneValues, getFilteredMemoryPlaneValues, getCachedSourceSlice } from './source-filters.js?v=20261010-build538';
import { createEffectiveReader } from './effective-hu.js?v=20261010-build538';

// the unfiltered volume the filters work on (memory volume: sourceVolume; source-backed: the volume itself)
export const rawHuVolume = () => sourceVolume || volume;
export const filtersActive = () => sourceFilterStages().length > 0;
export const readEffectiveSlice = createEffectiveReader({
  stageCount: () => sourceFilterStages().length,
  rawSlice(z, v) {
    const plane = v.columns * v.rows, arr = v.data || v.mprData;
    if (arr && arr.length >= plane * v.slices) return arr.subarray(z * plane, (z + 1) * plane);
    if (v.sourceBacked && v.series?.slices) return getCachedSourceSlice(v.series.slices[z]);
    throw new Error('slice ' + z + ' is not readable');
  },
  filteredSlice: (z, v) => (v.sourceBacked && v.series?.slices ? getFilteredSourcePlaneValues('axial', z, v.series, 'hu-analysis') : getFilteredMemoryPlaneValues('axial', z, v, null))
});
