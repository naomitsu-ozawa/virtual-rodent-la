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
import { createComment, addComment, getComments, commentMatchesSeries } from './comments.js?v=20261006-build462';

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
