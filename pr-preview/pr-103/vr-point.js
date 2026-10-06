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
import { createComment, addComment, getComments, removeComment, restoreComment, commentMatchesSeries } from './comments.js?v=20261006-build465';
import { marchClassificationHitInfo } from './vr-pick.js?v=20261006-build465';

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
export function sectionRayHit(o,q,{halfExt,dims,planes,count=0,cutBits=0}){
 let best=null;
 for(let i=0;i<count;i++){
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

// ---- trigger priority (build 464) ----
// What a hand's trigger acts on, first match wins: the menu / UI panels, then a section's handle or the hand's selected target, then an
// existing point (select it), then the face of a section (record a new point). Returns 'ui' | 'handle' | 'point' | 'section' | null.
export function resolveTrigger({ui=false,handle=false,point=null,section=false}={}){
 if(ui)return'ui';
 if(handle)return'handle';
 if(point!==null&&point!==undefined&&point!=='')return'point';
 if(section)return'section';
 return null;
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
// Trigger priority per mode: steps 1-3 are resolveTrigger's (menu -> section handle / selected target -> existing point); only the 4th step
// depends on the mode: 'section' = the face of a section (as before), 'surface' = the first tissue surface. Returns
// 'ui' | 'handle' | 'point' | 'section' | 'surface' | null.
export function resolveTriggerMode({ui=false,handle=false,point=null,section=false,surface=false,mode='section'}={}){
 const surf=normalizePointMode(mode)==='surface';
 const k=resolveTrigger({ui,handle,point,section:surf?false:section});
 return k===null&&surf&&surface?'surface':k;
}
