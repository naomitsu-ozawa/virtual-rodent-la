// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { sceneState, threeRenderMode, volume, setThreeDDirty, setThreeDApplying, volumeAnalysisMode, threeDCancelRequested } from './state.js?v=20260927-build237';
import { threeFilterBadge, filter3DState, filterRebuild3D, volumeAnalysisToggle, sectionViewToggle, $, threeBusy, threeBusyLabel, threeBusyCancel } from './ui-shell.js?v=20260927-build237';
import { currentFilterSignature } from './mpr-render.js?v=20260927-build237';
import { tr } from './i18n.js?v=20260927-build237';
import { SEGMENT_PRESET_ORDER, segmentState } from './segments.js?v=20260927-build237';
import { updateAnalysisEditorControls } from './edit-tools.js?v=20260927-build237';
export function request3DRender(){
 if(sceneState)sceneState.needsRender=true;
}
export const gpuVolumeRefresh={token:0,running:null};
export function updateVolumeFilterBadge(){
 if(!threeFilterBadge)return;
 const mv=sceneState?.medicalVolume,show=threeRenderMode==='volume'&&!!mv?.active&&(mv.dataSignature||'')!==currentFilterSignature();
 threeFilterBadge.classList.toggle('is-hidden',!show);
 if(show){const key=gpuVolumeRefresh.running!=null?'volumeFilterUpdating':'volumeFilterPending';if(threeFilterBadge.dataset.i18n!==key){threeFilterBadge.dataset.i18n=key;threeFilterBadge.textContent=tr(key)}}
}
export function set3DState(mode){
 setThreeDDirty(mode==='stale');setThreeDApplying(mode==='updating');
 updateVolumeFilterBadge();
 if(!filter3DState||!filterRebuild3D)return;
 filter3DState.classList.toggle('is-stale',mode==='stale');
 filter3DState.classList.toggle('is-updating',mode==='updating');
 filter3DState.classList.toggle('is-current',mode==='current');
 const key=mode==='stale'?'threeStale':mode==='updating'?'threeUpdating':'threeCurrent';filter3DState.dataset.i18n=key;filter3DState.textContent=tr(key);
 const actionKey=mode==='updating'?'cancel3D':'rebuild3D';
 filterRebuild3D.dataset.i18n=actionKey;filterRebuild3D.textContent=tr(actionKey);
 filterRebuild3D.classList.toggle('is-cancel',mode==='updating');
 filterRebuild3D.disabled=!volume||mode==='current';
 const volumeCurrent=threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active,hasSurface3D=mode==='current'&&!!sceneState?.obj&&threeRenderMode==='surface';
 if(volumeAnalysisToggle)volumeAnalysisToggle.disabled=volumeAnalysisMode?false:!(volumeCurrent||hasSurface3D);
 if(sectionViewToggle)sectionViewToggle.disabled=!volume;
 for(const key of SEGMENT_PRESET_ORDER){
  const exportBtn=$('[data-seg-export="'+key+'"]');
  if(exportBtn)exportBtn.disabled=!hasSurface3D||!segmentState[key].active||!segmentState[key].enabled;
 }
 updateAnalysisEditorControls();
}
export function mark3DStale(){if(volume)set3DState('stale')}
export function mark3DCurrent(){set3DState('current')}
export function set3DBusy(busyState,label='3D構築中…',cancelable=true){
 if(threeBusy)threeBusy.classList.toggle('is-hidden',!busyState);
 if(threeBusyLabel)threeBusyLabel.textContent=label;
 if(threeBusyCancel){threeBusyCancel.classList.toggle('is-hidden',!busyState||!cancelable);threeBusyCancel.disabled=!busyState||!cancelable||threeDCancelRequested;threeBusyCancel.textContent=threeDCancelRequested?tr('cancelling3D'):tr('cancel3D')}
}
