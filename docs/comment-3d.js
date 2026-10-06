// Position comments on the 3D view (Issue #88): a numbered dot per comment of the open series, drawn as small HTML elements in a layer
// over the 3D viewport, NOT inside the WebGPU / WebGL scene. One code path serves every 3D mode (GPU volume, surface mesh, WebGL
// fallback) because they all share the same scene object and camera; the dots cost no GPU work and stay crisp at any DPR.
// Position: the voxel {i,j,k} -> the scene's local coordinates with voxelToLocal3D (the mapping of the 3D MPR planes), then the
// object's world matrix and the camera, so rotation / zoom / pan follow by themselves. Updated after every 3D frame (the 3D loop only
// renders on request, so a change of the comments, the switch or the series asks for a render).
// Look (build 465, the same colours and shapes as VR, vr-point-markers.js): an EXPOSED point is a solid dot with a white rim; a point HIDDEN
// behind tissue is a smaller dot in the VR hidden colour (never removed: a lesion inside dense tissue must stay findable); the number is a
// small chip beside the dot. The hidden rule is VR's vr-point.js pointIsHidden over
// the classification bytes of the shown segments (vr-view.js hiddenClsFor, built lazily, in the background), eye = the camera, the section
// view's cut plane included; refreshed at most about 10 times a second while the view moves and once more when it stops
// (comment-3d-hidden.js). Until the bytes are ready, or when no segment is shown / no source data is in memory, every point is exposed.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { sceneState, volume, activeSeries, volumeAnalysisMode, analysisEditTool, sectionViewOpen, sectionViewPlane } from './state.js?v=20261006-build470';
import { tr } from './i18n.js?v=20261006-build470';
import { datasetFingerprint } from './project-file.js?v=20261006-build470';
import { voxelToLocal3D } from './crosshair.js?v=20261006-build470';
import { getComments, onCommentsChange, commentMatchesSeries, commentTarget, getMarkersShown, onMarkersShownChange } from './comments.js?v=20261006-build470';
import { request3DRender } from './scene3d.js?v=20261006-build470';
import { gpuVolumeTarget } from './gpu-volume-data.js?v=20261006-build470';
import { segmentState, segmentEditState, SEGMENT_PRESET_ORDER } from './segments.js?v=20261006-build470';
import { sectionLocalPoint, sectionLocalNormal } from './section-view.js?v=20261006-build470';
import { planeRelations, boxHalfExtent, clipSegmentNear } from './comment-3d-section.js?v=20261006-build470';
import { computeHiddenIds, shownChannels, sectionPlaneLocal, createHiddenThrottle } from './comment-3d-hidden.js?v=20261006-build470';

let host=null,layer=null,bubble=null,bubbleId=null,bubbleTimer=0;
let rels=new Map(),relSig='',svg=null,cuesOn=false;
let hiddenIds=new Set(),hiddenSig='',hiddenTimer=0,vrMod=null,vrModLoading=false,vrModFailed=false;
const throttle=createHiddenThrottle();
const els=new Map(); // comment id -> {el,x,y,vis,no}
const v3=new THREE.Vector3(),c3=new THREE.Vector3(),eye3=new THREE.Vector3(),p3=new THREE.Vector3(),q3=new THREE.Vector3();

export function closeBubble3d(){clearTimeout(bubbleTimer);bubbleId=null;if(bubble)bubble.hidden=true}
function placeBubble(){
 if(!bubble||bubbleId==null)return;
 const m=els.get(bubbleId),c=getComments().find(x=>x.id===bubbleId);
 if(!m||!m.vis||!c){closeBubble3d();return}
 const n=getComments().findIndex(x=>x.id===bubbleId)+1;
 bubble.querySelector('.comment-bubble-no').textContent=n;bubble.querySelector('.comment-bubble-text').textContent=c.text||'—';
 const W=host.clientWidth,bw=Math.min(260,W-16);bubble.style.maxWidth=bw+'px';
 bubble.style.left=Math.max(8,Math.min(W-bw-8,m.x-bw/2))+'px';bubble.style.top=Math.max(8,m.y+20)+'px';
}
function showBubble3d(id){
 if(!bubble){bubble=document.createElement('div');bubble.className='comment-bubble comment-bubble-3d';bubble.setAttribute('role','status');bubble.innerHTML='<b class="comment-bubble-no"></b><span class="comment-bubble-text"></span>';host.appendChild(bubble)}
 bubbleId=id;bubble.hidden=false;placeBubble();
 clearTimeout(bubbleTimer);bubbleTimer=setTimeout(closeBubble3d,7000);
}


// what the hidden judgement depends on, as a string: the series and its filter, the view (object + camera matrices), the points, the shown
// segments and their edits, the section plane. A change of it makes the judgement due (throttled); the same string = nothing to do.
function hiddenSignature(obj,camera,ids,plane,fp){
 const segs=SEGMENT_PRESET_ORDER.map(k=>{const g=segmentState[k]||{};return(g.active?1:0)+''+(g.enabled?1:0)+','+g.min+','+g.max+','+(segmentEditState[k]?.revision|0)}).join(';');
 return fp+'|'+(gpuVolumeTarget()?.filterSignature||'')+'|'+obj.matrixWorld.elements.join(',')+'|'+camera.matrixWorld.elements.join(',')+'|'+ids.join(',')+'|'+segs+'|'+(plane?[plane.x,plane.y,plane.z,plane.w].join(','):'');
}
const refreshSoon=()=>request3DRender();
// frees the classification bytes (series change, markers hidden): the next judgement builds them again
function releaseHidden(){clearTimeout(hiddenTimer);hiddenTimer=0;hiddenIds=new Set();hiddenSig='';throttle.reset();vrMod?.releaseHiddenCls?.()}
// the throttled judgement: returns true when the hidden set changed
function refreshHidden(obj,camera,pts,plane){
 const anyShown=SEGMENT_PRESET_ORDER.some(k=>segmentState[k]?.active&&segmentState[k]?.enabled);
 if(!anyShown||!pts.length){const had=hiddenIds.size>0;hiddenIds=new Set();return had}
 if(vrModFailed)return false; // the builder could not be loaded: every point stays exposed
 if(!vrMod){ // the classification builder lives in vr-view.js: loaded once, on the first need; until then the previous judgement stays
  if(!vrModLoading){vrModLoading=true;import('./vr-view.js?v=20261006-build470').then(m=>{vrMod=m;throttle.reset();refreshSoon()},()=>{vrModFailed=true;if(hiddenIds.size){hiddenIds=new Set();refreshSoon()}})}
  return false;
 }
 const prep=vrMod.hiddenClsFor(()=>{throttle.reset();refreshSoon()});
 if(!prep)return false; // still being built: keep the previous judgement
 const chs=shownChannels(prep?.cls,segmentState,SEGMENT_PRESET_ORDER);
 eye3.setFromMatrixPosition(camera.matrixWorld);obj.worldToLocal(eye3);
 const eye={x:eye3.x,y:eye3.y,z:eye3.z};
 const next=computeHiddenIds(pts,eye,prep,{chs,plane});
 const changed=next.size!==hiddenIds.size||[...next].some(id=>!hiddenIds.has(id));
 hiddenIds=next;return changed;
}

// the cues of the active section: bigger dots on it, lines from the other points to their foot on it
function ensureSvg(){
 if(svg)return svg;
 svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','comment-lines-3d');svg.setAttribute('aria-hidden','true');
 layer.insertBefore(svg,layer.firstChild); // under the dots
 return svg;
}
function projectPair(obj,camera,W,H,a,b,out){
 // both ends to camera space, clipped to the front of the camera, then projected: out = [x1,y1,x2,y2] in px, or false when nothing is in front
 p3.set(a.x,a.y,a.z).applyMatrix4(obj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
 q3.set(b.x,b.y,b.z).applyMatrix4(obj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
 const seg=clipSegmentNear({x:p3.x,y:p3.y,z:p3.z},{x:q3.x,y:q3.y,z:q3.z},camera.near||0.01);if(!seg)return false;
 p3.set(seg[0].x,seg[0].y,seg[0].z).applyMatrix4(camera.projectionMatrix);q3.set(seg[1].x,seg[1].y,seg[1].z).applyMatrix4(camera.projectionMatrix);
 out[0]=(p3.x+1)/2*W;out[1]=(1-p3.y)/2*H;out[2]=(q3.x+1)/2*W;out[3]=(1-q3.y)/2*H;
 return out.every(Number.isFinite);
}
const seg4=[0,0,0,0];
function drawSectionCues(obj,camera,W,H,pts){
 const hasPlane=rels.size>0;
 if(!hasPlane&&!cuesOn)return; // no active section and nothing left to clear
 cuesOn=hasPlane;
 if(hasPlane)ensureSvg();
 if(svg){svg.setAttribute('width',W);svg.setAttribute('height',H)}
 for(const p of pts){
  const m=els.get(p.id),r=rels.get(p.id);if(!m)continue;
  const on=!!r&&r.on;if(m.on!==on){m.on=on;m.el.classList.toggle('is-on-section',on)}
  const want=!!r&&!r.on;
  if(want){
   if(!m.line){m.line=document.createElementNS('http://www.w3.org/2000/svg','line');svg.appendChild(m.line)}
   if(projectPair(obj,camera,W,H,p.local,r.foot,seg4)){m.line.setAttribute('x1',seg4[0].toFixed(1));m.line.setAttribute('y1',seg4[1].toFixed(1));m.line.setAttribute('x2',seg4[2].toFixed(1));m.line.setAttribute('y2',seg4[3].toFixed(1));m.line.style.display=''}
   else m.line.style.display='none';
  }else if(m.line){m.line.remove();m.line=null}
 }
}

// called after each 3D frame (and when the camera / object / comments may have changed)
export function updateComment3dMarkers(){
 if(!layer)return;
 const s=sceneState,obj=s?.obj,camera=s?.camera;
 const fp=activeSeries?datasetFingerprint(activeSeries):null;
 const list=obj&&camera&&volume&&fp&&getMarkersShown()?getComments():[];
 const W=host.clientWidth,H=host.clientHeight,keep=new Set();
 if(list.length&&W>=8&&H>=8){
  const dims={columns:volume.columns,rows:volume.rows,slices:volume.slices};
  obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const pts=[];
  list.forEach((c,n)=>{
   if(!commentMatchesSeries(c,fp))return;
   const t=commentTarget(c,dims);if(!t)return;
   const l=voxelToLocal3D(t,dims,volume.spacing);
   pts.push({id:c.id,local:{x:l.x,y:l.y,z:l.z}});
   v3.set(l.x,l.y,l.z).applyMatrix4(obj.matrixWorld);
   v3.project(camera);
   const x=(v3.x+1)/2*W,y=(1-v3.y)/2*H,vis=v3.z>-1&&v3.z<1&&x>-12&&x<W+12&&y>-12&&y<H+12;
   keep.add(c.id);
   let m=els.get(c.id);
   if(!m){const el=document.createElement('div');el.className='comment-marker-3d';el.setAttribute('role','img');layer.appendChild(el);m={el,x:0,y:0,vis:false,no:0,label:'',back:null,on:false,line:null};els.set(c.id,m)}
   m.x=x;m.y=y;m.vis=vis;
   if(m.no!==n+1){m.no=n+1;m.el.textContent='';const sp=document.createElement('span');sp.className='comment-marker-3d-no';sp.textContent=String(n+1);m.el.appendChild(sp)} // the dot is the element (its centre = the point); the number sits beside it
   const label=tr('commentMarker3d')+' '+(n+1);if(m.label!==label){m.label=label;m.el.setAttribute('aria-label',label)}
   m.el.hidden=!vis;
   if(vis)m.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-50%)';
  });
  // hidden behind tissue: judged at most ~10 times a second (the positions above follow every frame), plus once more after the view stops
  const plane=sectionViewOpen&&sectionViewPlane?sectionPlaneLocal(sectionLocalPoint(),sectionLocalNormal()):null;
  const sig=hiddenSignature(obj,camera,pts.map(p=>p.id),plane,fp),now=performance.now(),st=throttle.step(now,sig!==hiddenSig);
  clearTimeout(hiddenTimer);hiddenTimer=0;
  if(st.run){hiddenSig=sig;refreshHidden(obj,camera,pts,plane)}
  else if(st.wait>0)hiddenTimer=setTimeout(refreshSoon,st.wait);
  for(const [id,m] of els){const back=hiddenIds.has(id);if(m.back!==back){m.back=back;m.el.classList.toggle('is-behind',back)}}
  // position cues relative to the active section (VR's rule): on it = bigger (.is-on-section); off it = a thin line to its foot (SVG layer).
  // The relation only changes with the plane / points, so it is recomputed then; the lines follow the camera every frame.
  const rsig=(plane?[plane.x,plane.y,plane.z,plane.w].join(','):'')+'|'+pts.map(p=>p.id+':'+p.local.x+','+p.local.y+','+p.local.z).join(';');
  if(rsig!==relSig){relSig=rsig;rels=planeRelations(pts,plane,boxHalfExtent(dims,volume.spacing),dims)}
  drawSectionCues(obj,camera,W,H,pts);
 }
 if(!list.length){clearTimeout(hiddenTimer);hiddenTimer=0}
 for(const [id,m] of [...els])if(!keep.has(id)){m.el.remove();m.line?.remove();els.delete(id)}
 if(bubbleId!=null)placeBubble();
}
// tap on a dot (not a drag): the pointer handlers of the 3D view are untouched (listeners are only added, nothing is stopped); taps in
// the analysis / edit modes, where a tap already means something, and taps that moved are ignored.
function installTap(){
 let d=null;
 host.addEventListener('pointerdown',e=>{closeBubble3d();d=e.target?.tagName==='CANVAS'?{id:e.pointerId,x:e.clientX,y:e.clientY}:null});
 host.addEventListener('pointerup',e=>{
  const s=d;d=null;if(!s||s.id!==e.pointerId||volumeAnalysisMode||analysisEditTool!=='select'||!getMarkersShown())return;
  if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>6)return;
  const r=host.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,reach=document.documentElement.classList.contains('vrl-ipad-ui')?24:16;
  let best=null,bd=1e9;for(const [id,m] of els){if(!m.vis)continue;const dd=Math.hypot(m.x-x,m.y-y);if(dd<=reach&&dd<bd){best=id;bd=dd}}
  if(best!=null)showBubble3d(best);
 });
 host.addEventListener('pointercancel',()=>{d=null});
 host.addEventListener('wheel',closeBubble3d,{passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBubble3d()});
}
export function installComment3d(viewportEl){
 if(layer||!viewportEl)return;
 host=viewportEl;layer=document.createElement('div');layer.className='comment-layer-3d';layer.setAttribute('aria-hidden','false');host.appendChild(layer);
 installTap();
 const again=()=>{request3DRender()};
 onCommentsChange(again);onMarkersShownChange(()=>{closeBubble3d();if(!getMarkersShown())releaseHidden();again()});
 document.addEventListener('vrl-serieschange',()=>{releaseHidden();again()});
}
