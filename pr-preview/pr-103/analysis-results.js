// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { setAnalysisRegions, setAnalysisFocusedRegionId, setNextAnalysisRegionId, setNextAnalysisColorIndex, sceneState, analysisRegions, analysisFocusedRegionId, currentLanguage, volumeAnalysisBusy, volume } from './state.js?v=20261006-build466';
import { analysisSummary, analysisRegionList, analysisMergeButton, analysisClearButton, planes } from './ui-shell.js?v=20261006-build466';
import { tr } from './i18n.js?v=20261006-build466';
import { analysisRegionById, updateAnalysisEditorControls } from './edit-tools.js?v=20261006-build466';
import { analysisColorCss, schedulePlaneRender } from './mpr-render.js?v=20261006-build466';
import { request3DRender } from './scene3d.js?v=20261006-build466';
import { dispose } from './surface-mesh.js?v=20261006-build466';
export function analysisRegionRepresentativeVoxel(region){
 if(!region?.runsBySlice)return null;
 const nonEmpty=[];for(let z=0;z<region.runsBySlice.length;z++)if(region.runsBySlice[z]?.length)nonEmpty.push(z);
 if(!nonEmpty.length)return null;
 const z=nonEmpty[Math.floor(nonEmpty.length/2)],rec=region.runsBySlice[z],i=Math.floor((rec.length/3)/2)*3;
 return{x:Math.floor((rec[i+1]+rec[i+2])/2),y:rec[i],z};
}
// move=false keeps the slice positions (build 441: re-applying the focus look after a lasso unselect)
export function setAnalysisFocusedRegion(id,voxel=null,move=true){
 const region=analysisRegionById(id);setAnalysisFocusedRegionId(region?.id??null);
 for(const r of analysisRegions){
  r.focused=r.id===analysisFocusedRegionId;
  if(r.meshGroup)r.meshGroup.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.opacity=r.focused?.98:.46;m.emissiveIntensity=r.focused?.9:.28}});
 }
 if(region&&move){
  const v=voxel||analysisRegionRepresentativeVoxel(region);
  if(v&&volume){
   planes.axial.slider.value=Math.max(0,Math.min(+planes.axial.slider.max,v.z));
   planes.coronal.slider.value=Math.max(0,Math.min(+planes.coronal.slider.max,v.y));
   planes.sagittal.slider.value=Math.max(0,Math.min(+planes.sagittal.slider.max,v.x));
  }
 }
 for(const p of Object.keys(planes))schedulePlaneRender(p);
 request3DRender();renderAnalysisResults();
}
export function analysisRegionName(region){
 return region.merged?(tr('mergedRegion')+' '+region.id):(tr('analysisRegion')+' '+region.id);
}
export function renderAnalysisResults(statusText=null){
 if(!analysisSummary||!analysisRegionList)return;
 analysisSummary.replaceChildren();
 if(statusText){
  analysisSummary.textContent=statusText;
 }else if(!analysisRegions.length){
  analysisSummary.textContent=tr('volumeHint');
 }else{
  const focused=analysisRegionById(analysisFocusedRegionId)||analysisRegions[analysisRegions.length-1];
  const count=document.createElement('div');count.textContent=tr('analysisRegions')+': '+analysisRegions.length;count.style.cssText='font-size:11px;color:rgb(var(--ui-t2));margin-bottom:7px';
  analysisSummary.appendChild(count);
  if(focused){
   const card=document.createElement('div');card.style.cssText='display:grid;gap:7px;padding:9px 10px;border:1px solid rgb(var(--ui-b3));border-radius:9px;background:rgb(var(--ui-s1));margin-bottom:8px';
   const title=document.createElement('strong');title.textContent=(currentLanguage==='ja'?'解析結果 · ':'Result · ')+analysisRegionName(focused);title.style.cssText='font-size:11px;color:rgb(var(--ui-t1))';
   const volumeRow=document.createElement('div');volumeRow.style.cssText='display:flex;align-items:baseline;justify-content:space-between;gap:10px';
   const volumeLabel=document.createElement('span');volumeLabel.textContent=currentLanguage==='ja'?'体積':'Volume';volumeLabel.style.cssText='font-size:10px;color:rgb(var(--ui-t4))';
   const volumeValue=document.createElement('strong');volumeValue.textContent=focused.mm3.toFixed(2)+' mm³';volumeValue.style.cssText='font-size:18px;line-height:1;color:rgb(var(--ui-t1));font-variant-numeric:tabular-nums;white-space:nowrap';
   volumeRow.append(volumeLabel,volumeValue);
   const meta=document.createElement('div');meta.textContent=focused.segmentKeys.map(k=>tr(k)||k).join(' + ')+' · '+focused.voxels.toLocaleString()+' voxels';meta.style.cssText='font-size:10px;line-height:1.35;color:rgb(var(--ui-t4));overflow-wrap:anywhere';
   card.append(title,volumeRow,meta);analysisSummary.appendChild(card);
  }
 }
 analysisMergeButton.disabled=analysisRegions.filter(r=>r.selected).length<2||volumeAnalysisBusy;
 analysisClearButton.disabled=!analysisRegions.length||volumeAnalysisBusy;updateAnalysisEditorControls();
 analysisRegionList.replaceChildren();
 for(const region of analysisRegions){
  const row=document.createElement('div');row.className='analysis-region-row'+(region.id===analysisFocusedRegionId?' is-focused':'');row.dataset.regionId=String(region.id);row.onclick=e=>{if(e.target.closest('button,input'))return;setAnalysisFocusedRegion(region.id)};
  const select=document.createElement('input');select.type='checkbox';select.checked=!!region.selected;select.className='analysis-region-select';select.title=tr('mergeSelected');select.onchange=()=>{region.selected=select.checked;renderAnalysisResults()};
  const swatch=document.createElement('span');swatch.className='analysis-region-swatch';swatch.style.background=analysisColorCss(region.color);swatch.title=analysisColorCss(region.color);
  const info=document.createElement('div');info.className='analysis-region-info';
  const title=document.createElement('strong');title.textContent=analysisRegionName(region);
  const keys=document.createElement('span');keys.textContent=region.segmentKeys.map(k=>tr(k)||k).join(' + ');
  const value=document.createElement('span');value.textContent=region.mm3.toFixed(2)+' mm³ · '+region.voxels.toLocaleString()+' voxels';value.style.cssText='white-space:normal;overflow:visible;text-overflow:clip';
  info.append(title,keys,value);
  const visible=document.createElement('button');visible.type='button';visible.className='analysis-region-button';visible.textContent=region.visible?tr('hideRegion'):tr('showRegion');visible.onclick=()=>{region.visible=!region.visible;if(region.meshGroup)region.meshGroup.visible=region.visible;request3DRender();renderAnalysisResults()};
  const remove=document.createElement('button');remove.type='button';remove.className='analysis-region-button analysis-region-delete';remove.textContent=tr('deleteRegion');remove.onclick=()=>removeAnalysisRegion(region.id);
  row.append(select,swatch,info,visible,remove);analysisRegionList.append(row);
 }
}
export function disposeAnalysisRegionMesh(region){
 if(!region?.meshGroup)return;if(region.meshGroup.parent)region.meshGroup.parent.remove(region.meshGroup);dispose(region.meshGroup);region.meshGroup=null;
}
export function removeAnalysisRegion(id){
 const idx=analysisRegions.findIndex(r=>r.id===id);if(idx<0)return;
 disposeAnalysisRegionMesh(analysisRegions[idx]);analysisRegions.splice(idx,1);
 if(analysisFocusedRegionId===id)setAnalysisFocusedRegionId(null);
 if(!analysisRegions.length&&sceneState?.analysisMesh){if(sceneState.analysisMesh.parent)sceneState.analysisMesh.parent.remove(sceneState.analysisMesh);sceneState.analysisMesh=null}
 request3DRender();renderAnalysisResults();for(const p of Object.keys(planes))schedulePlaneRender(p);
}
export function resetAnalysisRegistryAfterRebuild(){
 setAnalysisRegions([]);setAnalysisFocusedRegionId(null);setNextAnalysisRegionId(1);setNextAnalysisColorIndex(0);if(sceneState)sceneState.analysisMesh=null;renderAnalysisResults();
}
