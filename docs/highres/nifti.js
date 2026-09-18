export async function loadNiftiGz(url){
 const r=await fetch(url,{cache:'force-cache',mode:'cors'}); if(!r.ok)throw new Error(`MouseMapper data: HTTP ${r.status}`);
 if(!r.body||!('DecompressionStream'in window))throw new Error('gzip展開に対応していません。');
 const buf=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(); return parseNifti1(buf);
}
function parseNifti1(buffer){
 const v=new DataView(buffer); let le=true; if(v.getInt32(0,true)!==348){if(v.getInt32(0,false)===348)le=false;else throw new Error('NIfTI-1ではありません。');}
 const dims=[v.getInt16(42,le),v.getInt16(44,le),v.getInt16(46,le)]; const datatype=v.getInt16(70,le),bitpix=v.getInt16(72,le);
 const pixdim=[Math.abs(v.getFloat32(80,le))||1,Math.abs(v.getFloat32(84,le))||1,Math.abs(v.getFloat32(88,le))||1];
 const offset=Math.max(352,Math.floor(v.getFloat32(108,le))), n=dims[0]*dims[1]*dims[2], bytes=bitpix/8;
 if(offset+n*bytes>buffer.byteLength)throw new Error('NIfTI voxel payloadが不足しています。');
 const rv=new DataView(buffer,offset,n*bytes),data=new Uint16Array(n),read=reader(rv,datatype,le);
 for(let i=0;i<n;i++)data[i]=Math.max(0,Math.round(read(i))); return{dims,pixdim,data,datatype,bitpix};
}
function reader(v,t,le){switch(t){case 2:return i=>v.getUint8(i);case 4:return i=>v.getInt16(i*2,le);case 8:return i=>v.getInt32(i*4,le);case 16:return i=>v.getFloat32(i*4,le);case 256:return i=>v.getInt8(i);case 512:return i=>v.getUint16(i*2,le);case 768:return i=>v.getUint32(i*4,le);default:throw new Error(`Unsupported NIfTI datatype: ${t}`)}}
export function scanLabelStats(n){
 const[nx,ny,nz]=n.dims,s=new Map();let i=0;for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++,i++){
  const l=n.data[i];if(!l)continue;let q=s.get(l);if(!q){q={count:0,min:[x,y,z],max:[x,y,z]};s.set(l,q)}q.count++;
  if(x<q.min[0])q.min[0]=x;if(y<q.min[1])q.min[1]=y;if(z<q.min[2])q.min[2]=z;if(x>q.max[0])q.max[0]=x;if(y>q.max[1])q.max[1]=y;if(z>q.max[2])q.max[2]=z;
 }return s;
}
export function unionStats(stats){let o=null;for(const q of stats.values()){if(!o)o={count:q.count,min:[...q.min],max:[...q.max]};else{for(let a=0;a<3;a++){o.min[a]=Math.min(o.min[a],q.min[a]);o.max[a]=Math.max(o.max[a],q.max[a])}}}return o}
