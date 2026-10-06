// VR position points (Issue #88, stage 3): record where the VR laser meets a section as a position comment (voxel {i,j,k}).
// Pure geometry + the comment record, no three.js and no DOM (unit-tested in tests/unit/vr-point.test.js); vr-view.js feeds it the
// ray and the section planes, vr-point-markers.js draws the result.
//
// Which place is recorded: the intersection of the controller's ray with the PLANE of a section (not the first opaque voxel).
// Space: the volume's object space of vr-view.js (box +-halfExt; x and z run up the voxel index, y runs DOWN the row index), the
// same orientation as voxelToLocal3D in crosshair.js (index 0 is at -x / +y / -z). A plane is {x,y,z,w}: n.p = w (the shader's cutPlanes).
// Several sections: the ray takes the FIRST one it meets (smallest t) whose intersection lies inside the volume and is not on a part
// that another clipping section has cut away. A section whose intersection is outside the volume is skipped, never clamped.
// Voxel rule: voxel i covers the fraction [i/n, (i+1)/n) of the box along its axis, so the index is floor(fraction * n); a point
// outside [0,1) on any axis (the far face itself included) is NOT recorded: it is never moved into the volume.
import { createComment, addComment, getComments, removeComment, restoreComment, updateCommentPosition, commentMatchesSeries } from './comments.js?v=20261006-build467';
import { marchClassificationHitInfo } from './vr-pick.js?v=20261006-build467';

const T_MIN=1e-6,EDGE_EPS=1e-4;

// t of the ray o + t*q on the plane, or null (parallel, or behind the origin)
export function rayPlaneT(o,q,pl){
 const slope=pl.x*q.x+pl.y*q.y+pl.z*q.z;
 if(!(Math.abs(slope)>1e-9))return null;
 const t=(pl.w-(pl.x*o.x+pl.y*o.y+pl.z*o.z))/slope;
 return t>T_MIN?t:null;
}
// object-space point -> voxel {i,j,k} of the data (dims {columns,rows,slices}), or null when the point is outside the volume
export function localToVoxel(p,halfExt,dims){
 if(!p||!halfExt||!dims)return null;
 const n=[dims.columns,dims.rows,dims.slices],f=[p.x/(2*halfExt[0])+0.5,0.5-p.y/(2*halfExt[1]),p.z/(2*halfExt[2])+0.5],v=[];
 for(let a=0;a<3;a++){
  if(!(n[a]>0)||!Number.isFinite(f[a])||f[a]<0||f[a]>=1)return null;
  v.push(Math.min(n[a]-1,Math.floor(f[a]*n[a])));
 }
 return{i:v[0],j:v[1],k:v[2]};
}
// voxel -> the centre of that voxel in object space (inverse of localToVoxel on voxel centres)
export function voxelToLocal(v,halfExt,dims){
 return{x:((v.i+.5)/dims.columns-.5)*2*halfExt[0],y:(.5-(v.j+.5)/dims.rows)*2*halfExt[1],z:((v.k+.5)/dims.slices-.5)*2*halfExt[2]};
}
// The section point of a ray: {t,plane,point,voxel} or null.
// planes/count: the shader's cutPlanes and planeCount (all sections shown); cutBits: which of them clip (bit i), used only to leave out
// a point that another clipping plane has removed (the plane's own side test is skipped).
// only: a plane number = that plane is the only candidate (the other planes still cut away parts, as before)
export function sectionRayHit(o,q,{halfExt,dims,planes,count=0,cutBits=0,only=null}){
 let best=null;
 for(let i=0;i<count;i++){
  if(typeof only==='number'&&i!==only)continue;
  const pl=planes[i],t=rayPlaneT(o,q,pl);if(t===null||(best&&t>=best.t))continue;
  const point={x:o.x+q.x*t,y:o.y+q.y*t,z:o.z+q.z*t},voxel=localToVoxel(point,halfExt,dims);if(!voxel)continue;
  let cut=false;
  for(let j=0;j<count&&!cut;j++){
   if(j===i||!(cutBits>>j&1))continue;
   const c=planes[j];if(c.x*point.x+c.y*point.y+c.z*point.z-c.w<-EDGE_EPS)cut=true;
  }
  if(!cut)best={t,plane:i,point,voxel};
 }
 return best;
}

// ---- the comment ----
const NAME_RE=/^VR (?:ポイント|point) (\d+)$/;
export const vrPointText=(n,language='ja')=>language==='en'?'VR point '+n:'VR ポイント '+n;
// the next number: one more than the highest "VR ポイント N" / "VR point N" text of this series (deleting or renaming never repeats one)
export function nextVrPointNumber(comments,fingerprint){
 let max=0;
 for(const c of comments||[]){if(!commentMatchesSeries(c,fingerprint))continue;const m=NAME_RE.exec(String(c.text||'').trim());if(m)max=Math.max(max,+m[1])}
 return max+1;
}
// Adds "VR ポイント N" at the voxel to the shared comment store (project.comments, the 2D panel, "view this place" and the 3D
// overlay all read it). Returns the comment, or null when there is no voxel / no series.
// store: the comment store to use (the app's by default; a test passes its own, as the module URLs carry a ?v= build tag)
export function recordVrPoint({voxel,series,language='ja',now=Date.now(),store={getComments,addComment}}){
 if(!voxel||!series)return null;
 const text=vrPointText(nextVrPointNumber(store.getComments(),series),language);
 return store.addComment(createComment({text,position:voxel,series,now}));
}

// ---- thumbstick gate (build 464) ----
// The trigger of a hand must not record while that hand's thumbstick is being used (it scrolls the selected section; a stray trigger
// would add a point), nor for HOLDOFF_MS after the stick came back to the centre (the stick passes the dead zone on its way back).
// A state machine per hand: update(x, y, now) every frame with the stick axes (xr-standard axes[2], axes[3]) and the time in ms;
// canRecord(now) when the trigger is pressed. Outside the dead zone (length > deadzone) = active; back inside, recording is allowed once
// holdoffMs have passed since the last frame that was outside. A stick that never moved allows recording.
export const STICK_DEADZONE=0.15,STICK_HOLDOFF_MS=300;
export function createStickGate({deadzone=STICK_DEADZONE,holdoffMs=STICK_HOLDOFF_MS}={}){
 let active=false,lastActive=-Infinity;
 return{
  update(x,y,now){
   const m=Math.hypot(+x||0,+y||0);
   if(m>deadzone){active=true;lastActive=now}else active=false;
   return this.canRecord(now);
  },
  canRecord(now){return!active&&now-lastActive>=holdoffMs},
  reset(){active=false;lastActive=-Infinity},
 };
}

// ---- select / delete / undo (the same store operations as the 2D list) ----
// A point = a comment of the open series. deleteSelected removes it and returns what the undo needs ({c,index}); undoDelete puts it back
// at its place in the list (restoreComment, as the 2D "元に戻す").
export function deleteSelected(id,store){
 if(!id)return null;
 const all=store.getComments(),index=all.findIndex(c=>c.id===id),c=all[index];
 if(!c||!store.removeComment(id))return null;
 return{c,index};
}
export function undoDelete(d,store){return!!d&&store.restoreComment(d.c,d.index)}

// ---- hit test of a laser against a point (a sphere, world space) ----
// distance along the ray (unit direction d) to the first hit of the sphere, or null
export function raySphereT(o,d,c,r){
 const ox=o.x-c.x,oy=o.y-c.y,oz=o.z-c.z,b=ox*d.x+oy*d.y+oz*d.z,k=ox*ox+oy*oy+oz*oz-r*r,disc=b*b-k;
 if(disc<0)return null;
 const s=Math.sqrt(disc),t=-b-s>T_MIN?-b-s:(-b+s>T_MIN?-b+s:null);
 return t;
}
// the nearest point a ray touches: items [{id,center,radius}] -> {id,distance} or null
export function pickPoint(o,d,items){
 let best=null;
 for(const it of items){const t=raySphereT(o,d,it.center,it.radius);if(t!==null&&(!best||t<best.distance))best={id:it.id,distance:t}}
 return best;
}

// ---- distance to a section and the perpendicular ----
// Voxel size in object space (the box is +-halfExt over dims voxels).
export const voxelSize=(halfExt,dims)=>[2*halfExt[0]/dims.columns,2*halfExt[1]/dims.rows,2*halfExt[2]/dims.slices];
// Half of the voxel's thickness measured along the plane normal n (unit): |nx|*sx/2 + |ny|*sy/2 + |nz|*sz/2. A point is ON the section
// when its distance from the plane is within this (= the plane passes through that voxel's box; half a voxel for an axis-aligned section).
export const halfVoxelAlong=(n,size)=>(Math.abs(n.x)*size[0]+Math.abs(n.y)*size[1]+Math.abs(n.z)*size[2])/2;
// p: voxel centre in object space; plane {x,y,z,w} with a unit normal. -> {distance (signed, n.p-w), onSection, foot (the nearest point on the plane)}
export function sectionRelation(p,plane,halfExt,dims){
 const len=Math.hypot(plane.x,plane.y,plane.z)||1,n={x:plane.x/len,y:plane.y/len,z:plane.z/len},w=plane.w/len;
 const d=n.x*p.x+n.y*p.y+n.z*p.z-w,tol=halfVoxelAlong(n,voxelSize(halfExt,dims));
 return{distance:d,onSection:Math.abs(d)<=tol+1e-9,foot:{x:p.x-n.x*d,y:p.y-n.y*d,z:p.z-n.z*d}};
}

// ---- hidden behind tissue ----
// RULE (build 464): a point is HIDDEN when, walking in half-voxel steps (vr-pick.js marchClassificationHitInfo, the same march as the laser) from the
// point towards the head (the middle of both eyes), a voxel of a SHOWN segment (the classification channels `chs`, >= 128) is met on the side
// that every clipping section keeps, before reaching the head. The point's own voxel is skipped: the march starts one half voxel diagonal
// away from the point. Otherwise the point is EXPOSED. Nothing shown = exposed. Segment opacity is not considered (VR draws 100 % by default).
// pLocal / headLocal: object space of the volume (the head converted with the mesh's worldToLocal). pick: {cls,dims,halfExt} of volPick.
export function pointIsHidden(pLocal,headLocal,{cls,dims,halfExt,chs,planes=[],count=0,cut=0,voxel}){
 if(!cls||!chs||!chs.length)return false;
 const q={x:headLocal.x-pLocal.x,y:headLocal.y-pLocal.y,z:headLocal.z-pLocal.z},L=Math.hypot(q.x,q.y,q.z);
 if(!(L>1e-9))return false;
 const sz=voxel||[2*halfExt[0]/dims[0],2*halfExt[1]/dims[1],2*halfExt[2]/dims[2]],skip=0.5*Math.hypot(sz[0],sz[1],sz[2])/L;
 if(skip>=1)return false;
 return marchClassificationHitInfo(pLocal,q,halfExt,dims,cls,chs,planes,count,cut,skip,1)!==null;
}

// ---- surface mode (build 465) ----
// The 位置 tab can switch the trigger's 4th step from the face of a section (断面, default) to the first tissue surface the laser meets (表面).
// "Surface" = the first voxel of a SHOWN segment (classification channel >= 128) on the side every clipping section keeps, found by the same
// march as the analysis label pointer (vr-pick.js marchClassificationHitInfo); a face cut by a clipping section is therefore a surface too.
// Segment opacity is ignored. The recorded place is that voxel, stored as the usual {i,j,k} position comment.
export const POINT_MODES=['section','surface'];
export const normalizePointMode=m=>m==='surface'?'surface':'section';
// The hit voxel of a classification march (info {t,x,y,z}, indices of the classification grid clsDims [w,h,d], which can be coarser than the
// data) -> the data's voxel {i,j,k}. The point on the ray at t is used (exact when the grids are equal); the centre of the classification
// voxel is the fallback when that point rounds outside the box.
export function surfaceVoxelFromHit(info,o,q,{halfExt,dims,clsDims}){
 if(!info||!halfExt||!dims)return null;
 const p={x:o.x+q.x*info.t,y:o.y+q.y*info.t,z:o.z+q.z*info.t},v=localToVoxel(p,halfExt,dims);
 if(v)return v;
 if(!clsDims)return null;
 const n=[dims.columns,dims.rows,dims.slices],c=[info.x,info.y,info.z],r=[];
 for(let a=0;a<3;a++){if(!(n[a]>0)||!(clsDims[a]>0))return null;r.push(Math.min(n[a]-1,Math.max(0,Math.floor((c[a]+0.5)/clsDims[a]*n[a]))))}
 return{i:r[0],j:r[1],k:r[2]};
}
// Pure surface hit of a ray (object space, o + t*q): {t,point,voxel,ch} or null. cls: {data,C}; clsDims [w,h,d]; chs: the shown channels;
// planes / count / cut: the shader's cutPlanes, planeCount, planeCut. dims: the data's {columns,rows,slices}.
export function surfaceRayHit(o,q,{halfExt,dims,cls,clsDims,chs,planes=[],count=0,cut=0}){
 if(!cls||!chs||!chs.length||!clsDims)return null;
 const info=marchClassificationHitInfo(o,q,halfExt,clsDims,cls,chs,planes,count,cut);
 if(!info)return null;
 const voxel=surfaceVoxelFromHit(info,o,q,{halfExt,dims,clsDims});
 return voxel?{t:info.t,point:{x:o.x+q.x*info.t,y:o.y+q.y*info.t,z:o.z+q.z*info.t},voxel,ch:info.ch}:null;
}
// ======================================================================================================================
// One-handed redesign, stage 1 (build 468): pure functions only, not yet called by vr-view.js. See the one-hand spec.
// ======================================================================================================================

// ---- quaternions {x,y,z,w} (no three.js) ----
export const qMul=(a,b)=>({
 x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
 y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,
 z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,
 w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,
});
export const qNorm=q=>{const l=Math.hypot(q.x,q.y,q.z,q.w)||1;return{x:q.x/l,y:q.y/l,z:q.z/l,w:q.w/l}};
export const qInv=q=>{const l2=q.x*q.x+q.y*q.y+q.z*q.z+q.w*q.w||1;return{x:-q.x/l2,y:-q.y/l2,z:-q.z/l2,w:q.w/l2}};
// rotate the vector v by the unit quaternion q
export function qRot(q,v){
 const tx=2*(q.y*v.z-q.z*v.y),ty=2*(q.z*v.x-q.x*v.z),tz=2*(q.x*v.y-q.y*v.x);
 return{x:v.x+q.w*tx+q.y*tz-q.z*ty,y:v.y+q.w*ty+q.z*tx-q.x*tz,z:v.z+q.w*tz+q.x*ty-q.y*tx};
}
// rotation angle of a unit quaternion in degrees, 0..180
export const qAngleDeg=q=>2*Math.atan2(Math.hypot(q.x,q.y,q.z),Math.abs(q.w))*180/Math.PI;

// ---- trigger target (spec 2.3) ----
// c: {board, ringOwnOpen, ringHighlight, moving, placement, tab, point, band, tissue, plane, mode, analysis, canDrag}
//  board: anything truthy when the laser's nearest thing is a menu / help board / ring item; ringOwnOpen: this hand's ring (hand or point ring)
//  is open; ringHighlight: its lit item (null = none); moving: this hand is moving a point, placement = where it would land (or null);
//  tab: a section number tag hit {t,...}; point: {t|distance,id,...}; band: {t,...}; tissue / plane: {t,...} (tissue = first shown surface,
//  plane = the selected section's plane hit); mode 'section'|'surface'; analysis: the analysis tab is open; canDrag: a selected section exists
//  and the other hand is not dragging it.
// Returns {kind,ref}; kind: 'board'|'ring-confirm'|'ring-close'|'move'|'section'|'point'|'record'|'label'|'empty'|'none'.
// A hit's distance is t (or distance, as pickPoint returns); all in world metres. Ties within 1e-6 m: point > band > target.
export const TIE_EPS=1e-6;
const hitT=h=>h?(Number.isFinite(h.t)?h.t:(Number.isFinite(h.distance)?h.distance:null)):null;
export function resolveTriggerTarget(c={}){
 if(c.board)return{kind:'board',ref:c.board};
 if(c.ringOwnOpen){
  const h=c.ringHighlight;
  return h!==null&&h!==undefined?{kind:'ring-confirm',ref:h}:{kind:'ring-close',ref:null};
 }
 if(c.moving)return{kind:'move',ref:c.placement||null};
 if(c.tab)return{kind:'section',ref:c.tab};
 let target=null;
 if(c.analysis){if(c.tissue)target={kind:'label',ref:c.tissue}}
 else if(normalizePointMode(c.mode)==='surface'){if(c.tissue)target={kind:'record',ref:c.tissue,plane:false}}
 else if(c.plane)target={kind:'record',ref:c.plane,plane:true};
 const cands=[];
 if(c.point&&hitT(c.point)!==null)cands.push({kind:'point',ref:c.point,t:hitT(c.point),rank:0});
 if(c.band&&hitT(c.band)!==null)cands.push({kind:'section',ref:c.band,t:hitT(c.band),rank:1});
 if(target&&hitT(target.ref)!==null)cands.push({kind:target.kind,ref:target.ref,t:hitT(target.ref),rank:2});
 let best=null;
 for(const k of cands){
  if(!best||k.t<best.t-TIE_EPS||(Math.abs(k.t-best.t)<=TIE_EPS&&k.rank<best.rank))best=k;
 }
 if(best)return{kind:best.kind,ref:best.ref};
 return c.canDrag?{kind:'empty',ref:null}:{kind:'none',ref:null};
}

// ---- press classification ----
export const LONG_PRESS_MS=500;
// trigger: press(now); update(now) -> 'long' once when the press reaches longMs; release(now) -> 'tap' (released before longMs) | 'late' | null (not pressed)
export function createTriggerPress({longMs=LONG_PRESS_MS}={}){
 let t0=null,fired=false;
 return{
  press(now){t0=now;fired=false},
  update(now){if(t0===null||fired)return null;if(now-t0>=longMs){fired=true;return'long'}return null},
  release(now){
   if(t0===null)return null;
   const tap=now-t0<longMs&&!fired;t0=null;fired=false;return tap?'tap':'late';
  },
  get pressed(){return t0!==null},
 };
}
// when a press on a section turns into a drag: hand moved > posM (m) or turned > angDeg or held >= holdMs
export function dragShouldStart({dPosM=0,dAngleDeg=0,heldMs=0}={},{posM=0.01,angDeg=1.5,holdMs=LONG_PRESS_MS}={}){
 return dPosM>posM||dAngleDeg>angDeg||heldMs>=holdMs;
}

// ---- section drag (spec 4.3), holder space ----
// reach of a plane with unit normal n over the box +-halfExt: R(n) = |nx|hx+|ny|hy+|nz|hz
export const planeReach=(n,halfExt)=>Math.abs(n.x)*halfExt[0]+Math.abs(n.y)*halfExt[1]+Math.abs(n.z)*halfExt[2];
// the foot of the perpendicular from the origin: n*w
export const planeFoot=(n,w)=>({x:n.x*w,y:n.y*w,z:n.z*w});
// keep n.c within [-R(n), R(n)] so the plane still meets the box
export function clampPlaneCenter(c,n,halfExt){
 const R=planeReach(n,halfExt),d=n.x*c.x+n.y*c.y+n.z*c.z,e=d-Math.max(-R,Math.min(R,d));
 return e===0?{x:c.x,y:c.y,z:c.z}:{x:c.x-n.x*e,y:c.y-n.y*e,z:c.z-n.z*e};
}
// p0,q0: hand position / orientation (holder space) at the start of the drag; c0: the section's centre then; Qp0: its orientation then;
// p,q: the hand now (holder space). The section's local X is its normal. -> {c, Qp, n}
export function sectionDragStep({p0,q0,c0,Qp0,p,q,halfExt}){
 const dR=qMul(qNorm(q),qInv(qNorm(q0))),Qp=qNorm(qMul(dR,qNorm(Qp0))),n=qRot(Qp,{x:1,y:0,z:0});
 const s=(p.x-p0.x)*n.x+(p.y-p0.y)*n.y+(p.z-p0.z)*n.z;
 const c=clampPlaneCenter({x:c0.x+n.x*s,y:c0.y+n.y*s,z:c0.z+n.z*s},n,halfExt);
 return{c,Qp,n};
}

// ---- frame band of a section (spec 4.1), pure parts ----
// a point (y,z) on the section plane (local coordinates, square half side h) lies on the band of half width b around the edge
export function squareBandContains(y,z,h,b){return Math.abs(Math.max(Math.abs(y),Math.abs(z))-h)<=b+1e-12}
// ray (o,q in the section's local space) with the plane X=0 -> {t,y,z} or null (parallel, or behind the origin)
export function rayLocalPlaneX(o,q){
 if(!(Math.abs(q.x)>=1e-6))return null;
 const t=-o.x/q.x;if(!(t>T_MIN))return null;
 return{t,y:o.y+q.y*t,z:o.z+q.z*t};
}

// ---- hover vibration (spec 3) ----
// update(id, now) -> true when a pulse is due: a new id (not null) that differs from the previous frame's, at most once per debounceMs
export function createHoverPulse({debounceMs=100}={}){
 let last=null,lastPulse=-Infinity;
 return{
  update(id,now){
   if(id===null||id===undefined){last=null;return false}
   if(id===last)return false;
   last=id;
   if(now-lastPulse>=debounceMs){lastPulse=now;return true}
   return false;
  },
  reset(){last=null;lastPulse=-Infinity},
 };
}

// ---- haptic event table (spec 3), data only: amp 0..1, ms per pulse, count pulses, gapMs between them ----
export const HAPTIC={
 hover:{amp:0.08,ms:8,count:1,debounceMs:100},
 record:{amp:0.5,ms:20,count:1},
 select:{amp:0.35,ms:18,count:1},
 longPress:{amp:0.35,ms:18,count:2,gapMs:90}, // point ring opened, or the menu opened by a long A/X
 menuClose:{amp:0.35,ms:18,count:1},
 ringHighlight:{amp:0.12,ms:10,count:1},
 ringConfirm:{amp:0.35,ms:18,count:1},
 dragStart:{amp:0.35,ms:18,count:1}, // from an empty place only
 moveDrop:{amp:0.35,ms:18,count:1},
};
// no vibration at all: a tap on nothing, a record stopped by the thumbstick gate, a failed undo, a cancelled move, release of a drag
export const HAPTIC_SILENT=['emptyTap','gateBlocked','undoFailed','moveCancel','dragEnd'];

// ---- undo stack (spec 7) ----
// ops: {type:'add',id} | {type:'delete',c,index} | {type:'move',id,from,to}; the oldest is dropped beyond max
export function createUndoStack({max=20}={}){
 let ops=[];
 return{
  push(op){if(!op)return;ops.push(op);if(ops.length>max)ops=ops.slice(ops.length-max)},
  pop(){return ops.length?ops.pop():null},
  clear(){ops=[]},
  get size(){return ops.length},
 };
}
// undo one op on the comment store; true when it worked
export function applyUndo(op,store={removeComment,restoreComment,updateCommentPosition}){
 if(!op)return false;
 try{
  if(op.type==='add')return!!store.removeComment(op.id);
  if(op.type==='delete')return!!store.restoreComment(op.c,op.index);
  if(op.type==='move')return!!store.updateCommentPosition(op.id,op.from);
 }catch(e){console.warn('undo failed',e)}
 return false;
}
