// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { volume, incNextSegmentMaskVolumeId } from './state.js?v=20261005-build453';
import { hexRgb } from './utils.js?v=20261005-build453';
import { settings } from './app-settings.js?v=20261005-build453';
import { buildThresholdMask, morphMask, fillMaskHoles, removeSmallMaskComponents } from './mask-ops.js?v=20261005-build453';
import { thinSuppressActive, suppressThinMask } from './thin-suppress.js?v=20261005-build453';
import { effectiveRanges } from './segment-exclusive.js?v=20261005-build453';
import { sourceFilterStages } from './source-filters.js?v=20261005-build453';
export const SEGMENT_PRESET_ORDER=['bone','soft','fat','lung'];
export const segmentEditState=Object.fromEntries(SEGMENT_PRESET_ORDER.map(key=>[key,{baseRuns:null,baseSignature:'',keepRuns:null,excludeRuns:null,cutRuns:null,finalRuns:null,revision:0,undo:[],redo:[],surfaceGroup:null,rawCutSurface:false}]));
// build 407 (owner): every segment starts at 100 % opacity (translucent segments are heavy to render)
export const segmentState={
 bone:{active:false,enabled:false,color:'#f3f0e8',opacity:1,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 soft:{active:false,enabled:false,color:'#d97f7f',opacity:1,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 fat:{active:false,enabled:false,color:'#e7c85d',opacity:1,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''},
 lung:{active:false,enabled:false,color:'#6fb8d6',opacity:1,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,surfaceMm:0,thicknessMm:0,_maskCache:null,_maskCacheKey:''}
};
// build 438: non-overlapping segments (segment-exclusive.js). order = the segment cards top → bottom (priority);
// mode 'priority' (new data) or 'off' (projects saved before 438). seg.userMin / userMax = the sliders; seg.min / max =
// the range in use. pending = keys whose range in use changed since the last commit (invalidated on slider release).
export const segmentExclusive={order:['bone','fat','soft','lung'],mode:'priority',pending:new Set(),invalidate:null};
export function applyExclusiveRanges(){
 const segs={};
 for(const key of SEGMENT_PRESET_ORDER){const s=segmentState[key];if(s.userMin==null){s.userMin=s.min;s.userMax=s.max}segs[key]={userMin:s.userMin,userMax:s.userMax,active:!!s.active}}
 const order=[...segmentExclusive.order.filter(k=>SEGMENT_PRESET_ORDER.includes(k)),...SEGMENT_PRESET_ORDER.filter(k=>!segmentExclusive.order.includes(k))];
 const r=effectiveRanges(segs,order,segmentExclusive.mode),changed=[];
 for(const key of SEGMENT_PRESET_ORDER){const s=segmentState[key],e=r[key];s.exclusive=e;if(s.min!==e.min||s.max!==e.max){s.min=e.min;s.max=e.max;s._maskCache=null;changed.push(key);segmentExclusive.pending.add(key)}}
 return changed;
}
// recompute and invalidate every segment whose range in use changed (and the given ones)
export function commitExclusiveRanges(...keys){applyExclusiveRanges();const all=new Set([...keys,...segmentExclusive.pending]);segmentExclusive.pending.clear();if(all.size)segmentExclusive.invalidate?.([...all]);return [...all]}
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
// build 433: the in-memory MPR copy holds the unfiltered CT; segments are defined on the filtered data (build 418),
// so it may stand in for the source only while no filter is active (before, Opening & co. ignored the filters)
export function sourceMemoryUsable(v){return !!v?.mprData&&!sourceFilterStages().length}
export function sourceMprMemoryView(v){
 if(!sourceMemoryUsable(v))return null;
 if(!v._mprMemoryView||v._mprMemoryView.data!==v.mprData)v._mprMemoryView={data:v.mprData,columns:v.columns,rows:v.rows,slices:v.slices,spacing:v.spacing,min:v.min,max:v.max};
 return v._mprMemoryView;
}
// build 430 (owner: the 2D colour strength settable): colour weight over the CT grey = segment opacity × the setting
// (default 65 %, the value before 430: identical then); the 75 % cap of before stays unless the setting itself is higher
export function mprSegmentAlpha(seg){const s=+settings.get('mpr2dAlpha');const k=Number.isFinite(s)&&s>0?Math.min(1,s):0.65;return Math.min(Math.max(.75,k),seg.opacity*k)}
export function activeMprSegments(){
 const out=[],baseView=volume?.sourceBacked?sourceMprMemoryView(volume):volume;
 for(const key of ['lung','fat','soft','bone']){
  const seg=segmentState[key];if(!seg.active||!seg.enabled)continue;
  const edit=segmentEditState[key],processedMask=baseView&&segmentNeedsGlobalMask(seg)?getProcessedSegmentMask(baseView,seg):null,processedRuns=volume?.sourceBacked&&segmentNeedsGlobalMask(seg)?(edit.finalRuns||edit.baseRuns):null;
  out.push({key,seg,edit,processedMask,processedRuns,rgb:hexRgb(seg.color),alpha:mprSegmentAlpha(seg)});
 }
 return out;
}
export function segmentEditActive(key){const s=segmentEditState[key];return !!(s?.keepRuns||s?.excludeRuns)}
