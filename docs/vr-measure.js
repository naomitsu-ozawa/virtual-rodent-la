// VR display of the distances between two points (build 477): a line A-B with the value in mm on a label (billboard) at its midpoint, and, while a
// distance is being made, the START point with a pulsing ring and the hint 「終点のポイントを選んでください」 next to it.
// vr-view.js calls createVrMeasure(THREE, scene) -> { update, dispose } every frame and does everything else (the flow, haptics, undo) itself; the state is
// measurements.js (the same for the PC / iPad). The value follows the points: it is recomputed from their voxels each frame (a point being moved included, preview).
import { getComments, getMarkersShown, commentMatchesSeries, commentTarget } from './comments.js?v=20261007-build479';
import { getMeasurements, distanceMm, measureLabel } from './measurements.js?v=20261007-build479';
import { voxelToLocal } from './vr-point.js?v=20261007-build479';

export const VR_MEASURE_COLOR=0xffd23d,MEASURE_LABEL_W_M=0.045,MEASURE_LABEL_H_M=0.0132,MEASURE_HINT_W_M=0.2,MEASURE_HINT_H_M=0.026;
// pure (build 479): where the label of a line goes, in the volume's local space. The label sits OUTSIDE the volume box: from the line's midpoint, outward
// (away from the box centre, perpendicular to the line), just past the point where that ray leaves the box (+ margin), so it never covers the volume.
// a, b: the ends; half: box half extents [hx,hy,hz]; margin: extra distance (local units); fallbackDir: used when the line passes through the centre. -> {x,y,z}
export function labelPlacement(a,b,half,margin=0,fallbackDir={x:0,y:1,z:0}){
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
 let u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};const ul=Math.hypot(u.x,u.y,u.z)||1;u={x:u.x/ul,y:u.y/ul,z:u.z/ul};
 const dot=(p,q)=>p.x*q.x+p.y*q.y+p.z*q.z,perp=v=>{const k=dot(v,u);return{x:v.x-k*u.x,y:v.y-k*u.y,z:v.z-k*u.z}};
 let q=perp(mid),ql=Math.hypot(q.x,q.y,q.z);
 if(ql<1e-9){q=perp(fallbackDir);ql=Math.hypot(q.x,q.y,q.z)}
 if(ql<1e-9){q={x:-u.y,y:u.x,z:0};ql=Math.hypot(q.x,q.y,q.z)||1}
 q={x:q.x/ql,y:q.y/ql,z:q.z/ql};
 // distance along q to leave the box (0 when the midpoint is already outside it)
 const P=[mid.x,mid.y,mid.z],Q=[q.x,q.y,q.z];let exit=Infinity;
 if(Math.abs(P[0])>half[0]||Math.abs(P[1])>half[1]||Math.abs(P[2])>half[2])exit=0; // the midpoint is already outside the box
 for(let i=0;i<3&&exit!==0;i++){if(Math.abs(Q[i])<1e-12)continue;const t=((Q[i]>0?half[i]:-half[i])-P[i])/Q[i];exit=Math.min(exit,t)}
 if(!(exit>0)||!Number.isFinite(exit))exit=0;
 return{x:mid.x+q.x*(exit+margin),y:mid.y+q.y*(exit+margin),z:mid.z+q.z*(exit+margin)};
}
// the label's size factor from the head distance (m): about 1 at arm's length (0.6 m), bigger when far, never tiny
export const labelScaleFor=dist=>Math.min(2.2,Math.max(0.7,(+dist||0.6)/0.6));

// pure: the pulse of the start ring, 0..1, a period of 1.2 s
export const pulsePhase=nowMs=>0.5+0.5*Math.sin((+nowMs||0)/1200*Math.PI*2);

export function createVrMeasure(THREE,scene,deps={getComments,getMarkersShown,getMeasurements}){
 const planeGeo=new THREE.PlaneGeometry(1,1),sphereGeo=new THREE.SphereGeometry(1,16,12);
 const lineMat=new THREE.LineBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.95,depthTest:false,toneMapped:false});
 const leaderMat=new THREE.LineBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.6,depthTest:false,toneMapped:false});
 const pulseMat=new THREE.MeshBasicMaterial({color:VR_MEASURE_COLOR,transparent:true,opacity:0.9,side:THREE.BackSide,depthTest:false,toneMapped:false});
 const makeLabel=(cw,ch,w,h)=>{
  const canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(planeGeo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));
  mesh.scale.set(w,h,1);mesh.renderOrder=6;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);
  return{mesh,canvas,tex,text:null};
 };
 const drawText=(lb,text,font)=>{
  if(lb.text===text)return;lb.text=text;
  const c=lb.canvas,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='rgba(17,23,27,.92)';ctx.beginPath();ctx.roundRect(3,3,c.width-6,c.height-6,c.height/2.4);ctx.fill();
  ctx.lineWidth=5;ctx.strokeStyle='#ffd23d';ctx.stroke();
  ctx.fillStyle='#ffffff';ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2+2);
  lb.tex.needsUpdate=true;
 };
 const disposeLabel=lb=>{scene.remove(lb.mesh);lb.tex.dispose();lb.mesh.material.dispose()};
 const items=new Map(); // measurement id -> {line,label}
 let start=null; // {ring,hint}
 const a=new THREE.Vector3(),b=new THREE.Vector3(),mid=new THREE.Vector3(),s=new THREE.Vector3(),lab=new THREE.Vector3(),hl=new THREE.Vector3();
 const dropItem=(id,it)=>{scene.remove(it.line);scene.remove(it.leader);it.line.geometry.dispose();it.leader.geometry.dispose();disposeLabel(it.label);items.delete(id)};
 const dropStart=()=>{if(!start)return;scene.remove(start.ring);disposeLabel(start.hint);start=null};
 return{
  // fingerprint / dims / halfExt / mesh: as vpMarkers.update; head: the head's world position; spacing: [sx,sy,sz] mm; warn: the series has a slice-spacing warning;
  // startId: the point a distance starts at (or null); hint: its text; now: ms; preview: {id,voxel} a point being moved (voxel null = still at its place)
  update({fingerprint,dims,halfExt,mesh,head,spacing,warn=false,startId=null,hint='',now=performance.now(),preview=null}){
   const all=fingerprint&&dims&&halfExt&&mesh&&deps.getMarkersShown()?deps.getComments():[],byId=new Map();
   for(const c of all){
    if(!commentMatchesSeries(c,fingerprint))continue;
    const t=commentTarget(c,dims);if(!t)continue;
    const vox=preview&&preview.id===c.id&&preview.voxel?preview.voxel:t;
    byId.set(c.id,{vox,local:voxelToLocal(vox,halfExt,dims)});
   }
   const keep=new Set();
   if(byId.size){
    mesh.updateWorldMatrix(true,false);mesh.getWorldScale(s);const unit=s.x||1,r0=Math.max(0.003,0.045*unit);
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
     drawText(it.label,measureLabel(distanceMm(A.vox,B.vox,spacing),warn),'bold 40px system-ui,sans-serif');
     // the label: outside the volume box, outward from the midpoint (labelPlacement), smaller (60 %) and scaled with the head distance, with a thin leader back to the midpoint
     mid.addVectors(a,b).multiplyScalar(0.5);
     const k=labelScaleFor(head?head.distanceTo(mid):0.6),marginLocal=(MEASURE_LABEL_W_M*k*0.5+0.008)/unit;
     if(head){hl.copy(head);mesh.worldToLocal(hl)}
     const lp=labelPlacement(A.local,B.local,halfExt,marginLocal,head?{x:hl.x,y:hl.y,z:hl.z}:undefined);
     lab.set(lp.x,lp.y,lp.z);mesh.localToWorld(lab);
     it.label.mesh.position.copy(lab);it.label.mesh.scale.set(MEASURE_LABEL_W_M*k,MEASURE_LABEL_H_M*k,1);if(head)it.label.mesh.lookAt(head);it.label.mesh.visible=true;
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
  dispose(){for(const [id,it] of [...items])dropItem(id,it);dropStart();planeGeo.dispose();sphereGeo.dispose();lineMat.dispose();leaderMat.dispose();pulseMat.dispose()},
 };
}
