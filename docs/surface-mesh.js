// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { indexedGeometryFromTrianglePositions, makeSource3DCoordinates, makeVolume3DCoordinates, Float32FaceBuilder, appendAnalysisRunBoundaryFaces } from './mesh-geometry.js?v=20261001-build404';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { list, surfaceSmoothStrength } from './ui-shell.js?v=20261001-build404';
import { segmentState, segmentEditState } from './segments.js?v=20261001-build404';
import { surfaceSmoothingActive } from './settings.js?v=20261001-build404';
import { maskFromAnalysisRuns } from './run-length.js?v=20261001-build404';
import { frameYield } from './utils.js?v=20261001-build404';
import { smoothMaskScalarField } from './mask-ops.js?v=20261001-build404';
// ignoreCut: runs that are not the segment itself (an analysis region), so the
// segment's raw cut faces do not apply
export async function buildEditableRunsGroup(v,runs,key,shouldContinue=null,forceRaw=false,ignoreCut=false){
 const seg=segmentState[key],st=segmentEditState[key],smooth=!forceRaw&&surfaceSmoothingActive(),hasRawCut=!ignoreCut&&!!(st?.rawCutSurface&&st?.cutRuns);
 if(smooth&&!hasRawCut&&fullVolumeSmoothIsosurfaceFeasible(v)){
  if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
  const mask=maskFromAnalysisRuns(v,runs),mesh=await buildSmoothIsoMesh(v,mask,seg,key,true);
  if(shouldContinue&&!shouldContinue()){if(mesh)dispose(mesh);throw new Error('__SUPERSEDED__')}
  if(!mesh)return null;const group=new THREE.Group();group.add(mesh);return group;
 }
 const coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),limit=(navigator.maxTouchPoints>0?4:8)*1024*1024,pinnedKeys=hasRawCut?new Set():null;
 const params={color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!smooth};
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions,false,null,!forceRaw,pinnedKeys),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(params));mesh.name='edited_segment_'+key+'_'+z;mesh.userData.segmentKey=key;mesh.userData.editSurface=true;mesh.userData.displayScale=coords.scale;group.add(mesh);if(pinnedKeys)pinnedKeys.clear()};
 try{
  for(let z=0;z<v.slices;z++){
   if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
   appendAnalysisRunBoundaryFaces(builder,runs[z],z?runs[z-1]:null,z+1<v.slices?runs[z+1]:null,coords,z,hasRawCut?st.cutRuns[z]:null,hasRawCut&&z?st.cutRuns[z-1]:null,hasRawCut&&z+1<v.slices?st.cutRuns[z+1]:null,pinnedKeys);if(builder.length>=limit)flush(z);
   if((z&15)===0){await frameYield();if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__')}
  }
  flush(v.slices-1);
  if(smooth&&!hasRawCut)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
  return group.children.length?group:null;
 }catch(e){dispose(group);throw e}
}
export async function smoothIsosurfaceGeometry(v,mask,strength){
 const w=v.columns,h=v.rows,d=v.slices;if(!mask||mask.length!==w*h*d)return null;
 const {data,fw,fh,fd}=await smoothMaskScalarField(mask,w,h,d,strength),plane=fw*fh,[sx,sy,sz]=v.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),iso=.5;
 const positions=[],indices=[],edgeVertices=new Map();
 const cubeCorners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const tetEdges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const gridId=(x,y,z)=>z*plane+y*fw+x,field=(x,y,z)=>data[gridId(x,y,z)];
 const world=(x,y,z)=>[((x-.5)*sx-px/2)*scale,-((y-.5)*sy-py/2)*scale,((z-.5)*sz-pz/2)*scale];
 const edgeVertex=(ax,ay,az,bx,by,bz,va,vb)=>{
  const ia=gridId(ax,ay,az),ib=gridId(bx,by,bz),lo=Math.min(ia,ib),hi=Math.max(ia,ib),key=lo+':'+hi,found=edgeVertices.get(key);if(found!==undefined)return found;
  const den=vb-va,t=Math.abs(den)<1e-8?.5:Math.max(0,Math.min(1,(iso-va)/den)),pa=world(ax,ay,az),pb=world(bx,by,bz),id=positions.length/3;
  positions.push(pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t,pa[2]+(pb[2]-pa[2])*t);edgeVertices.set(key,id);return id;
 };
 const pcoord=id=>[positions[id*3],positions[id*3+1],positions[id*3+2]];
 const emit=(tri,out)=>{
  const a=pcoord(tri[0]),b=pcoord(tri[1]),cc=pcoord(tri[2]),abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=cc[0]-a[0],acy=cc[1]-a[1],acz=cc[2]-a[2],nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  if(nx*nx+ny*ny+nz*nz<1e-14)return;
  if(nx*out[0]+ny*out[1]+nz*out[2]<0){const t=tri[1];tri[1]=tri[2];tri[2]=t}indices.push(tri[0],tri[1],tri[2]);
 };
 for(let z=0;z<fd-1;z++){
  for(let y=0;y<fh-1;y++)for(let x=0;x<fw-1;x++){
   const cv=new Array(8),cg=new Array(8);let min=Infinity,max=-Infinity;
   for(let k=0;k<8;k++){const q=cubeCorners[k],gx=x+q[0],gy=y+q[1],gz=z+q[2],vv=field(gx,gy,gz);cv[k]=vv;cg[k]=[gx,gy,gz];if(vv<min)min=vv;if(vv>max)max=vv}
   if(min>=iso||max<iso)continue;
   for(const tet of tets){
    let inCount=0,outCount=0,ix=0,iy=0,iz=0,ox=0,oy=0,oz=0;
    for(const k of tet){const g=cg[k],p=world(g[0],g[1],g[2]);if(cv[k]>=iso){inCount++;ix+=p[0];iy+=p[1];iz+=p[2]}else{outCount++;ox+=p[0];oy+=p[1];oz+=p[2]}}
    if(inCount===0||inCount===4)continue;
    let crossings=[];
    for(const e of tetEdges){const ka=tet[e[0]],kb=tet[e[1]],va=cv[ka],vb=cv[kb];if((va>=iso)===(vb>=iso))continue;const a=cg[ka],b=cg[kb];crossings.push(edgeVertex(a[0],a[1],a[2],b[0],b[1],b[2],va,vb))}
    crossings=[...new Set(crossings)];
    const out=[ox/Math.max(1,outCount)-ix/Math.max(1,inCount),oy/Math.max(1,outCount)-iy/Math.max(1,inCount),oz/Math.max(1,outCount)-iz/Math.max(1,inCount)];
    if(crossings.length===3)emit([crossings[0],crossings[1],crossings[2]],out);
    else if(crossings.length===4){
     let cx=0,cy=0,cz=0;const pts=crossings.map(id=>{const p=pcoord(id);cx+=p[0];cy+=p[1];cz+=p[2];return{id,p}});cx/=4;cy/=4;cz/=4;
     let nl=Math.hypot(out[0],out[1],out[2])||1,nx=out[0]/nl,ny=out[1]/nl,nz=out[2]/nl;
     let ux=pts[0].p[0]-cx,uy=pts[0].p[1]-cy,uz=pts[0].p[2]-cz,ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
     let vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
     pts.sort((aa,bb)=>{const ap=aa.p,bp=bb.p,ax=ap[0]-cx,ay=ap[1]-cy,az=ap[2]-cz,bx=bp[0]-cx,by=bp[1]-cy,bz=bp[2]-cz;return Math.atan2(ax*vx+ay*vy+az*vz,ax*ux+ay*uy+az*uz)-Math.atan2(bx*vx+by*vy+bz*vz,bx*ux+by*uy+bz*uz)});
     emit([pts[0].id,pts[1].id,pts[2].id],out);emit([pts[0].id,pts[2].id,pts[3].id],out);
    }
   }
  }
  if((z&3)===3)await frameYield();
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
 taubinSmoothGeometry(geometry,Math.max(0,strength));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
export async function buildSmoothIsoMesh(v,mask,seg,key,editSurface=false){
 const geometry=await smoothIsosurfaceGeometry(v,mask,+surfaceSmoothStrength.value);if(!geometry)return null;
 const material=new THREE.MeshStandardMaterial({color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:false}),mesh=new THREE.Mesh(geometry,material);
 mesh.name='segment_'+key+'_isosurface';mesh.userData.segmentKey=key;mesh.userData.editSurface=!!editSurface;mesh.userData.displayScale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;return mesh;
}
export function fullVolumeSmoothIsosurfaceFeasible(v){
 if(!v)return false;
 const w=Number(v.columns)||0,h=Number(v.rows)||0,d=Number(v.slices)||0;
 if(w<=0||h<=0||d<=0)return false;
 const voxels=w*h*d,padded=(w+2)*(h+2)*(d+2);
 // Minimum working set before mesh arrays: binary mask + two Float32 scalar fields.
 const estimatedBytes=voxels+padded*8;
 const limit=(navigator.maxTouchPoints||0)>0?48*1024*1024:96*1024*1024;
 return estimatedBytes<=limit;
}
export function geometryFromSourcePositions(positions,alreadyGpuSmoothed=false,normals=null,applySmoothing=true,pinnedKeys=null){
 if(!positions||!positions.length)return null;
 let geometry;
 if(surfaceSmoothingActive()&&!alreadyGpuSmoothed&&applySmoothing){
  geometry=indexedGeometryFromTrianglePositions(positions);
  let pinned=null;
  if(pinnedKeys?.size){pinned=new Set();const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++){const k=Math.fround(p.getX(i))+','+Math.fround(p.getY(i))+','+Math.fround(p.getZ(i));if(pinnedKeys.has(k))pinned.add(i)}}
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value,pinned);
 }else{
  geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  if(alreadyGpuSmoothed&&normals?.length===positions.length)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3);
 }
 return geometry;
}
export function consolidateSegmentForStrongSmoothing(group,key,strength){
 const meshes=(group?.children||[]).filter(m=>m?.isMesh&&m.userData?.segmentKey===key&&!m.userData?.gpuResident);
 if(!meshes.length)return null;
 let floats=0;for(const mesh of meshes)floats+=mesh.geometry?.getAttribute?.('position')?.array?.length||0;
 if(!floats)return null;
 const positions=new Float32Array(floats);let q=0;
 for(const mesh of meshes){const a=mesh.geometry.getAttribute('position').array;positions.set(a,q);q+=a.length}
 const geometry=indexedGeometryFromTrianglePositions(positions);taubinSmoothGeometry(geometry,strength);
 const first=meshes[0],material=Array.isArray(first.material)?first.material[0].clone():first.material.clone(),merged=new THREE.Mesh(geometry,material);
 merged.name='segment_'+key+'_global_smooth';merged.userData.segmentKey=key;merged.userData.displayScale=first.userData.displayScale;if(first.userData.editSurface)merged.userData.editSurface=true;
 for(const mesh of meshes){mesh.parent?.remove(mesh);dispose(mesh)}
 group.add(merged);return merged;
}
export function taubinSmoothGeometry(geometry,strength,pinned=null){
 const pos=geometry.getAttribute('position');
 const index=geometry.index;
 if(!pos||!index||strength<=0)return;
 const vertexCount=pos.count;
 const neighbors=Array.from({length:vertexCount},()=>[]);
 const addNeighbor=(a,b)=>{const list=neighbors[a];for(let i=0;i<list.length;i++)if(list[i]===b)return;list.push(b)};
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  addNeighbor(a,b);addNeighbor(a,c);
  addNeighbor(b,a);addNeighbor(b,c);
  addNeighbor(c,a);addNeighbor(c,b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const baseStrength=Math.min(strength,1),lambda=.34*baseStrength,mu=-.36*baseStrength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(pinned?.has(i)||ns.length===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.length;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(strength<=1?2+strength*4:strength<=3?6+(strength-1)*18:42+(strength-3)*24));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}
export function dispose(o){o.traverse(c=>{const release=()=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()};const pending=c.userData?.gpuCompletion;if(pending?.then)pending.then(release,release);else release()})}
