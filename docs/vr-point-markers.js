// VR display of the position comments (Issue #88, stage 3) — a TEMPORARY, minimal look: one small real 3D sphere per comment of the open
// series (so it has the right parallax in stereo) plus a small number chip beside it. Number = the place in the whole comment list and
// colour = the 2D markers' cyan, the same rule as the 2D panel and the 3D overlay.
// How a point is shown when it is hidden inside / behind the volume is NOT decided here (a later PR): the spheres are drawn after the
// volume without a depth test, so they are always visible. To change the look, replace this module (or only drawMarker / the materials);
// vr-view.js only calls createVrPointMarkers(THREE, scene) -> { update, dispose }.
import { getComments, getMarkersShown, commentMatchesSeries, commentTarget } from './comments.js?v=20261006-build463';
import { voxelToLocal } from './vr-point.js?v=20261006-build463';

export const VR_MARKER_COLOR=0x4dd8ff;
const RADIUS_UNITS=0.045,MIN_RADIUS_M=0.003; // radius in volume units (the longest side is 3.3) and the least radius in metres

// deps: the comment store to read (the app's by default; a test passes its own, as module URLs carry a ?v= build tag)
export function createVrPointMarkers(THREE,scene,deps={getComments,getMarkersShown}){
 const geo=new THREE.SphereGeometry(1,16,12),mat=new THREE.MeshBasicMaterial({color:VR_MARKER_COLOR,transparent:true,depthTest:false,toneMapped:false});
 const chipGeo=new THREE.PlaneGeometry(1,1),items=new Map(); // comment id -> {sphere,chip,no}
 const v=new THREE.Vector3(),s=new THREE.Vector3();
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
  const sphere=new THREE.Mesh(geo,mat);sphere.renderOrder=4;sphere.frustumCulled=false;
  const chip=new THREE.Mesh(chipGeo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));chip.renderOrder=5;chip.frustumCulled=false;
  scene.add(sphere);scene.add(chip);return{sphere,chip,no:0};
 };
 const drop=(id,it)=>{scene.remove(it.sphere);scene.remove(it.chip);it.chip.material.map.dispose();it.chip.material.dispose();items.delete(id)};
 return{
  // every frame: positions follow the volume (mesh = the volume's box mesh) and the chips face the head
  update({fingerprint,dims,halfExt,mesh,head}){
   const all=fingerprint&&dims&&halfExt&&mesh&&deps.getMarkersShown()?deps.getComments():[],keep=new Set();
   if(all.length){
    mesh.updateWorldMatrix(true,false);mesh.getWorldScale(s);const unit=s.x||1,r=Math.max(MIN_RADIUS_M,RADIUS_UNITS*unit);
    all.forEach((c,n)=>{
     if(!commentMatchesSeries(c,fingerprint))return;
     const t=commentTarget(c,dims);if(!t)return;
     keep.add(c.id);let it=items.get(c.id);if(!it){it=make();items.set(c.id,it)}
     if(it.no!==n+1)drawChip(it,n+1);
     const l=voxelToLocal(t,halfExt,dims);v.set(l.x,l.y,l.z);mesh.localToWorld(v);
     it.sphere.position.copy(v);it.sphere.scale.setScalar(r);
     it.chip.position.set(v.x,v.y+r*2.6,v.z);it.chip.scale.setScalar(r*3);if(head)it.chip.lookAt(head);
    });
   }
   for(const [id,it] of [...items])if(!keep.has(id))drop(id,it);
  },
  dispose(){for(const [id,it] of [...items])drop(id,it);geo.dispose();mat.dispose();chipGeo.dispose()},
 };
}
