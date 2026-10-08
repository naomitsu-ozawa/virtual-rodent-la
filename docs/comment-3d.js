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
import { sceneState, volume, activeSeries, volumeAnalysisMode, analysisEditTool, sectionViewOpen, sectionViewPlane } from './state.js?v=20261008-build496';
import { tr } from './i18n.js?v=20261008-build496';
import { datasetFingerprint } from './project-file.js?v=20261008-build496';
import { voxelToLocal3D } from './crosshair.js?v=20261008-build496';
import { pointColor, darkFill, inkOn } from './point-colors.js?v=20261008-build496';
import { getComments, onCommentsChange, commentMatchesSeries, commentTarget, getMarkersShown, onMarkersShownChange } from './comments.js?v=20261008-build496';
import { getMeasurements, setLabelOffset, onMeasurementsChange, measurementMm, measureLabel, seriesSpacing, spacingLevel, getMeasureStart, onMeasureStartChange, createLongPress } from './measurements.js?v=20261008-build496';
import { openPointMenu, endMeasureAt, cancelMeasureUi } from './point-menu.js?v=20261008-build496';
import { request3DRender } from './scene3d.js?v=20261008-build496';
import { gpuVolumeTarget } from './gpu-volume-data.js?v=20261008-build496';
import { segmentState, segmentEditState, SEGMENT_PRESET_ORDER } from './segments.js?v=20261008-build496';
import { sectionLocalPoint, sectionLocalNormal } from './section-view.js?v=20261008-build496';
import { planeLabelPlacement, clampLabelCenter, stepDelta, offsetFromDelta, createFocusTracker } from './measure-label.js?v=20261008-build496';
import { planeRelations, boxHalfExtent, clipSegmentNear } from './comment-3d-section.js?v=20261008-build496';
import { computeHiddenIds, shownChannels, sectionPlaneLocal, createHiddenThrottle } from './comment-3d-hidden.js?v=20261008-build496';

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
  if(!vrModLoading){vrModLoading=true;import('./vr-view.js?v=20261008-build496').then(m=>{vrMod=m;throttle.reset();refreshSoon()},()=>{vrModFailed=true;if(hiddenIds.size){hiddenIds=new Set();refreshSoon()}})}
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
// build 477: distances. A line between the two points (the SVG layer, clipped at the near plane) and the value at its midpoint (a small label); the start of a
// distance in the making gets a pulsing ring (.is-measure-start) and a hint next to it. Follows the points live (they are recomputed every frame).
const measEls=new Map(); // measurement id -> {line,label,text}
// build 485: the lit label (mouse hover / a drag, touch included): the class is toggled only when the lit label changes
const labelFocus=createFocusTracker((n,p)=>{measEls.get(p)?.label.classList.remove('is-lit');measEls.get(n)?.label.classList.add('is-lit')});
let hintEl=null;
// object-space change per voxel along i / j / k in this view (voxelToLocal3D: the longest side is 3.3 units)
function voxelStep3d(dims,spacing){const[sx,sy,sz]=spacing||[1,1,1],k=3.3/Math.max(dims.columns*sx,dims.rows*sy,dims.slices*sz,1);return[sx*k,-sy*k,sz*k]}
function drawMeasures(obj,camera,W,H,pts,keep,dims){
 const byId=new Map(pts.map(p=>[p.id,p])),ms=getMeasurements().filter(m=>byId.has(m.a)&&byId.has(m.b));
 if(!ms.length)return;
 ensureSvg();svg.setAttribute('width',W);svg.setAttribute('height',H);
 const cs=getComments(),sp=seriesSpacing(activeSeries),warn=spacingLevel(activeSeries)==='warn',step=voxelStep3d(dims,volume.spacing);
 for(const m of ms){
  keep.add(m.id);let e=measEls.get(m.id);
  if(!e){
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('class','measure-line-3d');svg.appendChild(line);
   const leader=document.createElementNS('http://www.w3.org/2000/svg','line');leader.setAttribute('class','measure-leader-3d');svg.appendChild(leader);
   const label=document.createElement('div');label.className='measure-label-3d';layer.appendChild(label);
   if(labelFocus.get()===m.id)label.classList.add('is-lit');e={line,leader,label,text:'',w:60,h:16,sx:0,sy:0,ctx:null};measEls.set(m.id,e);
  }
  const text=measureLabel(measurementMm(m,cs,sp),warn);if(e.text!==text){e.text=text;e.label.textContent=text;if(warn)e.label.title=tr('measureWarn');e.label.hidden=false;e.w=e.label.offsetWidth||60;e.h=e.label.offsetHeight||16}
  const A=byId.get(m.a),B=byId.get(m.b);
  if(projectPair(obj,camera,W,H,A.local,B.local,seg4)){
   e.line.setAttribute('x1',seg4[0].toFixed(1));e.line.setAttribute('y1',seg4[1].toFixed(1));e.line.setAttribute('x2',seg4[2].toFixed(1));e.line.setAttribute('y2',seg4[3].toFixed(1));e.line.style.display='';
   const mx=(seg4[0]+seg4[2])/2,my=(seg4[1]+seg4[3])/2;
   // the midpoint in object space (voxel units: the mean of the two voxels) and its depth: what a drag of the label works from
   const ml=voxelToLocal3D({i:(A.vox.i+B.vox.i)/2,j:(A.vox.j+B.vox.j)/2,k:(A.vox.k+B.vox.k)/2},dims,volume.spacing);
   v3.set(ml.x,ml.y,ml.z).applyMatrix4(obj.matrixWorld).project(camera);e.ctx={ml,step,ndcZ:v3.z};
   let lx,ly;
   if(m.labelOffset){ // where the user left it
    const d=stepDelta(m.labelOffset,step);v3.set(ml.x+d.x,ml.y+d.y,ml.z+d.z).applyMatrix4(obj.matrixWorld).project(camera);
    const c=clampLabelCenter((v3.x+1)/2*W,(1-v3.y)/2*H,{w:e.w,h:e.h,x0:0,y0:0,iw:W,ih:H}); // shown inside the view (the stored offset is unchanged: it can never be lost off-screen)
    lx=c.x;ly=c.y;
   }else{ // by default NEAR the line: beside it (perpendicular, the upper side), inside the view
    const pl=planeLabelPlacement({x:seg4[0],y:seg4[1]},{x:seg4[2],y:seg4[3]},{w:e.w,h:e.h,gap:4,x0:0,y0:0,iw:W,ih:H});lx=pl.x;ly=pl.y;
   }
   if(Number.isFinite(lx)&&Number.isFinite(ly)){
    e.sx=lx;e.sy=ly;e.label.hidden=false;
    e.label.style.transform='translate('+lx.toFixed(1)+'px,'+ly.toFixed(1)+'px) translate(-50%,-50%)';
    e.leader.setAttribute('x1',mx.toFixed(1));e.leader.setAttribute('y1',my.toFixed(1));e.leader.setAttribute('x2',lx.toFixed(1));e.leader.setAttribute('y2',ly.toFixed(1));e.leader.style.display='';
   }else{e.leader.style.display='none';e.label.hidden=true}
  }else{e.line.style.display='none';e.leader.style.display='none';e.label.hidden=true}
 }
}
function pruneMeasures(keep){for(const [id,e] of [...measEls])if(!keep.has(id)){e.line.remove();e.leader.remove();e.label.remove();measEls.delete(id)}}
function placeHint(){
 const id=getMeasureStart(),m=id?els.get(id):null;
 if(!id||!m||!m.vis||!layer){if(hintEl)hintEl.hidden=true;return}
 if(!hintEl){hintEl=document.createElement('div');hintEl.className='measure-hint-3d';layer.appendChild(hintEl)}
 const t=tr('pmHint');if(hintEl.textContent!==t)hintEl.textContent=t;
 hintEl.hidden=false;hintEl.style.transform='translate('+m.x.toFixed(1)+'px,'+(m.y+22).toFixed(1)+'px) translate(-50%,0)';
}
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
   if(!m.line){m.line=document.createElementNS('http://www.w3.org/2000/svg','line');if(m.hex)m.line.style.stroke=m.hex;svg.appendChild(m.line)}
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
 const W=host.clientWidth,H=host.clientHeight,keep=new Set(),keepM=new Set();
 if(list.length&&W>=8&&H>=8){
  const dims={columns:volume.columns,rows:volume.rows,slices:volume.slices};
  obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const pts=[];
  list.forEach((c,n)=>{
   if(!commentMatchesSeries(c,fp))return;
   const t=commentTarget(c,dims);if(!t)return;
   const l=voxelToLocal3D(t,dims,volume.spacing);
   pts.push({id:c.id,local:{x:l.x,y:l.y,z:l.z},vox:t});
   v3.set(l.x,l.y,l.z).applyMatrix4(obj.matrixWorld);
   v3.project(camera);
   const x=(v3.x+1)/2*W,y=(1-v3.y)/2*H,vis=v3.z>-1&&v3.z<1&&x>-12&&x<W+12&&y>-12&&y<H+12;
   keep.add(c.id);
   let m=els.get(c.id);
   if(!m){const el=document.createElement('div');el.className='comment-marker-3d';el.setAttribute('role','img');layer.appendChild(el);m={el,x:0,y:0,vis:false,no:0,label:'',back:null,on:false,line:null,hex:''};els.set(c.id,m)}
   m.x=x;m.y=y;m.vis=vis;
   const hex=pointColor(c);if(m.hex!==hex){ // build 472: the point's colour (own or auto) overrides the CSS variables of this one element; the number chip inherits them
    m.hex=hex;const st=m.el.style,fill='#'+darkFill(hex).toString(16).padStart(6,'0');st.setProperty('--vr-point-dot',hex);st.setProperty('--vr-point-fill',fill);st.setProperty('--vr-point-ink',inkOn(hex));if(m.line)m.line.style.stroke=hex}
   if(m.no!==n+1){m.no=n+1;m.el.textContent='';const sp=document.createElement('span');sp.className='comment-marker-3d-no';sp.textContent=String(n+1);m.el.appendChild(sp)} // the dot is the element (its centre = the point); the number sits beside it
   const label=tr('commentMarker3d')+' '+(n+1);if(m.label!==label){m.label=label;m.el.setAttribute('aria-label',label)}
   m.el.hidden=!vis;
   const isStart=c.id===getMeasureStart();if(m.start!==isStart){m.start=isStart;m.el.classList.toggle('is-measure-start',isStart)}
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
  drawMeasures(obj,camera,W,H,pts,keepM,dims);
 }
 pruneMeasures(keepM);
 if(!list.length){clearTimeout(hiddenTimer);hiddenTimer=0}
 for(const [id,m] of [...els])if(!keep.has(id)){m.el.remove();m.line?.remove();els.delete(id)}
 if(bubbleId!=null)placeBubble();
 placeHint();
}
// tap on a dot (not a drag): the pointer handlers of the 3D view are untouched (listeners are only added, nothing is stopped); taps in
// the analysis / edit modes, where a tap already means something, and taps that moved are ignored.
// build 480: dragging a distance label. The labels do not take pointer events themselves: a CAPTURE-phase listener on the view finds the label under a press on the 3D canvas, so
// (1) a point under the press always wins (its tap / long press / menu), (2) a press on a label never reaches the 3D view's own rotate / pan handlers, (3) no label element
// sits over a dot. The new place is stored as labelOffset (voxel units from the midpoint: the same in VR and the 2D views, saved in the project). A double tap / click on a label
// puts it back at its default place.
let lastLabelDown={id:null,t:0,x:0,y:0};
function labelAt(x,y){for(const [id,e] of measEls)if(!e.label.hidden&&Math.abs(x-e.sx)<=e.w/2+4&&Math.abs(y-e.sy)<=e.h/2+4)return id;return null}
function installLabelDrag(nearestDot,gate){
 host.addEventListener('pointermove',ev=>{ // hover (mouse / pen): the label under the pointer lights up
  if(ev.pointerType==='touch'||ev.buttons)return;
  if(!gate()||nearestDot(ev.clientX,ev.clientY)!=null){labelFocus.hover(null);return}
  const r=host.getBoundingClientRect();labelFocus.hover(labelAt(ev.clientX-r.left,ev.clientY-r.top));
 });
 host.addEventListener('pointerleave',()=>labelFocus.hover(null));
 host.addEventListener('pointerdown',ev=>{
  if(ev.target?.tagName!=='CANVAS'||(ev.pointerType==='mouse'&&ev.button!==0)||!gate())return;
  if(nearestDot(ev.clientX,ev.clientY)!=null)return; // a point wins
  const r=host.getBoundingClientRect(),id=labelAt(ev.clientX-r.left,ev.clientY-r.top),e=id?measEls.get(id):null;if(!e||!e.ctx)return;
  ev.stopPropagation();ev.preventDefault();closeBubble3d();
  if(lastLabelDown.id===id&&ev.timeStamp-lastLabelDown.t<350&&Math.hypot(ev.clientX-lastLabelDown.x,ev.clientY-lastLabelDown.y)<12){lastLabelDown={id:null,t:0,x:0,y:0};setLabelOffset(id,null);return}
  lastLabelDown={id,t:ev.timeStamp,x:ev.clientX,y:ev.clientY};
  const dx=ev.clientX-r.left-e.sx,dy=ev.clientY-r.top-e.sy,pid=ev.pointerId;e.label.classList.add('is-dragging');labelFocus.drag(id);
  const move=m=>{
   if(m.pointerId!==pid||!e.ctx)return;m.stopPropagation();
   const{obj,camera}=sceneState,W=host.clientWidth,H=host.clientHeight;if(!obj||!camera)return;
   obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
   v3.set((m.clientX-r.left-dx)/W*2-1,1-(m.clientY-r.top-dy)/H*2,e.ctx.ndcZ).unproject(camera);obj.worldToLocal(v3); // the screen point, at the depth of the line's midpoint
   setLabelOffset(id,offsetFromDelta({x:v3.x-e.ctx.ml.x,y:v3.y-e.ctx.ml.y,z:v3.z-e.ctx.ml.z},e.ctx.step));
  };
  const up=m=>{if(m.pointerId!==pid)return;e.label.classList.remove('is-dragging');labelFocus.drag(null);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true)};
  document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
 },true);
}
function installTap(){
 let d=null;
 const gate=()=>!volumeAnalysisMode&&analysisEditTool==='select'&&getMarkersShown();
 const nearest=(cx,cy)=>{
  const r=host.getBoundingClientRect(),x=cx-r.left,y=cy-r.top,reach=document.documentElement.classList.contains('vrl-ipad-ui')?24:16;
  let best=null,bd=1e9;for(const [id,m] of els){if(!m.vis)continue;const dd=Math.hypot(m.x-x,m.y-y);if(dd<=reach&&dd<bd){best=id;bd=dd}}
  return best;
 };
 host.addEventListener('pointerdown',e=>{
  closeBubble3d();clearTimeout(d?.timer);
  d=e.target?.tagName==='CANVAS'?{id:e.pointerId,x:e.clientX,y:e.clientY,lp:createLongPress({ms:450}),timer:0}:null;
  if(!d)return;d.lp.down(e.clientX,e.clientY,performance.now());
  // build 477: long press on a dot (touch long press / mouse press-and-hold; a right-click opens it too) = the point menu
  const hit=(e.button===0||e.pointerType==='touch')&&gate()?nearest(e.clientX,e.clientY):null;
  if(hit!=null){const mine=d;mine.timer=setTimeout(()=>{if(d===mine&&mine.lp.tick(performance.now())==='long')openPointMenu({id:hit,x:mine.x,y:mine.y})},500)}
 });
 installLabelDrag(nearest,gate);
 host.addEventListener('pointermove',e=>{if(d&&d.id===e.pointerId)d.lp.move(e.clientX,e.clientY)});
 host.addEventListener('pointerup',e=>{
  const s=d;d=null;if(s)clearTimeout(s.timer);if(!s||s.id!==e.pointerId||!gate())return;
  const r=s.lp.up();if(r==='long'||r==='moved')return; // the long press opened the menu: the release is not a tap
  if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>6)return;
  const best=nearest(e.clientX,e.clientY);
  if(getMeasureStart()){if(best!=null)endMeasureAt(best);else cancelMeasureUi();return} // a distance is being measured: a dot = its END, empty space = cancel
  if(best!=null)showBubble3d(best);
 });
 host.addEventListener('pointercancel',()=>{if(d)clearTimeout(d.timer);d=null});
 host.addEventListener('contextmenu',e=>{
  if(!gate())return;const best=nearest(e.clientX,e.clientY);if(best==null)return;
  e.preventDefault();if(d){clearTimeout(d.timer);d=null}openPointMenu({id:best,x:e.clientX,y:e.clientY});
 });
 host.addEventListener('wheel',closeBubble3d,{passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBubble3d()});
}
export function installComment3d(viewportEl){
 if(layer||!viewportEl)return;
 host=viewportEl;layer=document.createElement('div');layer.className='comment-layer-3d';layer.setAttribute('aria-hidden','false');host.appendChild(layer);
 installTap();
 const again=()=>{request3DRender()};
 onCommentsChange(again);onMeasurementsChange(again);onMeasureStartChange(again);onMarkersShownChange(()=>{closeBubble3d();if(!getMarkersShown())releaseHidden();again()});
 document.addEventListener('vrl-serieschange',()=>{releaseHidden();again()});
}
