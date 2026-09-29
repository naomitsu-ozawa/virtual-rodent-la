// Build 320: device-local cache of the raw pixel bytes of each source slice.
// Build 319's read test measured ~3 ms of fixed cost per slice-file read (1784
// files ≈ 5.5 s per pass over the data, however fast the disk). The first pass
// over a series stores each slice's bytes (exactly what decodeSourceSlice read
// from the file) in the IndexedDB cache; later passes read 16 slices per request.
// Only a cache (browser storage can be evicted): the DICOM files stay the record.
// No imports: volume-io.js depends on this, data-load.js wires it up.
// MAX_INFLIGHT bounds the slices waiting to be written (memory, 32 × 2 MB): a slice
// read while the queue is full is skipped and stored on a later pass; an entry left
// incomplete is resumed when the data is opened again (build 322).
const CHUNK=16,KEEP_CHUNKS=2,MAX_INFLIGHT=32;
const metaCtx=new WeakMap(),BACKFILL_DELAY_MS=3000;let activeBackfill=null;

// cache: openVolumeCache() handle; key/info: entry key and settings-list info;
// sliceBytes: bytes per slice; persist(): optional prune/persist before writing
export async function attachRawSliceCache(series,{cache,key,info,sliceBytes,budget}){
 const n=series?.slices?.length||0;if(!cache||!n||!sliceBytes)return null;
 activeBackfill=null;
 const ctx={series,cache,key,sliceBytes,n,state:'off',writer:null,written:new Set(),stored:new Set(),inflight:0,committing:false,lastForeground:0,error:'',loaded:new Map()};
 try{
  const hit=await cache.lookup(key);
  if(hit&&hit.slices===n&&hit.bytesPerSlice===sliceBytes)ctx.state='hit';
  else if(n*sliceBytes<=budget){ctx.writer=await cache.begin(key,{slices:n,bytesPerSlice:sliceBytes,info},{resume:true});for(const i of ctx.writer.have||[]){ctx.written.add(i);ctx.stored.add(i)}ctx.state='writing'}
 }catch(e){console.warn('Raw slice cache unavailable.',e);return null}
 if(ctx.state==='writing'&&ctx.stored.size===n)await maybeCommit(ctx);
 series.slices.forEach((meta,i)=>metaCtx.set(meta,{ctx,i}));
 series.rawSliceCache=ctx;
 if(ctx.state==='writing')setTimeout(()=>void backfill(ctx),BACKFILL_DELAY_MS);
 return ctx;
}
// build 323: fill the missing slices in the background. A later run may never
// read the files again (segment results come from their own cache), so the
// entry would stay incomplete. One file read + one write at a time; stops when
// another series is attached, the entry completes, or a write fails.
async function backfill(ctx){
 activeBackfill=ctx;
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 for(let i=0;i<ctx.n;i++){
  if(activeBackfill!==ctx||ctx.state!=='writing')return;
  if(ctx.written.has(i))continue;
  // build 324: stay out of the way of the app's own reads (build 323: a segment run
  // with the backfill running took 36 s instead of 14 s)
  while(ctx.inflight>=MAX_INFLIGHT/2||performance.now()-ctx.lastForeground<2000){await pause(250);if(activeBackfill!==ctx||ctx.state!=='writing')return}
  const meta=ctx.series.slices[i];
  try{
   const bytes=new Uint8Array(await meta.file.slice(meta.pixelOffset,meta.pixelOffset+ctx.sliceBytes).arrayBuffer());
   if(bytes.byteLength===ctx.sliceBytes)store(meta,bytes,true);
  }catch(e){ctx.error='backfill: '+String(e?.message||e);return}
  await pause(0);
 }
}
export function rawSliceCacheState(series){return series?.rawSliceCache?.state||'off'}
// debug status text, e.g. "writing 1500/1784", "hit", "off (limit 2 GB < 3.6 GB)"
export function rawSliceCacheSummary(series){
 const c=series?.rawSliceCache;if(!c)return'off'+(series?.rawCacheReason?' ('+series.rawCacheReason+')':'');
 return c.state==='writing'?'writing '+c.stored.size+'/'+c.n+(c.error?' ('+c.error+')':''):c.state+(c.error?' ('+c.error+')':'');
}

function chunkOf(ctx,c){
 let p=ctx.loaded.get(c);
 if(p){ctx.loaded.delete(c);ctx.loaded.set(c,p);return p}
 const a=c*CHUNK,b=Math.min(ctx.n,a+CHUNK)-1;
 p=ctx.cache.readRange(ctx.key,a,b);ctx.loaded.set(c,p);
 while(ctx.loaded.size>KEEP_CHUNKS)ctx.loaded.delete(ctx.loaded.keys().next().value);
 return p;
}
// Uint8Array of the slice's pixel bytes, or null (not cached / not attached).
// A damaged or evicted entry turns the cache off; the caller reads the file.
export async function getRawSlice(meta){
 const m=metaCtx.get(meta);if(!m||m.ctx.state!=='hit')return null;
 const ctx=m.ctx,c=Math.floor(m.i/CHUNK);
 try{
  const rows=await chunkOf(ctx,c),b=rows?.[m.i-c*CHUNK];
  if(!b||b.byteLength!==ctx.sliceBytes)throw new Error('raw slice missing');
  globalThis.__vrlCount?.('raw cache hit');
  return b instanceof Uint8Array?b:new Uint8Array(b);
 }catch(e){console.warn('Raw slice cache read failed; reading the files.',e);ctx.state='off';ctx.error='read: '+String(e?.message||e);ctx.loaded.clear();try{await ctx.cache.remove(ctx.key)}catch{};return null}
}
// store the bytes read from the file on the first pass; the entry is published
// (and used from then on) once every slice has been stored.
// build 324: publish only after every write has finished (stored, not queued:
// build 323 committed with 13 writes still in flight and the commit failed), and a
// failed commit or write keeps the stored slices for a later session.
export function putRawSlice(meta,bytes){store(meta,bytes,false)}
function store(meta,bytes,background){
 const m=metaCtx.get(meta);if(!m||m.ctx.state!=='writing'||m.ctx.written.has(m.i))return;
 const ctx=m.ctx;if(!background)ctx.lastForeground=performance.now();
 if(bytes.byteLength!==ctx.sliceBytes||ctx.inflight>=MAX_INFLIGHT)return;
 ctx.written.add(m.i);ctx.inflight++;
 const copy=bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes:bytes.slice();
 ctx.writer.write(m.i,copy).then(()=>{ctx.inflight--;ctx.stored.add(m.i);return maybeCommit(ctx)},e=>{
  ctx.inflight--;ctx.written.delete(m.i);if(ctx.state!=='writing')return;
  ctx.state='off';ctx.error=String(e?.message||e);console.warn('Raw slice cache write failed (quota?); caching stopped for this session.',e);
 });
}
async function maybeCommit(ctx){
 if(ctx.state!=='writing'||ctx.committing||ctx.inflight>0||ctx.stored.size<ctx.n)return;
 ctx.committing=true;
 try{await ctx.writer.commit();ctx.state='hit';ctx.error='';globalThis.__vrlCount?.('raw cache stored')}
 catch(e){ctx.error='commit: '+String(e?.message||e)}
 finally{ctx.committing=false}
}
