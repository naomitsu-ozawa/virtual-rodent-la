import { test,expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dicomFolder } from '../helpers/dicom-folder.js';

const tag=readFileSync('docs/vr-view.js','utf8').match(/\.\/state\.js(\?v=[^']+)/)[1];

test('VR preparation builds and reuses conservative flags from the selected source',async({page})=>{
 test.setTimeout(120_000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?vrperf=1');
 await page.locator('#folder-input').setInputFiles(dicomFolder());
 await page.locator('#series-list .series-card').first().click({timeout:30_000});
 await expect(page.locator('.ready-badge').first()).toContainText(/ready/i,{timeout:60_000});
 const result=await page.evaluate(async tag=>{
  const state=await import('/state.js'+tag),load=await import('/data-load.js'+tag),segs=await import('/segments.js'+tag);
  // Keep the fixture tiny; use the same source-backed path as a large CT.
  const source=load.openSourceBackedVolume(state.activeSeries);state.setSourceVolume(source);state.setVolume(source);
  Object.assign(segs.segmentState.bone,{active:true,enabled:true,min:0,max:900});
  Object.assign(segs.segmentState.soft,{active:true,enabled:true,min:-1000,max:-1});
  const vr=await import('/vr-view.js'+tag),phases=[];
  const p=await vr.prepareVrData(s=>phases.push(s.phase)),again=await vr.prepareVrData();
  const beforeGpu=!vr.vrReady();
  // Chromium CI has no immersive headset. Stub only compatibility negotiation;
  // the actual WebGL2 uploads, program compilation and GPU fence still run.
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args){const gl=getContext.apply(this,args);if(args[0]==='webgl2'&&gl)gl.makeXRCompatible=async()=>{};return gl};
  let gpu;
  try{gpu=await vr.prepareVrGpu(p)}finally{HTMLCanvasElement.prototype.getContext=getContext}
  const uploaded=gpu.renderer.info.memory.textures,compiled=gpu.renderer.info.programs.length;
  const gpuReused=gpu===await vr.prepareVrGpu(p),modeReady=!vr.vrReady('ar');
  const ready=vr.vrReady();segs.segmentState.bone.min=1;const invalidated=!vr.vrReady();
  const changed=await vr.prepareVrData();
  HTMLCanvasElement.prototype.getContext=function(...args){const gl=getContext.apply(this,args);if(args[0]==='webgl2'&&gl){gl.makeXRCompatible=async()=>{};gl.getError=()=>gl.OUT_OF_MEMORY}return gl};
  let uploadRejected=false;
  try{await vr.prepareVrGpu(changed)}catch(e){uploadRejected=e.message==='GPU texture upload failed'}finally{HTMLCanvasElement.prototype.getContext=getContext}
  const failureNotReady=!vr.vrReady();
  return{dims:p.vd.dims,flags:p.fullFlags.length,clsFlags:p.clsFlags.length,half:p.half,phases,ready,invalidated,reused:p===again,classified:p.cls.C,beforeGpu,uploaded,compiled,gpuReused,modeReady,uploadRejected,failureNotReady};
 },tag);
 expect(result.dims).toEqual([16,16,12]);
 expect(result.flags).toBe(8);expect(result.clsFlags).toBe(8);expect(result.half).toBeNull();
 expect(result.classified).toBe(2);expect(result.phases).toContain('bricks');
 expect(result.ready&&result.invalidated&&result.reused&&result.beforeGpu&&result.gpuReused&&result.modeReady).toBe(true);
 expect(result.uploadRejected&&result.failureNotReady).toBe(true);
 expect(result.uploaded).toBeGreaterThanOrEqual(3);expect(result.compiled).toBeGreaterThanOrEqual(2);
 expect(errors).toEqual([]);
});
