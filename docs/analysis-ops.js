// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { mark3DCurrent, mark3DStale } from './three-state.js?v=20260927-build246';
import { set3DBusy } from './three-status.js?v=20260927-build246';
import { meshSegmentRanges, syncSectionClipParent, applySectionClippingMaterials, refreshEditedSegmentSurface, ensureGpuResidentCpuPositions } from './surface-build.js?v=20260927-build246';
import { sceneState, incSourceRenderRevision, sourceRenderRevision, currentLanguage, sectionViewOpen, sectionViewPlane, setAnalysisEditTool, setAnalysisEditTargetKey, setAnalysisEditTargetMode, setAnalysisCutStroke, setAnalysisCutScreen, setAnalysisPendingCut, current3DVolume, volume, volumeAnalysisMode, analysisRegions, threeRenderMode, threeDDirty, analysisFocusedRegionId, volumeAnalysisBusy, setVolumeAnalysisBusy, setAnalysisRegions, incNextAnalysisRegionId, nextAnalysisColorIndex, incNextAnalysisColorIndex, analysisEditTargetKey, sourceVolume, setAnalysisFocusedRegionId, analysisEditTool, analysisEditTargetMode } from './state.js?v=20260927-build246';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { eachGeometryTriangleRange, makeSource3DCoordinates, makeVolume3DCoordinates, Float32FaceBuilder, appendAnalysisRunBoundaryFaces, groupToBinaryStl } from './mesh-geometry.js?v=20260927-build246';
import { surfaceSmoothingActive } from './settings.js?v=20260927-build246';
import { SEGMENT_PRESET_ORDER, segmentState, getProcessedSegmentMask, segmentEditState, segmentEditActive, segmentNeedsGlobalMask } from './segments.js?v=20260927-build246';
import { request3DRender } from './scene3d.js?v=20260927-build246';
import { threeLabel, footer, analysisEditTargetSelect, selected, analysisCutDepth, analysisCutYaw, analysisCutPitch, analysisCutOffset, threeEditOverlay, volumeAnalysisResult, analysisSummary, threeBusyLabel } from './ui-shell.js?v=20260927-build246';
import { dispose, buildSmoothIsoMesh, geometryFromSourcePositions } from './surface-mesh.js?v=20260927-build246';
import { ensureSegmentBaseRuns, getFinalSegmentRuns, sourceAnalysisBlockDepth, sourceSegmentRunBlockGpu, sourceSegmentMaskBlock } from './segment-runs.js?v=20260927-build246';
import { maskFromAnalysisRuns, unionAnalysisRuns, analysisRunsVoxelCount, unionRunArrays, componentsFromRuns, analysisRunsOverlap, componentsFromRunsAsync, analysisRunsContain, sourceResultToAnalysisRuns, maskToAnalysisRuns, RunUnionFind, consumeGpuAnalysisRuns, sourceRunSlice } from './run-length.js?v=20260927-build246';
import { frameYield } from './utils.js?v=20260927-build246';
import { updateSectionClipPlaneWorld } from './section-view.js?v=20260927-build246';
import { setGpuComputeBackend, ensureGpuFilterDevice, gpuValidationScope, runGpuSourceFilters, gpuFilterRuntime } from './gpu-compute.js?v=20260927-build246';
import { clearSegmentEditCache, clearAnalysisHighlight } from './segment-ui.js?v=20260927-build246';
import { clearCutResultPreview, updateThreeEditUi, analysisRegionById, editTargetRegions, cutRunsFromVoxelStroke, cutWidthMm, updateAnalysisEditorControls } from './edit-tools.js?v=20260927-build246';
import { sourceFilterStages, readMemoryRegion, sourceFilterRuntime, getFilteredSourcePlaneValues, getCachedSourceSlice } from './source-filters.js?v=20260927-build246';
import { downloadBlob } from './data-load.js?v=20260927-build246';
import { renderAnalysisResults, disposeAnalysisRegionMesh, setAnalysisFocusedRegion } from './analysis-results.js?v=20260927-build246';
import { tr } from './i18n.js?v=20260927-build246';
import { syncGpuVolumeEdits } from './gpu-volume-data.js?v=20260927-build246';
import { renderAll } from './mpr-render.js?v=20260927-build246';
import { makeVoxelProjector, polygonBounds, componentFullyInside } from './lasso.js?v=20260927-build246';
export function clearThreeEditOverlay(){const ctx=threeEditOverlay?.getContext('2d');ctx?.clearRect(0,0,threeEditOverlay.width,threeEditOverlay.height)}
export const ANALYSIS_REGION_COLORS=[0x00d8ff,0xff9f1c,0x7ae582,0xff4d8d,0xf4e409,0x9b5cff,0xff5a5f,0x2ec4b6];
export function nextAnalysisColor(){
 const color=ANALYSIS_REGION_COLORS[nextAnalysisColorIndex%ANALYSIS_REGION_COLORS.length];
 incNextAnalysisColorIndex(false);return color;
}
export function analysisRegionAtVoxel(x,y,z){
 const focused=analysisRegionById(analysisFocusedRegionId);
 if(focused?.visible&&analysisRunsContain(focused.runsBySlice,x,y,z))return focused;
 return analysisRegions.find(r=>r.visible&&analysisRunsContain(r.runsBySlice,x,y,z))||null;
}
export async function connectedComponentVolumeGpuRuns(v,key,seg,x0,y0,z0){
 const device=await ensureGpuFilterDevice();if(!device||segmentNeedsGlobalMask(seg))return null;
 const w=v.columns,h=v.rows,d=v.slices,uf=new RunUnionFind(),sliceRuns=new Array(d),seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity},plane=w*h;
 let prevRows=null,done=0;const blockDepth=sourceAnalysisBlockDepth(w,h);
 try{
  for(let z0b=0;z0b<d;z0b+=blockDepth){
   const coreDepth=Math.min(blockDepth,d-z0b),data=readMemoryRegion(v,{x:0,y:0,z:z0b,width:w,height:h,depth:coreDepth}),target={x:0,y:0,z:0,width:w,height:h,depth:coreDepth};
   const result=await gpuValidationScope(device,'analysis RLE',()=>runGpuSourceFilters(data,w,h,coreDepth,v.min,v.max,[],target,[{key,seg}],{analysisRuns:true}));
   if(!result?.analysisRuns)return null;
   prevRows=consumeGpuAnalysisRuns(result.items,z0b,coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+coreDepth;
   analysisSummary.textContent=(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… ')+done+' / '+d;await frameYield();
  }
 }catch(e){setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',e?.message||e);console.warn('GPU connected-component run extraction failed; CPU analysis will be used.',e);return null}
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];setGpuComputeBackend('WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');return{voxels,mm3,root,uf,sliceRuns};
}
export async function connectedComponentVolumeSource(v,key,seg,x0,y0,z0){
 const w=v.columns,h=v.rows,d=v.slices,analysisRevision=sourceFilterRuntime.revision,uf=new RunUnionFind(),sliceRuns=new Array(d);
 const seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity};
 let prevRows=null,done=0,gpuUsed=false,hadCpuPath=false;const blockDepth=sourceAnalysisBlockDepth(w,h);
 analysisSummary.textContent=(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… ')+'0 / '+d;
 for(let z0b=0;z0b<d;z0b+=blockDepth){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  let gpuBlock=null;
  try{gpuBlock=await sourceSegmentRunBlockGpu(v,key,seg,z0b,blockDepth,analysisRevision)}catch(e){if(String(e.message||e)!=='__GPU_ANALYSIS_UNAVAILABLE__'){gpuFilterRuntime.lastError=String(e.message||e);console.warn('GPU source analysis block failed; using CPU mask block.',e)}}
  if(gpuBlock){
   gpuUsed=true;prevRows=consumeGpuAnalysisRuns(gpuBlock.items,z0b,gpuBlock.coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+gpuBlock.coreDepth;
  }else{
   hadCpuPath=true;setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0b,blockDepth,analysisRevision);
   for(let local=0;local<masks.length;local++){const z=z0b+local,result=sourceRunSlice(masks[local],w,h,z,seed,uf,prevRows);sliceRuns[z]=result.records;prevRows=result.rows;done=z+1}
   setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
  }
  analysisSummary.textContent=((gpuUsed&&!hadCpuPath)?(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… '):(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… '))+done+' / '+d;await frameYield();
 }
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
 if(gpuUsed&&!hadCpuPath)setGpuComputeBackend(sourceFilterStages().length?'WEBGPU ANALYSIS FILTER+RLE · CPU CONNECTIVITY':'WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');
 else if(gpuUsed&&hadCpuPath)setGpuComputeBackend('GPU+CPU ANALYSIS',gpuFilterRuntime.lastError||'Some analysis blocks used the exact CPU path');
 return{voxels,mm3,root,uf,sliceRuns};
}
export function surfacePointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const hits=raycaster.intersectObjects(sceneState.obj.children,true);
 const hit=hits.find(h=>h.object?.userData?.analysisRegionId===analysisFocusedRegionId)||(preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):null)||hits.find(h=>segmentKeyFromIntersection(h)||h.object?.userData?.analysisRegionId);
 if(!hit)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone());
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),hit};
}
export function surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const targets=cutRaycastSourceMeshes(preferredKey),hits=raycaster.intersectObjects(targets,false),hit=preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):hits.find(h=>segmentKeyFromIntersection(h));
 if(!hit)return null;
 const key=segmentKeyFromIntersection(hit);if(!key)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone()),inv=sceneState.obj.matrixWorld.clone().invert(),toVoxelDir=vec=>{const q=vec.clone().transformDirection(inv).normalize();return{x:q.x,y:-q.y,z:q.z}},localRay=toVoxelDir(raycaster.ray.direction),cameraRight=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)),cameraUp=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1));
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),ray:localRay,right:cameraRight,up:cameraUp,hit,key};
}
export async function segmentKeyAtVoxel(v,x,y,z){
 const w=v.columns,h=v.rows,d=v.slices;if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return null;
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||!(segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg))))continue;
  const runs=await getFinalSegmentRuns(key,v);if(analysisRunsContain(runs,x,y,z))return key;
 }
 let value=null;
 if(v.sourceBacked){
  if(sourceFilterStages().length){
   const values=await getFilteredSourcePlaneValues('axial',z,v.series,'analysis-pick');value=values[y*w+x];
  }else{
   const values=await getCachedSourceSlice(v.series.slices[z]);value=values[y*w+x];
  }
 }else value=v.data[z*h*w+y*w+x];
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg)))continue;
  if(!v.sourceBacked&&segmentNeedsGlobalMask(seg)){const mask=getProcessedSegmentMask(v,seg);if(mask[z*h*w+y*w+x]===1)return key}
  else if(value>=seg.min&&value<=seg.max)return key;
 }
 return null;
}
export async function analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z){
 const [vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,seg=segmentState[key];
 // Filtered source-backed volumes: analyse the cached filtered runs of the
 // segment (built once per filter/segment setting, shared with the edit
 // tools) instead of re-filtering the whole volume on every click.
 if(segmentEditActive(key)||(analysisVolume.sourceBacked&&(segmentNeedsGlobalMask(seg)||sourceFilterStages().length>0))){
  const showRunProgress=(done,total)=>{const text=(currentLanguage==='ja'?'フィルター適用済みの領域を準備中… ':'Preparing filtered segment… ')+done+' / '+total;analysisSummary.textContent=text;if(threeBusyLabel)threeBusyLabel.textContent=text};
  const runs=await getFinalSegmentRuns(key,analysisVolume,showRunProgress),comps=await componentsFromRunsAsync(runs,w,h,d,(phase,done,total)=>{if(threeBusyLabel)threeBusyLabel.textContent=(currentLanguage==='ja'?'領域を解析中… ':'Analyzing region… ')+done+' / '+total});let comp=comps.find(item=>analysisRunsContain(item.runsBySlice,x,y,z));
  if(!comp){for(let r=1;r<=2&&!comp;r++)for(let dz=-r;dz<=r&&!comp;dz++)for(let dy=-r;dy<=r&&!comp;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(ix<0||iy<0||iz<0||ix>=w||iy>=h||iz>=d)continue;comp=comps.find(item=>analysisRunsContain(item.runsBySlice,ix,iy,iz));if(comp)break}}
  if(!comp)throw new Error(currentLanguage==='ja'?'処理後の領域を特定できませんでした':'Could not identify the processed component');
  const mm3=comp.voxels*vx*vy*vz;setGpuComputeBackend('PROCESSED RLE · CPU CONNECTIVITY');return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels:comp.voxels,mm3});
 }
 if(analysisVolume.sourceBacked){
  const result=await connectedComponentVolumeSource(analysisVolume,key,seg,x,y,z),runsBySlice=sourceResultToAnalysisRuns(result,d);
  return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
 }
 const gpuResult=await connectedComponentVolumeGpuRuns(analysisVolume,key,seg,x,y,z);
 if(gpuResult){
  const runsBySlice=sourceResultToAnalysisRuns(gpuResult,d);return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:gpuResult.voxels,mm3:gpuResult.mm3});
 }
 setGpuComputeBackend('CPU ANALYSIS');
 const processedMask=getProcessedSegmentMask(analysisVolume,seg),inside=(ix,iy,iz)=>ix>=0&&iy>=0&&iz>=0&&ix<w&&iy<h&&iz<d&&processedMask[iz*h*w+iy*w+ix]===1;
 if(!inside(x,y,z)){
  let found=null;for(let r=1;r<=2&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(inside(ix,iy,iz)){found=[ix,iy,iz];break}}
  if(!found)throw new Error(currentLanguage==='ja'?'選択位置から領域を特定できませんでした':'Could not identify a component at the selected point');
  [x,y,z]=found;
 }
 const result=await connectedComponentVolume(analysisVolume,seg,x,y,z,processedMask),runsBySlice=maskToAnalysisRuns(result.mask,w,h,d);
 return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
}
export async function analyzeVolumeAtVoxel(x,y,z,keyHint=null,showResult=true){
 if(!volume||volumeAnalysisBusy)return false;const analysisVolume=current3DVolume||volume;
 setVolumeAnalysisBusy(true);
 if(showResult){volumeAnalysisResult.classList.remove('is-hidden');set3DBusy(true,currentLanguage==='ja'?'体積解析中…':'Analyzing volume…',false);await frameYield()}
 renderAnalysisResults(currentLanguage==='ja'?'解析中…':'Analyzing…');
 try{
  const key=keyHint||await segmentKeyAtVoxel(analysisVolume,x,y,z);
  if(!key){renderAnalysisResults(currentLanguage==='ja'?'選択位置に解析対象の領域がありません':'No analyzable segment at the selected point');return false}
  await analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z);return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'体積解析エラー: ':'Volume analysis error: ')+String(e.message||e))}
  return false;
 }finally{
  setVolumeAnalysisBusy(false);
  if(showResult)set3DBusy(false,'',false);
  renderAnalysisResults();
 }
}
export function returnToNavigate(){
 if(analysisEditTool==='select')return;
 setAnalysisEditTool('select');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateAnalysisEditorControls();
}
export async function selectRegionsInLasso(poly,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const analysisVolume=current3DVolume||volume,[vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices;
 const keys=analysisEditTargetMode==='auto'?SEGMENT_PRESET_ORDER.filter(k=>segmentState[k]?.active&&segmentState[k]?.enabled):[analysisEditTargetMode];
 sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const rect=canvas.getBoundingClientRect(),viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const project=makeVoxelProjector(analysisVolume,sceneState.obj.matrixWorld.elements,viewProjection.elements,rect.width,rect.height),bounds=polygonBounds(poly);
 setVolumeAnalysisBusy(true);set3DBusy(true,currentLanguage==='ja'?'囲み範囲の領域を解析中…':'Analyzing lasso selection…',false);await frameYield();
 let pieces=0,failed=false;
 try{
  for(const key of keys){
   const runs=await getFinalSegmentRuns(key,analysisVolume);if(!runs)continue;
   const comps=await componentsFromRunsAsync(runs,w,h,d,(phase,done,total)=>{if(threeBusyLabel)threeBusyLabel.textContent=(currentLanguage==='ja'?'囲み範囲の領域を解析中… ':'Analyzing lasso selection… ')+(total?Math.round(done/total*100)+'%':'')});
   const inside=[];
   for(let i=0;i<comps.length;i++){
    if(componentFullyInside(comps[i].runsBySlice,project,poly,{bounds}))inside.push(comps[i]);
    if(i%200===199)await frameYield();
   }
   if(!inside.length)continue;
   let merged=inside[0].runsBySlice,voxels=inside[0].voxels;
   for(let i=1;i<inside.length;i++){merged=unionRunArrays(merged,inside[i].runsBySlice,d);voxels+=inside[i].voxels}
   await addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice:merged,voxels,mm3:voxels*vx*vy*vz,merged:inside.length>1});
   pieces+=inside.length;
  }
  setGpuComputeBackend('PROCESSED RLE · LASSO SELECTION');
 }catch(e){failed=true;if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'囲み選択エラー: ':'Lasso selection error: ')+String(e.message||e))}}
 finally{setVolumeAnalysisBusy(false);set3DBusy(false,'',false);renderAnalysisResults()}
 updateAnalysisEditorControls();
 if(failed)return;
 if(pieces)returnToNavigate();
 updateThreeEditUi(pieces?(currentLanguage==='ja'?pieces+'個の塊を選択しました · 「選択領域を削除」で削除できます':pieces+' piece(s) selected · use Delete selected region'):(currentLanguage==='ja'?'囲みの中に完全に入っている領域がありません':'No piece lies completely inside the loop'));
}
export async function analyzeEditRegionAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const preferredKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;
 let picked=null;
 if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){
  setGpuComputeBackend('WEBGPU VOLUME PICK');
  if(preferredKey){const rect=canvas.getBoundingClientRect(),items=await sceneState.medicalVolume.pickMany([{clientX:event.clientX,clientY:event.clientY}],camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER,preferredKey);picked=items?.[0]||null}
  else picked=await sceneState.medicalVolume.pick(event.clientX,event.clientY,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);
  if(!picked){updateThreeEditUi(currentLanguage==='ja'?'選択できる領域がありません':'No selectable region');return}
 }else{
  picked=surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey);
  if(!picked){updateThreeEditUi(currentLanguage==='ja'?'選択できる領域がありません':'No selectable region');return}
 }
 const key=preferredKey||picked.key;if(!key)return;
 const existing=analysisRegionAtVoxel(picked.x,picked.y,picked.z);
 if(existing?.segmentKeys?.includes(key)){setAnalysisFocusedRegion(existing.id,{x:picked.x,y:picked.y,z:picked.z});updateAnalysisEditorControls();returnToNavigate();updateThreeEditUi(currentLanguage==='ja'?'領域を選択しました · 「選択領域を削除」で削除できます':'Region selected · use Delete selected region');return}
 set3DBusy(true,currentLanguage==='ja'?'領域を解析中…':'Analyzing region…',false);await frameYield();
 let ok=false;try{ok=await analyzeVolumeAtVoxel(picked.x,picked.y,picked.z,key,false)}finally{set3DBusy(false,'',false)}
 if(ok){updateAnalysisEditorControls();returnToNavigate();updateThreeEditUi(currentLanguage==='ja'?'領域を選択しました · 「選択領域を削除」で削除できます':'Region selected · use Delete selected region')}
}
export async function analyzeVolumeAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const analysisVolume=current3DVolume||volume,[vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,px=w*vx,py=h*vy,pz=d*vz;
 let key,x,y,z;
 if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){
  setGpuComputeBackend('WEBGPU VOLUME PICK');
  const picked=await sceneState.medicalVolume.pick(event.clientX,event.clientY,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);
  if(!picked){renderAnalysisResults(tr('volumeHint'));return}
  key=picked.key;x=picked.x;y=picked.y;z=picked.z;
 }else{
  const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(sceneState.obj.children,true),analysisHit=hits.find(h=>h.object?.userData?.analysisRegionId!=null);
  if(analysisHit){const region=analysisRegionById(analysisHit.object.userData.analysisRegionId);if(region){const picked=surfacePointerVoxel(event,canvas,camera,region.segmentKeys[0]);setAnalysisFocusedRegion(region.id,picked?{x:picked.x,y:picked.y,z:picked.z}:null);return}}
  const hit=hits.find(h=>segmentKeyFromIntersection(h));
  if(!hit){renderAnalysisResults(tr('volumeHint'));return}
  key=segmentKeyFromIntersection(hit);const scale=hit.object.userData.displayScale,local=hit.object.worldToLocal(hit.point.clone());
  x=Math.round((local.x/scale+px/2)/vx);y=Math.round((-local.y/scale+py/2)/vy);z=Math.round((local.z/scale+pz/2)/vz);
 }
 await analyzeVolumeAtVoxel(x,y,z,key);
}
export async function connectedComponentVolume(v,seg,x0,y0,z0,mask=getProcessedSegmentMask(v,seg)){
 const w=v.columns,h=v.rows,d=v.slices,n=w*h*d,data=v.data,visited=new Uint8Array(n);
 let queue=new Int32Array(65536),head=0,tail=0;
 const grow=()=>{const next=new Int32Array(queue.length*2);next.set(queue);queue=next};
 const start=z0*h*w+y0*w+x0;queue[tail++]=start;visited[start]=1;
 let count=0,steps=0;
 const tryPush=i=>{if(i<0||i>=n||visited[i]||!mask[i])return;visited[i]=1;if(tail>=queue.length)grow();queue[tail++]=i};
 while(head<tail){
  const i=queue[head++];count++;
  const z=Math.floor(i/(h*w)),rem=i-z*h*w,y=Math.floor(rem/w),x=rem-y*w;
  if(x>0)tryPush(i-1);if(x<w-1)tryPush(i+1);if(y>0)tryPush(i-w);if(y<h-1)tryPush(i+w);if(z>0)tryPush(i-h*w);if(z<d-1)tryPush(i+h*w);
  if((++steps&0x3ffff)===0)await frameYield();
 }
 return{voxels:count,mm3:count*v.spacing[0]*v.spacing[1]*v.spacing[2],mask:visited};
}
export function createAnalysisMaterial(color=0x00d8ff){
 return new THREE.MeshStandardMaterial({
  color,emissive:color,emissiveIntensity:.55,transparent:true,opacity:.92,
  roughness:.35,metalness:0,side:THREE.DoubleSide,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,flatShading:!surfaceSmoothingActive()
 });
}
export function clearAllSegmentEdits(){
 for(const key of SEGMENT_PRESET_ORDER){const st=segmentEditState[key];if(st.surfaceGroup?.parent)st.surfaceGroup.parent.remove(st.surfaceGroup);st.surfaceGroup=null;clearSegmentEditCache(key,true)}
 setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);clearCutResultPreview();updateThreeEditUi();
}
export function scheduleAnalysisRunPrewarm(){
 const v=current3DVolume||volume;
 if(!v?.sourceBacked||!sourceFilterStages().length)return;
 const keys=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key]?.active&&segmentState[key]?.enabled);
 setTimeout(async()=>{
  for(const key of keys){
   if(!volumeAnalysisMode||(current3DVolume||volume)!==v||!segmentState[key]?.active)return;
   try{await ensureSegmentBaseRuns(key,v,null,true)}catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('Background analysis prewarm failed for '+key+'; analysis will compute on demand.',e);return}
  }
 },300);
}
export function snapshotAnalysisRegionsForSegment(key){
 return analysisRegions.filter(r=>r.segmentKeys.length===1&&r.segmentKeys[0]===key).map(r=>({
  runsBySlice:r.runsBySlice,color:r.color,visible:r.visible,selected:r.selected,focused:r.id===analysisFocusedRegionId,merged:r.merged,groupId:r.groupId||null
 }));
}
export function editSnapshot(key){const st=segmentEditState[key];return{keepRuns:st.keepRuns,excludeRuns:st.excludeRuns,cutRuns:st.cutRuns,rawCutSurface:!!st.rawCutSurface,analysisRefs:snapshotAnalysisRegionsForSegment(key)}}
export function pushEditUndo(key){const st=segmentEditState[key];st.undo.push(editSnapshot(key));if(st.undo.length>20)st.undo.shift();st.redo=[]}
export function restoreEditSnapshot(key,snap){const st=segmentEditState[key];st.keepRuns=snap?.keepRuns||null;st.excludeRuns=snap?.excludeRuns||null;st.cutRuns=snap?.cutRuns||null;st.rawCutSurface=!!snap?.rawCutSurface;st.finalRuns=null;st.revision++}
export async function rebuildEditedAnalysisForSegment(key,referenceRegions=null){
 const v=current3DVolume||volume;if(!v)return;
 const refs=referenceRegions||snapshotAnalysisRegionsForSegment(key);
 for(const region of analysisRegions.filter(r=>r.segmentKeys.includes(key)))disposeAnalysisRegionMesh(region);
 setAnalysisRegions(analysisRegions.filter(r=>!r.segmentKeys.includes(key)));setAnalysisFocusedRegionId(null);
 if(!refs.length){renderAnalysisResults();renderAll();return}
 const runs=await getFinalSegmentRuns(key,v),comps=componentsFromRuns(runs,v.columns,v.rows,v.slices),usedRefs=new Map();let focusId=null,created=0;
 for(const comp of comps){
  const matches=refs.filter(ref=>analysisRunsOverlap(comp.runsBySlice,ref.runsBySlice));if(!matches.length)continue;
  const primary=matches[0],used=usedRefs.get(primary)||0;usedRefs.set(primary,used+1);
  const id=incNextAnalysisRegionId(false),voxels=comp.voxels,mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
  const region={id,regionId:'r'+id,groupId:used===0?primary.groupId:null,key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels,mm3,merged:used===0&&!!primary.merged,selected:!!primary.selected,focused:false,visible:primary.visible!==false,meshGroup:null,color:used===0?primary.color:nextAnalysisColor()};
  analysisRegions.push(region);await attachAnalysisRegion(region,v);if(primary.focused&&focusId==null)focusId=id;
  created++;if(created>=64)break;
 }
 if(focusId!=null)setAnalysisFocusedRegion(focusId);else{renderAnalysisResults();renderAll()}
}
// Group the edit targets by segment: keep / delete apply per segment.
function editTargetsBySegment(){
 const byKey=new Map();for(const r of editTargetRegions()){const key=r.segmentKeys[0];if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(r)}
 return byKey;
}
export async function applyEditKeepSelected(){
 const byKey=editTargetsBySegment();if(!byKey.size)return;const v=current3DVolume||volume;
 const plans=[...byKey].map(([key,regions])=>{
  const runs=regions.reduce((acc,r)=>acc?unionRunArrays(acc,r.runsBySlice,v.slices):r.runsBySlice,null);
  return{key,runs,refs:snapshotAnalysisRegionsForSegment(key).filter(ref=>analysisRunsOverlap(ref.runsBySlice,runs))};
 });
 for(const {key,runs} of plans){const st=segmentEditState[key];pushEditUndo(key);st.keepRuns=runs;st.excludeRuns=null;st.finalRuns=null;st.revision++}
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{for(const {key,refs} of plans){await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,refs)}}
 footer.textContent=currentLanguage==='ja'?'選択領域だけを残しました':'Kept the selected region only';
 returnToNavigate();
}
export async function applyEditRemoveSelected(){
 const byKey=editTargetsBySegment();if(!byKey.size)return;const v=current3DVolume||volume;
 const plans=[...byKey].map(([key,regions])=>{
  const runs=regions.reduce((acc,r)=>acc?unionRunArrays(acc,r.runsBySlice,v.slices):r.runsBySlice,null);
  return{key,runs,refs:snapshotAnalysisRegionsForSegment(key).filter(ref=>!analysisRunsOverlap(ref.runsBySlice,runs))};
 });
 set3DBusy(true,currentLanguage==='ja'?'選択領域を削除中…':'Deleting selected region…',false);await frameYield();
 try{
  for(const {key,runs} of plans){const st=segmentEditState[key];pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,runs,v.slices);st.finalRuns=null;st.revision++}
  if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{for(const {key,refs} of plans){await refreshEditedSegmentSurface(key,v);await rebuildEditedAnalysisForSegment(key,refs)}}
  footer.textContent=currentLanguage==='ja'?'選択領域を削除しました':'Deleted the selected region';
  returnToNavigate();
 }finally{set3DBusy(false,'',false)}
}
export async function undoSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].undo.length);if(!key)return;setAnalysisEditTargetKey(key);const st=segmentEditState[key],snap=st.undo.pop();if(!snap)return;st.redo.push(editSnapshot(key));restoreEditSnapshot(key,snap);
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[])}
 updateAnalysisEditorControls();footer.textContent='Undo';
}
export async function redoSegmentEdit(){
 const key=analysisEditTargetKey&&segmentEditState[analysisEditTargetKey].redo.length?analysisEditTargetKey:SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].redo.length);if(!key)return;setAnalysisEditTargetKey(key);const st=segmentEditState[key],snap=st.redo.pop();if(!snap)return;st.undo.push(editSnapshot(key));restoreEditSnapshot(key,snap);
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[])}
 updateAnalysisEditorControls();footer.textContent='Redo';
}
export async function resetFocusedSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditActive(k));if(!key)return;setAnalysisEditTargetKey(key);const refs=snapshotAnalysisRegionsForSegment(key);pushEditUndo(key);const st=segmentEditState[key];st.keepRuns=null;st.excludeRuns=null;st.cutRuns=null;st.rawCutSurface=false;st.finalRuns=null;st.revision++;
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);if(refs.length)await rebuildEditedAnalysisForSegment(key,refs)}
 updateAnalysisEditorControls();footer.textContent=currentLanguage==='ja'?'編集をリセットしました':'Edits reset';
}
export async function applyCutStroke(points,key=analysisEditTargetKey,mode='pen'){
 if(!key||!SEGMENT_PRESET_ORDER.includes(key)||!points?.length)return false;
 const v=current3DVolume||volume;if(!v)return false;
 const label=tr(key)||key,st=segmentEditState[key],refs=snapshotAnalysisRegionsForSegment(key);
 try{
  const cut=cutRunsFromVoxelStroke(v,points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,mode,+analysisCutOffset.value||0);
  const cutVoxels=analysisRunsVoxelCount(cut);
  if(!cutVoxels)throw new Error(currentLanguage==='ja'?'切断空間のボクセル化に失敗しました':'Cut volume voxelization produced no voxels');
  pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,cut,v.slices);st.cutRuns=unionRunArrays(st.cutRuns,cut,v.slices);st.rawCutSurface=true;st.finalRuns=null;st.revision++;setAnalysisEditTargetKey(key);
  console.info('[VRL CUT] solid voxel mask',{key,cutVoxels,widthMm:cutWidthMm(),depthMm:+analysisCutDepth.value||5});
  const revision=st.revision;
  if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){
   syncGpuVolumeEdits(sourceVolume||volume);if(refs.length)clearAnalysisHighlight();
   footer.textContent=currentLanguage==='ja'?label+'の切断をGPUボリュームへ反映しました':'Cut applied to GPU volume: '+label;
   updateThreeEditUi(currentLanguage==='ja'?'切断済み · GPUボリューム更新済み':'Cut applied · GPU volume updated');return true;
  }
  footer.textContent=currentLanguage==='ja'?label+'を切断しました · 3D更新中…':'Cut '+label+' · updating 3D…';
  updateThreeEditUi(currentLanguage==='ja'?'切断済み · 3D更新中…':'Cut applied · updating 3D…');
  const current=await refreshEditedSegmentSurface(key,v,revision);
  if(!current||st.revision!==revision)return false;
  if(refs.length){updateThreeEditUi(currentLanguage==='ja'?'3D更新済み · 解析更新中…':'3D updated · refreshing analysis…');await rebuildEditedAnalysisForSegment(key,refs);if(st.revision!==revision)return false}
  footer.textContent=currentLanguage==='ja'?label+'の切断を反映しました':'Cut applied to '+label;return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent=(currentLanguage==='ja'?'切断後の更新に失敗しました: ':'Cut refresh failed: ')+String(e.message||e);updateThreeEditUi(currentLanguage==='ja'?'切断後の更新に失敗しました':'Cut refresh failed')}
  return false;
 }finally{clearThreeEditOverlay();request3DRender()}
}
export function ensureAnalysisRoot(){
 if(sceneState?.analysisMesh?.parent===sceneState?.obj)return sceneState.analysisMesh;
 const root=new THREE.Group();root.name='analysis_regions';sceneState.analysisMesh=root;sceneState?.obj?.add(root);return root;
}
export async function buildAnalysisRunsGroup(v,runsBySlice,key,id,color){
 const d=v.slices,coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial(color));mesh.name='analysis_'+key+'_'+id+'_'+z;mesh.renderOrder=20;mesh.userData.analysisRegionId=id;mesh.userData.displayScale=coords.scale;group.add(mesh)};
 for(let z=0;z<d;z++){
  appendAnalysisRunBoundaryFaces(builder,runsBySlice[z],z>0?runsBySlice[z-1]:null,z+1<d?runsBySlice[z+1]:null,coords,z);
  if(builder.length>=floatLimit)flush(z);if((z&31)===0)await frameYield();
 }
 flush(d-1);return group.children.length?group:null;
}
export async function attachAnalysisRegion(region,v,forExport=false){
 // GPU volume view: regions are coloured inside the volume (syncVolumeAnalysisOverlay), no mesh.
 // STL export still needs the mesh (built on demand, kept hidden in volume view).
 if(!forExport&&volumeAnalysisOverlayActive()){request3DRender();return}
 const group=await buildAnalysisRunsGroup(v,region.runsBySlice,region.key,region.id,region.color);region.meshGroup=group;if(group){group.visible=region.visible;ensureAnalysisRoot().add(group)}request3DRender();
}
// New regions start ticked (owner: having to tick each analysed part before
// keep/delete selected is poor UX); untick one to leave it out.
export async function addAnalysisRegion(v,{key,segmentKeys,runsBySlice,voxels,mm3,merged=false}){
 const existing=analysisRegions.find(r=>r.segmentKeys.includes(key)&&analysisRunsOverlap(r.runsBySlice,runsBySlice));
 if(existing){existing.selected=true;existing.visible=true;if(existing.meshGroup)existing.meshGroup.visible=true;renderAnalysisResults();request3DRender();return existing}
 const id=incNextAnalysisRegionId(false),region={id,regionId:'r'+id,groupId:merged?'g'+id:null,key,segmentKeys:[...new Set(segmentKeys)],runsBySlice,voxels,mm3,merged,selected:true,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};
 analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);return region;
}
export async function mergeSelectedAnalysisRegions(){
 if(volumeAnalysisBusy)return;const selected=analysisRegions.filter(r=>r.selected);if(selected.length<2){renderAnalysisResults(tr('mergeNeedsTwo'));return}
 const v=current3DVolume||volume;if(!v)return;setVolumeAnalysisBusy(true);renderAnalysisResults(tr('mergingRegions'));
 try{
  const runsBySlice=unionAnalysisRuns(selected,v.slices),voxels=analysisRunsVoxelCount(runsBySlice),mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2],segmentKeys=[...new Set(selected.flatMap(r=>r.segmentKeys))],key=segmentKeys.length===1?segmentKeys[0]:'merged';
  for(const region of selected)disposeAnalysisRegionMesh(region);
  const ids=new Set(selected.map(r=>r.id));setAnalysisRegions(analysisRegions.filter(r=>!ids.has(r.id)));
  const id=incNextAnalysisRegionId(false),region={id,regionId:'r'+id,groupId:'g'+id,key,segmentKeys,runsBySlice,voxels,mm3,merged:true,selected:true,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);
 }finally{setVolumeAnalysisBusy(false);renderAnalysisResults()}
}
export function volumeAnalysisOverlayActive(){return threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active&&!volumeAnalysisOverlayFailed.value}
export const volumeAnalysisOverlayFailed={value:false};
export function syncVolumeAnalysisOverlay(){
 const mv=sceneState?.medicalVolume,v=current3DVolume||volume;
 if(volumeAnalysisOverlayActive()){
  for(const r of analysisRegions)if(r.meshGroup)r.meshGroup.visible=false;
  const shown=analysisRegions.filter(r=>r.visible&&r.runsBySlice);
  const signature=(mv.seriesId||'')+'|'+(mv.textureDims||[]).join('x')+'|'+shown.map(r=>r.id+':'+r.color+':'+(r.focused?1:0)+':'+r.voxels).join(',');
  try{mv.setAnalysisRuns(shown.map(r=>({runs:r.runsBySlice,color:Number(r.color??0x00d8ff),focused:!!r.focused})),v,signature)}
  catch(e){console.warn('GPU volume analysis overlay failed; using region meshes.',e);volumeAnalysisOverlayFailed.value=true;mv.clearAnalysisRuns?.();for(const r of analysisRegions)if(r.visible&&!r.meshGroup)void attachAnalysisRegion(r,v)}
  return;
 }
 if(mv?.analysisOverlaySignature)mv.clearAnalysisRuns();
 if(!v||!sceneState?.obj)return;
 for(const r of analysisRegions){
  if(r.meshGroup){r.meshGroup.visible=r.visible;continue}
  if(r.visible&&!r.meshPending){r.meshPending=true;attachAnalysisRegion(r,v).finally(()=>{r.meshPending=false})}
 }
}
export async function render3DSmoothIsosurface(v){
 if(!sceneState||!surfaceSmoothingActive())return false;
 const revision=incSourceRenderRevision(true),previous=sceneState.obj,group=new THREE.Group();if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 set3DBusy(true,'3D等値面を構築中…');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';
 try{
  for(let ai=0;ai<active.length;ai++){
   const {key,seg}=active[ai];if(revision!==sourceRenderRevision){dispose(group);return null}
   footer.textContent=(currentLanguage==='ja'?'滑らかな3D表面を構築中… ':'Building smooth 3D surface… ')+(ai+1)+' / '+active.length;
   let mask;
   if(v.sourceBacked){
    const runs=await ensureSegmentBaseRuns(key,v);if(revision!==sourceRenderRevision){dispose(group);return null}
    mask=maskFromAnalysisRuns(v,runs);
   }else mask=getProcessedSegmentMask(v,seg);
   const mesh=await buildSmoothIsoMesh(v,mask,seg,key,false);if(mesh)group.add(mesh);await frameYield();
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(active.length&&!group.children.some(o=>o?.isMesh))throw new Error('Smooth isosurface produced no mesh');
  if(previous){previous.parent?.remove(previous);dispose(previous)}sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  setGpuComputeBackend('CPU ISOSURFACE · WEBGPU RENDER');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';footer.textContent=currentLanguage==='ja'?'3D滑面表示 · フル解像度':'3D smooth surface · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){dispose(group);set3DBusy(false);console.error(e);threeLabel.textContent=(sceneState.backend||'3D')+' · smooth surface error';footer.textContent='3D isosurface error: '+String(e.message||e);mark3DStale();request3DRender();return false}
}
export function segmentKeyFromIntersection(hit){
 const direct=hit?.object?.userData?.segmentKey;if(direct)return direct;
 const mi=hit?.face?.materialIndex,ranges=hit?.object?.userData?.segmentRanges;
 if(Array.isArray(ranges)&&Number.isInteger(mi)){const match=ranges.find(r=>r.materialIndex===mi);if(match)return match.key}
 return null;
}
export function cutRaycastSourceMeshes(key=null){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{
  if(!o.isMesh||o.userData?.cutResultPreview)return;
  const hasSegment=!!o.userData?.segmentKey||Array.isArray(o.userData?.segmentRanges)&&o.userData.segmentRanges.length;
  if(!hasSegment)return;
  if(key&&meshSegmentRanges(o,key).length===0)return;
  meshes.push(o);
 });return meshes;
}
export function currentSegmentMeshes(key){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(o.isMesh&&o.geometry&&meshSegmentRanges(o,key).length)meshes.push(o)});return meshes;
}
export function currentSegmentDisplayScale(key){
 const mesh=currentSegmentMeshes(key)[0];return Number(mesh?.userData?.displayScale)||1;
}
export function currentSegmentVolumeMm3(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return 0;
 const scale=currentSegmentDisplayScale(key),inv3=1/Math.max(scale*scale*scale,1e-18),cross=new THREE.Vector3();let signed=0;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(a,b,c)=>{signed+=a.dot(cross.crossVectors(b,c))/6});
 return Math.abs(signed)*inv3;
}
export function currentSegmentTriangleCount(key){
 let count=0;for(const mesh of currentSegmentMeshes(key))for(const range of meshSegmentRanges(mesh,key))count+=Math.floor(range.count/3);return count;
}
export async function exportFocusedAnalysisRegionStl(){
 const region=analysisRegionById(analysisFocusedRegionId),v=current3DVolume||volume;if(!region||!v)return;if(!region.meshGroup)await attachAnalysisRegion(region,v,true);
 const scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale,blob=groupToBinaryStl(region.meshGroup,'region-'+region.id,1/Math.max(scale,1e-12));if(!blob)return;
 const filename='virtual-rodent-region-'+region.id+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
export function currentSegmentToBinaryStl(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return null;
 const triCount=currentSegmentTriangleCount(key),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer),header=new TextEncoder().encode('Virtual Rodent Lab '+key);
 new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));view.setUint32(80,triCount,true);
 const scale=currentSegmentDisplayScale(key),inverseScale=1/Math.max(scale,1e-12),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();let off=84;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(aa,bb,cc)=>{
  const a=aa.clone().multiplyScalar(inverseScale),b=bb.clone().multiplyScalar(inverseScale),c=cc.clone().multiplyScalar(inverseScale);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 });
 return new Blob([buffer],{type:'model/stl'});
}
export async function exportSegmentStl(key){
 if(!sceneState?.obj||threeDDirty){footer.textContent=currentLanguage==='ja'?'STL: 先に3Dを再構築してください':'STL: rebuild 3D first';return}
 let blob=null;
 if(segmentEditActive(key)){
  if(!segmentEditState[key].surfaceGroup)await refreshEditedSegmentSurface(key);
  const v=current3DVolume||volume,scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;blob=groupToBinaryStl(segmentEditState[key].surfaceGroup,'edited-'+key,1/Math.max(scale,1e-12));
 }else{
  try{await ensureGpuResidentCpuPositions(key,currentLanguage==='ja'?'STL用メッシュを取得中':'Preparing STL mesh')}catch(e){console.error(e);footer.textContent='STL readback error: '+String(e.message||e);return}
  blob=currentSegmentToBinaryStl(key);
 }
 if(!blob){footer.textContent='STL: segment is empty';return}
 const names={bone:'bone',soft:'soft-tissue',fat:'fat',lung:'lung'},filename='virtual-rodent-'+(names[key]||key)+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
export function cutPointerVoxel(event,canvas,camera,preferredKey=null){
 return surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey);
}
