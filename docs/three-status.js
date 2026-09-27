// 3D status UI that needs no edit tools: busy overlay, GPU volume filter badge.
// Depends only on the imports below; never imports from app.js.
import { sceneState, threeRenderMode, threeDCancelRequested } from './state.js?v=20260927-build250';
import { threeFilterBadge, threeBusy, threeBusyLabel, threeBusyCancel } from './ui-shell.js?v=20260927-build250';
import { currentFilterSignature } from './source-filters.js?v=20260927-build250';
import { tr } from './i18n.js?v=20260927-build250';
export const gpuVolumeRefresh={token:0,running:null};
export function updateVolumeFilterBadge(){
 if(!threeFilterBadge)return;
 const mv=sceneState?.medicalVolume,show=threeRenderMode==='volume'&&!!mv?.active&&(mv.dataSignature||'')!==currentFilterSignature();
 threeFilterBadge.classList.toggle('is-hidden',!show);
 if(show){const key=gpuVolumeRefresh.running!=null?'volumeFilterUpdating':'volumeFilterPending';if(threeFilterBadge.dataset.i18n!==key){threeFilterBadge.dataset.i18n=key;threeFilterBadge.textContent=tr(key)}}
}
export function set3DBusy(busyState,label='3D構築中…',cancelable=true){
 if(threeBusy)threeBusy.classList.toggle('is-hidden',!busyState);
 if(threeBusyLabel)threeBusyLabel.textContent=label;
 if(threeBusyCancel){threeBusyCancel.classList.toggle('is-hidden',!busyState||!cancelable);threeBusyCancel.disabled=!busyState||!cancelable||threeDCancelRequested;threeBusyCancel.textContent=threeDCancelRequested?tr('cancelling3D'):tr('cancel3D')}
}
