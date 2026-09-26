// Project files (.vrlab): the portable, original-resolution record of a
// session — filter settings, segment settings, 3D edits and display state —
// without the DICOM data itself. Pure functions (no DOM); app.js gathers and
// applies the state. Layout: a zip with project.json plus binary run files.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'https://esm.sh/fflate@0.8.2';

export const PROJECT_FORMAT='virtual-rodent-lab-project';
export const PROJECT_VERSION=1;
export const PROJECT_EXTENSION='.vrlab';

// What identifies the data a project belongs to (original resolution).
export function datasetFingerprint(series){
 const f=series?.slices?.[0]||{};
 return{
  seriesId:series?.id??null,studyUid:f.studyUid??null,seriesUid:f.seriesUid??null,
  description:series?.description??'',modality:series?.modality??'',
  columns:series?.columns??0,rows:series?.rows??0,slices:series?.slices?.length??0,
  spacing:[series?.spacingX,series?.spacingY,series?.spacingZ].map(n=>Number.isFinite(+n)?+(+n).toPrecision(8):null),
 };
}

export function compareFingerprints(saved,current){
 const issues=[];
 if(saved?.seriesUid&&current?.seriesUid&&saved.seriesUid!==current.seriesUid)issues.push('seriesUid');
 for(const k of['columns','rows','slices'])if(saved?.[k]!==current?.[k])issues.push(k);
 const a=saved?.spacing||[],b=current?.spacing||[];
 if(a.length!==3||b.length!==3||a.some((v,i)=>v==null||b[i]==null||Math.abs(v-b[i])>1e-4*Math.max(1,Math.abs(v))))issues.push('spacing');
 return{ok:issues.length===0,issues};
}

// Run-length edit masks: per axial slice a flat Uint32Array of [y,x0,x1]
// triples (see run-length.js). Binary layout, little-endian uint32:
//   'VLR1' magic, slices, offsets[slices+1] (in uint32 units), data...
const RUNS_MAGIC=0x31524c56; // 'VLR1'
export function encodeRuns(runsBySlice,slices){
 let total=0;const offsets=new Uint32Array(slices+1);
 for(let z=0;z<slices;z++){offsets[z]=total;total+=runsBySlice?.[z]?.length||0}
 offsets[slices]=total;
 const words=2+offsets.length+total,dv=new DataView(new ArrayBuffer(words*4));
 let o=0;const put=v=>{dv.setUint32(o,v,true);o+=4};
 put(RUNS_MAGIC);put(slices);for(const v of offsets)put(v);
 for(let z=0;z<slices;z++){const r=runsBySlice?.[z];if(r)for(let i=0;i<r.length;i++)put(r[i])}
 return new Uint8Array(dv.buffer);
}

export function decodeRuns(bytes,{slices,columns,rows}){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<8||bytes.byteLength%4)throw new Error('Invalid run data');
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),get=i=>dv.getUint32(i*4,true);
 if(get(0)!==RUNS_MAGIC)throw new Error('Invalid run data (magic)');
 if(get(1)!==slices)throw new Error(`Run data has ${get(1)} slices, expected ${slices}`);
 const base=2+slices+1,words=bytes.byteLength/4;
 if(words<base)throw new Error('Invalid run data (truncated)');
 const out=new Array(slices);
 for(let z=0;z<slices;z++){
  const a=get(2+z),b=get(3+z);
  if(b<a||base+b>words||(b-a)%3)throw new Error('Invalid run data (offsets)');
  if(a===b){out[z]=null;continue}
  const r=new Uint32Array(b-a);
  for(let i=0;i<r.length;i+=3){
   const y=get(base+a+i),x0=get(base+a+i+1),x1=get(base+a+i+2);
   if(y>=rows||x0>x1||x1>=columns)throw new Error(`Run out of bounds at slice ${z}`);
   r[i]=y;r[i+1]=x0;r[i+2]=x1;
  }
  out[z]=r;
 }
 return out;
}

// project: plain JSON-able object; binaries: {path: Uint8Array}
export function packProject(project,binaries={}){
 const files={'project.json':strToU8(JSON.stringify({format:PROJECT_FORMAT,version:PROJECT_VERSION,...project},null,1))};
 for(const[path,bytes]of Object.entries(binaries))files[path]=[bytes,{level:6}];
 return zipSync(files,{level:6});
}

export function unpackProject(bytes){
 let files;
 try{files=unzipSync(bytes instanceof Uint8Array?bytes:new Uint8Array(bytes))}catch{throw new Error('Not a project file (zip expected)')}
 if(!files['project.json'])throw new Error('Not a project file (project.json missing)');
 let project;
 try{project=JSON.parse(strFromU8(files['project.json']))}catch{throw new Error('Broken project.json')}
 if(project?.format!==PROJECT_FORMAT)throw new Error('Not a Virtual Rodent Lab project');
 if(!Number.isInteger(project.version)||project.version<1)throw new Error('Unknown project version');
 if(project.version>PROJECT_VERSION)throw new Error(`Project version ${project.version} is newer than this app supports (${PROJECT_VERSION}); please update`);
 return{project,files};
}
