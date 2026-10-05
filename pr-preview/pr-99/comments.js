// Position comments (Issue #88, stage 2): a comment = text + a place in the DATA (voxel indices {i,j,k}, like the linked
// crosshair in state.js: independent of zoom, pan or 3D rotation) + the series it was written on. Pure data and a small in-memory
// store, no DOM. They are saved in the project file (project.comments, see gatherProject / applyProject in data-load.js).
// A loaded project does NOT move any view by itself: a position is only used when the user presses "view this place".
import { clampVoxel } from './crosshair.js?v=20261005-build459';
import { compareFingerprints } from './project-file.js?v=20261005-build459';

export const COMMENT_MAX_TEXT=2000;
const isIdx=n=>Number.isFinite(+n)&&n!==null&&n!==''&&n!==true&&n!==false;
export const commentVoxel=v=>v&&isIdx(v.i)&&isIdx(v.j)&&isIdx(v.k)?{i:Math.round(+v.i),j:Math.round(+v.j),k:Math.round(+v.k)}:null;

let counter=0;
export function createComment({text,position,series,now=Date.now(),id}){
 const pos=commentVoxel(position);if(!pos)return null;
 return{id:id||('c'+now.toString(36)+'-'+(++counter)),text:String(text??'').slice(0,COMMENT_MAX_TEXT),createdAt:new Date(now).toISOString(),position:pos,series:series||null};
}
// from a project file / anything untrusted: keep valid entries, drop the rest
export function sanitizeComments(list){
 if(!Array.isArray(list))return[];
 const out=[],seen=new Set();
 for(const c of list){
  const pos=commentVoxel(c?.position);if(!pos||!c||typeof c!=='object')continue;
  let id=typeof c.id==='string'&&c.id?c.id:'c-'+out.length;while(seen.has(id))id+='_';seen.add(id);
  out.push({id,text:String(c.text??'').slice(0,COMMENT_MAX_TEXT),createdAt:typeof c.createdAt==='string'?c.createdAt:'',position:pos,series:c.series&&typeof c.series==='object'?c.series:null});
 }
 return out;
}
// a comment can be shown only on the series it was written on (same fingerprint: seriesUid if both have one, size, spacing)
export const commentMatchesSeries=(comment,fingerprint)=>!!comment?.series&&!!fingerprint&&compareFingerprints(comment.series,fingerprint).ok;
// the voxel to move to: inside the volume (a position outside, e.g. from a coarser grid, is clamped, never rejected)
export const commentTarget=(comment,dims)=>{const p=commentVoxel(comment?.position);return p&&dims?clampVoxel(p,dims):null};

// ---- store ----
let list=[];
const listeners=new Set();
const emit=()=>{for(const cb of [...listeners]){try{cb(getComments())}catch(e){console.warn('comment listener failed',e)}}};
export const getComments=()=>list.map(c=>({...c,position:{...c.position}}));
export function addComment(c){if(!c)return null;list=[...list,c];emit();return c}
export function removeComment(id){const n=list.length;list=list.filter(c=>c.id!==id);if(list.length!==n)emit();return list.length!==n}
export function setComments(next){list=sanitizeComments(next);emit()}
export const onCommentsChange=cb=>{listeners.add(cb);return()=>listeners.delete(cb)};
// for the project file: only what belongs to the series being saved
export const commentsForProject=fingerprint=>getComments().filter(c=>commentMatchesSeries(c,fingerprint));
