// Headless check of the WebGPU volume shader (docs/medical-volume.js
// volumeShader): renders a synthetic phantom with the real WGSL through
// SwiftShader WebGPU, saves the image, and compares two versions of the file
// pixel by pixel. SwiftShader time is a CPU proxy (relative only).
//   PW_CHROMIUM=/opt/pw-browsers/chromium node tools/volume-shader-check.mjs [fileA] [fileB] [outDir]
// fileA defaults to docs/medical-volume.js; fileB (optional) is compared with
// it, e.g. a copy from git: git show HEAD:docs/medical-volume.js > /tmp/old.js
import { chromium } from '@playwright/test';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const fileA=process.argv[2]||'docs/medical-volume.js',fileB=process.argv[3]||null,outDir=process.argv[4]||'.',refine=+(process.env.REFINE??1),overlap=+(process.env.OVERLAP??1);
const safeWgsl=source=>source.replace(/\bmeta\b/g,'vrlMeta').replace(/\bactive\b/g,'vrlActive').replace(/\btarget\b/g,'vrlTarget');
const shaderOf=file=>{const s=fs.readFileSync(file,'utf8'),a=s.indexOf('export function volumeShader(){'),b=s.indexOf('export function brickShader(){',a);const body=s.slice(a,b),i=body.indexOf('`')+1,j=body.lastIndexOf('`');return safeWgsl(body.slice(i,j))};
const counting=code=>('var<private> nFetch:u32=0u;var<private> nBrick:u32=0u;var<private> nEdit:u32=0u;\n'+code)
 .replace('fn huAt(tc0:vec3<f32>)->f32{','fn huAt(tc0:vec3<f32>)->f32{nFetch=nFetch+1u;')
 .replace('fn brickMayContain(p:vec3<f32>)->bool{return brickClass(p)>0;}','fn brickMayContain(p:vec3<f32>)->bool{return brickClass(p)>0;}').replace('fn brickClass(p:vec3<f32>)->i32{','fn brickClass(p:vec3<f32>)->i32{nBrick=nBrick+1u;').replace(/fn brickMayContain\(p:vec3<f32>\)->bool\{\n/,'fn brickMayContain(p:vec3<f32>)->bool{nBrick=nBrick+1u;\n')
 .replace('fn editAllows(seg:u32,tc0:vec3<f32>)->bool{','fn editAllows(seg:u32,tc0:vec3<f32>)->bool{nEdit=nEdit+1u;')
 .replace(/return vec4<f32>\(acc\.rgb\+bg\*\(1\.0-acc\.a\),1\.0\);\n}`?$/,'return vec4<f32>(f32(nFetch),f32(nBrick),f32(nEdit),1.0);\n}');
const shaders={A:shaderOf(fileA),B:fileB?shaderOf(fileB):null};
const srv=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end('<!doctype html><html><body></body></html>')}).listen(8778);
const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM,args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader']});
const pg=await b.newPage();pg.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console.'+m.type()+':',m.text().slice(0,400))});
await pg.goto('http://localhost:8778/');
const result=await pg.evaluate(async ({shaders,counting,refine,overlap})=>{
 const adapter=await navigator.gpu.requestAdapter(),device=await adapter.requestDevice();
 // phantom: 128³, unsigned u16 = HU + 1024 (slope 1, intercept -1024, bias 0):
 // soft-tissue ellipsoid (40 HU) holding a bone sphere (900 HU), a 2-voxel
 // bone plate and a hollow bone tube; air outside (-1000)
 const N=128,dims=[N,N,N],data=new Uint8Array(N*N*N*2);
 const hu=(x,y,z)=>{const cx=x-64,cy=y-64,cz=z-64;
  let v=-1000;
  if(cx*cx/(52*52)+cy*cy/(40*40)+cz*cz/(56*56)<1)v=40;
  if(cx*cx+cy*cy+cz*cz<22*22)v=900;
  if(Math.abs(cy-20)<1&&Math.abs(cx)<36&&Math.abs(cz)<36)v=900;
  const r=Math.hypot(cx+30,cz);if(r>8&&r<11&&Math.abs(cy)<40)v=900;
  return v};
 for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<N;x++){const q=hu(x,y,z)+1024,o=((z*N+y)*N+x)*2;data[o]=q&255;data[o+1]=q>>8}
 const tex=device.createTexture({size:{width:N,height:N,depthOrArrayLayers:N},dimension:'3d',format:'rg8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 device.queue.writeTexture({texture:tex},data,{bytesPerRow:N*2,rowsPerImage:N},{width:N,height:N,depthOrArrayLayers:N});
 // bricks (min/max HU, 8³, index bz*bx*by+by*bx+bx)
 const BS=8,bx=N/BS,brick=new Float32Array(bx*bx*bx*2);
 for(let k=0;k<bx;k++)for(let j=0;j<bx;j++)for(let i=0;i<bx;i++){let lo=1e9,hi=-1e9;
  const ov=overlap?1:0;for(let z=Math.max(0,k*BS-ov);z<Math.min(N,(k+1)*BS+ov);z++)for(let y=Math.max(0,j*BS-ov);y<Math.min(N,(j+1)*BS+ov);y++)for(let x=Math.max(0,i*BS-ov);x<Math.min(N,(i+1)*BS+ov);x++){const v=hu(x,y,z);if(v<lo)lo=v;if(v>hi)hi=v}
  const o=((k*bx+j)*bx+i)*2;brick[o]=lo;brick[o+1]=hi}
 const storage=arr=>{const buf=device.createBuffer({size:Math.max(16,arr.byteLength),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(buf,0,arr);return buf};
 const brickBuf=storage(brick),zero=storage(new Uint32Array([0,0,0,0])),editRows=storage(new Uint32Array(64));
 const W=384,H=384,uni=new Float32Array(22*4),put=(s,a,c,d,e)=>{uni[s*4]=a;uni[s*4+1]=c;uni[s*4+2]=d;uni[s*4+3]=e};
 // camera: app units, longest side 3.3; half extents 1.65; looking from a corner
 const half=[1.65,1.65,1.65],scale=3.3/N,step=Math.max(1e-5,scale*0.85);
 const o=[3.2,2.1,4.0],len=Math.hypot(...o),fwd=o.map(v=>-v/len),upW=[0,1,0];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
 const right=norm(cross(fwd,upW)),up=cross(right,fwd);
 put(0,o[0],o[1],o[2],0);put(1,right[0],right[1],right[2],Math.tan(45/2*Math.PI/180));put(2,up[0],up[1],up[2],W/H);put(3,fwd[0],fwd[1],fwd[2],0);
 put(4,half[0],half[1],half[2],step);put(5,N,N,N,1);put(6,-1024,0,bx,bx);put(7,W,H,bx,BS);
 // segments: bone opaque, soft tissue 35 % (rays continue through it)
 put(8,300,3000,1,1);put(9,0.91,0.86,0.72,1);put(10,-200,299,0.35,1);put(11,0.85,0.55,0.42,1);put(12,0,0,0,0);put(13,0,0,0,0);put(14,0,0,0,0);put(15,0,0,0,0);
 put(16,0,0,0,0);put(17,0,0,0,refine);put(18,40,400,0,0);put(19,0,0,1,0);put(20,0,0.85,0,28);put(21,N,N,N,1);
 const uniBuf=device.createBuffer({size:uni.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(uniBuf,0,uni);
 const sampler=device.createSampler({magFilter:'linear',minFilter:'linear'});
 const targets={rgba8unorm:device.createTexture({size:{width:W,height:H},format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),rgba32float:device.createTexture({size:{width:W,height:H},format:'rgba32float',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC})};
 const readBufs={rgba8unorm:device.createBuffer({size:W*H*4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),rgba32float:device.createBuffer({size:W*H*16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})};
 const run=async(code,label,format='rgba8unorm')=>{
  const target=targets[format],readBuf=readBufs[format],bpp=format==='rgba8unorm'?4:16;
  const module=device.createShaderModule({code});const info=await module.getCompilationInfo();
  const errs=info.messages.filter(m=>m.type==='error').map(m=>m.lineNum+':'+m.message);if(errs.length)return{label,errs};
  const pipeline=device.createRenderPipeline({layout:'auto',vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'fs',targets:[{format}]},primitive:{topology:'triangle-list'}});
  const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
   {binding:0,resource:{buffer:uniBuf}},{binding:1,resource:tex.createView({dimension:'3d'})},{binding:2,resource:{buffer:editRows}},{binding:3,resource:{buffer:brickBuf}},{binding:4,resource:sampler},
   {binding:5,resource:{buffer:zero}},{binding:6,resource:{buffer:zero}},{binding:7,resource:{buffer:zero}},{binding:8,resource:{buffer:zero}},{binding:9,resource:{buffer:zero}},{binding:10,resource:{buffer:zero}}]});
  const times=[];let px=null;
  const passes=format==='rgba8unorm'?6:1;
  for(let i=0;i<passes;i++){
   const enc=device.createCommandEncoder(),pass=enc.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',clearValue:{r:0,g:0,b:0,a:1},storeOp:'store'}]});
   pass.setPipeline(pipeline);pass.setBindGroup(0,group);pass.draw(3);pass.end();
   if(i===passes-1)enc.copyTextureToBuffer({texture:target},{buffer:readBuf,bytesPerRow:W*bpp},{width:W,height:H});
   const t0=performance.now();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();times.push(performance.now()-t0);
  }
  await readBuf.mapAsync(GPUMapMode.READ);px=format==='rgba8unorm'?Array.from(new Uint8Array(readBuf.getMappedRange())):Array.from(new Float32Array(readBuf.getMappedRange()));readBuf.unmap();
  times.sort((a,b)=>a-b);return{label,ms:times[0],px};
 };
 const out={A:await run(shaders.A,'A'),Ac:await run(shaders.Ac,'Ac','rgba32float')};if(shaders.B){out.B=await run(shaders.B,'B');out.Bc=await run(shaders.Bc,'Bc','rgba32float')}
 for(const k of ['Ac','Bc']){const r=out[k];if(!r||r.errs)continue;let f=0,br=0,e=0;for(let i=0;i<r.px.length;i+=4){f+=r.px[i];br+=r.px[i+1];e+=r.px[i+2]}r.sums={fetch:f,brick:br,edit:e};r.px=null}
 return{W,H,out};
},{shaders:{A:shaders.A,B:shaders.B,Ac:counting(shaders.A),Bc:shaders.B?counting(shaders.B):null},refine,overlap});
await b.close();srv.close();
const {W,H,out}=result;
for(const k of Object.keys(out)){const r=out[k];if(r.errs){console.log(k,'COMPILE ERRORS',r.errs);process.exit(1)}
 if(r.sums)console.log(k+': per pixel — HU fetches '+(r.sums.fetch/(W*H)).toFixed(1)+', brick reads '+(r.sums.brick/(W*H)).toFixed(1)+', edit lookups '+(r.sums.edit/(W*H)).toFixed(1)+' (totals '+r.sums.fetch+' / '+r.sums.brick+' / '+r.sums.edit+')');
 else console.log(k+': SwiftShader pass '+r.ms.toFixed(0)+' ms (min of 6; CPU proxy, relative only)')}
// PNG writer (no deps): zlib via node
import zlib from 'node:zlib';
const png=(px,w,h)=>{const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;for(let x=0;x<w*4;x++)raw[y*(w*4+1)+1+x]=px[y*w*4+x]}
 const crc=b=>{let c=~0;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(0xEDB88320&-(c&1))}return ~c>>>0};
 const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])};
fs.writeFileSync(path.join(outDir,'volume-A.png'),png(out.A.px,W,H));
if(out.B){fs.writeFileSync(path.join(outDir,'volume-B.png'),png(out.B.px,W,H));
 let maxd=0,n=0,sum=0;const a=out.A.px,bb=out.B.px;for(let i=0;i<a.length;i++){if(i%4===3)continue;const d=Math.abs(a[i]-bb[i]);if(d){n++;sum+=d;if(d>maxd)maxd=d}}
 console.log('A vs B: differing channels '+n+' of '+(a.length*3/4)+', max |diff| '+maxd+', mean |diff| over differing '+(n?(sum/n).toFixed(2):0));
 const diff=a.map((v,i)=>i%4===3?255:Math.min(255,Math.abs(v-bb[i])*8));fs.writeFileSync(path.join(outDir,'volume-diff.png'),png(diff,W,H));}
console.log('images in',outDir);
