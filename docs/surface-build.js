// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { mark3DStale, mark3DCurrent } from './three-state.js?v=20261005-build441';
import { set3DBusy } from './three-status.js?v=20261005-build441';
import { sceneState, deferAutomatic3D, threeDCancelRequested, currentLanguage, analysisEditTool, threeRenderMode, current3DVolume, volume, incSourceRenderRevision, sourceRenderRevision, sectionViewOpen, sectionViewPlane, sourceVolume } from './state.js?v=20261005-build441';
import { request3DRender } from './scene3d.js?v=20261005-build441';
import { threeLabel, footer, surfaceSmoothStrength } from './ui-shell.js?v=20261005-build441';
import { surfaceSmoothingActive, strongSurfaceSmoothingActive } from './settings.js?v=20261005-build441';
import { frameYield, isDesktopRuntime } from './utils.js?v=20261005-build441';
import { gpuFilterRuntime, setGpuComputeBackend, ensureGpuFilterDevice, runGpuSourceFilters, gpuStagesSupported } from './gpu-compute.js?v=20261005-build441';
import { setProcessingBusy } from './busy.js?v=20261005-build441';
import { SEGMENT_PRESET_ORDER, segmentEditState, segmentEditActive, segmentState, segmentNeedsGlobalMask, sourceMprMemoryView, sourceMemoryUsable } from './segments.js?v=20261005-build441';
import { dispose, buildEditableRunsGroup, geometryFromSourcePositions, consolidateSegmentForStrongSmoothing } from './surface-mesh.js?v=20261005-build441';
import { renderAll } from './mpr-render.js?v=20261005-build441';
import { getFinalSegmentRuns, thresholdRunsFromMemory, decodeSourceSegmentMasks } from './segment-runs.js?v=20261005-build441';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { updateSectionClipPlaneWorld } from './section-view.js?v=20261005-build441';
import { makeVolume3DCoordinates, Float32FaceBuilder, appendSourceFacesFromCompactTile, makeSource3DCoordinates, appendSourceSliceFacesFast } from './mesh-geometry.js?v=20261005-build441';
import { fitSourceTile, readMemoryRegion, sourceFilterStages, sourceFilterRuntime, sourceFilterHalo, readSourceRegion, runSourceFilterWorker } from './source-filters.js?v=20261005-build441';
import { compactFaceFlags, valuesToFaceFlags } from './mask-ops.js?v=20261005-build441';
export function applySectionClippingMaterials(root=sceneState?.obj){
 if(!root||!sceneState)return;
 const active=sectionViewOpen&&!!sectionViewPlane&&sceneState.backend!=='WEBGPU';
 root.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.clippingPlanes=active?[sceneState.sectionClipPlane]:null;m.clipShadows=false;m.needsUpdate=true}});
}
export function syncSectionClipParent(){
 if(!sceneState?.obj)return;
 const active=sectionViewOpen&&!!sectionViewPlane;
 if(sceneState.backend==='WEBGPU'&&sceneState.sectionClipGroup){
  const g=sceneState.sectionClipGroup;
  if(active){if(sceneState.obj.parent!==g)g.add(sceneState.obj);g.enabled=true;g.clippingPlanes=[sceneState.sectionClipPlane]}
  else{g.enabled=false;g.clippingPlanes=[];if(sceneState.obj.parent===g){g.remove(sceneState.obj);sceneState.scene.add(sceneState.obj)}}
 }else{
  sceneState.renderer.localClippingEnabled=true;
  applySectionClippingMaterials(sceneState.obj);
 }
}
export function gpuMeshBlockDepth(){
 if(navigator.maxTouchPoints>0)return 2;
 if(!isDesktopRuntime())return 4;
 const cap=Number(gpuFilterRuntime.device?.limits?.maxStorageBufferBindingSize)||128*1024*1024;
 return cap>=256*1024*1024?32:cap>=128*1024*1024?16:12;
}
export function gpuMeshTileStart(){return isDesktopRuntime()?[1024,1024]:[192,64]}
export function gpuResidentSurfaceDrawBudget(){
 if(navigator.maxTouchPoints>0)return 0;
 return isDesktopRuntime()?48:24;
}
export function shouldUseGpuResidentSurface(w,h,d,tx,ty,blockDepth,segmentCount){
 const budget=gpuResidentSurfaceDrawBudget();if(budget<=0)return false;
 const tilesPerBlock=Math.ceil(w/Math.max(1,tx))*Math.ceil(h/Math.max(1,ty));
 const blocks=Math.ceil(d/Math.max(1,blockDepth));
 const estimatedDraws=tilesPerBlock*blocks*Math.max(1,segmentCount||1);
 return estimatedDraws<=budget;
}
export function gpuCapacityError(error){
 const m=String(error?.message||error||'').toLowerCase();
 return m.includes('__gpu_smooth_capacity__')||m.includes('out of memory')||m.includes('allocation')||m.includes('buffer limit')||m.includes('binding size')||m.includes('maxstoragebufferbindingsize')||m.includes('maxbuffersize');
}
export async function processSourceRegionFaces(series,target,stages,key,revision,segments,gpuResident=true){
 const halo=Math.max(1,sourceFilterHalo(stages)),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const compact=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:series.columns,globalH:series.rows,globalD:series.slices.length,spacingX:series.spacingX,spacingY:series.spacingY,spacingZ:series.spacingZ,mesh:true,gpuResident});
   if(compact?.mesh||compact?.compact){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return compact}
  }catch(e){
   if(gpuCapacityError(e))throw e;
   gpuFilterRuntime.lastError='mesh: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU face extraction failed; using exact CPU face extraction path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:{x:0,y:0,z:0,width:box.width,height:box.height,depth:box.depth}};
 const filtered=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return compactFaceFlags(valuesToFaceFlags(filtered,box.width,box.height,box.depth,localTarget,segments,box,series));
}
export async function getFilteredSourceAxialFaceBlock(zStart,coreDepth,series,segments,keyPrefix='3d-face-block'){
 const stages=sourceFilterStages();
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=Math.max(1,sourceFilterHalo(stages)),outDepth=Math.min(d-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(w,h,outDepth,halo,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(w,h,d,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,w-x),height:Math.min(ty,h-y),depth:outDepth});
 while(queue.length){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const target=queue.shift();
  try{
   const compact=await processSourceRegionFaces(series,target,stages,keyPrefix+':'+zStart+':'+target.x+':'+target.y,revision,segments,gpuResident);
   if(compact.mesh){if(compact.gpuResident||compact.vertices?.length)tiles.push(compact);}
   else if(compact.items.length)tiles.push({...target,items:compact.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{tiles,coreDepth:outDepth};
}
export async function processMemoryMeshRegion(v,target,segments,gpuResident=true){
 const halo=1,x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const [sx,sy,sz]=v.spacing;
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,[],local,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:v.columns,globalH:v.rows,globalD:v.slices,spacingX:sx,spacingY:sy,spacingZ:sz,mesh:true,gpuResident});
 if(result?.mesh||result?.compact)return result;
 throw new Error('__GPU_UNAVAILABLE__');
}
export async function getMemoryGpuMeshBlock(v,zStart,coreDepth,segments){
 const outDepth=Math.min(v.slices-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(v.columns,v.rows,outDepth,1,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(v.columns,v.rows,v.slices,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<v.rows;y+=ty)for(let x=0;x<v.columns;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,v.columns-x),height:Math.min(ty,v.rows-y),depth:outDepth});
 while(queue.length){
  const target=queue.shift();
  try{
   const result=await processMemoryMeshRegion(v,target,segments,gpuResident);
   if(result.mesh){if(result.gpuResident||result.vertices?.length)tiles.push(result)}
   else if(result.items.length)tiles.push({...target,items:result.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 return{tiles,coreDepth:outDepth};
}
export function setBaseSegmentSurfaceVisibility(key,visible){
 sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||o.userData?.editSurface)return;
  if(o.userData?.segmentKey===key){o.visible=visible;return}
  if(Array.isArray(o.userData?.segmentRanges)&&Array.isArray(o.material))for(const r of o.userData.segmentRanges)if(r.key===key&&o.material[r.materialIndex])o.material[r.materialIndex].visible=visible;
 });
}
export function segmentUsesRunSurface(key,v=current3DVolume||volume){
 return segmentEditActive(key)||!!(v?.sourceBacked&&segmentState[key]?.active&&segmentState[key]?.enabled&&segmentNeedsGlobalMask(segmentState[key]));
}
export async function refreshEditedSegmentSurface(key,v=current3DVolume||volume,expectedRevision=null){
 if(!sceneState?.obj||!v)return false;const st=segmentEditState[key],isCurrent=()=>expectedRevision==null||st.revision===expectedRevision;
 if(!segmentUsesRunSurface(key,v)){
  if(!isCurrent())return false;
  if(st.surfaceGroup){const old=st.surfaceGroup;if(old.parent)old.parent.remove(old);dispose(old);st.surfaceGroup=null}
  setBaseSegmentSurfaceVisibility(key,true);request3DRender();renderAll();return true;
 }
 const runs=await getFinalSegmentRuns(key,v);if(!isCurrent())return false;
 const group=await buildEditableRunsGroup(v,runs,key,isCurrent);if(!isCurrent()){if(group)dispose(group);return false}
 const old=st.surfaceGroup;setBaseSegmentSurfaceVisibility(key,false);st.surfaceGroup=group;
 if(group)sceneState.obj.add(group);if(old){if(old.parent)old.parent.remove(old);dispose(old)}
 request3DRender();renderAll();return true;
}
export async function restoreEditedSegmentSurfaces(v=current3DVolume||volume){
 for(const key of SEGMENT_PRESET_ORDER)if(segmentUsesRunSurface(key,v))await refreshEditedSegmentSurface(key,v);
}
export function appendGpuMeshTile(positionsByKey,normalsByKey,tile,active){
 let faceOffset=0;
 for(let s=0;s<active.length&&s<4;s++){
  const faces=tile.counts[s]||0,floatCount=faces*18;
  if(floatCount){const builder=positionsByKey.get(active[s].key);if(builder){builder.appendArray(tile.vertices.subarray(faceOffset*18,faceOffset*18+floatCount));builder.hasGpuMesh=true;if(!tile.gpuSmoothed)builder.allGpuSmoothed=false;}if(tile.gpuSmoothed&&tile.normals){normalsByKey.get(active[s].key)?.appendArray(tile.normals.subarray(faceOffset*18,faceOffset*18+floatCount));}}
  faceOffset+=faces;
 }
}
export function addGpuResidentTileMesh(group,tile,active,materialParamsByKey,displayScale,name){
 if(!tile?.gpuResident||!tile.positionAttribute)return false;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',tile.positionAttribute);if(tile.normalAttribute)geometry.setAttribute('normal',tile.normalAttribute);
 const materials=[],ranges=[];let start=0,total=0;
 for(let s=0;s<active.length&&s<4;s++){
  const count=(tile.counts[s]||0)*6,key=active[s].key;
  if(count){const materialIndex=materials.length;materials.push(new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));geometry.addGroup(start,count,materialIndex);ranges.push({key,start,count,materialIndex});}
  start+=count;total+=count;
 }
 if(!total){geometry.dispose();return false}
 geometry.setDrawRange(0,total);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3.6);
 const mesh=new THREE.Mesh(geometry,materials);mesh.name=name;mesh.userData.segmentRanges=ranges;mesh.userData.displayScale=displayScale;mesh.userData.gpuResident=true;mesh.userData.gpuPositionReady=false;mesh.userData.gpuCompletion=tile.completion||null;
 if(ranges.length===1)mesh.userData.segmentKey=ranges[0].key;
 group.add(mesh);return true;
}
export async function render3DSourceBacked(v){
 if(!sceneState||!v.series)return;
 const revision=incSourceRenderRevision(true),series=v.series,previous=sceneState.obj;
 const group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 const processedActive=active.filter(({seg})=>segmentNeedsGlobalMask(seg)&&!!v.mprData),streamActive=active.filter(({seg})=>!(segmentNeedsGlobalMask(seg)&&!!v.mprData));
 threeLabel.textContent=(sceneState.backend||'3D')+' · building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);
  syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeSource3DCoordinates(series),positionsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),strongSmooth=strongSurfaceSmoothingActive();
 const materialParamsByKey=new Map(streamActive.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}]));
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,positions=builder.take(),geometry=geometryFromSourcePositions(positions,alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();
  if(geometry){
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));
   mesh.name='segment_'+key+'_full_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
  }
 };
 try{
  for(const {key,seg} of processedActive){
   // build 433: with a filter active the unfiltered memory copy is not the segment's data: use its (filtered) runs
   const runs=sourceMemoryUsable(v)?thresholdRunsFromMemory(sourceMprMemoryView(v),seg):await getFinalSegmentRuns(key,v),processedGroup=await buildEditableRunsGroup(v,runs,key);
   if(processedGroup){processedGroup.name='processed_segment_'+key;group.add(processedGroup)}
   await frameYield();
  }
  const filtered=sourceFilterStages().length>0,useGpuMesh=streamActive.length>0&&(filtered||('gpu' in navigator&&!gpuFilterRuntime.disabled));
  if(useGpuMesh){
   const filterBlockDepth=gpuMeshBlockDepth();
   for(let z0=0;z0<series.slices.length;z0+=filterBlockDepth){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const block=await getFilteredSourceAxialFaceBlock(z0,filterBlockDepth,series,streamActive,'3d:'+revision);
    for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,streamActive,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,streamActive);else appendSourceFacesFromCompactTile(positionsByKey,series,tile,streamActive,coords)}}
    const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+series.slices.length);await frameYield()}
   }
  }else if(streamActive.length){
   let prev=null,curr=await decodeSourceSegmentMasks(series.slices[0],streamActive);
   let next=streamActive.length&&series.slices.length>1?await decodeSourceSegmentMasks(series.slices[1],streamActive):null;
   for(let z=0;z<series.slices.length;z++){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const nz=z+2,nextPromise=streamActive.length&&nz<series.slices.length?decodeSourceSegmentMasks(series.slices[nz],streamActive):Promise.resolve(null);
    for(const {key} of streamActive)appendSourceSliceFacesFast(positionsByKey.get(key),series,z,prev?.get(key),curr.get(key),next?.get(key),coords);
    const flush=(z%chunkDepth===chunkDepth-1)||z===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,z);footer.textContent='3D building · CPU · '+(z+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(z+1)+' / '+series.slices.length);await frameYield()}
    prev=curr;curr=next;next=await nextPromise;
   }
  }
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(strongSmooth){
   for(const {key} of streamActive)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution');
  if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · source DICOM · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · source DICOM · no resampling';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);
  if(revision===sourceRenderRevision){threeLabel.textContent=(sceneState.backend||'3D')+' · build error';footer.textContent='3D build error: '+String(e.message||e);set3DBusy(false);mark3DStale()}
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
 }
}
export async function render3DMemoryGpu(v){
 const device=await ensureGpuFilterDevice();if(!device)return false;
 const revision=incSourceRenderRevision(true),previous=sceneState.obj,group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 threeLabel.textContent=(sceneState.backend||'3D')+' · GPU building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeVolume3DCoordinates(v),positionsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),materialParamsByKey=new Map(active.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}])),strongSmooth=strongSurfaceSmoothingActive();
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,geometry=geometryFromSourcePositions(builder.take(),alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();if(!geometry)return;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));mesh.name='segment_'+key+'_gpu_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
 };
 try{
  const blockDepth=gpuMeshBlockDepth();
  for(let z0=0;z0<v.slices;z0+=blockDepth){
   if(revision!==sourceRenderRevision){dispose(group);return null}
   const block=await getMemoryGpuMeshBlock(v,z0,blockDepth,active);
   for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,active,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,active);else appendSourceFacesFromCompactTile(positionsByKey,{columns:v.columns,rows:v.rows},tile,active,coords)}}
   const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===v.slices-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
   if(flush){for(const {key} of active)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+v.slices;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+v.slices);await frameYield()}
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(strongSmooth){
   for(const {key} of active)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution · GPU');if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · '+gpuFilterRuntime.lastBackend;set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);set3DBusy(false);
  if(revision!==sourceRenderRevision||threeDCancelRequested)return null;
  if(String(e.message||e)!=='__GPU_UNAVAILABLE__')console.warn('GPU decoded-volume mesh failed.',e);
  return false;
 }
}
export async function render3D(v,force=false){
 if(!sceneState)return false;
 if(deferAutomatic3D&&!force){mark3DStale();return false}
 let ok;
 if(v.sourceBacked)ok=await render3DSourceBacked(v);
 else ok=await render3DMemoryGpu(v);
 if(ok!==true){
  if(ok===null||threeDCancelRequested)return false;
  threeLabel.textContent=(sceneState.backend||'3D')+(surfaceSmoothingActive()?' · smooth surface error':' · 3D build error');
  footer.textContent=currentLanguage==='ja'?(surfaceSmoothingActive()?'表面平滑化3Dの構築に失敗しました。以前の3D表示を保持しています。':'3D生成に失敗しました。以前の3D表示を保持しています。'):(surfaceSmoothingActive()?'Smooth 3D build failed. The previous 3D view was preserved.':'3D build failed. The previous 3D view was preserved.');
  mark3DStale();return false;
 }
 await restoreEditedSegmentSurfaces(v);
 if((analysisEditTool==='pen'||analysisEditTool==='line')&&threeRenderMode==='surface'){
  try{await ensureEditRaycastReady(null,currentLanguage==='ja'?'3D編集データを更新中':'Refreshing 3D edit data')}
  catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'3D編集データ更新エラー: ':'3D edit refresh error: ')+String(e.message||e)}
 }
 return true;
}
export function meshSegmentRanges(mesh,key){
 const pos=mesh?.geometry?.getAttribute?.('position');if(!pos)return[];
 if(mesh.userData?.segmentKey===key)return[{start:0,count:mesh.geometry.index?mesh.geometry.index.count:pos.count}];
 return Array.isArray(mesh.userData?.segmentRanges)?mesh.userData.segmentRanges.filter(r=>r.key===key):[];
}
export async function ensureGpuResidentCpuPositions(key=null,label='GPU readback'){
 const renderer=sceneState?.renderer;if(!renderer||typeof renderer.getArrayBufferAsync!=='function')return;
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||!o.userData?.gpuResident||o.userData?.gpuPositionReady)return;if(key&&meshSegmentRanges(o,key).length===0)return;meshes.push(o)});
 if(!meshes.length)return;
 const previousBackend=gpuFilterRuntime.lastBackend;setGpuComputeBackend('WEBGPU GPU-RESIDENT READBACK');setProcessingBusy(true,label);
 try{
  for(const mesh of meshes){
   if(mesh.userData.gpuCompletion)await mesh.userData.gpuCompletion;
   const attr=mesh.geometry.getAttribute('position'),buffer=await renderer.getArrayBufferAsync(attr),values=new Float32Array(buffer);
   if(values.length!==attr.array.length)throw new Error('GPU position readback size mismatch');
   attr.array.set(values);mesh.userData.gpuPositionReady=true;mesh.geometry.computeBoundingSphere();
  }
 }finally{setProcessingBusy(false,label);setGpuComputeBackend(previousBackend)}
}
export function gpuResidentReadbackPending(key=null){
 let pending=false;sceneState?.obj?.traverse?.(o=>{if(pending||!o.isMesh||!o.userData?.gpuResident||o.userData?.gpuPositionReady)return;if(key&&meshSegmentRanges(o,key).length===0)return;pending=true});return pending;
}
export async function ensureEditRaycastReady(key=null,label='3D edit data'){
 for(let attempt=0;attempt<4;attempt++){
  const obj=sceneState?.obj;
  await ensureGpuResidentCpuPositions(key,label);
  if(sceneState?.obj===obj&&!gpuResidentReadbackPending(key))return true;
  await frameYield();
 }
 if(gpuResidentReadbackPending(key))throw new Error('3D edit mesh changed during preparation');
 return true;
}
