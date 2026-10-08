// Analysis result labels (build 523): the label of an analysis result (colour, number, segments, volume) pinned at a point of the volume, in VR and on the PC / iPad 3D view,
// and MOVABLE in both. Pure functions (no DOM, no three.js); the label lives on the analysis region itself (region.label), so it is saved in the project with the
// region, follows the region's removal for free and is the same object for every view.
//   label = { anchor:{i,j,k}, offset?:{i,j,k} }
//   anchor : the point the label refers to, in VOXEL units of the data (floats, voxel centres at +.5 as in voxelToLocal / voxelToLocal3D)
//   offset : where the user left the label, as the vector from the anchor in VOXEL units (the same convention as a distance label's labelOffset in measurements.js), so it does not
//            depend on the model's move / rotation / scale and is the same in VR and on the PC. No offset = the view's default placement (beside the anchor, facing the viewer).
// A leader line joins a moved label to its anchor (leaderVisible).
import { stepDelta, offsetFromDelta } from './measure-label.js?v=20261008-build522';

export const ANALYSIS_LABEL_MAX=1e4; // |component| limit (voxels): anything beyond is a corrupt file, dropped
const num=(x)=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=ANALYSIS_LABEL_MAX;
const r3=x=>Math.round(x*1000)/1000;
const vec=o=>{if(!o||typeof o!=='object')return null;const{i,j,k}=o;return num(i)&&num(j)&&num(k)?{i:r3(i),j:r3(j),k:r3(k)}:null};
export const normalizeAnchor=vec;
export const normalizeOffset=vec;
// untrusted input (a project file) or a fresh label -> a clean label, or null (no / invalid anchor = no label; an invalid offset = the default placement)
export function normalizeAnalysisLabel(l){
 const anchor=vec(l?.anchor);if(!anchor)return null;
 const offset=vec(l?.offset);
 return offset?{anchor,offset}:{anchor};
}
export const sameVec=(a,b)=>(a?a.i+','+a.j+','+a.k:'')===(b?b.i+','+b.j+','+b.k:'');
export const sameLabel=(a,b)=>sameVec(a?.anchor,b?.anchor)&&sameVec(a?.offset,b?.offset);
export const hasOffset=l=>!!vec(l?.offset);
// the leader (label -> anchor) is shown once the label was moved away from its default place (a zero offset has nothing to lead)
export const leaderVisible=l=>{const o=vec(l?.offset);return !!o&&(Math.abs(o.i)>1e-6||Math.abs(o.j)>1e-6||Math.abs(o.k)>1e-6)};
// a label with a new offset (null = back to the default); the anchor is kept. Returns the clean label (a new object) or null for an invalid label.
export function withOffset(l,offset){
 const a=vec(l?.anchor);if(!a)return null;
 const o=offset==null?null:vec(offset);if(offset!=null&&!o)return null; // an invalid offset is refused, not "reset"
 return o?{anchor:a,offset:o}:{anchor:a};
}

// ---- data space <-> a view's local space ----
// step = the view's change per voxel along i / j / k: PC 3D [sx*k,-sy*k,sz*k] (comment-3d.js voxelStep3d), VR [2hx/cols,-2hy/rows,2hz/slices] (vr-measure.js voxelStep)
// the label's place in the view's local space: the anchor's local point + the offset in that view's units
export function labelLocal(anchorLocal,offset,step){
 const d=offset?stepDelta(offset,step):{x:0,y:0,z:0};
 return{x:anchorLocal.x+d.x,y:anchorLocal.y+d.y,z:anchorLocal.z+d.z};
}
// the offset (voxel units) that puts the label at `p` (the view's local space), given the anchor's local point
export const offsetForLocal=(anchorLocal,p,step)=>offsetFromDelta({x:p.x-anchorLocal.x,y:p.y-anchorLocal.y,z:p.z-anchorLocal.z},step);

// VR local (vr-point.js voxelToLocal) -> voxel (floats). halfExt = half extents of the box; dims {columns,rows,slices}
export function voxelFromLocalVr(p,halfExt,dims){
 return{i:(p.x/(2*halfExt[0])+.5)*dims.columns-.5,j:(.5-p.y/(2*halfExt[1]))*dims.rows-.5,k:(p.z/(2*halfExt[2])+.5)*dims.slices-.5};
}
// PC 3D local (crosshair.js voxelToLocal3D) -> voxel (floats)
export function voxelFromLocal3d(p,dims,spacing){
 const[sx,sy,sz]=spacing||[1,1,1],px=dims.columns*sx,py=dims.rows*sy,pz=dims.slices*sz,scale=3.3/Math.max(px,py,pz,1);
 return{i:(p.x/scale+px/2)/sx-.5,j:(-p.y/scale+py/2)/sy-.5,k:(p.z/scale+pz/2)/sz-.5};
}
// a voxel inside the dims (anchors are clamped so a label whose region was edited / a corrupt value never lies far outside the volume)
export function clampVoxel(v,dims){
 const c=(x,n)=>Math.min(Math.max(x,-.5),n-.5);
 return{i:c(v.i,dims.columns),j:c(v.j,dims.rows),k:c(v.k,dims.slices)};
}

// ---- state (on the region) ----
// regions: the analysisRegions array (or any list of {id,label?}). Changes are announced to the views (onAnalysisLabelsChange), which redraw.
const listeners=new Set();
export const onAnalysisLabelsChange=cb=>{listeners.add(cb);return()=>listeners.delete(cb)};
export const emitAnalysisLabelsChange=info=>{for(const cb of [...listeners])cb(info)};
// pin / replace the label of a region at an anchor (voxel units); keeps an existing offset only when keepOffset. false when the region is missing / the anchor is invalid.
export function setRegionLabel(region,label){
 if(!region)return false;
 if(label==null){if(!region.label)return true;delete region.label;emitAnalysisLabelsChange({id:region.id});return true}
 const l=normalizeAnalysisLabel(label);if(!l)return false;
 if(sameLabel(region.label,l))return true;
 region.label=l;emitAnalysisLabelsChange({id:region.id});return true;
}
// move the label (offset in voxel units from the anchor) or null = the default place; an unchanged value is not a change. labelOnly: only the place changed (a redraw, no re-judgement of anything else)
export function setRegionLabelOffset(region,offset){
 if(!region?.label)return false;
 const next=withOffset(region.label,offset);if(!next)return false;
 if(sameLabel(region.label,next))return true;
 region.label=next;emitAnalysisLabelsChange({id:region.id,labelOnly:true});return true;
}
// the label of a region for the project file (a clean copy) / for a snapshot, or undefined
export const labelForProject=region=>normalizeAnalysisLabel(region?.label)||undefined;
