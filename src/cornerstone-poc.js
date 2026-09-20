import {
  RenderingEngine,
  Enums,
  cache,
  init as cornerstoneInit,
  metaData,
  volumeLoader,
  setVolumesForViewports,
  cornerstoneStreamingImageVolumeLoader,
  utilities,
} from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { registerDefaultProviders } from '@cornerstonejs/metadata';
import * as dicomParser from 'dicom-parser';

const $=(s)=>document.querySelector(s);
const status=$('#status');
const metrics={
  files:$('#metric-files'),source:$('#metric-source'),headers:$('#metric-headers'),
  volume:$('#metric-volume'),cache:$('#metric-cache')
};
const elements={
  axial:$('#axial'),coronal:$('#coronal'),sagittal:$('#sagittal')
};

const renderingEngineId='VRL_CORNERSTONE_POC';
const viewportIds={axial:'VRL_AXIAL',coronal:'VRL_CORONAL',sagittal:'VRL_SAGITTAL'};
const headerByImageId=new Map();
let renderingEngine=null;
let currentVolumeId=null;
let currentVolume=null;

const fmt=(n)=>{
  if(!Number.isFinite(n))return '—';
  const units=['B','KiB','MiB','GiB'];let i=0,v=n;
  while(v>=1024&&i<units.length-1){v/=1024;i++}
  return (i? v.toFixed(v>=100?0:v>=10?1:2):String(v))+' '+units[i];
};

function setStatus(text){status.textContent=text}
function val(ds,tag){return ds.string(tag)?.trim()}
function num(ds,tag,fallback=undefined){const v=Number(ds.string(tag));return Number.isFinite(v)?v:fallback}
function nums(ds,tag,count,fallback){
  const raw=ds.string(tag);
  if(!raw)return fallback;
  const a=raw.split('\\').map(Number);
  if(a.length<count||a.some(v=>!Number.isFinite(v)))return fallback;
  return a.slice(0,count);
}
function signed16(ds,tag,signed){
  const v=signed?ds.int16(tag):ds.uint16(tag);
  return Number.isFinite(v)?v:undefined;
}

async function readHeader(file){
  let size=Math.min(file.size,256*1024);
  let lastError;
  for(let attempt=0;attempt<6;attempt++){
    try{
      const bytes=new Uint8Array(await file.slice(0,size).arrayBuffer());
      return dicomParser.parseDicom(bytes,{untilTag:'x7fe00010'});
    }catch(e){
      lastError=e;
      if(size>=file.size)break;
      size=Math.min(file.size,size*2);
    }
  }
  throw lastError||new Error('DICOM header parse failed');
}

function headerRecord(ds,file,imageId){
  const orientation=nums(ds,'x00200037',6,[1,0,0,0,1,0]);
  const instance=num(ds,'x00200013',0);
  const position=nums(ds,'x00200032',3,[0,0,instance]);
  const spacing=nums(ds,'x00280030',2,[1,1]);
  const rows=ds.uint16('x00280010')||0,columns=ds.uint16('x00280011')||0;
  const pixelRepresentation=ds.uint16('x00280103')||0;
  return {
    file,imageId,
    studyUID:val(ds,'x0020000d')||'study',
    seriesUID:val(ds,'x0020000e')||'series',
    seriesDescription:val(ds,'x0008103e')||'Unnamed series',
    modality:val(ds,'x00080060')||'OT',
    sopClassUID:val(ds,'x00080016'),
    sopInstanceUID:val(ds,'x00080018')||file.name,
    frameOfReferenceUID:val(ds,'x00200052')||'frame',
    instanceNumber:instance,
    rows,columns,
    orientation,position,
    pixelSpacing:spacing,
    sliceThickness:num(ds,'x00180050',1),
    sliceLocation:num(ds,'x00201041',position[2]),
    samplesPerPixel:ds.uint16('x00280002')||1,
    photometricInterpretation:val(ds,'x00280004')||'MONOCHROME2',
    bitsAllocated:ds.uint16('x00280100')||16,
    bitsStored:ds.uint16('x00280101')||16,
    highBit:ds.uint16('x00280102')??15,
    pixelRepresentation,
    planarConfiguration:ds.uint16('x00280006'),
    smallestPixelValue:signed16(ds,'x00280106',pixelRepresentation===1),
    largestPixelValue:signed16(ds,'x00280107',pixelRepresentation===1),
    rescaleIntercept:num(ds,'x00281052',0),
    rescaleSlope:num(ds,'x00281053',1),
    rescaleType:val(ds,'x00281054'),
    windowCenter:nums(ds,'x00281050',1,undefined),
    windowWidth:nums(ds,'x00281051',1,undefined),
    voiLUTFunction:val(ds,'x00281056'),
    transferSyntaxUID:val(ds,'x00020010')||'1.2.840.10008.1.2.1',
  };
}

function metadataProvider(type,imageId){
  const h=headerByImageId.get(imageId);
  if(!h)return;
  switch(type){
    case 'imagePlaneModule': {
      const o=h.orientation;
      return {
        frameOfReferenceUID:h.frameOfReferenceUID,rows:h.rows,columns:h.columns,
        imageOrientationPatient:o,rowCosines:o.slice(0,3),columnCosines:o.slice(3,6),
        imagePositionPatient:h.position,sliceThickness:h.sliceThickness,
        sliceLocation:h.sliceLocation,pixelSpacing:h.pixelSpacing,
        rowPixelSpacing:h.pixelSpacing[0],columnPixelSpacing:h.pixelSpacing[1],
        usingDefaultValues:false,
      };
    }
    case 'imagePixelModule':
      return {
        samplesPerPixel:h.samplesPerPixel,photometricInterpretation:h.photometricInterpretation,
        rows:h.rows,columns:h.columns,bitsAllocated:h.bitsAllocated,bitsStored:h.bitsStored,
        highBit:h.highBit,pixelRepresentation:h.pixelRepresentation,
        planarConfiguration:h.planarConfiguration,smallestPixelValue:h.smallestPixelValue,
        largestPixelValue:h.largestPixelValue,
      };
    case 'generalSeriesModule':
      return {modality:h.modality,seriesInstanceUID:h.seriesUID,seriesDescription:h.seriesDescription,studyInstanceUID:h.studyUID};
    case 'generalImageModule':
      return {sopInstanceUID:h.sopInstanceUID,instanceNumber:h.instanceNumber};
    case 'sopCommonModule':
      return {sopClassUID:h.sopClassUID,sopInstanceUID:h.sopInstanceUID};
    case 'modalityLutModule':
      return {rescaleIntercept:h.rescaleIntercept,rescaleSlope:h.rescaleSlope,rescaleType:h.rescaleType};
    case 'voiLutModule':
      return {windowCenter:h.windowCenter,windowWidth:h.windowWidth,voiLUTFunction:h.voiLUTFunction};
    case 'transferSyntax':
      return {transferSyntaxUID:h.transferSyntaxUID};
  }
}

function seriesKey(h){return h.studyUID+'::'+h.seriesUID}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function sortSeries(items){
  if(items.length<2)return items;
  const o=items[0].orientation,n=cross(o.slice(0,3),o.slice(3,6));
  return [...items].sort((a,b)=>dot(a.position,n)-dot(b.position,n)||a.instanceNumber-b.instanceNumber);
}

async function parseFiles(files){
  const candidates=[...files].filter(f=>f.size>132&&!f.name.startsWith('.'));
  metrics.files.textContent=String(candidates.length);
  metrics.source.textContent=fmt(candidates.reduce((n,f)=>n+f.size,0));
  const t0=performance.now(),records=[];
  const batchSize=6;
  for(let i=0;i<candidates.length;i+=batchSize){
    const batch=candidates.slice(i,i+batchSize);
    const parsed=await Promise.all(batch.map(async file=>{
      try{
        const imageId=dicomImageLoader.wadouri.fileManager.add(file);
        const ds=await readHeader(file);
        const rec=headerRecord(ds,file,imageId);
        headerByImageId.set(imageId,rec);
        return rec;
      }catch(e){
        console.warn('skip',file.name,e);
        return null;
      }
    }));
    records.push(...parsed.filter(Boolean));
    setStatus('ヘッダー解析 '+Math.min(i+batch.length,candidates.length)+' / '+candidates.length);
    await new Promise(requestAnimationFrame);
  }
  metrics.headers.textContent=Math.round(performance.now()-t0)+' ms';

  const groups=new Map();
  for(const r of records){const k=seriesKey(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
  const series=[...groups.values()].sort((a,b)=>b.length-a.length);
  if(!series.length)throw new Error('DICOM seriesが見つかりません');
  return sortSeries(series[0]);
}

async function clearCurrent(){
  if(currentVolumeId){
    try{cache.removeVolumeLoadObject(currentVolumeId)}catch{}
  }
  try{cache.purgeCache()}catch{}
  try{dicomImageLoader.wadouri.fileManager.purge()}catch{}
  headerByImageId.clear();
  currentVolumeId=null;currentVolume=null;
  metrics.files.textContent='0';metrics.source.textContent='0 B';metrics.headers.textContent='—';metrics.volume.textContent='—';metrics.cache.textContent='0 B';
  setStatus('待機中');
}

function installNavigation(element,viewportId){
  element.addEventListener('wheel',e=>{
    e.preventDefault();
    const viewport=renderingEngine?.getViewport(viewportId);if(!viewport)return;
    utilities.scroll(viewport,{delta:e.deltaY>0?1:-1});
  },{passive:false});
  let y0=null;
  element.addEventListener('touchstart',e=>{if(e.touches.length===1)y0=e.touches[0].clientY},{passive:true});
  element.addEventListener('touchend',e=>{
    if(y0==null||!e.changedTouches.length)return;
    const dy=e.changedTouches[0].clientY-y0;y0=null;
    if(Math.abs(dy)<24)return;
    const viewport=renderingEngine?.getViewport(viewportId);if(!viewport)return;
    utilities.scroll(viewport,{delta:dy<0?1:-1});
  },{passive:true});
}

async function loadSeries(records){
  if(currentVolumeId){try{cache.removeVolumeLoadObject(currentVolumeId)}catch{}}
  cache.purgeCache();
  const isIOS=/iPad|iPhone|iPod/.test(navigator.platform)||(navigator.maxTouchPoints>2&&navigator.platform.includes('MacIntel'));
  cache.setMaxCacheSize((isIOS?320:768)*1024*1024);

  const imageIds=records.map(r=>r.imageId);
  currentVolumeId='cornerstoneStreamingImageVolume:VRL_'+Date.now();
  setStatus('Volumeを作成中…');
  const t0=performance.now();
  currentVolume=await volumeLoader.createAndCacheVolume(currentVolumeId,{imageIds,progressiveRendering:true});
  metrics.volume.textContent=Math.round(performance.now()-t0)+' ms';

  await setVolumesForViewports(renderingEngine,[{volumeId:currentVolumeId}],Object.values(viewportIds));
  renderingEngine.renderViewports(Object.values(viewportIds));

  currentVolume.load(()=>{
    setStatus('読込完了 · full resolution');
    metrics.cache.textContent=fmt(cache.getCacheSize());
  });
  setStatus('progressive loading · full resolution');
  metrics.cache.textContent=fmt(cache.getCacheSize());
}

async function handleFiles(fileList){
  try{
    await clearCurrent();
    const records=await parseFiles(fileList);
    if(!records.length)throw new Error('対象seriesが空です');
    const h=records[0];
    setStatus(h.seriesDescription+' · '+records.length+' slices · '+h.columns+'×'+h.rows);
    await loadSeries(records);
  }catch(e){
    console.error(e);setStatus('Error: '+String(e?.message||e));
  }
}

async function init(){
  registerDefaultProviders();
  dicomImageLoader.init({maxWebWorkers:Math.max(1,Math.min(4,Math.floor((navigator.hardwareConcurrency||4)/2)))});
  cornerstoneInit({isMobile:navigator.maxTouchPoints>0,rendering:{preferSizeOverAccuracy:false}});
  volumeLoader.registerUnknownVolumeLoader(cornerstoneStreamingImageVolumeLoader);
  volumeLoader.registerVolumeLoader('cornerstoneStreamingImageVolume',cornerstoneStreamingImageVolumeLoader);
  metaData.addProvider(metadataProvider,10000);

  renderingEngine=new RenderingEngine(renderingEngineId);
  renderingEngine.setViewports([
    {viewportId:viewportIds.axial,type:Enums.ViewportType.ORTHOGRAPHIC,element:elements.axial,defaultOptions:{orientation:Enums.OrientationAxis.AXIAL,background:[0,0,0]}},
    {viewportId:viewportIds.coronal,type:Enums.ViewportType.ORTHOGRAPHIC,element:elements.coronal,defaultOptions:{orientation:Enums.OrientationAxis.CORONAL,background:[0,0,0]}},
    {viewportId:viewportIds.sagittal,type:Enums.ViewportType.ORTHOGRAPHIC,element:elements.sagittal,defaultOptions:{orientation:Enums.OrientationAxis.SAGITTAL,background:[0,0,0]}},
  ]);
  installNavigation(elements.axial,viewportIds.axial);
  installNavigation(elements.coronal,viewportIds.coronal);
  installNavigation(elements.sagittal,viewportIds.sagittal);
  setStatus('待機中 · full-resolution PoC');
}

$('#folder-input').addEventListener('change',e=>{if(e.target.files?.length)handleFiles(e.target.files)});
$('#file-input').addEventListener('change',e=>{if(e.target.files?.length)handleFiles(e.target.files)});
$('#clear-button').addEventListener('click',clearCurrent);
window.addEventListener('resize',()=>renderingEngine?.resize(true,true));

init().catch(e=>{console.error(e);setStatus('初期化エラー: '+String(e?.message||e))});
