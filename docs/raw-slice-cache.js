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
const metaCtx=new WeakMap();

// cache: openVolumeCache() handle; key/info: entry key and settings-list info;
// sliceBytes: bytes per slice; persist(): optional prune/persist before writing
export async function attachRawSliceCache(series,{cache,key,info,sliceBytes,budget}){
 const n=series?.slices?.length||0;if(!cache||!n||!sliceBytes)return null;
 const ctx={series,cache,key,sliceBytes,n,state:'off',writer:null,written:new Set(),inflight:0,loaded:new Map()};
 try{
  const hit=await cache.lookup(key);
  if(hit&&hit.slices===n&&hit.bytesPerSlice===sliceBytes)ctx.state='hit';
  else if(n*sliceBytes<=budget){ctx.writer=await cache.begin(key,{slices:n,bytesPerSlice:sliceBytes,info},{resume:true});for(const i of ctx.writer.have||[])ctx.written.add(i);ctx.state='writing'}
 }catch(e){console.warn('Raw slice cache unavailable.',e);return null}
 if(ctx.state==='writing'&&ctx.written.size===n){try{await ctx.writer.commit();ctx.state='hit'}catch(e){ctx.state='off';ctx.error='commit: '+String(e?.message||e)}}
 series.slices.forEach((meta,i)=>metaCtx.set(meta,{ctx,i}));
 series.rawSliceCache=ctx;
 return ctx;
}
export function rawSliceCacheState(series){return series?.rawSliceCache?.state||'off'}
// debug status text, e.g. "writing 1500/1784", "hit", "off (limit 2 GB < 3.6 GB)"
export function rawSliceCacheSummary(series){
 const c=series?.rawSliceCache;if(!c)return'off'+(series?.rawCacheReason?' ('+series.rawCacheReason+')':'');
 return c.state==='writing'?'writing '+c.written.size+'/'+c.n:c.state+(c.error?' ('+c.error+')':'');
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
// (and used from then on) once every slice has been stored
export function putRawSlice(meta,bytes){
 const m=metaCtx.get(meta);if(!m||m.ctx.state!=='writing'||m.ctx.written.has(m.i))return;
 const ctx=m.ctx;if(bytes.byteLength!==ctx.sliceBytes||ctx.inflight>=MAX_INFLIGHT)return;
 ctx.written.add(m.i);ctx.inflight++;
 const copy=bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength?bytes:bytes.slice();
 ctx.writer.write(m.i,copy).finally(()=>{ctx.inflight--}).then(async()=>{
  if(ctx.state==='writing'&&ctx.written.size===ctx.n){
   try{await ctx.writer.commit();ctx.state='hit';globalThis.__vrlCount?.('raw cache stored')}
   catch(e){ctx.state='off';ctx.error='commit: '+String(e?.message||e);try{await ctx.writer.abort()}catch{}}
  }
 },async e=>{ctx.written.delete(m.i);if(ctx.state!=='writing')return;ctx.state='off';ctx.error=String(e?.message||e);console.warn('Raw slice cache write failed (quota?); caching stopped.',e);try{await ctx.writer.abort()}catch{}});
}
