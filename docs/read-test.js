// Build 319 diagnostics: how fast can this browser read the slice files?
// Settings → デバッグ → 読み込みテスト. Each test reads its own slices (disjoint
// groups spread over the series) so one test does not warm the OS file cache
// for the next; the first run after opening the data is the one that counts.
//  tiny   : 1-byte reads, 4 in flight -> the fixed cost of one file read
//  full xN: the pixel bytes of each slice, N in flight -> MB/s
//  worker : the same reads done by 4 Web Workers -> is the main thread in the way?
const WORKER_SRC=`onmessage=async e=>{const{file,offset,size,id}=e.data;const t=performance.now();const b=await file.slice(offset,offset+size).arrayBuffer();postMessage({id,ms:performance.now()-t,bytes:b.byteLength})}`;
function sliceBytes(meta){const bpp=meta.bits===8?1:2;return meta.rows*meta.columns*bpp}
async function runPool(items,inflight,readOne){
 let next=0,bytes=0;const t=performance.now();
 const lane=async()=>{while(next<items.length){const m=items[next++];bytes+=await readOne(m)}};
 await Promise.all(Array.from({length:inflight},lane));
 return{ms:performance.now()-t,bytes};
}
const mainRead=size=>async m=>(await m.file.slice(m.pixelOffset??0,(m.pixelOffset??0)+(size??sliceBytes(m))).arrayBuffer()).byteLength;
export async function runReadTest(series,onStep){
 const slices=(series?.slices||[]).filter(m=>m?.file);
 if(slices.length<16)throw new Error('no slice files');
 const tests=[['tiny',4],['full',1],['full',4],['full',8],['full',16],['worker',4]],per=Math.max(4,Math.min(64,Math.floor(slices.length/tests.length)));
 // group g takes every tests.length-th slice starting at g: spread over the whole series
 const group=g=>{const out=[];for(let i=g;i<slices.length&&out.length<per;i+=tests.length)out.push(slices[i]);return out};
 const results=[];
 for(let g=0;g<tests.length;g++){
  const[kind,n]=tests[g],items=group(g);onStep?.(kind+(kind==='tiny'?'':' ×'+n));
  if(kind==='tiny'){const r=await runPool(items,n,mainRead(1));results.push({kind,n,count:items.length,msPerFile:r.ms*n/items.length})}
  else if(kind==='full'){const r=await runPool(items,n,mainRead());results.push({kind,n,count:items.length,mbps:r.bytes/1048576/(r.ms/1000)})}
  else{
   const url=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'})),workers=Array.from({length:n},()=>new Worker(url));URL.revokeObjectURL(url);
   try{
    let id=0;const readOne=w=>m=>new Promise((res,rej)=>{const my=++id;const h=e=>{if(e.data.id!==my)return;w.removeEventListener('message',h);res(e.data.bytes)};w.addEventListener('message',h);w.onerror=rej;w.postMessage({file:m.file,offset:m.pixelOffset??0,size:sliceBytes(m),id:my})});
    let next=0,bytes=0;const t=performance.now();
    await Promise.all(workers.map(async w=>{const r=readOne(w);while(next<items.length){bytes+=await r(items[next++])}}));
    results.push({kind,n,count:items.length,mbps:bytes/1048576/((performance.now()-t)/1000)});
   }finally{workers.forEach(w=>w.terminate())}
  }
 }
 return results;
}
export function formatReadTest(results,ja){
 return results.map(r=>r.kind==='tiny'?(ja?'1バイト読込 ':'1-byte read ')+r.msPerFile.toFixed(1)+' ms/'+(ja?'件':'file'):(r.kind==='worker'?'worker ×':(ja?'並列':'x'))+r.n+' '+r.mbps.toFixed(0)+' MB/s').join(' · ')+' ('+results[0].count+(ja?'枚ずつ':' slices each')+')';
}
