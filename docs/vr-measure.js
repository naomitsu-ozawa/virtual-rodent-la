// VR display of the distances between two points (build 477): a line A-B with the value in mm on a label (billboard) at its midpoint, and, while a
// distance is being made, the START point with a pulsing ring and the hint 「終点のポイントを選んでください」 next to it.
// vr-view.js calls createVrMeasure(THREE, scene) -> { update, pickLabel, dragLabel, dispose } every frame and does everything else (the flow, haptics, undo) itself; the state is
// measurements.js (the same for the PC / iPad). The value follows the points: it is recomputed from their voxels each frame (a point being moved included, preview).
import { getComments, getMarkersShown, commentMatchesSeries, commentTarget } from './comments.js?v=20261008-build496';
import { getMeasurements, setLabelOffset, distanceMm, measureLabel } from './measurements.js?v=20261008-build496';
import { nearLabelWorld, stepDelta, offsetFromDelta } from './measure-label.js?v=20261008-build496';
import { voxelToLocal } from './vr-point.js?v=20261008-build496';

export const VR_MEASURE_COLOR=0xffd23d,MEASURE_LABEL_W_M=0.045,MEASURE_LABEL_H_M=0.0132,MEASURE_HINT_W_M=0.2,MEASURE_HINT_H_M=0.026;
// the label's size factor from the head distance (m): about 1 at arm's length (0.6 m), bigger when far, never tiny
// the lit label (the laser on it / grabbed): like the ring menu's lit sector (vr-ring.js) it turns #ffe27a with dark text and a white rim, and grows a little
export const LABEL_LIT_SCALE=1.15;
export const labelScaleFor=dist=>Math.min(2.2,Math.max(0.7,(+dist||0.6)/0.6));

// pure: the pulse of the start ring, 0..1, a period of 1.2 s
export const pulsePhase=nowMs=>0.5+0.5*Math.sin((+nowMs||0)/1200*Math.PI*2);

export function createVrMeasure(THREE,scene,deps={getComments,getMarkersShown,getMeasurements,setLabelOffset}){
 const planeGeo=new THREE.PlaneGeometry(1,1),sphereGeo=new THREE.SphereGeometry(1,16,12);
 const lineMat=new THREE.LineBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.95,depthTest:false,toneMapped:false});
 const leaderMat=new THREE.LineBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.6,depthTest:false,toneMapped:false});
 const pulseMat=new THREE.MeshBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.9,side:THREE.BackSide,depthTest:false,toneMapped:false});
 const makeLabel=(cw,ch,w,h)=>{
  const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(planeGeo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));
  mesh.scale.set(w,h,1);mesh.renderOrder=6;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  return{mesh,canvas,tex,text:null,lit:false};
 };
 const drawText=(lb,text,font,lit=false)=>{
  if(lb.text===text&&lb.lit===lit)return;lb.text=text;lb.lit=lit; // the canvas is redrawn (and re-uploaded) only when the text or the lit state changes
  const c=lb.canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle=lit?'#ffe27a':'rgba(17,23,27,.92)';ctx.beginPath();ctx.roundRect(3,3,c.width-6,c.height-6,c.height/2.4);ctx.fill();
  ctx.lineWidth=lit?7:5;ctx.strokeStyle=lit?'#ffffff':'#ffd23d';ctx.stroke();
  ctx.fillStyle=lit?'#111111':'#ffffff';ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2+2);
  lb.tex.needsUpdate=true;
 };
 const disposeLabel=lb=>{scene.remove(lb.mesh);lb.tex.dispose();lb.mesh.material.dispose()};
 const items=new Map(); // measurement id -> {line,label}
 let start=null; // {ring,hint}
 const a=new THREE.Vector3(),b=new THREE.Vector3(),mid=new THREE.Vector3(),s=new THREE.Vector3(),lab=new THREE.Vector3(),inv=new THREE.Matrix4(),lo=new THREE.Vector3(),ld=new THREE.Vector3(),hit=new THREE.Vector3();
 const mv={i:0,j:0,k:0};
 const voxelStep=(h,d)=>[2*h[0]/d.columns,-2*h[1]/d.rows,2*h[2]/d.slices]; // object-space change per voxel along i / j / k (vr-point.js voxelToLocal)
 const dropItem=(id,it)=>{scene.remove(it.line);scene.remove(it.leader);it.line.geometry.dispose();it.leader.geometry.dispose();disposeLabel(it.label);items.delete(id)};
 const dropStart=()=>{if(!start)return;scene.remove(start.ring);disposeLabel(start.hint);start=null};
 return{
  // fingerprint / dims / halfExt / mesh: as vpMarkers.update; head: the head's world position; spacing: [sx,sy,sz] mm; warn: the series has a slice-spacing warning;
  // startId: the point a distance starts at (or null); hint: its text; now: ms; preview: {id,voxel} a point being moved (voxel null = still at its place)
  update({fingerprint,dims,halfExt,mesh,head,spacing,warn=false,startId=null,hint='',now=performance.now(),preview=null,lit=null}){ // lit: a Set of measurement ids whose label is lit (laser on it / grabbed), or null
   const all=fingerprint&&dims&&halfExt&&mesh&&deps.getMarkersShown()?deps.getComments():[],byId=new Map();
   for(const c of all){
    if(!commentMatchesSeries(c,fingerprint))continue;
    const t=commentTarget(c,dims);if(!t)continue;
    const vox=preview&&preview.id===c.id&&preview.voxel?preview.voxel:t;
    byId.set(c.id,{vox,local:voxelToLocal(vox,halfExt,dims)});
   }
   const keep=new Set();
   if(byId.size){
    mesh.updateWorldMatrix(true,false);mesh.getWorldScale(s);const unit=s.x||1,r0=Math.max(0.003,0.045*unit),step=voxelStep(halfExt,dims);
    for(const m of deps.getMeasurements()){
     const A=byId.get(m.a),B=byId.get(m.b);if(!A||!B)continue;
     keep.add(m.id);let it=items.get(m.id);
     if(!it){
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),lineMat);line.renderOrder=4;line.frustumCulled=false;scene.add(line);
      const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),leaderMat);leader.renderOrder=4;leader.frustumCulled=false;scene.add(leader);
      it={line,leader,label:makeLabel(256,72,MEASURE_LABEL_W_M,MEASURE_LABEL_H_M)};items.set(m.id,it);
     }
     a.set(A.local.x,A.local.y,A.local.z);mesh.localToWorld(a);b.set(B.local.x,B.local.y,B.local.z);mesh.localToWorld(b);
     const pos=it.line.geometry.attributes.position;pos.setXYZ(0,a.x,a.y,a.z);pos.setXYZ(1,b.x,b.y,b.z);pos.needsUpdate=true;
     const isLit=!!lit&&lit.has(m.id);drawText(it.label,measureLabel(distanceMm(A.vox,B.vox,spacing),warn),'bold 40px system-ui,sans-serif',isLit);
     // the label (60 % size, scaled with the head distance): where the user left it (labelOffset: voxel units from the midpoint) or, by default, NEAR the line
     // (beside it as seen from the head); a thin leader joins it to the midpoint
     mid.addVectors(a,b).multiplyScalar(0.5);
     const k=labelScaleFor(head?head.distanceTo(mid):0.6)*(isLit?LABEL_LIT_SCALE:1),ctx=it.ctx||(it.ctx={mesh:null,step:null,ml:{x:0,y:0,z:0}}),ml=ctx.ml;
     mv.i=(A.vox.i+B.vox.i)/2;mv.j=(A.vox.j+B.vox.j)/2;mv.k=(A.vox.k+B.vox.k)/2;ml.x=((mv.i+.5)/dims.columns-.5)*2*halfExt[0];ml.y=(.5-(mv.j+.5)/dims.rows)*2*halfExt[1];ml.z=((mv.k+.5)/dims.slices-.5)*2*halfExt[2]; // = voxelToLocal(mv), without a new object per frame
     ctx.mesh=mesh;ctx.step=step; // for dragLabel
     if(m.labelOffset){const d=stepDelta(m.labelOffset,step);lab.set(ml.x+d.x,ml.y+d.y,ml.z+d.z);mesh.localToWorld(lab)}
     else{const p=nearLabelWorld(a,b,head||{x:mid.x,y:mid.y+1,z:mid.z+1},(MEASURE_LABEL_W_M*0.35+0.008)*k);lab.set(p.x,p.y,p.z)}
     it.label.mesh.position.copy(lab);it.label.mesh.scale.set(MEASURE_LABEL_W_M*k,MEASURE_LABEL_H_M*k,1);if(head)it.label.mesh.lookAt(head);it.label.mesh.visible=true;it.label.mesh.updateMatrixWorld(true);
     const lg=it.leader.geometry.attributes.position;lg.setXYZ(0,mid.x,mid.y,mid.z);lg.setXYZ(1,lab.x,lab.y,lab.z);lg.needsUpdate=true;
    }
    const S=startId?byId.get(startId):null;
    if(S){
     if(!start){
      const ring=new THREE.Mesh(sphereGeo,pulseMat);ring.renderOrder=2;ring.frustumCulled=false;scene.add(ring);
      start={ring,hint:makeLabel(512,64,MEASURE_HINT_W_M,MEASURE_HINT_H_M)};
     }
     a.set(S.local.x,S.local.y,S.local.z);mesh.localToWorld(a);
     start.ring.position.copy(a);start.ring.scale.setScalar(r0*0.4*(2.1+0.9*pulsePhase(now)));
     drawText(start.hint,hint,'bold 30px system-ui,sans-serif');
     start.hint.mesh.position.set(a.x,a.y+0.045+r0,a.z);if(head)start.hint.mesh.lookAt(head);start.hint.mesh.visible=true;
    }else dropStart();
   }else dropStart();
   for(const [id,it] of [...items])if(!keep.has(id))dropItem(id,it);
  },
  // the label a ray (world origin o, unit direction d) points at: {id,distance,hit,pos} (hit / pos: world points) or null (as of the last update)
  pickLabel(o,d){
   let best=null;
   for(const [id,it] of items){
    const lm=it.label.mesh;if(!lm.visible)continue;
    inv.copy(lm.matrixWorld).invert();lo.set(o.x,o.y,o.z).applyMatrix4(inv);ld.set(d.x,d.y,d.z).transformDirection(inv);
    if(Math.abs(ld.z)<1e-9)continue;const t=-lo.z/ld.z;if(!(t>0))continue;
    hit.copy(lo).addScaledVector(ld,t); // on the label's plane, in its unit square (+-0.5): a little generous (the label is small)
    if(Math.abs(hit.x)>0.6||Math.abs(hit.y)>1.0)continue;
    hit.applyMatrix4(lm.matrixWorld);const dist=Math.hypot(hit.x-o.x,hit.y-o.y,hit.z-o.z);
    if(!best||dist<best.distance)best={id,distance:dist,hit:hit.clone(),pos:lm.position.clone()};
   }
   return best;
  },
  // move the label so that it sits at the world point P: stored as labelOffset (voxel units from the midpoint). false when the measurement is not shown.
  dragLabel(id,P){
   const it=items.get(id);if(!it||!it.ctx)return false;
   lo.set(P.x,P.y,P.z);it.ctx.mesh.worldToLocal(lo);
   return deps.setLabelOffset(id,offsetFromDelta({x:lo.x-it.ctx.ml.x,y:lo.y-it.ctx.ml.y,z:lo.z-it.ctx.ml.z},it.ctx.step));
  },
  dispose(){for(const [id,it] of [...items])dropItem(id,it);dropStart();planeGeo.dispose();sphereGeo.dispose();lineMat.dispose();leaderMat.dispose();pulseMat.dispose()},
 };
}
