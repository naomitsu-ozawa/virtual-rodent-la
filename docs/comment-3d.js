// Position comments on the 3D view (Issue #88): a numbered dot per comment of the open series, drawn as small HTML elements in a layer
// over the 3D viewport, NOT inside the WebGPU / WebGL scene. One code path serves every 3D mode (GPU volume, surface mesh, WebGL
// fallback) because they all share the same scene object and camera; the dots cost no GPU work and stay crisp at any DPR.
// Position: the voxel {i,j,k} -> the scene's local coordinates with voxelToLocal3D (the mapping of the 3D MPR planes), then the
// object's world matrix and the camera, so rotation / zoom / pan follow by themselves. Updated after every 3D frame (the 3D loop only
// renders on request, so a change of the comments, the switch or the series asks for a render). Depth: dots are never hidden by the
// volume (a lesion inside dense tissue would vanish); a dot farther than the volume's centre is shown fainter and smaller instead.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { sceneState, volume, activeSeries, volumeAnalysisMode, analysisEditTool } from './state.js?v=20261005-build459';
import { tr } from './i18n.js?v=20261005-build459';
import { datasetFingerprint } from './project-file.js?v=20261005-build459';
import { voxelToLocal3D } from './crosshair.js?v=20261005-build459';
import { getComments, onCommentsChange, commentMatchesSeries, commentTarget, getMarkersShown, onMarkersShownChange } from './comments.js?v=20261005-build459';
import { request3DRender } from './scene3d.js?v=20261005-build459';

let host=null,layer=null,bubble=null,bubbleId=null,bubbleTimer=0;
const els=new Map(); // comment id -> {el,x,y,vis,no}
const v3=new THREE.Vector3(),c3=new THREE.Vector3();

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
  const centreZ=c3.setFromMatrixPosition(obj.matrixWorld).applyMatrix4(camera.matrixWorldInverse).z;
  list.forEach((c,n)=>{
   if(!commentMatchesSeries(c,fp))return;
   const t=commentTarget(c,dims);if(!t)return;
   const l=voxelToLocal3D(t,dims,volume.spacing);
   v3.set(l.x,l.y,l.z).applyMatrix4(obj.matrixWorld);
   const viewZ=v3.clone().applyMatrix4(camera.matrixWorldInverse).z;
   v3.project(camera);
   const x=(v3.x+1)/2*W,y=(1-v3.y)/2*H,vis=v3.z>-1&&v3.z<1&&x>-12&&x<W+12&&y>-12&&y<H+12;
   keep.add(c.id);
   let m=els.get(c.id);
   if(!m){const el=document.createElement('div');el.className='comment-marker-3d';el.setAttribute('role','img');layer.appendChild(el);m={el,x:0,y:0,vis:false,no:0,label:'',back:null};els.set(c.id,m)}
   m.x=x;m.y=y;m.vis=vis;
   if(m.no!==n+1){m.no=n+1;m.el.textContent=String(n+1)}
   const label=tr('commentMarker3d')+' '+(n+1);if(m.label!==label){m.label=label;m.el.setAttribute('aria-label',label)}
   const back=viewZ<centreZ;if(m.back!==back){m.back=back;m.el.classList.toggle('is-behind',back)}
   m.el.hidden=!vis;
   if(vis)m.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) translate(-50%,-50%)';
  });
 }
 for(const [id,m] of [...els])if(!keep.has(id)){m.el.remove();els.delete(id)}
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
 onCommentsChange(again);onMarkersShownChange(()=>{closeBubble3d();again()});
 document.addEventListener('vrl-serieschange',again);
}
