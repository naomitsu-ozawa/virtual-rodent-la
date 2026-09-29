// Compare two versions of docs/gpu-shaders.js on SwiftShader WebGPU (bit-exact check
// + rough timing; SwiftShader runs on the CPU, so timings are only a hint).
// A case may set oldKind to compare a new kernel against an old one (nlmTile vs nlm).
// Usage: git show origin/main:docs/gpu-shaders.js > /tmp/old-gpu-shaders.js
//        node tools/gpu-shader-compare.mjs '[{"kind":"nlm","meta":[1,1],"params":[-1000,1000,0.5]}]'
import { chromium } from 'playwright';import http from 'http';import fs from 'fs';
const files={'/old.js':fs.readFileSync(process.env.OLD||'/tmp/old-gpu-shaders.js'),'/new.js':fs.readFileSync('docs/gpu-shaders.js')};
const s=http.createServer((q,r)=>{if(files[q.url]){r.setHeader('content-type','text/javascript');r.end(files[q.url])}else{r.setHeader('content-type','text/html');r.end('<html></html>')}}).listen(8768);
const b=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader']});
const p=await b.newPage();p.on('console',m=>console.log('page:',m.text()));await p.goto('http://127.0.0.1:8768/');if(process.env.DIMS)await p.evaluate(d=>{globalThis.__dims=d},process.env.DIMS.split('x').map(Number));
const cases=JSON.parse(process.argv[2]);
console.log(JSON.stringify(await p.evaluate(async cases=>{
 const O=await import('/old.js'),N=await import('/new.js');
 const a=await navigator.gpu.requestAdapter(),d=await a.requestDevice();const WG=64;
 const w=+(globalThis.__dims?.[0]??48),h=+(globalThis.__dims?.[1]??48),z=+(globalThis.__dims?.[2]??24),n=w*h*z;let seed=3;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
 const src=new Float32Array(n);for(let i=0;i<n;i++)src[i]=-1000+2000*rnd()*(i%7<3?0.2:1);
 const run=async(mod,kind,meta4,params)=>{const tiled=kind==='nlmTile';
  const code=mod.normalizeVrlWgsl(mod.gpuFilterShader(kind,WG));const m=d.createShaderModule({code});const info=await m.getCompilationInfo();const errs=info.messages.filter(x=>x.type==='error');if(errs.length)return{error:errs.map(e=>e.message).join('|')};
  const pl=d.createComputePipeline({layout:'auto',compute:{module:m,entryPoint:'main'}});
  const buf=(data,u)=>{const bf=d.createBuffer({size:Math.max(32,data.byteLength),usage:u|GPUBufferUsage.COPY_DST});d.queue.writeBuffer(bf,0,data);return bf};
  const S=GPUBufferUsage.STORAGE,meta=new Uint32Array(8);meta.set([w,h,z,n]);meta.set(meta4,4);const pr=new Float32Array(Math.max(8,params.length));pr.set(params);
  const sb=buf(src,S),db=d.createBuffer({size:n*4,usage:S|GPUBufferUsage.COPY_SRC}),mb=buf(meta,S),pb=buf(pr,S);
  const g=d.createBindGroup({layout:pl.getBindGroupLayout(0),entries:[sb,db,mb,pb].map((x,j)=>({binding:j,resource:{buffer:x}}))});
  const once=async()=>{const e=d.createCommandEncoder();const ps=e.beginComputePass();ps.setPipeline(pl);ps.setBindGroup(0,g);if(tiled)ps.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8),z);else ps.dispatchWorkgroups(Math.ceil(n/WG));ps.end();d.queue.submit([e.finish()]);await d.queue.onSubmittedWorkDone()};
  await once();const t=performance.now();await once();await once();const ms=(performance.now()-t)/2;
  const rb=d.createBuffer({size:n*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const e=d.createCommandEncoder();e.copyBufferToBuffer(db,0,rb,0,n*4);d.queue.submit([e.finish()]);await rb.mapAsync(GPUMapMode.READ);
  return{out:new Float32Array(rb.getMappedRange().slice(0)),ms};
 };
 const res=[];
 for(const c of cases){const A=await run(O,c.oldKind||c.kind,c.meta,c.params),B=await run(N,c.kind,c.meta,c.params);
  if(A.error||B.error){res.push({c,err:A.error||B.error});continue}
  let diff=0,maxd=0;for(let i=0;i<n;i++){if(A.out[i]!==B.out[i]){diff++;maxd=Math.max(maxd,Math.abs(A.out[i]-B.out[i]))}}
  res.push({kind:c.kind,meta:c.meta,oldMs:A.ms.toFixed(1),newMs:B.ms.toFixed(1),diffCount:diff,maxAbsDiff:maxd});}
 return res;
},cases)));await b.close();s.close();
