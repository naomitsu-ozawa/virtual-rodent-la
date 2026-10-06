// VR display of the position comments (Issue #88, stages 3-4): one real 3D sphere per comment of the open series (right parallax in stereo)
// plus a small number chip. Number = the place in the whole comment list and colour = the 2D markers' cyan, the same rule as the 2D panel
// and the 3D overlay. vr-view.js calls createVrPointMarkers(THREE, scene) -> { update, pick, dispose } and does everything else
// (hidden test, laser, selection) itself; the look is decided here and nowhere else.
//
// Look (build 464):
//  - EXPOSED point (nothing of a shown segment between it and the head): a dark filled sphere with a white rim.
//  - HIDDEN point (behind tissue; the rule is vr-point.js pointIsHidden, refreshed about 10 times a second by vr-view.js): a small dot.
//  - ON the section (the active section passes through the point's voxel, vr-point.js sectionRelation): bigger, full strength.
//    Off the section: normal size and a thin line (the perpendicular) down to the section. No active section: neither.
//  - laser on a point: a white halo; the selected point: a yellow halo (kept until it is deselected or deleted).
// Spheres are drawn after the volume without a depth test, so a hidden point is still visible (as the small dot).
import { getComments, getMarkersShown, commentMatchesSeries, commentTarget } from './comments.js?v=20261006-build467';
import { voxelToLocal, sectionRelation, pickPoint } from './vr-point.js?v=20261006-build467';

export const VR_MARKER_COLOR=0x4dd8ff,VR_MARKER_FILL=0x0b6f8c,VR_RIM_COLOR=0xffffff,VR_HALO_HOVER=0xffffff,VR_HALO_SELECTED=0xffd23d;
export const PICK_MIN_M=0.004;
const RADIUS_UNITS=0.045,MIN_RADIUS_M=0.003; // radius in volume units (the longest side is 3.3) and the least radius in metres

// pure: how a point looks. Factors of the base radius. section: 'on' (the active section passes through the point's voxel), 'off', or null
// (no active section: no emphasis and no line).
export function markerStyle({hidden=false,section=null,selected=false,hover=false}={}){
 const on=section==='on';
 return{
  scale:(hidden?0.4:1)*(on?1.4:1),rim:!hidden,fill:hidden?'dot':'solid',chipScale:(hidden?2:3)*(on?1.2:1),
  halo:selected?'selected':hover?'hover':null,
  perpendicular:section==='off',
 };
}

// deps: the comment store to read (the app's by default; a test passes its own, as module URLs carry a ?v= build tag)
export function createVrPointMarkers(THREE,scene,deps={getComments,getMarkersShown}){
 const geo=new THREE.SphereGeometry(1,16,12);
 const mk=(color,extra={})=>new THREE.MeshBasicMaterial({color,transparent:true,depthTest:false,toneMapped:false,...extra});
 const mats={dot:mk(VR_MARKER_COLOR),solid:mk(VR_MARKER_FILL),rim:mk(VR_RIM_COLOR,{side:THREE.BackSide}),hover:mk(VR_HALO_HOVER,{side:THREE.BackSide,opacity:0.9}),selected:mk(VR_HALO_SELECTED,{side:THREE.BackSide,opacity:0.95})};
 const lineMat=new THREE.LineBasicMaterial({color:VR_MARKER_COLOR,transparent:true,opacity:0.6,depthTest:false,toneMapped:false});
 const chipGeo=new THREE.PlaneGeometry(1,1),items=new Map(); // comment id -> {sphere,rim,halo,line,chip,no}
 const v=new THREE.Vector3(),f=new THREE.Vector3(),s=new THREE.Vector3();
 const drawChip=(item,no)=>{
  const c=item.chip.material.map.image,ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#4dd8ff';ctx.beginPath();ctx.roundRect(3,3,c.width-6,c.height-6,24);ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.stroke();
  ctx.fillStyle='#04202a';ctx.font='800 56px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(no),c.width/2,c.height/2+3);
  item.chip.material.map.needsUpdate=true;item.no=no;
 };
 const make=()=>{
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const sphere=new THREE.Mesh(geo,mats.solid);sphere.renderOrder=4;sphere.frustumCulled=false;
  const rim=new THREE.Mesh(geo,mats.rim);rim.renderOrder=3;rim.frustumCulled=false;
  const halo=new THREE.Mesh(geo,mats.hover);halo.renderOrder=2;halo.frustumCulled=false;halo.visible=false;
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),lineMat);line.renderOrder=3;line.frustumCulled=false;line.visible=false;
  const chip=new THREE.Mesh(chipGeo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));chip.renderOrder=5;chip.frustumCulled=false;
  for(const o of [halo,rim,sphere,line,chip])scene.add(o);
  return{sphere,rim,halo,line,chip,no:0,radius:0};
 };
 const drop=(id,it)=>{for(const o of [it.sphere,it.rim,it.halo,it.line,it.chip])scene.remove(o);it.line.geometry.dispose();it.chip.material.map.dispose();it.chip.material.dispose();items.delete(id)};
 return{
  // every frame: positions follow the volume (mesh = the volume's box mesh) and the chips face the head.
  // hidden: Set of comment ids that are hidden behind tissue (vr-view.js, ~10 Hz); section: the active section's plane in object space
  // ({x,y,z,w}, unit normal) or null; selectedId; hover: Set of ids a laser points at.
  update({fingerprint,dims,halfExt,mesh,head,hidden=null,section=null,selectedId=null,hover=null}){
   const all=fingerprint&&dims&&halfExt&&mesh&&deps.getMarkersShown()?deps.getComments():[],keep=new Set();
   if(all.length){
    mesh.updateWorldMatrix(true,false);mesh.getWorldScale(s);const unit=s.x||1,r0=Math.max(MIN_RADIUS_M,RADIUS_UNITS*unit);
    all.forEach((c,n)=>{
     if(!commentMatchesSeries(c,fingerprint))return;
     const t=commentTarget(c,dims);if(!t)return;
     keep.add(c.id);let it=items.get(c.id);if(!it){it=make();items.set(c.id,it)}
     if(it.no!==n+1)drawChip(it,n+1);
     const l=voxelToLocal(t,halfExt,dims),rel=section?sectionRelation(l,section,halfExt,dims):null;
     const st=markerStyle({hidden:!!hidden?.has(c.id),section:rel?(rel.onSection?'on':'off'):null,selected:c.id===selectedId,hover:!!hover?.has(c.id)});
     v.set(l.x,l.y,l.z);mesh.localToWorld(v);
     const r=r0*st.scale;it.radius=Math.max(PICK_MIN_M,r*1.3*1.2); // build 468: the drawn radius (rim included) +20 %, about 4.7 mm at the default size; the least is PICK_MIN_M
     it.sphere.material=mats[st.fill];
     it.sphere.position.copy(v);it.sphere.scale.setScalar(r);
     it.rim.visible=st.rim;it.rim.position.copy(v);it.rim.scale.setScalar(r*1.3);
     it.halo.visible=!!st.halo;if(st.halo){it.halo.material=mats[st.halo];it.halo.position.copy(v);it.halo.scale.setScalar(r*1.9)}
     const showLine=st.perpendicular&&!!rel;it.line.visible=showLine;
     if(showLine){f.set(rel.foot.x,rel.foot.y,rel.foot.z);mesh.localToWorld(f);const a=it.line.geometry.attributes.position;a.setXYZ(0,v.x,v.y,v.z);a.setXYZ(1,f.x,f.y,f.z);a.needsUpdate=true}
     it.chip.position.set(v.x,v.y+r*2.6,v.z);it.chip.scale.setScalar(r0*st.chipScale);if(head)it.chip.lookAt(head);
    });
   }
   for(const [id,it] of [...items])if(!keep.has(id))drop(id,it);
  },
  // the nearest point a world-space ray (unit direction) touches: {id,distance} or null (as of the last update)
  pick(o,d){return pickPoint(o,d,[...items].map(([id,it])=>({id,center:it.sphere.position,radius:it.radius})))},
  // world centres of the points shown: [{id,world:Vector3}] (for the hidden test)
  centres(){return[...items].map(([id,it])=>({id,world:it.sphere.position}))},
  dispose(){for(const [id,it] of [...items])drop(id,it);geo.dispose();for(const m of Object.values(mats))m.dispose();lineMat.dispose();chipGeo.dispose()},
 };
}

// ---- surface-mode cursor (build 467) ----
// Where a trigger press would record in surface mode: a small lime core (about one voxel, centred EXACTLY on the voxel that will be recorded)
// plus a thin ring around it so the cursor is not lost. No glow. Clearly different from the point markers (cyan sphere with a white rim /
// yellow halo) and from the section-mode tip (a small dot in the hand colour). Drawn without a depth test, like the markers.
// Size: the core is one voxel wide in the world but never smaller than MIN_CORE_RAD angular radius seen from the head; the ring is a
// constant angular size (it scales with the distance to the head) and faces the head.
export const SURFACE_CURSOR_COLOR=0x8dff4a,SURFACE_CURSOR_MIN_CORE_RAD=0.0022,SURFACE_CURSOR_RING_RAD=0.011,SURFACE_CURSOR_RING_WIDTH=0.14;
// pure: core and ring radii (world metres). dist: head -> cursor distance (m); voxelM: the voxel's world size (m).
export function surfaceCursorSizes(dist,voxelM){
 const d=Math.max(1e-3,+dist||0),core=Math.max(0.5*(+voxelM||0),d*SURFACE_CURSOR_MIN_CORE_RAD),ring=Math.max(d*SURFACE_CURSOR_RING_RAD,core*2.6);
 return{core,ring};
}
// pure: side (world metres) of the section-mode cursor, a flat square lying on the section (about the surface ring's diameter, 0.022 of the distance)
export const sectionCursorSize=(dist,voxelM)=>Math.max((+dist||0)*0.022,2*(+voxelM||0));
// build 468: the section-mode cursor: a thin square frame lying on the section (same lime colour as the surface cursor; the mode is told by the shape only)
export function createSectionCursor(THREE,scene){
 const o=0.5,i=0.38,shape=new THREE.Shape([new THREE.Vector2(-o,-o),new THREE.Vector2(o,-o),new THREE.Vector2(o,o),new THREE.Vector2(-o,o)]);
 shape.holes.push(new THREE.Path([new THREE.Vector2(-i,-i),new THREE.Vector2(-i,i),new THREE.Vector2(i,i),new THREE.Vector2(i,-i)]));
 const frame=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:SURFACE_CURSOR_COLOR,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
 frame.rotation.y=Math.PI/2; // the shape's plane = the section's local YZ plane (its normal is local X)
 const group=new THREE.Group();group.add(frame);frame.renderOrder=6;frame.frustumCulled=false;group.visible=false;scene.add(group);
 const d=new THREE.Vector3();
 return{
  group,
  // centre: where on the section (world); quat: the section's world orientation; head: the head's world position; voxelM: the voxel's world size. null = hidden
  set(centre,quat,head,voxelM=0){
   group.visible=!!centre;if(!centre)return;
   group.position.set(centre.x,centre.y,centre.z);group.quaternion.set(quat.x,quat.y,quat.z,quat.w);
   const dist=head?d.set(head.x-centre.x,head.y-centre.y,head.z-centre.z).length():1;
   group.scale.setScalar(sectionCursorSize(dist,voxelM));
  },
  dispose(){scene.remove(group);frame.geometry.dispose();frame.material.dispose()},
 };
}
export function createSurfaceCursor(THREE,scene){
 const mat=()=>new THREE.MeshBasicMaterial({color:SURFACE_CURSOR_COLOR,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
 const core=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mat()),ring=new THREE.Mesh(new THREE.RingGeometry(1-SURFACE_CURSOR_RING_WIDTH,1,40),mat());
 core.renderOrder=6;ring.renderOrder=6;core.frustumCulled=false;ring.frustumCulled=false;
 const group=new THREE.Group();group.add(ring);group.add(core);group.visible=false;scene.add(group);
 const d=new THREE.Vector3();
 return{
  group,core,ring,
  // centre: the centre of the voxel that will be recorded (world); head: the head's world position; voxelM: the voxel's world size. null = hidden
  set(centre,head,voxelM=0){
   group.visible=!!centre;if(!centre)return;
   group.position.set(centre.x,centre.y,centre.z);
   const dist=head?d.set(head.x-centre.x,head.y-centre.y,head.z-centre.z).length():1,sz=surfaceCursorSizes(dist,voxelM);
   core.scale.setScalar(sz.core);ring.scale.setScalar(sz.ring);
   if(head)ring.lookAt(head.x,head.y,head.z);
  },
  dispose(){scene.remove(group);for(const m of [core,ring]){m.geometry.dispose();m.material.dispose()}},
 };
}
