// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { mark3DStale } from './three-state.js?v=20261002-build426';
import { $, threeLabel, ctRangeAuto, ctRangeFull, wc, ww, sigmoidCenter, wcVal, wwVal, sigmoidCenterValue, segmentControls, segmentAddSelect, segmentAddButton } from './ui-shell.js?v=20261002-build426';
import { sceneState, setAnalysisRegions, setAnalysisFocusedRegionId, setNextAnalysisRegionId, setNextAnalysisColorIndex, volume, segmentRenderTimer, incSourceRenderRevision, threeRenderMode, ctRangeMode, ctRangeProfile, setCtRangeMode, sourceVolume } from './state.js?v=20261002-build426';
import { dispose } from './surface-mesh.js?v=20261002-build426';
import { request3DRender } from './scene3d.js?v=20261002-build426';
import { renderAnalysisResults } from './analysis-results.js?v=20261002-build426';
import { segmentEditState, SEGMENT_PRESET_ORDER, segmentState } from './segments.js?v=20261002-build426';
import { niceCtStep, formatCtValue } from './utils.js?v=20261002-build426';
import { syncGpuVolumeEdits } from './gpu-volume-data.js?v=20261002-build426';
import { renderAll } from './mpr-render.js?v=20261002-build426';
export function renderSegmentPresets(){
 const active=new Set(SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active));
 for(const key of SEGMENT_PRESET_ORDER){
  const card=segmentControls.querySelector('[data-segment="'+key+'"]');
  if(card)card.classList.toggle('is-hidden',!active.has(key));
  const option=[...segmentAddSelect.options].find(o=>o.value===key);
  if(option)option.disabled=active.has(key);
 }
 const next=[...segmentAddSelect.options].find(o=>!o.disabled);
 if(next)segmentAddSelect.value=next.value;
 segmentAddSelect.disabled=!volume||!next;
 segmentAddButton.disabled=!volume||!next;
}
export function addSegmentPreset(key){
 if(!volume||!SEGMENT_PRESET_ORDER.includes(key)||segmentState[key].active)return;
 const seg=segmentState[key];seg.active=true;seg.enabled=true;
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.checked=true;enabled.disabled=false;color.disabled=false;min.disabled=false;max.disabled=false;opacity.disabled=false;
 opening.disabled=false;closing.disabled=false;minComponent.disabled=false;holeFill.disabled=false;
 for(const [attr] of THIN_SLIDERS){const el=$('[data-seg-'+attr+'="'+key+'"]');if(el)el.disabled=false}
 if(exportBtn)exportBtn.disabled=true;if(removeBtn)removeBtn.disabled=false;
 renderSegmentPresets();renderAll();scheduleSegment3D();
}
export function removeSegmentPreset(key){
 if(!SEGMENT_PRESET_ORDER.includes(key)||!segmentState[key].active)return;
 const seg=segmentState[key];seg.active=false;seg.enabled=false;clearSegmentEditCache(key,true);if(threeRenderMode==='volume')syncGpuVolumeEdits(sourceVolume||volume);
 const enabled=$('[data-seg-enabled="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]');
 if(enabled)enabled.checked=false;if(removeBtn)removeBtn.disabled=true;
 renderSegmentPresets();clearAnalysisHighlight();renderAll();scheduleSegment3D();
}
export function setCtSliderRange(el,min,max,step){
 if(!el)return;
 const value=+el.value,lo=Math.min(min,value),hi=Math.max(max,value);
 el.min=String(lo);el.max=String(Math.max(lo+step,hi));el.step=String(step);
 el.value=String(value);
}
export function autoAround(value,halfSpan,fullMin,fullMax){
 const v=Number.isFinite(+value)?+value:(fullMin+fullMax)/2;
 let lo=Math.max(fullMin,v-halfSpan),hi=Math.min(fullMax,v+halfSpan);
 if(hi<=lo){lo=fullMin;hi=fullMax}
 return[lo,hi];
}
export function applyCtRangeMode(mode=ctRangeMode){
 if(!ctRangeProfile||!volume)return;
 setCtRangeMode(mode==='full'?'full':'auto');
 ctRangeAuto.classList.toggle('is-active',ctRangeMode==='auto');
 ctRangeFull.classList.toggle('is-active',ctRangeMode==='full');
 const p=ctRangeProfile,fullStep=niceCtStep(p.fullSpan),autoStep=niceCtStep(Math.max(p.width*2,p.fullSpan/20));
 if(ctRangeMode==='full'){
  setCtSliderRange(wc,p.fullMin,p.fullMax,fullStep);
  setCtSliderRange(ww,Math.max(fullStep,1e-6),p.fullWidthMax,fullStep);
  setCtSliderRange(sigmoidCenter,p.fullMin,p.fullMax,fullStep);
  for(const key of SEGMENT_PRESET_ORDER){
   setCtSliderRange($('[data-seg-min="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
   setCtSliderRange($('[data-seg-max="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
  }
 }else{
  const half=Math.max(p.width,p.fullSpan/200);
  let r=autoAround(+wc.value,half,p.fullMin,p.fullMax);setCtSliderRange(wc,r[0],r[1],autoStep);
  const currentWidth=Math.max(+ww.value,autoStep),wwLo=Math.max(autoStep,currentWidth-p.width),wwHi=Math.min(p.fullWidthMax,Math.max(currentWidth+p.width,currentWidth*1.5));
  setCtSliderRange(ww,wwLo,Math.max(wwLo+autoStep,wwHi),autoStep);
  r=autoAround(+sigmoidCenter.value,half,p.fullMin,p.fullMax);setCtSliderRange(sigmoidCenter,r[0],r[1],autoStep);
  for(const key of SEGMENT_PRESET_ORDER){
   const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
   let rr=autoAround(+minEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(minEl,rr[0],rr[1],autoStep);
   rr=autoAround(+maxEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(maxEl,rr[0],rr[1],autoStep);
  }
 }
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 sigmoidCenterValue.value=formatCtValue(+sigmoidCenter.value,+sigmoidCenter.step);
 for(const key of SEGMENT_PRESET_ORDER)updateSegmentOutputs(key);
}
export function updateSegmentOutputs(key){
 const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
 $('[data-seg-min-out="'+key+'"]').value=formatCtValue(segmentState[key].min,+minEl?.step||1);
 $('[data-seg-max-out="'+key+'"]').value=formatCtValue(segmentState[key].max,+maxEl?.step||1);
 $('[data-seg-opacity-out="'+key+'"]').value=segmentState[key].opacity.toFixed(2);
 for(const [attr,field] of THIN_SLIDERS){const out=$('[data-seg-'+attr+'-out="'+key+'"]');if(out)out.value=formatMmVoxels(segmentState[key][field])}
}
// Thin-region sliders hold mm; the step is one in-plane source voxel and the
// output shows the voxel equivalent (see IMPLEMENTATION_PLAN).
export const THIN_SLIDERS=[['surface-mm','surfaceMm',8],['thickness-mm','thicknessMm',8]];
export function thinVoxelMm(v=volume){const s=v?.spacing||[1,1,1];return Math.max(1e-6,Math.min(+s[0]||1,+s[1]||1))}
export function formatMmVoxels(mm){
 mm=+mm||0;if(mm<=0)return '0';
 const vox=thinVoxelMm(),digits=vox<.1?2:vox<1?1:0;
 return mm.toFixed(digits+(vox<.01?1:0))+' mm ≈ '+Math.round(mm/vox)+' vox';
}
export function configureThinSliders(key,v){
 const vox=thinVoxelMm(v),cfg=segmentState[key];
 for(const [attr,field,maxVox] of THIN_SLIDERS){
  const el=$('[data-seg-'+attr+'="'+key+'"]');if(!el)continue;
  el.min='0';el.step=String(vox);el.max=String(vox*maxVox);
  cfg[field]=Math.min(vox*maxVox,Math.max(0,+cfg[field]||0));el.value=String(cfg[field]);
 }
}
export function thinSliderValue(el){const vox=thinVoxelMm();return Math.round((+el.value||0)/vox)*vox}
export function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);incSourceRenderRevision(false);mark3DStale();if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){request3DRender();threeLabel.textContent=(sceneState.backend||'3D')+' · GPU volume'}}
export function clearSegmentEditCache(key,clearEdits=false){
 const st=segmentEditState[key];if(!st)return;
 // a removed or reset segment must not leave its run surface in the scene
 if(clearEdits&&st.surfaceGroup){const old=st.surfaceGroup;if(old.parent)old.parent.remove(old);dispose(old);st.surfaceGroup=null;request3DRender()}st.baseRuns=null;st.baseSignature='';st.finalRuns=null;st.pendingBase=null;
 if(clearEdits){st.keepRuns=null;st.excludeRuns=null;st.cutRuns=null;st.rawCutSurface=false;st.undo=[];st.redo=[];st.revision=0}
}
export function clearAnalysisHighlight(){
 if(sceneState?.analysisMesh){const root=sceneState.analysisMesh;if(root.parent)root.parent.remove(root);dispose(root);sceneState.analysisMesh=null}
 setAnalysisRegions([]);setAnalysisFocusedRegionId(null);setNextAnalysisRegionId(1);setNextAnalysisColorIndex(0);request3DRender();renderAnalysisResults();
}
export const segmentControl=(attr,key)=>$('[data-seg-'+attr+'="'+key+'"]');
export function setControlValue(el,value){if(!el||value==null)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
export function setControlChecked(el,checked){if(!el||el.checked===!!checked)return;el.checked=!!checked;el.dispatchEvent(new Event('change',{bubbles:true}))}
