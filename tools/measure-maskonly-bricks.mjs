// MEASUREMENT ONLY (issue #132). No app behaviour is changed: the occupancy-bit skip is prototyped as a string patch of the
// WGSL read from docs/medical-volume.js, inside this harness. Renders the real volumeShader() through SwiftShader WebGPU for
//   A  = main shader (maskOnly marks every brick as mixed)
//   P  = naive prototype: per-8^3-brick occupancy bits (r8uint 3D texture, binding 12) gate the maskOnly branch of brickClass(),
//        using main's existing skip (re-phases the ray, resets prevHv / previousCutIdx)
//   R  = P + a skip that keeps the ray's own sample grid (same float accumulation), re-fetches prevHv and keeps previousCutIdx:
//        pixel-identical to A in the maskOnly cases tested. Rd = R with the occupancy dilated by one brick.
//   F  = no skipping at all (FREF=1; reference for the existing HU skip)
// and reports GPU pass time (SwiftShader = CPU proxy, RELATIVE ONLY), HU fetches / brick reads / edit lookups per pixel, the
// brick census (how many bricks are mixed only because of maskOnly), occupancy build time / memory and A-vs-P/R pixel diffs.
// CUT=1|2 adds an applied cut box on the masked segment (far / near side of the camera), CUTOCC=1|2 adds the cut bricks to the
// occupancy (1 = all cut bricks, 2 = cut bricks whose HU range overlaps a segment); SEGOFF=0,2 disables segments; DBG=1 dumps first-hit
// debug values (F vs R). NOTE: tools/volume-shader-check.mjs is stale on main (uniform buffer 352 B, shader needs 368 B since the
// background colour), this harness uses 23 vec4.
//   PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node tools/measure-maskonly-bricks.mjs [fileA] [outDir]
// env: DATA=synth|real (real: REAL=<256^3 Int16 HU file>, REALSEG=sample2|sample1)  MODE=none|keep|sparse|dense|closing|body
//      (none = no edit mask; keep = same mask as a plain keep-mode edit (HU-gated, not maskOnly); the rest = maskOnly masks)
//      SEG=<shader segment index of the masked segment>  MPR=1 SECTION=1 ANALYSIS=1 (synth only)  PASSES=<timed passes>
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const fileA=process.argv[2]||'docs/medical-volume.js',outDir=process.argv[3]||'.';
const env=process.env,data=env.DATA||'synth',mode=env.MODE||'none',real=data==='real';
const N=real?256:+(env.N||128),passes=+(env.PASSES||5),mpr=+(env.MPR||0),section=!!env.SECTION,analysis=+(env.ANALYSIS||0);
const seg=+(env.SEG??(real?2:1));
const safeWgsl=source=>source.replace(/\bmeta\b/g,'vrlMeta').replace(/\bactive\b/g,'vrlActive').replace(/\btarget\b/g,'vrlTarget');
const shaderOf=file=>{const s=fs.readFileSync(file,'utf8'),a=s.indexOf('export function volumeShader(){'),b=s.indexOf('export function brickShader(){',a);const body=s.slice(a,b),i=body.indexOf('`')+1,j=body.lastIndexOf('`');return safeWgsl(body.slice(i,j))};
const counting=code=>('var<private> nFetch:u32=0u;var<private> nBrick:u32=0u;var<private> nEdit:u32=0u;\n'+code)
 .replace('fn huAt(tc0:vec3<f32>)->f32{','fn huAt(tc0:vec3<f32>)->f32{nFetch=nFetch+1u;').replace('fn huVoxel(tc0:vec3<f32>)->f32{','fn huVoxel(tc0:vec3<f32>)->f32{nFetch=nFetch+1u;')
 .replace('fn brickClass(p:vec3<f32>)->i32{','fn brickClass(p:vec3<f32>)->i32{nBrick=nBrick+1u;')
 .replace('fn editAllows(seg:u32,tc0:vec3<f32>)->bool{','fn editAllows(seg:u32,tc0:vec3<f32>)->bool{nEdit=nEdit+1u;')
 .replace(/return vec4<f32>\(acc\.rgb\+bg\*\(1\.0-acc\.a\),1\.0\);\n}`?$/,'return vec4<f32>(f32(nFetch),f32(nBrick),f32(nEdit),1.0);\n}');
// prototype patch (harness only)
const MASKONLY_LINE='for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];if(a.w>0.5&&((editRows[1]&(16u<<s))!=0u||(a.y>=mm.x&&a.x<=mm.y))){';
const proto=code=>{if(!code.includes(MASKONLY_LINE))throw new Error('brickClass maskOnly line not found (main changed?)');
 if(!code.includes('@group(0) @binding(11) var regionTex:texture_3d<u32>;'))throw new Error('regionTex binding not found');
 return code.replace('@group(0) @binding(11) var regionTex:texture_3d<u32>;','@group(0) @binding(11) var regionTex:texture_3d<u32>;\n@group(0) @binding(12) var occTex:texture_3d<u32>;')
  .replace(MASKONLY_LINE,'for(var s:u32=0u;s<4u;s=s+1u){let a=u.segments[s*2u];var cand=a.y>=mm.x&&a.x<=mm.y;if((editRows[1]&(16u<<s))!=0u){let ov=textureLoad(occTex,vec3<i32>(i32(bx),i32(by),i32(bz)),0).r;cand=(ov&(1u<<s))!=0u||((ov&(16u<<s))!=0u&&a.y>=mm.x&&a.x<=mm.y);}if(a.w>0.5&&cand){')};
// Q = P + phase-preserving skip: after skipping an empty brick the ray resumes on its own sample grid and the surface search
// starts one step back (previousT = nextT - step), i.e. the sample positions of a ray that sampled every step. (A / P re-phase.)
const SKIP_LINE='if(!canSample){brickEnd=-1.0;prevHv=-1e9;let skip=brickExitDistance(p,dir);nextT=t+max(skip+step*0.05,step);}';
const PREV_LINE='previousT=select(t,max(t,nextT-step*0.1),uniformJump);t=nextT;',NEXT_LINE='var nextT=t+step;var uniformJump=false;';
const phase=code=>{for(const l of[SKIP_LINE,PREV_LINE,NEXT_LINE])if(!code.includes(l))throw new Error('phase patch line not found: '+l.slice(0,40));
 return code.replace(SKIP_LINE,'if(!canSample){brickEnd=-1.0;prevHv=-1e9;let skip=brickExitDistance(p,dir);var nt=t;var pt=t;let nn=u32(max(ceil(skip/step),1.0));for(var q:u32=0u;q<nn;q=q+1u){pt=nt;nt=nt+step;}nextT=nt;skipPrevT=pt;skipJump=true;}')
  .replace(NEXT_LINE,NEXT_LINE+'var skipJump=false;var skipPrevT=0.0;').replace(PREV_LINE,'previousT=select(select(t,skipPrevT,skipJump),max(t,nextT-step*0.1),uniformJump);t=nextT;')};
// R = Q + keeps previousCutIdx across an occupancy skip (as the all-mixed path does; needed for the cut-face normal) + the HU of the sample one step before the resume point is fetched again (prevHv), so the iso-surface refinement of the first
// hit after a skipped brick sees what a ray that sampled every step would have seen (one extra fetch per brick entry).
const KEEPCUT_LINE='else if(!canSample&&!uniformJump){lastIndex=-1;previousCutIdx=-1;}';
const BRICKEND_LINE='var brickEnd=-1.0;var prevHv=-1e9;var uniformSeg:i32=-1;',PREVHV_LINE='let hvPrev=prevHv;prevHv=hv;';
const resume=code=>{for(const l of[BRICKEND_LINE,PREVHV_LINE,KEEPCUT_LINE])if(!code.includes(l))throw new Error('resume patch line not found: '+l.slice(0,40));
 return code.replace(KEEPCUT_LINE,'else if(!canSample&&!uniformJump){lastIndex=-1;if(!skipJump){previousCutIdx=-1;}}').replace(BRICKEND_LINE,BRICKEND_LINE+'var restoreT=-1.0;').replace('skipJump=true;}','skipJump=true;restoreT=skipPrevT;}')
  .replace('let tc0=texCoord(p);\n   let hv=huAt(tc0);','let tc0=texCoord(p);\n   if(restoreT>0.0){prevHv=huAt(texCoord(u.camOrigin.xyz+dir*restoreT));}restoreT=-1.0;\n   let hv=huAt(tc0);')};
const noSkip=code=>code.replace('fn brickClass(p:vec3<f32>)->i32{','fn brickClass(p:vec3<f32>)->i32{if(brickMinMax[0].x>1e30){return 0;}return 1;}\nfn brickClassOld(p:vec3<f32>)->i32{');
const codeA=shaderOf(fileA),codeP=proto(codeA),codeQ=phase(codeP),codeR=resume(codeQ);
if(!codeR.includes('restoreT>0.0'))throw new Error('resume patch (sample block) not applied');
const dbgPatch=code=>{const l='let hp=u.camOrigin.xyz+dir*hi;';if(!code.includes(l))throw new Error('dbg line');return ('var<private> dbg:vec4<f32>=vec4<f32>(-1.0);\n'+code).replace(l,l+'if(dbg.x<0.0){dbg=vec4<f32>(hi,previousT,hvPrev,f32(idx));}').replace(/return vec4<f32>\(acc\.rgb\+bg\*\(1\.0-acc\.a\),1\.0\);\n}`?$/,'return dbg;\n}')};
const shaders={Fd:dbgPatch(noSkip(codeA)),Rdbg:dbgPatch(codeR),A:codeA,Ac:counting(codeA),P:codeP,Pc:counting(codeP),R:codeR,Rc:counting(codeR),F:noSkip(codeA)};
const srv=http.createServer((q,r)=>{if(q.url==='/real.bin'){r.writeHead(200,{'content-type':'application/octet-stream'});fs.createReadStream(env.REAL).pipe(r);return}r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><html><body></body></html>')}).listen(8779);
const b=await chromium.launch({executablePath:env.PW_CHROMIUM,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader']});
const pg=await b.newPage();pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console.'+m.type()+':',m.text().slice(0,400))});
await pg.goto('http://localhost:8779/');
const result=await pg.evaluate(async ({shaders,N,real,mode,seg,passes,fref,dbgOn,segoff,cutOn,cutOcc,mpr,section,analysis,realseg,sectionZ,sectionSign})=>{
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 const total=N*N*N,dims=[N,N,N];let huArr;const INTERCEPT=real?-4000:-1024;
 // ---------------- volume ----------------
 if(real){const buf=await (await fetch('/real.bin')).arrayBuffer();huArr=new Int16Array(buf)}
 else{ // synthetic phantom (same as tools/volume-shader-check.mjs, scaled with N/128)
  huArr=new Int16Array(total);const k=N/128;
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const cx=(x-N/2)/k,cy=(y-N/2)/k,cz=(z-N/2)/k;let v=-1000;
   if(cx*cx/(52*52)+cy*cy/(40*40)+cz*cz/(56*56)<1)v=40;if(cx*cx+cy*cy+cz*cz<22*22)v=900;
   if(Math.abs(cy-20)<1&&Math.abs(cx)<36&&Math.abs(cz)<36)v=900;const r=Math.hypot(cx+30,cz);if(r>8&&r<11&&Math.abs(cy)<40)v=900;huArr[(z*N+y)*N+x]=v}}
 const raw=new Uint8Array(total*2);for(let i=0;i<total;i++){const q=huArr[i]-INTERCEPT;raw[i*2]=q&255;raw[i*2+1]=q>>8}
 const tex=device.createTexture({size:{width:N,height:N,depthOrArrayLayers:N},dimension:'3d',format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 device.queue.writeTexture({texture:tex},raw,{bytesPerRow:N*2,rowsPerImage:N},{width:N,height:N,depthOrArrayLayers:N});
 // ---------------- segments ----------------
 const segs=real
  ?(realseg==='sample1'?[[350,61535,1,1],[-50,350,0.35,1],[-250,-50,0.5,1],[-950,-300,0.4,0]]:[[350,61535,1,1],[-374,2419,0.35,1],[-574,-173,0.5,1],[-1391,-504,0.4,1]])
  :[[300,3000,1,1],[-200,299,0.35,1],[0,0,0,0],[0,0,0,0]];
 if(segoff!=='')for(const c of String(segoff).split(','))segs[+c][3]=0;
 const colors=[[0.91,0.86,0.72],[0.85,0.55,0.42],[0.91,0.78,0.36],[0.44,0.72,0.84]];
 // ---------------- bricks (min/max HU with one voxel overlap, as brickShader) ----------------
 const BS=8,nb=N/BS,nB=nb*nb*nb,brick=new Float32Array(nB*2);
 for(let k=0;k<nb;k++)for(let j=0;j<nb;j++)for(let i=0;i<nb;i++){let lo=1e9,hi=-1e9;
  for(let z=Math.max(0,k*BS-1);z<Math.min(N,(k+1)*BS+1);z++)for(let y=Math.max(0,j*BS-1);y<Math.min(N,(j+1)*BS+1);y++){const r=(z*N+y)*N;for(let x=Math.max(0,i*BS-1);x<Math.min(N,(i+1)*BS+1);x++){const v=huArr[r+x];if(v<lo)lo=v;if(v>hi)hi=v}}
  const o=(k*nb+j)*nb+i;brick[o*2]=lo;brick[o*2+1]=hi}
 const storage=arr=>{const buf=device.createBuffer({size:Math.max(16,arr.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(buf,0,arr);return buf};
 // ---------------- mask of segment `seg` ----------------
 const rangeMask=(lo,hi)=>{const m=new Uint8Array(total);for(let i=0;i<total;i++){const v=huArr[i];if(v>=lo&&v<=hi)m[i]=1}return m};
 const pass1=(src,axis,r,dil)=>{const dst=new Uint8Array(total),st=axis===0?1:axis===1?N:N*N;
  for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(z*N+y)*N+x,c=axis===0?x:axis===1?y:z;let acc=dil?0:1;
   const lo=Math.max(0,c-r),hi=Math.min(N-1,c+r);for(let q=lo;q<=hi;q++){const v=src[i+(q-c)*st];if(dil){if(v){acc=1;break}}else if(!v){acc=0;break}}
   dst[i]=acc}return dst};
 const closing=(m,r)=>{let a=m;for(const ax of[0,1,2])a=pass1(a,ax,r,true);for(const ax of[0,1,2])a=pass1(a,ax,r,false);return a};
 let mask=null;
 if(mode!=='none'){
  if(mode==='keep')mask=rangeMask(segs[seg][0],segs[seg][1]);
  else if(mode==='closing')mask=closing(rangeMask(segs[seg][0],segs[seg][1]),2);
  else if(mode==='body'){const m=new Uint8Array(total);for(let i=0;i<total;i++)if(huArr[i]>-1500)m[i]=1;mask=closing(m,3)}
  else if(mode==='dense'){mask=new Uint8Array(total);const e=Math.floor(N/32);for(let z=e;z<N-e;z++)for(let y=e;y<N-e;y++)for(let x=e;x<N-e;x++)mask[(z*N+y)*N+x]=1}
  else if(mode==='sparse'){mask=new Uint8Array(total);const k=N/128,sp=[[64,64,64,12],[40,70,80,9],[90,50,45,7]];
   for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=huArr[(z*N+y)*N+x];for(const [a,c,d,r] of sp){const dd=Math.hypot(x/k-a,y/k-c,z/k-d);if(dd<r*1.0&&((v>=segs[seg][0]&&v<=segs[seg][1])||dd<r*0.5)){mask[(z*N+y)*N+x]=1;break}}}}}
 // runs → editRows / editIntervals (setEditRuns layout: [activeMask, keepMask, 4 × (rowCount+1) row offsets], intervals x0|x1<<16)
 const rowCount=N*N;
 let cutRows=null,cutInts=null,cutBrick=null;
 if(cutOn){const cr=new Uint32Array(1+4*(rowCount+1)),ci=[];cr[0]=1<<seg;const cx0=cutOn===2?Math.round(N*72/128):0,cx1=cutOn===2?N-1:Math.round(N*56/128)-1;
  for(let si=0;si<4;si++){const base=1+si*(rowCount+1);for(let r=0;r<rowCount;r++){cr[base+r]=ci.length;if(si===seg)ci.push((cx1<<16)|cx0)}cr[base+rowCount]=ci.length}
  cutRows=storage(cr);cutInts=storage(new Uint32Array(ci));cutBrick=new Uint8Array(nB);for(let k=0;k<nb;k++)for(let j=0;j<nb;j++)for(let i=cx0>>3;i<=(cx1>>3);i++)cutBrick[(k*nb+j)*nb+i]=1;
  if(mask)for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=cx0;x<=cx1;x++)mask[(z*N+y)*N+x]=0}
 const maskOnly=mode!=='none'&&mode!=='keep';let editRows=storage(new Uint32Array(64)),editIntervals=null,intervalCount=0,occ=null,occD=null,buildMs=null;
 const occStats={};
 if(mask){
  const offsets=new Uint32Array(2+4*(rowCount+1)),ints=[];offsets[0]=1<<seg;offsets[1]=(1<<seg)|(maskOnly?16<<seg:0);
  for(let si=0;si<4;si++){const base=2+si*(rowCount+1);for(let r=0;r<rowCount;r++){offsets[base+r]=ints.length;
   if(si===seg){let x=0;const o=r*N;while(x<N){if(mask[o+x]){let x1=x;while(x1+1<N&&mask[o+x1+1])x1++;ints.push((x1<<16)|x);x=x1+1}else x++}}}offsets[base+rowCount]=ints.length}
  editRows=storage(offsets);editIntervals=storage(new Uint32Array(ints.length?ints:[0]));intervalCount=ints.length;
  // occupancy build from the runs (what setEditRuns would do): bit s = brick holds a voxel of the segment's final mask. median of 7 builds
  const build=()=>{const o=new Uint8Array(nB),bit=1<<seg;let z=0,y=0;const base=2+seg*(rowCount+1);
   for(let r=0;r<rowCount;r++){z=(r/N)|0;y=r%N;const rowBase=((z>>3)*nb+(y>>3))*nb;for(let q=offsets[base+r];q<offsets[base+r+1];q++){const v=ints[q],x0=v&65535,x1=v>>>16;for(let bx=x0>>3;bx<=x1>>3;bx++)o[rowBase+bx]|=bit}}return o};
  const ts=[];let o0;for(let i=0;i<7;i++){const t0=performance.now();o0=build();ts.push(performance.now()-t0)}ts.sort((a,b)=>a-b);buildMs=ts[3];occ=o0;if(cutOn&&cutOcc)for(let o=0;o<nB;o++)if(cutBrick[o])occ[o]|=(cutOcc===2?16:1)<<seg;
  const bit=1<<seg;occD=new Uint8Array(nB);
  for(let k=0;k<nb;k++)for(let j=0;j<nb;j++)for(let i=0;i<nb;i++){let f=0;for(let dz=-1;dz<=1&&!f;dz++)for(let dy=-1;dy<=1&&!f;dy++)for(let dx=-1;dx<=1;dx++){const x=i+dx,y=j+dy,zz=k+dz;if(x<0||y<0||zz<0||x>=nb||y>=nb||zz>=nb)continue;if(occ[(zz*nb+y)*nb+x]&bit){f=1;break}}if(f)occD[(k*nb+j)*nb+i]=bit}
  if(cutOn&&cutOcc===2)for(let o=0;o<nB;o++)occD[o]|=occ[o]&(16<<seg);
 }
 // ---------------- brick census ----------------
 {let baseNonEmpty=0,otherOv=0,occN=0,occDN=0,exactNew=0,dilNew=0,uniformBase=0;
  for(let o=0;o<nB;o++){const lo=brick[o*2],hi=brick[o*2+1];let any=false,other=false;
   for(let s=0;s<4;s++){const a=segs[s];if(!a[3])continue;if(a[1]>=lo&&a[0]<=hi){any=true;if(s!==seg)other=true}}
   if(any)baseNonEmpty++;if(other)otherOv++;const oc=occ?(occ[o]>>seg)&1:0,od=occD?(occD[o]>>seg)&1:0;if(oc)occN++;if(od)occDN++;if(other||oc)exactNew++;if(other||od)dilNew++}
  Object.assign(occStats,{nB,nonEmptyHuGated:baseNonEmpty,mixedWithMaskOnly_main:maskOnly?nB:baseNonEmpty,occupiedBricks:occN,occupiedDilated:occDN,mixedProtoExact:maskOnly?exactNew:baseNonEmpty,mixedProtoDilated:maskOnly?dilNew:baseNonEmpty,mixedOnlyBecauseOfMaskOnly:maskOnly?nB-baseNonEmpty:0,intervals:intervalCount,occBuildMs:buildMs,occBytes:nB})}
 const occTexFor=arr=>{const t=device.createTexture({size:{width:nb,height:nb,depthOrArrayLayers:nb},dimension:'3d',format:'r8uint',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  device.queue.writeTexture({texture:t},arr||new Uint8Array(nB),{bytesPerRow:nb,rowsPerImage:nb},{width:nb,height:nb,depthOrArrayLayers:nb});return t};
 const occTexExact=occTexFor(occ),occTexDil=occTexFor(occD),brickBuf=storage(brick),zero=storage(new Uint32Array([0,0,0,0]));
 // ---------------- analysis overlay (synthetic only; copied from volume-shader-check) ----------------
 let overlayBuf=zero,regionTex=device.createTexture({size:{width:1,height:1,depthOrArrayLayers:1},dimension:'3d',format:'r32uint',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 if(analysis&&!real){const regionR=22*N/128,counts=new Uint32Array(rowCount),runs=[];
  for(let z=0;z<N;z++)for(let y=0;y<N;y++){let x0=-1;for(let x=0;x<=N;x++){const inR=x<N&&Math.hypot(x-N/2,y-N/2,z-N/2)<regionR;if(inR&&x0<0)x0=x;if(!inR&&x0>=0){runs.push([z*N+y,x0,x-1]);counts[z*N+y]++;x0=-1}}}
  const header=2+rowCount,d1=new Uint32Array(header+runs.length*2),cursor=new Uint32Array(rowCount);d1[0]=1;let at=header;for(let r=0;r<rowCount;r++){d1[1+r]=at;cursor[r]=at;at+=counts[r]*2}d1[1+rowCount]=at;
  const word=(0x00c8ff|0x1000000|0x80000000)>>>0;for(const [row,x0,x1] of runs){const c=cursor[row];d1[c]=((x1&65535)<<16)|(x0&65535);d1[c+1]=word;cursor[row]=c+2}
  const tableStart=header+runs.length*2,d2=new Uint32Array(tableStart+16);d2.set(d1);d2[0]=tableStart;d2[tableStart]=0xff;d2[tableStart+1]=word;overlayBuf=storage(d2);
  const tw=N/8,bytesPerRow=Math.ceil(tw*4/256)*256,rowWords=bytesPerRow/4,staging=device.createBuffer({size:bytesPerRow*N*N,usage:GPUBufferUsage.COPY_SRC,mappedAtCreation:true}),words=new Uint32Array(staging.getMappedRange());
  for(const [row,x0,x1] of runs){for(let x=x0;x<=x1;x++){const wi=row*rowWords+(x>>3),sh=(x&7)*4;words[wi]=(words[wi]&~(15<<sh))|(1<<sh)}}
  staging.unmap();regionTex=device.createTexture({size:{width:tw,height:N,depthOrArrayLayers:N},dimension:'3d',format:'r32uint',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
  const enc=device.createCommandEncoder();enc.copyBufferToTexture({buffer:staging,bytesPerRow,rowsPerImage:N},{texture:regionTex},{width:tw,height:N,depthOrArrayLayers:N});device.queue.submit([enc.finish()])}
 // ---------------- uniforms (same camera / layout as volume-shader-check) ----------------
 const W=384,H=384,uni=new Float32Array(23*4),put=(s,a,c,d,e)=>{uni[s*4]=a;uni[s*4+1]=c;uni[s*4+2]=d;uni[s*4+3]=e};
 const half=[1.65,1.65,1.65],scale=3.3/N,step=Math.max(1e-5,scale*0.85);
 const o=[3.2,2.1,4.0],len=Math.hypot(...o),fwd=o.map(v=>-v/len),upW=[0,1,0];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
 const right=norm(cross(fwd,upW)),up=cross(right,fwd);
 put(0,o[0],o[1],o[2],0);put(1,right[0],right[1],right[2],Math.tan(45/2*Math.PI/180));put(2,up[0],up[1],up[2],W/H);put(3,fwd[0],fwd[1],fwd[2],0);
 put(4,half[0],half[1],half[2],step);put(5,N,N,N,1);put(6,INTERCEPT,0,nb,nb);put(7,W,H,nb,BS);
 for(let s=0;s<4;s++){const a=segs[s];put(8+s*2,a[0],a[1],a[2],a[3]);put(9+s*2,colors[s][0],colors[s][1],colors[s][2],1)}
 put(16,N/2,N/2,N/2,mpr?0.6:0);put(17,mpr,0,0,1);put(18,40,400,0,0);put(19,section?1:0,sectionZ,sectionSign,0);put(20,section?1:0,0.85,0,28);put(21,N,N,N,1);put(22,0.05,0.06,0.08,1);
 const uniBuf=device.createBuffer({size:uni.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(uniBuf,0,uni);
 const sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});
 const targets={rgba8unorm:device.createTexture({size:{width:W,height:H},format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),rgba32float:device.createTexture({size:{width:W,height:H},format:'rgba32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})};
 const readBufs={rgba8unorm:device.createBuffer({size:W*H*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),rgba32float:device.createBuffer({size:W*H*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})};
 const run=async(code,label,format,occTexture)=>{
  const target=targets[format],readBuf=readBufs[format],bpp=format==='rgba8unorm'?4:16;
  const module=device.createShaderModule({code});const info=await module.getCompilationInfo();
  const errs=info.messages.filter(m=>m.type==='error').map(m=>m.lineNum+':'+m.message);if(errs.length)return{label,errs};
  const pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const entries=[{binding:0,resource:{buffer:uniBuf}},{binding:1,resource:tex.createView({dimension:'3d'})},{binding:2,resource:{buffer:editRows}},{binding:3,resource:{buffer:brickBuf}},{binding:4,resource:sampler},
   {binding:5,resource:{buffer:editIntervals||zero}},{binding:6,resource:{buffer:zero}},{binding:7,resource:{buffer:zero}},{binding:8,resource:{buffer:cutRows||zero}},{binding:9,resource:{buffer:cutInts||zero}},{binding:10,resource:{buffer:overlayBuf}},{binding:11,resource:regionTex.createView({dimension:'3d'})}];
  if(code.includes('occTex'))entries.push({binding:12,resource:occTexture.createView({dimension:'3d'})});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries});
  const times=[],np=format==='rgba8unorm'?passes+1:1;let px=null;
  for(let i=0;i<np;i++){
   const enc=device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',clearValue:{r:0,g:0,b:0,a:1},storeOp:'store'}]});
   pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();
   if(i===np-1)enc.copyTextureToBuffer({texture:target},{buffer:readBuf,bytesPerRow:W*bpp},{width:W,height:H});
   const t0=performance.now();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();times.push(performance.now()-t0);
  }
  await readBuf.mapAsync(GPUMapMode.READ);px=format==='rgba8unorm'?Array.from(new Uint8Array(readBuf.getMappedRange())):Array.from(new Float32Array(readBuf.getMappedRange()));readBuf.unmap();
  const warm=times.slice(1).sort((a,b)=>a-b);return{label,msMin:warm[0],msMed:warm[(warm.length/2)|0],px};
 };
 if(dbgOn){const fd=await run(shaders.Fd,'Fd','rgba32float'),rd=await run(shaders.Rdbg,'Rdbg','rgba32float',occTexExact);if(fd.errs||rd.errs)return{res:{errs:[fd.errs,rd.errs]}};
  const rows=[];let n=0;for(let i=0;i<fd.px.length;i+=4){if(fd.px[i]!==rd.px[i]||fd.px[i+1]!==rd.px[i+1]||fd.px[i+2]!==rd.px[i+2]){n++;if(rows.length<12)rows.push([(i/4)%W,((i/4)/W)|0,Array.from(fd.px.slice(i,i+4)),Array.from(rd.px.slice(i,i+4))])}}
  return{res:{n,rows},A:[],P:[],W,H}}
 const out={A:await run(shaders.A,'A','rgba8unorm'),P:await run(shaders.P,'P','rgba8unorm',occTexExact),R:await run(shaders.R,'R','rgba8unorm',occTexExact),Rd:await run(shaders.R,'Rd','rgba8unorm',occTexDil),
  Ac:await run(shaders.Ac,'Ac','rgba32float'),Pc:await run(shaders.Pc,'Pc','rgba32float',occTexExact),Rc:await run(shaders.Rc,'Rc','rgba32float',occTexExact),Rdc:await run(shaders.Rc,'Rdc','rgba32float',occTexDil)};
 if(fref)out.F=await run(shaders.F,'F','rgba8unorm');
 for(const k of['Ac','Pc','Rc','Rdc']){const r=out[k];if(r.errs)continue;let f=0,br=0,e=0;for(let i=0;i<r.px.length;i+=4){f+=r.px[i];br+=r.px[i+1];e+=r.px[i+2]}r.sums={fetch:f/(W*H),brick:br/(W*H),edit:e/(W*H)};r.px=null}
 const diff=(a,b)=>{let n=0,maxd=0,sum=0;for(let i=0;i<a.length;i++){if(i%4===3)continue;const d=Math.abs(a[i]-b[i]);if(d){n++;sum+=d;if(d>maxd)maxd=d}}return{differingChannels:n,of:a.length*3/4,maxDiff:maxd,meanDiff:n?sum/n:0}};
 const dump=[];if(fref){const pf=out.F.px,pr=out.R.px;for(let i=0;i<pf.length&&dump.length<400;i+=4){if(pf[i]!==pr[i]||pf[i+1]!==pr[i+1]||pf[i+2]!==pr[i+2])dump.push([(i/4)%W,((i/4)/W)|0,pf[i],pf[i+1],pf[i+2],pr[i],pr[i+1],pr[i+2]])}}
 const res={dump,A:{msMin:out.A.msMin,msMed:out.A.msMed},P:{msMin:out.P.msMin,msMed:out.P.msMed},R:{msMin:out.R.msMin,msMed:out.R.msMed},Rd:{msMin:out.Rd.msMin,msMed:out.Rd.msMed},
  counts:{A:out.Ac.sums,P:out.Pc.sums,R:out.Rc.sums,Rd:out.Rdc.sums},diffAP:diff(out.A.px,out.P.px),diffAR:diff(out.A.px,out.R.px),diffARd:diff(out.A.px,out.Rd.px),
  ...(fref?{F:{msMin:out.F.msMin,msMed:out.F.msMed},diffAF:diff(out.A.px,out.F.px),diffRF:diff(out.R.px,out.F.px),diffPF:diff(out.P.px,out.F.px)}:{}),census:occStats,errs:[out.A,out.P,out.R,out.Rc].filter(r=>r.errs).map(r=>r.label+':'+r.errs.join('|'))};
 return{res,A:out.A.px,P:out.R.px,W,H};
},{shaders,N,real,mode,seg,passes,fref:!!env.FREF,dbgOn:!!env.DBG,segoff:env.SEGOFF??'',cutOn:+(env.CUT||0),cutOcc:+(env.CUTOCC||0),mpr,section,analysis,realseg:env.REALSEG||'sample2',sectionZ:+(env.SECTION_Z??0.3),sectionSign:+(env.SECTION_SIGN??-1)});
await b.close();srv.close();
const tag=[data,mode,'seg'+seg,mpr?'mpr':'',section?'section':'',env.CUT?(env.CUTOCC?'cutocc':'cut'):'',analysis?'analysis':''].filter(Boolean).join('_');
console.log('RESULT '+tag+' '+JSON.stringify(result.res));
if(env.PNG){const zlib=await import('node:zlib');
 const png=(px,w,h)=>{const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w*4;x++)raw[y*(w*4+1)+1+x]=px[y*w*4+x]}
  const crc=bb=>{let c=~0;for(const v of bb){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(0xEDB88320&-(c&1))}return ~c>>>0};
  const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])};
 fs.writeFileSync(path.join(outDir,tag+'-A.png'),png(result.A,result.W,result.H));fs.writeFileSync(path.join(outDir,tag+'-P.png'),png(result.P,result.W,result.H))}
