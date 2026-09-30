// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { volume, incNextSegmentMaskVolumeId } from './state.js?v=20260930-build375';
import { hexRgb } from './utils.js?v=20260930-build375';
import { buildThresholdMask, morphMask, fillMaskHoles, removeSmallMaskComponents } from './mask-ops.js?v=20260930-build375';
import { thinSuppressActive, suppressThinMask } from './thin-suppress.js?v=20260930-build375';
export const SEGMENT_PRESET_ORDER=['bone','soft','fat','lung'];
export const segmentEditState=Object.fromEntries(SEGMENT_PRESET_ORDER.map(key=>[key,{baseRuns:null,baseSignature:'',keepRuns:null,excludeRuns:null,cutRuns:null,finalRuns:null,revision:0,undo:[],redo:[],surfaceGroup:null,rawCutSurface:false}]));
export const segmentState={
 bone:{active:false,enabled:false,color:'#f3f0e8',opacity:.85,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 soft:{active:false,enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 fat:{active:false,enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 lung:{active:false,enabled:false,color:'#6fb8d6',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''}
};
export const segmentMaskVolumeIds=new WeakMap();
export function segmentMaskVolumeId(v){
 let id=segmentMaskVolumeIds.get(v);if(!id){id=incNextSegmentMaskVolumeId(false);segmentMaskVolumeIds.set(v,id)}return id;
}
export function segmentNeedsGlobalMask(seg){return seg.opening>0||seg.closing>0||seg.holeFill||seg.minComponent>0||thinSuppressActive(seg)}
export function getProcessedSegmentMask(v,seg){
 const key=[segmentMaskVolumeId(v),seg.min,seg.max,seg.opening,seg.closing,seg.minComponent,seg.holeFill,seg.surfaceMm,seg.thicknessMm].join('|');if(seg._maskCache&&seg._maskCacheKey===key)return seg._maskCache;
 const w=v.columns,h=v.rows,d=v.slices;let mask=buildThresholdMask(v,seg);
 if(thinSuppressActive(seg))mask=suppressThinMask(mask,v.data,w,h,d,v.spacing||[1,1,1],seg);
 if(seg.opening>0){mask=morphMask(mask,w,h,d,seg.opening,false);mask=morphMask(mask,w,h,d,seg.opening,true)}
 if(seg.closing>0){mask=morphMask(mask,w,h,d,seg.closing,true);mask=morphMask(mask,w,h,d,seg.closing,false)}
 if(seg.holeFill)mask=fillMaskHoles(mask,w,h,d);
 if(seg.minComponent>0)mask=removeSmallMaskComponents(mask,w,h,d,seg.minComponent);
 seg._maskCache=mask;seg._maskCacheKey=key;return mask;
}
export function sourceMprMemoryView(v){
 if(!v?.mprData)return null;
 if(!v._mprMemoryView||v._mprMemoryView.data!==v.mprData)v._mprMemoryView={data:v.mprData,columns:v.columns,rows:v.rows,slices:v.slices,spacing:v.spacing,min:v.min,max:v.max};
 return v._mprMemoryView;
}
export function activeMprSegments(){
 const out=[],baseView=volume?.sourceBacked?sourceMprMemoryView(volume):volume;
 for(const key of ['lung','fat','soft','bone']){
  const seg=segmentState[key];if(!seg.active||!seg.enabled)continue;
  const edit=segmentEditState[key],processedMask=baseView&&segmentNeedsGlobalMask(seg)?getProcessedSegmentMask(baseView,seg):null,processedRuns=volume?.sourceBacked&&segmentNeedsGlobalMask(seg)?(edit.finalRuns||edit.baseRuns):null;
  out.push({key,seg,edit,processedMask,processedRuns,rgb:hexRgb(seg.color),alpha:Math.min(.75,seg.opacity*.65)});
 }
 return out;
}
export function segmentEditActive(key){const s=segmentEditState[key];return !!(s?.keepRuns||s?.excludeRuns)}
