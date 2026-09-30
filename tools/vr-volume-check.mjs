// Headless check of the VR volume shader (docs/vr-view.js fragmentShader):
// renders a synthetic phantom with the real GLSL through three.js on
// SwiftShader WebGL2, in the HU path and the precomputed-classification path,
// counts texture fetches per pixel (counters injected into huAt / sliceGray /
// brickMayContain / the cls fetch) and compares two versions of the file.
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/vr-volume-check.mjs [fileA] [fileB] [outDir]
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const fileA=process.argv[2]||'docs/vr-view.js',fileB=process.argv[3]||null,outDir=process.argv[4]||'.';
const grab=(src,name)=>{const m=src.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'));if(!m)throw new Error('shader '+name+' not found');return m[1]};
const load=f=>{const s=fs.readFileSync(f,'utf8');return{vs:grab(s,'vertexShader'),fs:grab(s,'fragmentShader')}};
const counting=code=>code
 .replace('out highp vec4 outColor;','out highp vec4 outColor;\nint nFetch=0;int nBrick=0;int nCls=0;')
 .replace('float huAt(vec3 tc0){','float huAt(vec3 tc0){nFetch++;')
 .replace('bool brickMayContain(vec3 tc){\n','bool brickMayContain(vec3 tc){nBrick++;\n').replace('int brickClass(vec3 tc){','int brickClass(vec3 tc){nBrick++;')
 .replace('  vec4 q=texture(clsTex,','  nCls++;vec4 q=texture(clsTex,')
 .replace('out highp vec4 outColor;\nint nFetch=0;','out highp vec4 outColor;\nint nDist=0;int nFetch=0;').replace('float distAt(vec3 tc){','float distAt(vec3 tc){nDist++;')
 .replace(/ outColor=acc;\n}$/,' outColor=vec4(float(nFetch),float(nBrick),float(nCls),float(nDist));\n}');
const A=load(fileA),B=fileB?load(fileB):null;
const nm=path.resolve('node_modules');
const srv=http.createServer((q,r)=>{if(q.url.startsWith('/distance-field.js')){r.writeHead(200,{'content-type':'text/javascript'});return r.end(fs.readFileSync('docs/distance-field.js','utf8'))}r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><html><body></body></html>')}).listen(8779);
const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage();pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console.'+m.type()+':',m.text().slice(0,300))});pg.on('pageerror',e=>console.log('PAGEERROR',String(e).slice(0,300)));
await pg.route(/^https:\/\//,rt=>{const u=rt.request().url();if(u.includes('three.module.js'))return rt.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(nm+'/three/build/three.module.js','utf8')});if(u.includes('three.core.js'))return rt.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(nm+'/three/build/three.core.js','utf8')});return rt.abort()});
await pg.goto('http://localhost:8779/');
const result=await pg.evaluate(async ({A,B,countA,countB,refine,useDist,boneOnly})=>{
 const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
 const W=384,H=384,renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.setSize(W,H,false);
 // phantom as in tools/volume-shader-check.mjs: u16 = HU + 1024, slope 1, intercept -1024
 const N=128,data=new Uint8Array(N*N*N*2);
 const hu=(x,y,z)=>{const cx=x-64,cy=y-64,cz=z-64;let v=-1000;
  if(cx*cx/(52*52)+cy*cy/(40*40)+cz*cz/(56*56)<1)v=40;if(cx*cx+cy*cy+cz*cz<22*22)v=900;
  if(Math.abs(cy-20)<1&&Math.abs(cx)<36&&Math.abs(cz)<36)v=900;const r=Math.hypot(cx+30,cz);if(r>8&&r<11&&Math.abs(cy)<40)v=900;return v};
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const q=hu(x,y,z)+1024,o=((z*N+y)*N+x)*2;data[o]=q&255;data[o+1]=q>>8}
 const vol=new THREE.Data3DTexture(data,N,N,N);vol.format=THREE.RGFormat;vol.type=THREE.UnsignedByteType;vol.minFilter=vol.magFilter=THREE.LinearFilter;vol.unpackAlignment=1;vol.needsUpdate=true;
 // bricks 8³ with one voxel of overlap (vr-view computeBricks)
 const BS=8,bx=N/BS,mm=new Float32Array(bx*bx*bx*2);
 for(let k=0;k<bx;k++)for(let j=0;j<bx;j++)for(let i=0;i<bx;i++){let lo=1e9,hi=-1e9;
  for(let z=Math.max(0,k*BS-1);z<Math.min(N,(k+1)*BS+1);z++)for(let y=Math.max(0,j*BS-1);y<Math.min(N,(j+1)*BS+1);y++)for(let x=Math.max(0,i*BS-1);x<Math.min(N,(i+1)*BS+1);x++){const v=hu(x,y,z);if(v<lo)lo=v;if(v>hi)hi=v}
  const o=((k*bx+j)*bx+i)*2;mm[o]=lo;mm[o+1]=hi}
 const bricks=new THREE.Data3DTexture(mm,bx,bx,bx);bricks.format=THREE.RGFormat;bricks.type=THREE.FloatType;bricks.minFilter=bricks.magFilter=THREE.NearestFilter;bricks.unpackAlignment=1;bricks.needsUpdate=true;
 // classification (vr-view build 356): per segment 0.5 + (HU distance inside the range)/2048, one byte per channel
 const SEG=[[300,3000],[-200,299]],cls=new Uint8Array(N*N*N*2);
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const v=hu(x,y,z),o=((z*N+y)*N+x)*2;for(let s=0;s<2;s++){const [a,c]=SEG[s],d=Math.min(v-a,c-v);cls[o+s]=Math.max(0,Math.min(255,Math.round(127.5+d/2048*255)))}}
 const clsTex=new THREE.Data3DTexture(cls,N,N,N);clsTex.format=THREE.RGFormat;clsTex.type=THREE.UnsignedByteType;clsTex.minFilter=clsTex.magFilter=THREE.LinearFilter;clsTex.unpackAlignment=1;clsTex.needsUpdate=true;
 const dummy=new THREE.Data3DTexture(new Uint8Array(4),1,1,1);dummy.format=THREE.RGBAFormat;dummy.needsUpdate=true;
 const {buildDistanceBytes}=await import('/distance-field.js');const t0=performance.now();const dist=await buildDistanceBytes({data:cls,C:2,chan:[0,1,-1,-1]},[N,N,N]);const distMs=performance.now()-t0;
 const distTex=new THREE.Data3DTexture(dist.data,N,N,N);distTex.format=THREE.RGFormat;distTex.type=THREE.UnsignedByteType;distTex.minFilter=distTex.magFilter=THREE.NearestFilter;distTex.unpackAlignment=1;distTex.needsUpdate=true;
 const half=1.65,scale=3.3/N,step=scale*0.85;
 const uniforms=()=>({vol:{value:vol},bricks:{value:bricks},halfExt:{value:new THREE.Vector3(half,half,half)},texDims:{value:new THREE.Vector3(N,N,N)},brickDims:{value:new THREE.Vector3(bx,bx,bx)},
  stepSize:{value:step},diag:{value:0},calib:{value:new THREE.Vector3(1,-1024,0)},segA:{value:[new THREE.Vector4(300,3000,1,1),new THREE.Vector4(-200,299,0.35,1),new THREE.Vector4(),new THREE.Vector4()]},segC:{value:[new THREE.Vector4(0.91,0.86,0.72,0),new THREE.Vector4(0.85,0.55,0.42,0),new THREE.Vector4(),new THREE.Vector4()]},
  cutPlanes:{value:[0,1,2,3].map(()=>new THREE.Vector4(0,0,1,0))},planeCount:{value:0},planeCut:{value:0},capOn:{value:1},sliceTint:{value:0.5},sliceOpacity:{value:0},sliceWindow:{value:new THREE.Vector2(40,400)},sliceVol:{value:vol},useCls:{value:0},clsTex:{value:clsTex},clsChan:{value:new THREE.Vector4(0,1,-1,-1)},editMask:{value:0},editTex:{value:dummy},refine:{value:refine},distTex:{value:distTex},useDist:{value:0},voxelMin:{value:2*half/N}});
 const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(45,1,0.01,50);cam.position.set(3.2,2.1,4.0);cam.lookAt(0,0,0);cam.updateMatrixWorld();
 const rtColor=new THREE.WebGLRenderTarget(W,H,{depthBuffer:false}),rtCount=new THREE.WebGLRenderTarget(W,H,{depthBuffer:false,type:THREE.FloatType});
 const run=(sh,mode,count)=>{
  const u=uniforms();u.useCls.value=mode;u.useDist.value=mode&&useDist?1:0;if(boneOnly)u.segA.value[1].w=0;
  const mat=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:sh.vs,fragmentShader:count?sh.fsc:sh.fs,side:THREE.BackSide,uniforms:u,transparent:false,blending:THREE.NoBlending,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),mat);mesh.frustumCulled=false;scene.add(mesh);
  const rt=count?rtCount:rtColor;renderer.setRenderTarget(rt);renderer.setClearColor(0x000000,1);
  const times=[];for(let i=0;i<(count?1:5);i++){renderer.clear();const t0=performance.now();renderer.render(scene,cam);renderer.getContext().finish();times.push(performance.now()-t0)}
  let px;if(count){px=new Float32Array(W*H*4);renderer.readRenderTargetPixels(rt,0,0,W,H,px);let f=0,br=0,c=0,dd=0;for(let i=0;i<px.length;i+=4){f+=px[i];br+=px[i+1];c+=px[i+2];dd+=px[i+3]}scene.remove(mesh);mat.dispose();return{sums:{fetch:f,brick:br,cls:c,dist:dd}}}
  px=new Uint8Array(W*H*4);renderer.readRenderTargetPixels(rt,0,0,W,H,px);scene.remove(mesh);mat.dispose();times.sort((a,b)=>a-b);
  const err=renderer.getContext().getError();return{ms:times[0],px:Array.from(px),glErr:err};
 };
 const shA={vs:A.vs,fs:A.fs,fsc:countA},shB=B?{vs:B.vs,fs:B.fs,fsc:countB}:null,out={};
 for(const mode of [0,1]){out['A'+mode]=run(shA,mode,false);out['A'+mode+'c']=run(shA,mode,true);if(shB){out['B'+mode]=run(shB,mode,false);out['B'+mode+'c']=run(shB,mode,true)}}
 return{W,H,out,distMs};
},{A,B,countA:counting(A.fs),countB:B?counting(B.fs):null,refine:+(process.env.REFINE??1),useDist:+(process.env.DIST??1),boneOnly:process.env.SEGS==='bone'});
await b.close();srv.close();
const {W,H,out,distMs}=result;console.log('distance field build (128³, 2 channels): '+distMs.toFixed(0)+' ms');
import zlib from 'node:zlib';
const png=(px,w,h)=>{const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w*4;x++)raw[y*(w*4+1)+1+x]=px[(h-1-y)*w*4+x]}
 const crc=b=>{let c=~0;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(0xEDB88320&-(c&1))}return ~c>>>0};
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])};
for(const mode of [0,1]){
 const name=mode?'cls':'HU';
 for(const k of ['A','B']){const r=out[k+mode];if(!r)continue;const c=out[k+mode+'c'].sums;
  console.log(k+' ('+name+'): SwiftShader '+r.ms.toFixed(0)+' ms (min of 5; CPU proxy) · per pixel HU fetches '+(c.fetch/(W*H)).toFixed(1)+', brick reads '+(c.brick/(W*H)).toFixed(1)+', cls fetches '+(c.cls/(W*H)).toFixed(1)+', dist fetches '+(c.dist/(W*H)).toFixed(1)+(r.glErr?' · GL error '+r.glErr:''));
  fs.writeFileSync(path.join(outDir,'vr-'+k+'-'+name+'.png'),png(r.px.map((v,i)=>i%4===3?255:v),W,H));}
 if(out['B'+mode]){const a=out['A'+mode].px,bb=out['B'+mode].px;let maxd=0,n=0,sum=0;for(let i=0;i<a.length;i++){if(i%4===3)continue;const d=Math.abs(a[i]-bb[i]);if(d){n++;sum+=d;if(d>maxd)maxd=d}}
  console.log('A vs B ('+name+'): differing channels '+n+' of '+(a.length*3/4)+', max |diff| '+maxd+', mean |diff| over differing '+(n?(sum/n).toFixed(2):0));
  fs.writeFileSync(path.join(outDir,'vr-diff-'+name+'.png'),png(a.map((v,i)=>i%4===3?255:Math.min(255,Math.abs(v-bb[i])*8)),W,H))}
}
console.log('images in',outDir);
