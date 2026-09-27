
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { MedicalVolumeRenderer, extractSourceThresholdRuns } from './medical-volume.js?v=20260927-build230';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
import { clampRangeValue, ctDigits, esc, fmt, formatCtValue, frameYield, hexRgb, isDesktopMac, isIPadRuntime, isIPhoneRuntime, multi, niceCtStep, num, numberOr, rangeNumber, rangePrecision, rangeStep, safePair, safeTriple, withTimeout } from './utils.js?v=20260927-build230';
import { COMPRESSED_DICOM_TRANSFER_SYNTAXES, NATIVE_DICOM_TRANSFER_SYNTAXES, canDecodeToInt16, dicomImageFrameInfo, encapsulatedFrameBytes, expandParsedFrames, groupSeries, isNativeDicomTransferSyntax, parseDicomHeader, parseFiles, parsedSliceMeta, sourceRangeFromMetadata } from './dicom.js?v=20260927-build230';
import { boxBlur3D, buildThresholdMask, compactFaceFlags, fillMaskHoles, morphMask, removeSmallMaskComponents, smoothMaskScalarField, thresholdSourceMask, valuesToFaceFlags, valuesToSegmentBits } from './mask-ops.js?v=20260927-build230';
import { RunUnionFind, analysisRunRows, analysisRunSliceState, analysisRunsContain, analysisRunsOverlap, analysisRunsVoxelCount, complementRunArrays, componentAtVoxel, componentTouchesVolumeBoundary, componentsFromRuns, componentsFromRunsAsync, consumeGpuAnalysisRuns, forEachUncoveredRun, intersectRunArrays, intersectRunSlice, maskFromAnalysisRuns, maskToAnalysisRuns, mergeIntervals, morphSourceRunArrays, postprocessSourceRuns, rowIntervalsFromRuns, rowsToRunSlice, runArraysBinary, runsSliceToMask, sourceComponentSliceState, sourceResultToAnalysisRuns, sourceRunSlice, sourceRunSliceFromRanges, subtractRunArrays, subtractRunSlice, unionAnalysisRuns, unionOverlappingRuns, unionRunArrays, unionRunSlice } from './run-length.js?v=20260927-build230';
import { Float32FaceBuilder, appendAnalysisRunBoundaryFaces, appendDecodedMaskSliceFaces, appendSourceFacesFromCompactTile, appendSourceSliceFaces, appendSourceSliceFacesFast, appendSourceSliceFacesFromBits, appendSourceSliceFacesFromFlags, eachGeometryTriangle, eachGeometryTriangleRange, geometryToBinaryStl, groupToBinaryStl, groupTriangleCount, indexedGeometryFromTrianglePositions, makeSource3DCoordinates, makeVolume3DCoordinates } from './mesh-geometry.js?v=20260927-build230';
import { I18N, tr } from './i18n.js?v=20260927-build230';
import { GPU_PREWARM_KINDS, gpuFilterShader, normalizeVrlWgsl } from './gpu-shaders.js?v=20260927-build230';
import { activeId, activeSeries, analysisCutApplying, analysisCutScreen, analysisCutStroke, analysisEditPreparing, analysisEditTargetKey, analysisEditTargetMode, analysisEditTool, analysisFocusedRegionId, analysisPendingCut, analysisRegions, ctRangeMode, ctRangeProfile, current3DVolume, currentLanguage, cutBvhModulePromise, cutControlPreviewRaf, cutRaycastMaterial, cutResultPreviewRevision, cutResultPreviewTimer, deferAutomatic3D, dicomCodecModulePromise, filterOrder, filterRebuildRevision, filterRebuildTimer, gpuPrewarmIndex, gpuPrewarmScheduled, incCutResultPreviewRevision, incFilterRebuildRevision, incGpuPrewarmIndex, incNextAnalysisColorIndex, incNextAnalysisRegionId, incNextSegmentMaskVolumeId, incResidentMprEpoch, incSourceMprWarmupToken, incSourceRenderRevision, ipadGpuTargetSide, memoryGpuPreviewActive, mpr3DSurfaceOpacity, mpr3DVolumeOpacity, mpr3DWindowLutKey, mpr3DWindowLutTable, nextAnalysisColorIndex, nextAnalysisRegionId, nextSegmentMaskVolumeId, precisionRangeDrag, residentGpuUploadSeriesId, residentMprEpoch, residentMprReadbackDisabled, sceneState, sectionAutoPlane, sectionCapEnabled, sectionCapHatch, sectionCapOpacity, sectionSliceImageVisible, sectionViewOpen, sectionViewPlane, sectionViewReverse, segmentRenderTimer, setActiveId, setActiveSeries, setAnalysisCutApplying, setAnalysisCutScreen, setAnalysisCutStroke, setAnalysisEditPreparing, setAnalysisEditTargetKey, setAnalysisEditTargetMode, setAnalysisEditTool, setAnalysisFocusedRegionId, setAnalysisPendingCut, setAnalysisRegions, setCtRangeMode, setCtRangeProfile, setCurrent3DVolume, setCurrentLanguage, setCutBvhModulePromise, setCutControlPreviewRaf, setCutRaycastMaterial, setCutResultPreviewRevision, setCutResultPreviewTimer, setDeferAutomatic3D, setDicomCodecModulePromise, setFilterOrder, setFilterRebuildRevision, setFilterRebuildTimer, setGpuPrewarmIndex, setGpuPrewarmScheduled, setIpadGpuTargetSide, setMemoryGpuPreviewActive, setMpr3DSurfaceOpacity, setMpr3DVolumeOpacity, setMpr3DWindowLutKey, setMpr3DWindowLutTable, setNextAnalysisColorIndex, setNextAnalysisRegionId, setNextSegmentMaskVolumeId, setPrecisionRangeDrag, setResidentGpuUploadSeriesId, setResidentMprEpoch, setResidentMprReadbackDisabled, setSceneState, setSectionAutoPlane, setSectionCapEnabled, setSectionCapHatch, setSectionCapOpacity, setSectionSliceImageVisible, setSectionViewOpen, setSectionViewPlane, setSectionViewReverse, setSegmentRenderTimer, setSmoothingRefreshTimer, setSourceMprWarmupPlane, setSourceMprWarmupToken, setSourceOrthogonalPlaneCacheBytes, setSourceRenderRevision, setSourceVolume, setThreeDApplying, setThreeDCancelRequested, setThreeDDirty, setThreeRenderMode, setVolume, setVolumeAnalysisBusy, setVolumeAnalysisMode, smoothingRefreshTimer, sourceMprWarmupPlane, sourceMprWarmupToken, sourceOrthogonalPlaneCacheBytes, sourceRenderRevision, sourceVolume, threeDApplying, threeDCancelRequested, threeDDirty, threeRenderMode, volume, volumeAnalysisBusy, volumeAnalysisMode } from './state.js?v=20260927-build230';
import { $, analysisClearButton, analysisCutApply, analysisCutButton, analysisCutCancel, analysisCutConfirm, analysisCutDepth, analysisCutDepthValue, analysisCutOffset, analysisCutOffsetValue, analysisCutPitch, analysisCutPitchValue, analysisCutWidth, analysisCutWidthValue, analysisCutYaw, analysisCutYawValue, analysisEditRemoveSelected, analysisEditTargetSelect, analysisExportSelected, analysisKeepSelected, analysisLassoButton, analysisLineCutButton, analysisMergeButton, analysisNavigateButton, analysisRedo, analysisRegionList, analysisRemoveSelected, analysisResetEdit, analysisSelectRegionButton, analysisSummary, analysisUndo, anisotropicBtn, anisotropicIterations, anisotropicIterationsValue, anisotropicStrength, anisotropicStrengthValue, app, appVersionBadge, bar, bilateralBtn, bilateralIntensity, bilateralIntensityValue, bilateralPasses, bilateralPassesValue, bilateralSpatial, bilateralSpatialValue, bilateralStrength, bilateralStrengthValue, ctRangeAuto, ctRangeFull, demoBtn, filter3DState, filterAddButton, filterAddSelect, filterControlList, filterRebuild3D, folderBtn, folderInput, footer, gaussianBtn, gaussianStrength, gaussianStrengthValue, ipadGpuQuality, ipadGpuQualityControl, languageToggle, list, mainViewSlot, mpr3DSliceSliders, mprSurfaceOpacity, mprSurfaceOpacityValue, mprVolumeOpacity, mprVolumeOpacityValue, nlmBtn, nlmPatchRadius, nlmPatchRadiusValue, nlmSearchRadius, nlmSearchRadiusValue, nlmStrength, nlmStrengthValue, planes, processingOverlay, processingOverlayLabel, prog, progLabel, projectInput, projectOpenBtn, projectSaveBtn, renderModeToggle, resetFilterBtn, sectionCapEnabledControl, sectionCapHatchControl, sectionCapOpacityControl, sectionCapOpacityValue, sectionPosition, sectionPositionValue, sectionReverse, sectionSliceImageControl, sectionViewReadout, sectionViewResult, sectionViewToggle, segmentAddButton, segmentAddSelect, segmentControls, selected, sigmoidBtn, sigmoidCenter, sigmoidCenterValue, sigmoidStrength, sigmoidStrengthValue, smoothingType, spatialPasses, spatialPassesValue, spikeHoleBtn, spikeHoleStrength, spikeHoleStrengthValue, spikeHoleThreshold, spikeHoleThresholdValue, state, status, subViewSlots, surfaceSmoothEnabled, surfaceSmoothStrength, surfaceSmoothValue, threeBusy, threeBusyCancel, threeBusyLabel, threeEditHelp, threeEditOverlay, threeEditStatus, threeFilterBadge, threeLabel, tvBtn, tvIterations, tvIterationsValue, tvWeight, tvWeightValue, unsharpAmount, unsharpAmountValue, unsharpBtn, unsharpRadius, unsharpRadiusValue, unsharpThreshold, unsharpThresholdValue, viewport, volumeAnalysisResult, volumeAnalysisToggle, volumeCacheClearBtn, wc, wcVal, ww, wwVal } from './ui-shell.js?v=20260927-build230';
import { latestOnlyRunner } from './latest-runner.js?v=20260927-build230';
import { strongSurfaceSmoothingActive, surfaceSmoothingActive } from './settings.js?v=20260927-build230';
import { GPU_FILTER_KEYS, acquireGpuWorkBuffer, adoptRendererGpuDevice, clearGpuBufferPool, createGpuResidentFloat3Attribute, destroyGpuResidentAttribute, ensureGpuFilterDevice, finishGpuResidentTemps, gpuAdapterLabel, gpuBufferBucketSize, gpuComputeWorkgroupSize, gpuDeviceMode, gpuDeviceRequestDescriptor, gpuFilterPipeline, gpuFilterRuntime, gpuPoolLimit, gpuSmallBuffer, gpuStagesSupported, gpuValidationScope, installGpuErrorListener, releaseGpuWorkBuffer, requestVrlGpuAdapter, requestVrlGpuDevice, runGpuSourceFilters, setGpuComputeBackend, updateGpuStatus, verifyGpuComputeDevice, verifyGpuPipelineSet } from './gpu-compute.js?v=20260927-build230';
import { cachedSagittalDisplayPlane, cachedSourceMprPlane, decode, decodeCompressedDicomSlice, decodeSourceSlice, getDicomCodecModule, prepareSourceMprCache, readSourceColumn, readSourceRow, readSourceRows, sourceMprCacheLimit, sourceMprDecodeConcurrency, sourceSliceCache } from './volume-io.js?v=20260927-build230';
const APP_VERSION='2026.09.27-230';const APP_BUILD='230';
import { componentFullyInside, makeVoxelProjector, polygonBounds } from './lasso.js?v=20260927-build230';
import { PROJECT_EXTENSION, compareFingerprints, datasetFingerprint, decodeRuns, encodeRuns, isProjectArchiveName, packProject, projectFromEntries, unpackProject } from './project-file.js?v=20260927-build230';
import { cacheKey, openVolumeCache, textureCacheHandle } from './gpu-volume-cache.js?v=20260927-build230';
import { createSourceFilterSlot, ensureSourceFilterWorkers, filterState, fitSourceTile, getCachedSourceSlice, getFilteredMemoryPlaneValues, getFilteredSourceAxialBlock, getFilteredSourcePlaneValues, memoryFilterPreviewCache, memoryFilterPreviewGet, memoryFilterPreviewSet, memoryPreviewCacheLimit, planeRenderRevision, processMemoryRegion, processSourceRegion, pumpSourceFilterWorkers, readMemoryRegion, readSourceRegion, readSourceSubregion, runSourceFilterWorker, sourceFilterCacheGet, sourceFilterCacheLimit, sourceFilterCacheSet, sourceFilterHalo, sourceFilterRuntime, sourceFilterSignature, sourceFilterStages, sourceFilterWorkerMain, sourceSliceCacheLimit, sourceTileBudget } from './source-filters.js?v=20260927-build230';
import { buildSourceOrthogonalPlane, readResidentGpuMprPlane, readSourceOrthogonalStrip, residentGpuMprAvailable, residentMprJobs, sourceOrthogonalCacheGet, sourceOrthogonalCacheLimit, sourceOrthogonalCacheSet, sourceOrthogonalPlaneCache, sourceOrthogonalPlanePending } from './mpr-orthogonal.js?v=20260927-build230';
import { request3DRender } from './scene3d.js?v=20260927-build230';
import { cpuAnisotropicDiffusion, cpuBilateral3D, cpuGaussian3D, cpuMedian3D, cpuNlm3D, cpuSigmoid, cpuSpikeHole, cpuTvDenoising3D, cpuUnsharpMask3D } from './cpu-filters.js?v=20260927-build230';
import { disposeMprPlaneGroup, ensureMpr3DPlanes, ensureMpr3DPreviewCache, makeMprPlaneLabel, mpr3DCacheImage, mpr3DOpacitySource, mpr3DOrthoSliding, mpr3DPreviewCache, mpr3DPreviewMap, mpr3DPreviewPlan, mpr3DPreviewSignature, mpr3DVisibility, mpr3DWindowLut, paintMpr3DCacheSliceFast, pushCachedMpr3DPlane, refreshMpr3DPlaneTexture, restoreSectionAutoPlane, setMpr3DOverlayVisible, showSectionPlaneOverlay, syncMpr3DOverlayPresentation, syncMpr3DSliceSliders, updateMpr3DPlanePositions } from './mpr3d-overlay.js?v=20260927-build230';
import { SEGMENT_PRESET_ORDER, activeMprSegments, getProcessedSegmentMask, segmentEditActive, segmentEditState, segmentMaskVolumeId, segmentMaskVolumeIds, segmentNeedsGlobalMask, segmentState, sourceMprMemoryView } from './segments.js?v=20260927-build230';
import { rebindWebGpuSectionClipGroup, sectionLocalNormal, sectionLocalPoint, sectionPlaneLabel, updateSectionClipPlaneWorld, updateSectionViewUi } from './section-view.js?v=20260927-build230';
import { analysisColorCss, buildSourceOrthogonalNeighborhood, cancelSourceMprWarmup, currentFilterSignature, drawAnalysisOverlay, filteredPlaneDims, filteredPlaneRunners, gpuVolumeShowsCurrentFilters, mprPaintCache, orthogonalHighResPrefetch, paintFastOrthogonalPreview, paintInstantPlaneWhileSliding, paintResidentCachedMprPreview, paintSourcePlane, perSliceFilteredActive, planeRenderTimers, prefetchOrthogonalHighRes, renderPlane, renderPlaneMemoryFiltered, renderPlaneSourceBacked, reusableMprImage, safeRenderPlane, schedulePlaneRender, updateMprCanvasPhysicalAspect } from './mpr-render.js?v=20260927-build230';
async function ensureLatestDeployedBuild(){
 try{
  const res=await fetch('./version.json?t='+Date.now(),{cache:'no-store',headers:{'Cache-Control':'no-cache'}});
  if(!res.ok)return;
  const latest=await res.json(),build=String(latest?.build||'');
  if(!build||build===String(APP_BUILD))return;
  const url=new URL(location.href),requested=url.searchParams.get('build');
  console.warn('Build marker differs from loaded app.',{loaded:String(APP_BUILD),published:build,requested});
  if(requested===build)return;
  url.searchParams.set('build',build);
  url.searchParams.set('_',Date.now().toString(36));
  location.replace(url.toString());
 }catch(e){console.warn('Version check failed.',e)}
}


const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
const DEMO_SIZE=20800000;
function applyLanguage(lang){
 setCurrentLanguage(lang);
 document.documentElement.lang=lang;
 document.title=lang==='ja'?'Virtual Rodent Lab — DICOMビューワー':'Virtual Rodent Lab — DICOM Viewer';
 document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=tr(key)});
 const toggle=document.querySelector('#language-toggle');if(toggle)toggle.textContent=lang==='ja'?'English':'日本語';
}


// Unified range controls:
// - wheel works on every range input
// - pointer dragging is relative and intentionally slower than the browser default
const RANGE_DRAG_MOUSE_GAIN=.48,RANGE_DRAG_TOUCH_GAIN=.36;
// Owner: slice sliders follow the pen/finger 1:1 (the thumb stays under it);
// every other slider keeps the precision gain above.
const SLICE_SLIDER_SELECTOR='#axial-slider,#coronal-slider,#sagittal-slider,[id^="mpr3d-slider-"],#section-position';
function rangeValueAtPointer(el,clientX,min,max){const r=el.getBoundingClientRect(),t=r.width>0?(clientX-r.left)/r.width:0;return min+Math.max(0,Math.min(1,t))*(max-min)}
const setRangeValue=(el,value,commit=false)=>{
 const next=clampRangeValue(el,value);if(Number(el.value)===next)return false;
 el.value=String(next);el.dispatchEvent(new Event('input',{bubbles:true}));
 if(commit)el.dispatchEvent(new Event('change',{bubbles:true}));
 return true;
};
const rangeWheelState=new WeakMap();
// While a range slider is dragged or wheeled and the 3D view shows GPU volume
// rendering, render at the reduced resolution used for camera rotation, so
// sliders stay responsive. Overlays (cut preview, analysis mesh) stay visible.
const sliderFastInteraction={active:false,timer:null};
function beginSliderFastInteraction(){
 clearTimeout(sliderFastInteraction.timer);sliderFastInteraction.timer=null;
 if(sliderFastInteraction.active)return;
 if(!(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active&&sceneState.setFastInteraction))return;
 sliderFastInteraction.active=true;sceneState.setFastInteraction(true,true);
}
function endSliderFastInteraction(delay=0){
 if(!sliderFastInteraction.active)return;
 clearTimeout(sliderFastInteraction.timer);
 sliderFastInteraction.timer=setTimeout(()=>{sliderFastInteraction.timer=null;sliderFastInteraction.active=false;sceneState?.setFastInteraction?.(false)},delay);
}
document.addEventListener('wheel',e=>{
 const el=e.target?.closest?.('input[type="range"]');if(!el||el.disabled)return;
 e.preventDefault();
 const delta=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;if(!delta)return;
 const modeScale=e.deltaMode===1?16:e.deltaMode===2?80:1,state=rangeWheelState.get(el)||{acc:0,timer:null};
 state.acc+=delta*modeScale;
 const threshold=42,min=rangeNumber(el,'min',0),max=rangeNumber(el,'max',100),step=rangeStep(el),span=Math.max(step,max-min),coarseSteps=Math.max(1,Math.round(span/(step*220)));
 let ticks=0;
 while(Math.abs(state.acc)>=threshold&&Math.abs(ticks)<24){const sign=state.acc>0?1:-1;ticks+=sign;state.acc-=sign*threshold}
 if(!ticks&&Math.abs(delta)>=80){ticks=delta>0?1:-1;state.acc=0}
 if(ticks){
  const multiplier=e.shiftKey?5:1;
  beginSliderFastInteraction();endSliderFastInteraction(220);
  setRangeValue(el,Number(el.value)-ticks*step*coarseSteps*multiplier,false);
  clearTimeout(state.timer);state.timer=setTimeout(()=>el.dispatchEvent(new Event('change',{bubbles:true})),140);
 }
 rangeWheelState.set(el,state);
},{passive:false,capture:true});

document.addEventListener('pointerdown',e=>{
 const el=e.target?.closest?.('input[type="range"]');if(!el||el.disabled||e.button!==0)return;
 const min=rangeNumber(el,'min',0),max=rangeNumber(el,'max',100),step=rangeStep(el),steps=Math.max(1,(max-min)/step);
 const gain=steps<=12 ? 0.78 : (e.pointerType==='touch'?RANGE_DRAG_TOUCH_GAIN:RANGE_DRAG_MOUSE_GAIN);
 const absolute=el.matches(SLICE_SLIDER_SELECTOR);
 setPrecisionRangeDrag({el,id:e.pointerId,startX:e.clientX,startValue:Number(el.value),min,max,step,gain,moved:false,absolute});
 if(absolute){const value=rangeValueAtPointer(el,e.clientX,min,max);if(Math.round(value/step)!==Math.round(Number(el.value)/step)){precisionRangeDrag.moved=true;beginSliderFastInteraction();setRangeValue(el,value,false)}}
 el.focus({preventScroll:true});el.style.touchAction='none';
 try{el.setPointerCapture(e.pointerId)}catch{}
 e.preventDefault();
},{capture:true});
document.addEventListener('pointermove',e=>{
 const d=precisionRangeDrag;if(!d||d.id!==e.pointerId||d.el.disabled)return;
 const width=Math.max(80,d.el.getBoundingClientRect().width),dx=e.clientX-d.startX;
 if(Math.abs(dx)>1){d.moved=true;beginSliderFastInteraction()}
 const value=d.absolute?rangeValueAtPointer(d.el,e.clientX,d.min,d.max):d.startValue+(dx/width)*(d.max-d.min)*d.gain;
 setRangeValue(d.el,value,false);e.preventDefault();
},{capture:true});
const finishPrecisionRangeDrag=e=>{
 const d=precisionRangeDrag;if(!d||d.id!==e.pointerId)return;
 try{if(d.el.hasPointerCapture(e.pointerId))d.el.releasePointerCapture(e.pointerId)}catch{}
 d.el.style.touchAction='';if(d.moved)d.el.dispatchEvent(new Event('change',{bubbles:true}));
 setPrecisionRangeDrag(null);endSliderFastInteraction(120);e.preventDefault();
};
// iPad Safari still runs the native range behaviour for touches (the thumb
// jumps to and follows the finger) next to the precision drag above, so the
// value alternated between the two positions and 2D slices flickered (build
// 226, touch only; pen was fine). Suppress the native touch handling: on
// touchstart except in the scrollable sidebar (vertical scroll may start on a
// slider there), and on every touchmove of an active precision drag.
document.addEventListener('touchstart',e=>{
 const el=e.target?.closest?.('input[type="range"]');if(!el||el.disabled||el.closest('.sidebar-scroll'))return;
 e.preventDefault();
},{passive:false,capture:true});
document.addEventListener('touchmove',e=>{
 const d=precisionRangeDrag;if(!d||e.target?.closest?.('input[type="range"]')!==d.el)return;
 e.preventDefault();
},{passive:false,capture:true});
document.addEventListener('pointerup',finishPrecisionRangeDrag,{capture:true});
document.addEventListener('pointercancel',finishPrecisionRangeDrag,{capture:true});

const mprResizeObserver=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{if(volume)for(const p of Object.keys(planes))updateMprCanvasPhysicalAspect(p)}):null;
for(const p of Object.keys(planes))if(planes[p].canvas?.parentElement)mprResizeObserver?.observe(planes[p].canvas.parentElement);
languageToggle.onclick=()=>{applyLanguage(currentLanguage==='ja'?'en':'ja');renderAnalysisResults();updateSectionViewUi();updateThreeEditUi();updateGpuStatus();updateRenderModeControl()};
applyLanguage('ja');;
if(appVersionBadge)appVersionBadge.textContent='Virtual Rodent Lab · v'+APP_VERSION+' · build '+APP_BUILD;
function updateSectionCapControls(){
 if(sectionSliceImageControl)sectionSliceImageControl.checked=sectionSliceImageVisible;
 if(sectionCapEnabledControl)sectionCapEnabledControl.checked=sectionCapEnabled;
 if(sectionCapOpacityControl)sectionCapOpacityControl.value=String(Math.round(sectionCapOpacity*100));
 if(sectionCapOpacityValue)sectionCapOpacityValue.value=Math.round(sectionCapOpacity*100)+'%';
 if(sectionCapHatchControl)sectionCapHatchControl.checked=sectionCapHatch;
}
if(sectionSliceImageControl)sectionSliceImageControl.onchange=()=>{setSectionSliceImageVisible(!!sectionSliceImageControl.checked);request3DRender()};
if(sectionCapEnabledControl)sectionCapEnabledControl.onchange=()=>{setSectionCapEnabled(!!sectionCapEnabledControl.checked);updateSectionViewUi();request3DRender()};
if(sectionCapOpacityControl)sectionCapOpacityControl.oninput=()=>{setSectionCapOpacity(Math.max(0,Math.min(1,+sectionCapOpacityControl.value/100)));updateSectionCapControls();request3DRender()};
if(sectionCapHatchControl)sectionCapHatchControl.onchange=()=>{setSectionCapHatch(!!sectionCapHatchControl.checked);request3DRender()};
updateSectionCapControls();
function updateMpr3DOpacityControls(){
 if(mprSurfaceOpacity){mprSurfaceOpacity.value=String(Math.round(mpr3DSurfaceOpacity*100));mprSurfaceOpacityValue.value=Math.round(mpr3DSurfaceOpacity*100)+'%'}
 if(mprVolumeOpacity){mprVolumeOpacity.value=String(Math.round(mpr3DVolumeOpacity*100));mprVolumeOpacityValue.value=Math.round(mpr3DVolumeOpacity*100)+'%'}
 // also called during startup, before the 3D slice panel is initialised
 if(mpr3DSlicePanelReady.value)syncMpr3DSliceSliders();
}
const mpr3DSlicePanelReady={value:false};
if(mprSurfaceOpacity)mprSurfaceOpacity.oninput=()=>{setMpr3DSurfaceOpacity(Math.max(0,Math.min(1,+mprSurfaceOpacity.value/100)));updateMpr3DOpacityControls();syncMpr3DOverlayPresentation()};
if(mprVolumeOpacity)mprVolumeOpacity.oninput=()=>{setMpr3DVolumeOpacity(Math.max(0,Math.min(1,+mprVolumeOpacity.value/100)));updateMpr3DOpacityControls();syncMpr3DOverlayPresentation()};
updateMpr3DOpacityControls();
function sectionLocalStep(p=sectionViewPlane){
 if(!volume||!p)return null;const[sx,sy,sz]=volume.spacing,w=volume.columns,h=volume.rows,d=volume.slices,scale=3.3/Math.max(w*sx,h*sy,d*sz,1);
 return p==='axial'?new THREE.Vector3(0,0,sz*scale):p==='coronal'?new THREE.Vector3(0,-sy*scale,0):new THREE.Vector3(sx*scale,0,0);
}
function sectionLocalPlane(){
 if(!volume||!sectionViewPlane)return null;
 const point=sectionLocalPoint(),normal=sectionLocalNormal();return new THREE.Plane(normal,-normal.dot(point));
}
function applySectionClippingMaterials(root=sceneState?.obj){
 if(!root||!sceneState)return;
 const active=sectionViewOpen&&!!sectionViewPlane&&sceneState.backend!=='WEBGPU';
 root.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.clippingPlanes=active?[sceneState.sectionClipPlane]:null;m.clipShadows=false;m.needsUpdate=true}});
}
function syncSectionClipParent(){
 if(!sceneState?.obj)return;
 const active=sectionViewOpen&&!!sectionViewPlane;
 if(sceneState.backend==='WEBGPU'&&sceneState.sectionClipGroup){
  const g=sceneState.sectionClipGroup;
  if(active){if(sceneState.obj.parent!==g)g.add(sceneState.obj);g.enabled=true;g.clippingPlanes=[sceneState.sectionClipPlane]}
  else{g.enabled=false;g.clippingPlanes=[];if(sceneState.obj.parent===g){g.remove(sceneState.obj);sceneState.scene.add(sceneState.obj)}}
 }else{
  sceneState.renderer.localClippingEnabled=true;
  applySectionClippingMaterials(sceneState.obj);
 }
}
function clearSectionView(){
 restoreSectionAutoPlane();setSectionViewPlane(null);setSectionViewReverse(false);
 if(threeRenderMode!=='volume'){syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj)}
 updateSectionViewUi();request3DRender();
}
function setSectionView(key){
 if(key==='off'){clearSectionView();return}
 if(!planes[key])return;
 setSectionViewOpen(true);setSectionViewPlane(key);showSectionPlaneOverlay(key);
 if(sectionPosition){sectionPosition.max=planes[key].slider.max;sectionPosition.value=planes[key].slider.value}
 if(threeRenderMode!=='volume'){updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj)}
 updateMpr3DPlanePositions();updateSectionViewUi();request3DRender();
}
function clearThreeEditOverlay(){const ctx=threeEditOverlay?.getContext('2d');ctx?.clearRect(0,0,threeEditOverlay.width,threeEditOverlay.height)}
const ANALYSIS_REGION_COLORS=[0x00d8ff,0xff9f1c,0x7ae582,0xff4d8d,0xf4e409,0x9b5cff,0xff5a5f,0x2ec4b6];
function nextAnalysisColor(){
 const color=ANALYSIS_REGION_COLORS[nextAnalysisColorIndex%ANALYSIS_REGION_COLORS.length];
 incNextAnalysisColorIndex(false);return color;
}
function analysisRegionById(id){return analysisRegions.find(r=>r.id===id)||null}
function analysisRegionRepresentativeVoxel(region){
 if(!region?.runsBySlice)return null;
 const nonEmpty=[];for(let z=0;z<region.runsBySlice.length;z++)if(region.runsBySlice[z]?.length)nonEmpty.push(z);
 if(!nonEmpty.length)return null;
 const z=nonEmpty[Math.floor(nonEmpty.length/2)],rec=region.runsBySlice[z],i=Math.floor((rec.length/3)/2)*3;
 return{x:Math.floor((rec[i+1]+rec[i+2])/2),y:rec[i],z};
}
function setAnalysisFocusedRegion(id,voxel=null){
 const region=analysisRegionById(id);setAnalysisFocusedRegionId(region?.id??null);
 for(const r of analysisRegions){
  r.focused=r.id===analysisFocusedRegionId;
  if(r.meshGroup)r.meshGroup.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;m.opacity=r.focused?.98:.46;m.emissiveIntensity=r.focused?.9:.28}});
 }
 if(region){
  const v=voxel||analysisRegionRepresentativeVoxel(region);
  if(v&&volume){
   planes.axial.slider.value=Math.max(0,Math.min(+planes.axial.slider.max,v.z));
   planes.coronal.slider.value=Math.max(0,Math.min(+planes.coronal.slider.max,v.y));
   planes.sagittal.slider.value=Math.max(0,Math.min(+planes.sagittal.slider.max,v.x));
  }
 }
 for(const p of Object.keys(planes))schedulePlaneRender(p);
 request3DRender();renderAnalysisResults();
}
function analysisRegionAtVoxel(x,y,z){
 const focused=analysisRegionById(analysisFocusedRegionId);
 if(focused?.visible&&analysisRunsContain(focused.runsBySlice,x,y,z))return focused;
 return analysisRegions.find(r=>r.visible&&analysisRunsContain(r.runsBySlice,x,y,z))||null;
}
function mprEventVoxel(p,event){
 if(!volume)return null;const c=planes[p],rect=c.canvas.getBoundingClientRect();
 const cx=Math.max(0,Math.min(c.canvas.width-1,Math.floor((event.clientX-rect.left)/Math.max(rect.width,1)*c.canvas.width)));
 const cy=Math.max(0,Math.min(c.canvas.height-1,Math.floor((event.clientY-rect.top)/Math.max(rect.height,1)*c.canvas.height)));
 const idx=+c.slider.value,d=volume.slices;
 if(p==='axial')return{x:cx,y:cy,z:idx};
 if(p==='coronal')return{x:cx,y:idx,z:d-1-cy};
 return{x:idx,y:cx,z:d-1-cy};
}
function selectAnalysisRegionFromMpr(p,event){
 if(!volumeAnalysisMode)return false;
 const voxel=mprEventVoxel(p,event);if(!voxel)return false;
 const region=analysisRegionAtVoxel(voxel.x,voxel.y,voxel.z);
 if(region){setAnalysisFocusedRegion(region.id,voxel);return true}
 void analyzeVolumeAtVoxel(voxel.x,voxel.y,voxel.z);return true;
}
const FILTER_CATALOG_ORDER=['spikeHole','nlm','anisotropic','gaussian','sigmoid','bilateral','tv','unsharp'];

// GPU volume + filters (source-backed series only; that is what the GPU volume
// renderer supports). Filters apply to 2D immediately; the volume is updated
// only by an explicit "3D rebuild" (owner decision: the rewrite takes time).
// The texture is rewritten in place with filtered slices streamed from
// getFilteredSourceAxialBlock, so no full filtered copy is kept in memory.
const gpuVolumeApplied={seriesId:null,signature:''};
// Data the volume should show: the filters applied by the last 3D rebuild of
// this series, if they are still the current settings; otherwise the original.
function gpuVolumeDataSignature(){
 const id=(sourceVolume||volume)?.series?.id??null,applied=gpuVolumeApplied.seriesId===id?gpuVolumeApplied.signature:'';
 return applied&&applied===currentFilterSignature()?applied:'';
}
function filteredSourceSliceProvider(series,blockDepth=8){
 let block=null,start=-1;
 return async z=>{
  if(!block||z<start||z>=start+block.coreDepth){start=Math.floor(z/blockDepth)*blockDepth;block=await getFilteredSourceAxialBlock(start,blockDepth,series,'gpu-volume')}
  const n=series.rows*series.columns,off=(z-start)*n;return block.data.subarray(off,off+n);
 };
}
// Device-local cache of filtered GPU volume textures (stage 2 of the save
// plan, docs/gpu-volume-cache.js). Keyed by dataset fingerprint + filter
// signature + texture plan, so iPad 512/768 and Mac full size are separate.
const volumeCacheState={cache:null,failed:false,persistAsked:false};
async function volumeCache(){
 if(volumeCacheState.cache||volumeCacheState.failed)return volumeCacheState.cache;
 try{volumeCacheState.cache=await openVolumeCache()}catch(e){volumeCacheState.failed=true;console.warn('GPU volume cache unavailable.',e)}
 return volumeCacheState.cache;
}
async function volumeCacheBudget(){
 const cap=(isIPadRuntime()?1.5:4)*2**30;
 try{const q=(await navigator.storage?.estimate?.())?.quota||0;return Math.max(256*2**20,Math.min(cap,q?q*.3:cap))}catch{return 512*2**20}
}
function gpuVolumeCacheFor(series,signature){
 return async info=>{
  const cache=await volumeCache();if(!cache)return null;
  const size=info.slices*info.bytesPerSlice,budget=await volumeCacheBudget();
  if(size>budget)return null;
  if(!volumeCacheState.persistAsked){volumeCacheState.persistAsked=true;try{await navigator.storage?.persist?.()}catch{}}
  const key=await cacheKey({dataset:datasetFingerprint(series),filter:signature,plan:info.planSignature,reduced:info.reduced});
  await cache.prune(budget-size,{keep:key});
  return textureCacheHandle(cache,key,{slices:info.slices,bytesPerSlice:info.bytesPerSlice,info:{description:series.description||'',plan:info.planSignature}});
 };
}
async function updateVolumeCacheControl(){
 if(!volumeCacheClearBtn)return;
 const available=!!sceneState?.medicalVolume,cache=available?await volumeCache():null,bytes=cache?await cache.usage().catch(()=>0):0;
 volumeCacheClearBtn.classList.toggle('is-hidden',!cache);
 volumeCacheClearBtn.textContent=tr('volumeCacheClear')+(bytes?' · '+fmt(bytes):'');
 volumeCacheClearBtn.disabled=!bytes;
}
function gpuVolumeTarget(){
 const base=sourceVolume||volume,signature=gpuVolumeDataSignature();
 if(!signature||!base?.sourceBacked||!base.series)return base;
 return{...base,filterSignature:signature,sliceData:filteredSourceSliceProvider(base.series),textureCache:gpuVolumeCacheFor(base.series,signature)};
}
const gpuVolumeRefresh={token:0,running:null};
async function refreshGpuVolumeData(){
 const mv=sceneState?.medicalVolume;
 if(!(threeRenderMode==='volume'&&mv?.active))return;
 const wanted=gpuVolumeDataSignature();
 if((mv.dataSignature||'')===wanted||gpuVolumeRefresh.running===wanted){updateVolumeFilterBadge();return}
 const token=++gpuVolumeRefresh.token,target={...gpuVolumeTarget(),isCancelled:()=>token!==gpuVolumeRefresh.token};
 gpuVolumeRefresh.running=wanted;updateVolumeFilterBadge();
 try{await mv.ensure(target,gpuVolumePlanOptions());syncGpuVolumeEdits(target);request3DRender();if(mv.lastCacheHit)footer.textContent=tr('volumeCacheLoaded');void updateVolumeCacheControl()}
 catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('GPU volume filter refresh failed.',e)}
 finally{if(token===gpuVolumeRefresh.token){gpuVolumeRefresh.running=null;set3DBusy(false)}updateVolumeFilterBadge()}
}
function updateVolumeFilterBadge(){
 if(!threeFilterBadge)return;
 const mv=sceneState?.medicalVolume,show=threeRenderMode==='volume'&&!!mv?.active&&(mv.dataSignature||'')!==currentFilterSignature();
 threeFilterBadge.classList.toggle('is-hidden',!show);
 if(show){const key=gpuVolumeRefresh.running!=null?'volumeFilterUpdating':'volumeFilterPending';if(threeFilterBadge.dataset.i18n!==key){threeFilterBadge.dataset.i18n=key;threeFilterBadge.textContent=tr(key)}}
}
function set3DState(mode){
 setThreeDDirty(mode==='stale');setThreeDApplying(mode==='updating');
 updateVolumeFilterBadge();
 if(!filter3DState||!filterRebuild3D)return;
 filter3DState.classList.toggle('is-stale',mode==='stale');
 filter3DState.classList.toggle('is-updating',mode==='updating');
 filter3DState.classList.toggle('is-current',mode==='current');
 const key=mode==='stale'?'threeStale':mode==='updating'?'threeUpdating':'threeCurrent';filter3DState.dataset.i18n=key;filter3DState.textContent=tr(key);
 const actionKey=mode==='updating'?'cancel3D':'rebuild3D';
 filterRebuild3D.dataset.i18n=actionKey;filterRebuild3D.textContent=tr(actionKey);
 filterRebuild3D.classList.toggle('is-cancel',mode==='updating');
 filterRebuild3D.disabled=!volume||mode==='current';
 const volumeCurrent=threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active,hasSurface3D=mode==='current'&&!!sceneState?.obj&&threeRenderMode==='surface';
 if(volumeAnalysisToggle)volumeAnalysisToggle.disabled=volumeAnalysisMode?false:!(volumeCurrent||hasSurface3D);
 if(sectionViewToggle)sectionViewToggle.disabled=!volume;
 for(const key of SEGMENT_PRESET_ORDER){
  const exportBtn=$('[data-seg-export="'+key+'"]');
  if(exportBtn)exportBtn.disabled=!hasSurface3D||!segmentState[key].active||!segmentState[key].enabled;
 }
 updateAnalysisEditorControls();
}
function mark3DStale(){if(volume)set3DState('stale')}
function mark3DCurrent(){set3DState('current')}
function mark3DUpdating(){set3DState('updating')}
function updateRenderModeControl(v=volume){
 updateVolumeFilterBadge();
 if(!renderModeToggle)return;
 const mv=sceneState?.medicalVolume,support=mv&&v?mv.support(v,gpuVolumePlanOptions()):{ok:false,reason:'WebGPU volume unavailable'};
 renderModeToggle.disabled=!support.ok;
 renderModeToggle.removeAttribute('data-i18n');renderModeToggle.textContent=threeRenderMode==='volume'?tr('surfaceRender'):tr('volumeRender');
 renderModeToggle.title=support.ok?'':(support.reason||'');
}
function ensureVolumeTransformProxy(){
 if(sceneState?.obj)return sceneState.obj;
 const group=new THREE.Group();sceneState.obj=group;sceneState.scene.add(group);return group;
}
function setSurfaceMeshesHiddenForVolume(hidden){
 if(!sceneState?.obj)return;
 sceneState.obj.traverse(o=>{
  if(!o.isMesh)return;
  const isSurface=!!o.userData?.segmentKey||Array.isArray(o.userData?.segmentRanges);
  if(!isSurface)return;
  if(hidden){
   if(o.userData._volumePrevVisible===undefined)o.userData._volumePrevVisible=o.visible;
   o.visible=false;
  }else if(o.userData._volumePrevVisible!==undefined){
   o.visible=!!o.userData._volumePrevVisible;delete o.userData._volumePrevVisible;
  }
 });
}
function setThreeVolumeOverlay(active){
 const state=sceneState;if(!state?.renderer)return;
 const canvas=state.renderer.domElement;
 if(active){
  state._surfaceBackground=state.scene.background;
  state._surfaceClearAlpha=typeof state.renderer.getClearAlpha==='function'?state.renderer.getClearAlpha():1;
  state.scene.background=null;if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(0);
  Object.assign(canvas.style,{position:'absolute',inset:'0',zIndex:'2',pointerEvents:'auto'});
  setSurfaceMeshesHiddenForVolume(true);
 }else{
  state.scene.background=state._surfaceBackground||new THREE.Color(0x090c0e);
  if(typeof state.renderer.setClearAlpha==='function')state.renderer.setClearAlpha(state._surfaceClearAlpha??1);
  canvas.style.position='';canvas.style.inset='';canvas.style.zIndex='';canvas.style.pointerEvents='';
  setSurfaceMeshesHiddenForVolume(false);
 }
}
function gpuVolumeEditDescriptors(v=sourceVolume||volume){
 const out={};if(!v)return out;
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key];if(!st)continue;
  if(st.keepRuns){out[key]={mode:'keep',runs:st.excludeRuns?subtractRunArrays(st.keepRuns,st.excludeRuns,v.slices):st.keepRuns,cutRuns:st.cutRuns}}
  else if(st.excludeRuns){out[key]={mode:'exclude',runs:st.excludeRuns,cutRuns:st.cutRuns}}
 }
 return out;
}
function syncGpuVolumeEdits(v=sourceVolume||volume){
 const mv=sceneState?.medicalVolume;if(!mv||!v)return;
 try{mv.setEditRuns(gpuVolumeEditDescriptors(v),SEGMENT_PRESET_ORDER,v);request3DRender()}
 catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'GPU編集マスク更新エラー: ':'GPU edit mask error: ')+String(e.message||e)}
}

async function activateMedicalVolume(){
 const mv=sceneState?.medicalVolume,target=gpuVolumeTarget();if(!mv||!target)return;
 gpuVolumeRefresh.token++;gpuVolumeRefresh.running=null;
 const planOptions=gpuVolumePlanOptions(),support=mv.support(target,planOptions);if(!support.ok){footer.textContent='GPU Volume: '+support.reason;updateRenderModeControl(target);return}
 set3DBusy(true,currentLanguage==='ja'?'GPUボリューム準備中…':'Preparing GPU volume…');
 try{
  await mv.ensure(target,planOptions);if(mv.lastCacheHit)footer.textContent=tr('volumeCacheLoaded');void updateVolumeCacheControl();ensureVolumeTransformProxy();setThreeRenderMode('volume');mv.setActive(true);syncGpuVolumeEdits(target);setThreeVolumeOverlay(true);syncMpr3DOverlayPresentation();volumeAnalysisToggle.disabled=false;
  const reduced=!!mv.isReduced?.(target),dims=mv.textureDims||[],profile=gpuVolumeProfileLabel();
  threeLabel.textContent=(sceneState.backend||'3D')+(reduced?' · '+profile+' GPU volume':' · GPU volume');setGpuComputeBackend(reduced?'WEBGPU '+profile.toUpperCase()+' VOLUME RAYCAST · LINEAR':'WEBGPU VOLUME RAYCAST');updateRenderModeControl(target);request3DRender();
  footer.textContent=reduced?(profile+' GPUボリューム · '+dims.join('×')+' · '+fmt(mv.textureBytes)+' · MPR/元データはフル解像度'):(currentLanguage==='ja'?'GPUボリューム · 16-bit CTを3D textureから直接描画':'GPU Volume · direct 16-bit CT 3D-texture ray casting');
 }catch(e){console.error(e);mv.setActive(false);setThreeRenderMode('surface');setGpuComputeBackend('GPU VOLUME ERROR',e?.message||e);footer.textContent='GPU Volume error: '+String(e.message||e);updateRenderModeControl(target)}
 finally{set3DBusy(false)}
}
function deactivateMedicalVolume(){
 const mv=sceneState?.medicalVolume;if(mv)mv.setActive(false);setThreeVolumeOverlay(false);setThreeRenderMode('surface');syncMpr3DOverlayPresentation();updateRenderModeControl();
 threeLabel.textContent=sceneState?.backend||'3D';request3DRender();
 if(threeDDirty)mark3DStale();else mark3DCurrent();
}
function clear3DForSeriesChange(){
 incSourceRenderRevision(false);setThreeDCancelRequested(false);setCurrent3DVolume(null);setMemoryGpuPreviewActive(false);setResidentMprReadbackDisabled(false);setResidentGpuUploadSeriesId(null);clearResidentMprJobs();sceneState?.medicalVolume?.resetData?.();setThreeRenderMode('surface');setThreeVolumeOverlay(false);clearMemoryFilterPreviewCache();set3DBusy(false);clearAnalysisHighlight();
 if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}
 disposeMprPlaneGroup();request3DRender();mark3DStale();
}
async function buildCpuFilteredVolumeFor3D(){
 const previousDefer=deferAutomatic3D;setDeferAutomatic3D(true);setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();setVolume(sourceVolume);
 let base=sourceVolume;
 try{
  for(const key of filterOrder){
   if(!filterState[key])continue;
   await applyCpuFilter(key,base);
   base=volume;
  }
  return base;
 }finally{setDeferAutomatic3D(previousDefer)}
}
function cancel3DRebuild(){
 if(!threeDApplying||threeDCancelRequested)return;
 setThreeDCancelRequested(true);gpuVolumeRefresh.token++;gpuVolumeRefresh.running=null;
 incFilterRebuildRevision(false);
 invalidateSourceFilters();
 if(threeBusyLabel)threeBusyLabel.textContent=tr('cancelling3D');
 if(threeBusyCancel)threeBusyCancel.disabled=true;
 filterRebuild3D.disabled=true;
 footer.textContent=tr('cancelling3D');
}
// Surface meshes left stale by a volume-only rebuild; rebuilt when switching
// back to surface mode.
const surfaceRebuildPending={value:false};
async function rebuildCurrent3D(){
 if(!volume||threeDApplying)return;
 // Volume mode: "Rebuild 3D" applies the current filters to the GPU volume
 // only. Building surface meshes here was slow and the new meshes were drawn
 // over the volume (they are created after the volume hid the old ones).
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active&&(sourceVolume||volume)?.sourceBacked){
  setThreeDCancelRequested(false);mark3DUpdating();
  gpuVolumeApplied.seriesId=(sourceVolume||volume)?.series?.id??null;gpuVolumeApplied.signature=currentFilterSignature();
  surfaceRebuildPending.value=true;
  await refreshGpuVolumeData();
  if(threeDCancelRequested){setThreeDCancelRequested(false);mark3DStale()}else mark3DCurrent();
  updateVolumeFilterBadge();return;
 }
 setThreeDCancelRequested(false);mark3DUpdating();const settingsRevision=filterRebuildRevision,appliedSignature=currentFilterSignature();
 try{
  let buildVolume=sourceVolume||volume;
  if(!buildVolume.sourceBacked){
   const stages=sourceFilterStages();
   if(stages.length){
    set3DBusy(true,'3D再構築 · GPUフィルター処理…');
    try{
     const data=await applyGpuFiltersToMemoryVolume(sourceVolume,stages,settingsRevision);
     if(threeDCancelRequested||settingsRevision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
     buildVolume=cloneVolumeWithData(sourceVolume,data);
    }catch(e){
     if(String(e.message||e)==='__SUPERSEDED__'){
      set3DBusy(false);mark3DStale();
      if(threeDCancelRequested){footer.textContent=tr('threeCancelled');threeLabel.textContent=(sceneState?.backend||'3D')+(sceneState?.obj?' · previous 3D':'')}
      return;
     }
     console.warn('Full GPU filter rebuild failed; using exact CPU filter stack.',e);
     buildVolume=await buildCpuFilteredVolumeFor3D();
     if(threeDCancelRequested){set3DBusy(false);mark3DStale();footer.textContent=tr('threeCancelled');return}
    }
   }
  }
  const ok=await render3D(buildVolume,true);
  if(threeDCancelRequested||!ok){
   set3DBusy(false);mark3DStale();
   if(threeDCancelRequested){footer.textContent=tr('threeCancelled');threeLabel.textContent=(sceneState?.backend||'3D')+(sceneState?.obj?' · previous 3D':'')}
   return;
  }
  resetAnalysisRegistryAfterRebuild();setCurrent3DVolume(buildVolume);surfaceRebuildPending.value=false;
  gpuVolumeApplied.seriesId=(sourceVolume||volume)?.series?.id??null;gpuVolumeApplied.signature=appliedSignature;
  if(threeRenderMode==='volume')void refreshGpuVolumeData();
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
  set3DBusy(false);mark3DStale();
  if(threeDCancelRequested)footer.textContent=tr('threeCancelled');
 }
}
function renderSegmentPresets(){
 const active=new Set(SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active));
 for(const key of SEGMENT_PRESET_ORDER){
  const card=segmentControls.querySelector('[data-segment="'+key+'"]');
  if(card)card.classList.toggle('is-hidden',!active.has(key));
  const option=[...segmentAddSelect.options].find(o=>o.value===key);
  if(option)option.disabled=active.has(key);
 }
 const next=[...segmentAddSelect.options].find(o=>!o.disabled);
 if(next)segmentAddSelect.value=next.value;
 segmentAddSelect.disabled=!volume||!next;
 segmentAddButton.disabled=!volume||!next;
}
function addSegmentPreset(key){
 if(!volume||!SEGMENT_PRESET_ORDER.includes(key)||segmentState[key].active)return;
 const seg=segmentState[key];seg.active=true;seg.enabled=true;
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.checked=true;enabled.disabled=false;color.disabled=false;min.disabled=false;max.disabled=false;opacity.disabled=false;
 opening.disabled=false;closing.disabled=false;minComponent.disabled=false;holeFill.disabled=false;
 if(exportBtn)exportBtn.disabled=true;if(removeBtn)removeBtn.disabled=false;
 renderSegmentPresets();renderAll();scheduleSegment3D();
}
function removeSegmentPreset(key){
 if(!SEGMENT_PRESET_ORDER.includes(key)||!segmentState[key].active)return;
 const seg=segmentState[key];seg.active=false;seg.enabled=false;clearSegmentEditCache(key,true);if(threeRenderMode==='volume')syncGpuVolumeEdits(sourceVolume||volume);
 const enabled=$('[data-seg-enabled="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]');
 if(enabled)enabled.checked=false;if(removeBtn)removeBtn.disabled=true;
 renderSegmentPresets();clearAnalysisHighlight();renderAll();scheduleSegment3D();
}
segmentAddButton.onclick=()=>addSegmentPreset(segmentAddSelect.value);
analysisMergeButton.onclick=()=>void mergeSelectedAnalysisRegions();
analysisClearButton.onclick=()=>clearAnalysisHighlight();
analysisNavigateButton.onclick=()=>{if(analysisCutApplying||analysisPendingCut)return;setAnalysisEditTool('select');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);setAnalysisCutStroke(null);setAnalysisCutScreen([]);clearThreeEditOverlay();updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'通常操作':'Navigate');request3DRender()};
analysisSelectRegionButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut||analysisEditPreparing)return;if(analysisEditTool==='region'){setAnalysisEditTool('select');updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'通常操作':'Navigate');return}setAnalysisEditPreparing(true);setAnalysisEditTool('region');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateAnalysisEditorControls();try{if(threeRenderMode==='surface')await ensureGpuResidentCpuPositions(null,currentLanguage==='ja'?'領域選択データを準備中':'Preparing region selection');updateThreeEditUi(tr('editRegionHint'))}catch(e){setAnalysisEditTool('select');console.error(e);footer.textContent=(currentLanguage==='ja'?'領域選択の準備に失敗しました: ':'Region selection preparation failed: ')+String(e.message||e)}finally{setAnalysisEditPreparing(false);updateAnalysisEditorControls()}};
analysisLassoButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut||analysisEditPreparing)return;if(analysisEditTool==='lasso'){setAnalysisEditTool('select');updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'通常操作':'Navigate');return}setAnalysisEditTool('lasso');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateAnalysisEditorControls();updateThreeEditUi(tr('editLassoHint'))};
analysisCutButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut||analysisEditPreparing)return;if(analysisEditTool==='pen'){setAnalysisEditTool('select');updateAnalysisEditorControls();return}setAnalysisEditPreparing(true);setAnalysisEditTool('pen');updateAnalysisEditorControls();try{if(threeRenderMode==='surface')await ensureEditRaycastReady(null,currentLanguage==='ja'?'3D編集データを準備中':'Preparing 3D edit data');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateThreeEditUi(tr('editPenHint'))}catch(e){setAnalysisEditTool('select');console.error(e);footer.textContent='3D edit preparation error: '+String(e.message||e)}finally{setAnalysisEditPreparing(false);updateAnalysisEditorControls()}};
analysisLineCutButton.onclick=async()=>{if(analysisCutApplying||analysisPendingCut||analysisEditPreparing)return;if(analysisEditTool==='line'){setAnalysisEditTool('select');updateAnalysisEditorControls();return}setAnalysisEditPreparing(true);setAnalysisEditTool('line');updateAnalysisEditorControls();try{if(threeRenderMode==='surface')await ensureEditRaycastReady(null,currentLanguage==='ja'?'3D編集データを準備中':'Preparing 3D edit data');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateThreeEditUi(tr('editLineHint'))}catch(e){setAnalysisEditTool('select');console.error(e);footer.textContent='3D edit preparation error: '+String(e.message||e)}finally{setAnalysisEditPreparing(false);updateAnalysisEditorControls()}};
analysisEditTargetSelect.onchange=()=>{if(analysisCutApplying)return;const next=analysisEditTargetSelect.value;setAnalysisEditTargetMode(next);if(analysisPendingCut){if(next==='auto')setAnalysisEditTargetKey(analysisPendingCut.key||null);else{setAnalysisEditTargetKey(next);analysisPendingCut.key=next}}else setAnalysisEditTargetKey(next==='auto'?null:next);updateAnalysisEditorControls();updateThreeEditUi();request3DRender()};
analysisEditRemoveSelected.onclick=()=>void applyEditRemoveSelected();
analysisRemoveSelected.onclick=()=>void applyEditRemoveSelected();
analysisKeepSelected.onclick=()=>void applyEditKeepSelected();
analysisUndo.onclick=()=>void undoSegmentEdit();
analysisRedo.onclick=()=>void redoSegmentEdit();
analysisResetEdit.onclick=()=>void resetFocusedSegmentEdit();
function configureCutControlRanges(v=current3DVolume||volume){
 if(!v||!analysisCutWidth)return;
 const [sx,sy,sz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,dims=[w*sx,h*sy,d*sz],diag=Math.hypot(...dims),minSpacing=Math.min(sx,sy,sz),minDim=Math.min(...dims);
 const clamp=(el,min,max,step)=>{el.min=String(min);el.max=String(max);el.step=String(step);el.value=String(Math.max(min,Math.min(max,+el.value)))};
 const widthMax=Math.max(2,Math.min(8,minDim*.22));
 clamp(analysisCutWidth,0,widthMax,.05);
 clamp(analysisCutDepth,Math.max(.1,minSpacing*.5),Math.max(5,diag),.1);
 clamp(analysisCutYaw,-90,90,.25);clamp(analysisCutPitch,-90,90,.25);
 const offsetMax=Math.max(5,diag*.6);clamp(analysisCutOffset,-offsetMax,offsetMax,.1);
}
function cutWidthMm(){
 const value=Number(analysisCutWidth?.value);return Number.isFinite(value)?Math.max(0,value):.8;
}
function refreshCutControlReadouts(){
 analysisCutWidthValue.value=cutWidthMm().toFixed(2)+' mm';
 analysisCutDepthValue.value=(+analysisCutDepth.value).toFixed(1)+' mm';
 analysisCutYawValue.value=(+analysisCutYaw.value).toFixed(1)+'°';
 analysisCutPitchValue.value=(+analysisCutPitch.value).toFixed(1)+'°';
 analysisCutOffsetValue.value=(+analysisCutOffset.value).toFixed(1)+' mm';
}
const onCutControlInput=()=>{
 refreshCutControlReadouts();updateThreeEditUi();
 if(cutControlPreviewRaf)cancelAnimationFrame(cutControlPreviewRaf);
 setCutControlPreviewRaf(requestAnimationFrame(()=>{
  setCutControlPreviewRaf(0);
  updateCutPreview(sceneState?.editCutPreviewPoint);
  if(analysisPendingCut&&threeRenderMode==='volume'&&sceneState?.medicalVolume?.active)scheduleCutResultPreview(0);
  request3DRender();
 }));
};
for(const control of [analysisCutWidth,analysisCutDepth,analysisCutYaw,analysisCutPitch,analysisCutOffset]){
 control.oninput=onCutControlInput;
 control.onchange=onCutControlInput;
 control.onpointermove=e=>{if(e.buttons||e.pointerType==='touch'||e.pointerType==='pen')onCutControlInput()};
}
analysisCutApply.onclick=async()=>{if(!analysisPendingCut||analysisCutApplying)return;const pending=analysisPendingCut;setAnalysisPendingCut(null);setAnalysisCutApplying(true);setAnalysisCutStroke(null);setAnalysisCutScreen([]);clearThreeEditOverlay();if(sceneState)sceneState.editCutPreviewPoint=null;updateCutPreview(null);updateAnalysisEditorControls();updateThreeEditUi(currentLanguage==='ja'?'切断を反映中…':'Applying cut…');let ok=false;try{ok=await applyCutStroke(pending.points,pending.key,pending.mode)}finally{clearCutResultPreview();setAnalysisCutApplying(false);setAnalysisEditTool('select');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);if(sceneState)sceneState.editCutPreviewPoint=null;updateAnalysisEditorControls();const ready=ok?(currentLanguage==='ja'?'切断を反映しました · 操作モードに戻りました':'Cut applied · returned to Navigate'):(currentLanguage==='ja'?'切断結果を確認してください · 操作モードに戻りました':'Check cut result · returned to Navigate');updateThreeEditUi(ready);request3DRender()}};
analysisCutCancel.onclick=()=>{if(analysisCutApplying)return;setAnalysisPendingCut(null);setAnalysisCutStroke(null);setAnalysisCutScreen([]);clearThreeEditOverlay();clearCutResultPreview();if(sceneState)sceneState.editCutPreviewPoint=null;updateCutPreview(null);setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateAnalysisEditorControls();returnToNavigate();updateThreeEditUi(currentLanguage==='ja'?'切断をキャンセルしました':'Cut cancelled');request3DRender()};
analysisExportSelected.onclick=()=>void exportFocusedAnalysisRegionStl();
renderModeToggle.onclick=async()=>{
 if(threeRenderMode==='volume'){
  deactivateMedicalVolume();
  if(!current3DVolume||threeDDirty||surfaceRebuildPending.value)await rebuildCurrent3D();
  if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj);request3DRender()}
 }else await activateMedicalVolume();
};
sectionViewToggle.onclick=()=>{if(!volume)return;setSectionViewOpen(!sectionViewOpen);if(!sectionViewOpen)clearSectionView();else{requestIPadSettingsTab('display');updateSectionViewUi()}};
document.querySelectorAll('[data-section-view]').forEach(button=>button.addEventListener('click',()=>setSectionView(button.dataset.sectionView)));
sectionReverse.onclick=()=>{if(!sectionViewPlane)return;setSectionViewReverse(!sectionViewReverse);if(threeRenderMode!=='volume'){updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();syncSectionClipParent();applySectionClippingMaterials(sceneState?.obj)}updateSectionViewUi();request3DRender()};
sectionPosition.oninput=()=>{if(!sectionViewPlane)return;const p=sectionViewPlane,idx=Math.max(0,Math.min(+planes[p].slider.max,+sectionPosition.value));planes[p].slider.value=idx;planes[p].label.textContent=idx+1;updateMpr3DPlanePositions();if(threeRenderMode!=='volume'){updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup()}updateSectionViewUi();request3DRender();if(threeRenderMode!=='volume')renderSectionPlaneLive(p)};
sectionPosition.onchange=()=>{if(sectionViewPlane)renderSectionPlaneLive(sectionViewPlane)};
volumeAnalysisToggle.onclick=async()=>{
 if(!volume)return;
 if(volumeAnalysisMode){
  setVolumeAnalysisMode(false);
  volumeAnalysisToggle.disabled=false;
  volumeAnalysisToggle.textContent=tr('volumeMode');
  volumeAnalysisToggle.classList.remove('is-active');
  volumeAnalysisResult.classList.add('is-hidden');
  clearAnalysisHighlight();
  return;
 }
 volumeAnalysisToggle.disabled=true;
 try{
  if(threeRenderMode!=='volume')await ensureGpuResidentCpuPositions(null,currentLanguage==='ja'?'体積解析用データを取得中':'Preparing volume analysis');
  if(!volume)return;
  setVolumeAnalysisMode(true);
  scheduleAnalysisRunPrewarm();
  requestIPadSettingsTab('display');
  volumeAnalysisToggle.textContent=tr('volumeOff');
  volumeAnalysisToggle.classList.add('is-active');
  volumeAnalysisResult.classList.remove('is-hidden');
  renderAnalysisResults();
 }catch(e){
  console.error(e);footer.textContent=(currentLanguage==='ja'?'体積解析の準備に失敗しました: ':'Volume analysis preparation failed: ')+String(e.message||e);
 }finally{
  volumeAnalysisToggle.disabled=volumeAnalysisMode?false:!(threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active||!threeDDirty&&!!sceneState?.obj&&threeRenderMode==='surface');
 }
};
// iPadOS Safari: once a file picker opened with input.click() is cancelled,
// clicking the same <input> again may not reopen it. Swap in a fresh clone
// (same id/attributes/handler) before every open. Handlers read e.target, not
// the original element.
const filePickers={folder:folderInput,project:projectInput};
function openFilePicker(name){
 const old=filePickers[name],fresh=old.cloneNode(false);
 fresh.onchange=old.onchange;old.replaceWith(fresh);filePickers[name]=fresh;
 fresh.value='';fresh.click();
}
folderBtn.onclick=()=>openFilePicker('folder');
// A project file (.vrlab) inside the chosen DICOM folder is applied
// automatically: the newest one is loaded, the matching series is selected,
// and selectSeries applies the pending project once the volume is ready.
// (Browsers cannot open files a user did not pick, so this is the one-step
// way to reopen data + project, on iPad as well.)
folderInput.onchange=async e=>{
 const all=[...(e.target.files||[])];if(!all.length)return;
 const found=[],rel=f=>f.webkitRelativePath||f.name;
 // archives: .vrlab, or *.zip (Safari/iOS may append .zip); others are skipped
 for(const f of all.filter(f=>isProjectArchiveName(f.name)&&f.size<200*2**20)){
  try{found.push({parsed:unpackProject(new Uint8Array(await f.arrayBuffer())),name:f.name,time:f.lastModified,used:[f]})}catch{}
 }
 // extracted archives (tapping the zip in the iOS Files app): project.json + edits/
 for(const pj of all.filter(f=>f.name==='project.json')){
  const dir=rel(pj).slice(0,rel(pj).length-'project.json'.length),members=all.filter(f=>f===pj||(rel(f).startsWith(dir)&&/^edits\//.test(rel(f).slice(dir.length))));
  try{const entries=await Promise.all(members.map(async f=>({path:rel(f),bytes:new Uint8Array(await f.arrayBuffer())})));found.push({parsed:projectFromEntries(entries),name:(dir.replace(/\/$/,'').split('/').pop()||'project.json'),time:pj.lastModified,used:members})}catch{}
 }
 found.sort((a,b)=>b.time-a.time);
 const used=new Set(found.flatMap(x=>x.used)),files=all.filter(f=>!used.has(f));
 const chosen=found[0]||null;if(chosen)pendingProject.value=chosen.parsed;
 await inspect(files,false);
 if(!chosen||!pendingProject.value)return;
 const ds=pendingProject.value.project.dataset,match=detectedSeries.list.find(s=>compareFingerprints(ds,datasetFingerprint(s)).ok);
 const ja=currentLanguage==='ja',others=found.length>1?(ja?'（'+found.length+'件中、最新を使用）':' (newest of '+found.length+')'):'';
 if(match){footer.textContent=(ja?'フォルダ内のプロジェクトを適用します: ':'Applying project from the folder: ')+chosen.name+others;await selectSeries(match)}
 else footer.textContent=(ja?'フォルダ内のプロジェクト（':'The project in the folder (')+chosen.name+(ja?'）はこのフォルダのシリーズと一致しません':') does not match any series in this folder');
};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('demoLoading')+'</strong><span>'+tr('demoSize')+'</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>'+tr('demoFailed')+'</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=()=>{renderMainMprPreview();if(threeRenderMode==='volume')request3DRender()};
wc.onchange=ww.onchange=()=>renderAll();
ctRangeAuto.onclick=()=>applyCtRangeMode('auto');
ctRangeFull.onclick=()=>applyCtRangeMode('full');
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderMainMprPreview();scheduleSegment3D()};
 color.onchange=()=>renderAll();
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 min.onchange=max.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');renderAll()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 opacity.onchange=()=>renderAll();
 const invalidateSegment=(full=false)=>{segmentState[key]._maskCache=null;segmentState[key]._maskCacheKey='';clearSegmentEditCache(key,false);clearAnalysisHighlight();if(full)renderAll();else renderMainMprPreview();scheduleSegment3D();if(full&&volume?.sourceBacked&&segmentNeedsGlobalMask(segmentState[key]))void prepareSourceSegmentPostprocess(key)};
 opening.oninput=()=>{segmentState[key].opening=+opening.value;$('[data-seg-opening-out="'+key+'"]').value=opening.value;invalidateSegment(false)};
 opening.onchange=()=>invalidateSegment(true);
 closing.oninput=()=>{segmentState[key].closing=+closing.value;$('[data-seg-closing-out="'+key+'"]').value=closing.value;invalidateSegment(false)};
 closing.onchange=()=>invalidateSegment(true);
 minComponent.oninput=()=>{segmentState[key].minComponent=+minComponent.value;$('[data-seg-min-component-out="'+key+'"]').value=minComponent.value;invalidateSegment(false)};
 minComponent.onchange=()=>invalidateSegment(true);
 holeFill.onchange=()=>{segmentState[key].holeFill=holeFill.checked;invalidateSegment(true)};
 exportBtn.onclick=()=>void exportSegmentStl(key);
 removeBtn.onclick=()=>removeSegmentPreset(key);
}
async function prepareSourceSegmentPostprocess(key){
 const v=current3DVolume||volume;if(!v?.sourceBacked||!segmentState[key]?.active||!segmentState[key]?.enabled||!segmentNeedsGlobalMask(segmentState[key]))return;
 try{
  await ensureSegmentBaseRuns(key,v);
  if(sceneState?.obj)await refreshEditedSegmentSurface(key,v);
  renderAll();footer.textContent=currentLanguage==='ja'?(tr(key)||key)+'のセグメント処理を更新しました':'Updated segment processing for '+(tr(key)||key);
 }catch(e){if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent='Segment processing error: '+String(e.message||e)}}
}
function markSmoothingSettingsChanged(){
 clearTimeout(smoothingRefreshTimer);setSmoothingRefreshTimer(null);
 mark3DStale();
}
surfaceSmoothEnabled.onchange=()=>{
 surfaceSmoothStrength.disabled=!surfaceSmoothEnabled.checked||!volume;
 markSmoothingSettingsChanged();
};
surfaceSmoothStrength.oninput=()=>{
 surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);
 markSmoothingSettingsChanged();
};
surfaceSmoothStrength.onchange=()=>{
 surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);
 markSmoothingSettingsChanged();
};
const liveFilterState={timer:null,base:null,key:null};
function beginLiveFilter(key){
 if(!volume)return;
 if(liveFilterState.key!==key||!liveFilterState.base){
  liveFilterState.key=key;
  liveFilterState.base=volume;
 }
}
function scheduleLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 liveFilterState.timer=setTimeout(()=>void fn(liveFilterState.base),260);
}
function finishLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 void fn(liveFilterState.base).finally(()=>{
  if(liveFilterState.key===key){liveFilterState.base=null;liveFilterState.key=null}
 });
}
function bindLiveSlider(input,output,key,fn){
 input.addEventListener('pointerdown',()=>beginLiveFilter(key));
 input.addEventListener('input',()=>{
  output.value=(+input.value).toFixed(2);
  scheduleLiveFilter(key,fn);
 });
 input.addEventListener('change',()=>finishLiveFilter(key,fn));
}
function renderFilterOrder(){
 if(!filterControlList)return;
 const active=new Set(filterOrder);
 for(const key of FILTER_CATALOG_ORDER){
  const card=filterControlList.querySelector('[data-filter-key="'+key+'"]');
  if(!card)continue;
  card.classList.toggle('is-hidden',!active.has(key));
  if(active.has(key))filterControlList.insertBefore(card,resetFilterBtn);
 }
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  const key=card.dataset.filterKey,index=filterOrder.indexOf(key);
  const up=card.querySelector('[data-filter-move="up"]'),down=card.querySelector('[data-filter-move="down"]');
  if(up)up.disabled=index<=0;
  if(down)down.disabled=index<0||index>=filterOrder.length-1;
 }
 for(const option of filterAddSelect.options)option.disabled=active.has(option.value);
 const next=[...filterAddSelect.options].find(o=>!o.disabled);
 if(next)filterAddSelect.value=next.value;
 filterAddButton.disabled=!next;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function addFilter(key){
 if(!FILTER_CATALOG_ORDER.includes(key)||filterOrder.includes(key))return;
 filterOrder.push(key);
 filterState[key]=true;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=true;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function removeFilter(key){
 const index=filterOrder.indexOf(key);if(index<0)return;
 filterOrder.splice(index,1);filterState[key]=false;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=false;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function moveFilter(key,delta){
 const from=filterOrder.indexOf(key),to=from+delta;
 if(from<0||to<0||to>=filterOrder.length)return;
 [filterOrder[from],filterOrder[to]]=[filterOrder[to],filterOrder[from]];
 renderFilterOrder();
 if(sourceVolume&&filterOrder.length)scheduleFilterRebuild(0);
}
function installFilterReorder(){
 if(!filterControlList)return;
 filterAddButton.addEventListener('click',()=>addFilter(filterAddSelect.value));
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  card.querySelector('[data-filter-move="up"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,-1));
  card.querySelector('[data-filter-move="down"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,1));
  card.querySelector('[data-filter-remove]')?.addEventListener('click',()=>removeFilter(card.dataset.filterKey));
  let draggedKey=null;
  card.addEventListener('dragstart',e=>{
   draggedKey=card.dataset.filterKey;card.classList.add('is-dragging');
   if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedKey)}
  });
  card.addEventListener('dragend',()=>{draggedKey=null;card.classList.remove('is-dragging')});
  card.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'});
  card.addEventListener('drop',e=>{
   e.preventDefault();
   const fromKey=draggedKey||e.dataTransfer?.getData('text/plain'),targetKey=card.dataset.filterKey;
   if(!fromKey||fromKey===targetKey)return;
   const from=filterOrder.indexOf(fromKey),to=filterOrder.indexOf(targetKey);
   if(from<0||to<0)return;
   filterOrder.splice(from,1);filterOrder.splice(to,0,fromKey);
   renderFilterOrder();
   if(sourceVolume)scheduleFilterRebuild(0);
  });
 }
 renderFilterOrder();
}
function syncFilterControls(){
 gaussianStrength.disabled=!sourceVolume||!filterState.gaussian;
 spatialPasses.disabled=!sourceVolume||!filterState.gaussian;
 smoothingType.disabled=!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=!sourceVolume||!filterState.spikeHole;
 spikeHoleThreshold.disabled=!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=!sourceVolume||!filterState.nlm;
 nlmSearchRadius.disabled=!sourceVolume||!filterState.nlm;
 nlmPatchRadius.disabled=!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=!sourceVolume||!filterState.anisotropic;
 anisotropicIterations.disabled=!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=!sourceVolume||!filterState.sigmoid;
 sigmoidCenter.disabled=!sourceVolume||!filterState.sigmoid;
 bilateralStrength.disabled=!sourceVolume||!filterState.bilateral;bilateralSpatial.disabled=!sourceVolume||!filterState.bilateral;bilateralIntensity.disabled=!sourceVolume||!filterState.bilateral;bilateralPasses.disabled=!sourceVolume||!filterState.bilateral;
 tvWeight.disabled=!sourceVolume||!filterState.tv;tvIterations.disabled=!sourceVolume||!filterState.tv;
 unsharpRadius.disabled=!sourceVolume||!filterState.unsharp;unsharpAmount.disabled=!sourceVolume||!filterState.unsharp;unsharpThreshold.disabled=!sourceVolume||!filterState.unsharp;
 gaussianBtn.disabled=!sourceVolume;smoothingType.disabled=!sourceVolume||!filterState.gaussian;spikeHoleBtn.disabled=!sourceVolume;nlmBtn.disabled=!sourceVolume;anisotropicBtn.disabled=!sourceVolume;sigmoidBtn.disabled=!sourceVolume;bilateralBtn.disabled=!sourceVolume;tvBtn.disabled=!sourceVolume;unsharpBtn.disabled=!sourceVolume;
 gaussianBtn.checked=filterState.gaussian;spikeHoleBtn.checked=filterState.spikeHole;nlmBtn.checked=filterState.nlm;anisotropicBtn.checked=filterState.anisotropic;sigmoidBtn.checked=filterState.sigmoid;bilateralBtn.checked=filterState.bilateral;tvBtn.checked=filterState.tv;unsharpBtn.checked=filterState.unsharp;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function scheduleFilterRebuild(delay=120){
 clearTimeout(filterRebuildTimer);clearMemoryFilterPreviewCache();mark3DStale();
 const finalize3D=!(sourceVolume?.sourceBacked)||delay===0;
 setFilterRebuildTimer(setTimeout(()=>{setFilterRebuildTimer(null);void rebuildActiveFilters(finalize3D)},delay));
}
async function rebuildActiveFilters(finalize3D=true){
 if(!sourceVolume)return;
 const revision=incFilterRebuildRevision(true);
 clearTimeout(liveFilterState.timer);liveFilterState.base=null;liveFilterState.key=null;
 if(sourceVolume.sourceBacked){
  invalidateSourceFilters();setVolume(sourceVolume);scheduleSourceMprWarmup();setProcessingBusy(true,'Full-resolution filters',false);
  try{
   const mainKey=currentMainViewKey(),previewPlane=planes[mainKey]?mainKey:'axial';
   await renderPlane(previewPlane,++planeRenderRevision[previewPlane],+planes[previewPlane].slider.value);
   if(revision!==filterRebuildRevision)return;
   mark3DStale();
   footer.textContent=filterOrder.length?'Full-resolution filters · '+gpuFilterRuntime.lastBackend+' · '+filterOrder.length+' stage(s)':tr('original');
  }finally{setProcessingBusy(false,'Full-resolution filters',false);syncFilterControls()}
  if(applyVolumeAfterFilterRebuild.value&&revision===filterRebuildRevision){applyVolumeAfterFilterRebuild.value=false;void refreshGpuVolumeData()}
  return;
 }
 let base=sourceVolume;
 setDeferAutomatic3D(true);
 try{
  const stages=sourceFilterStages();
  if(!stages.length){
   setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();setVolume(sourceVolume);renderAll();mark3DStale();footer.textContent=tr('original');return;
  }
  if(gpuStagesSupported(stages)&&!hasGlobalSegmentProcessing()){
   setMemoryGpuPreviewActive(true);clearMemoryFilterPreviewCache();setVolume(sourceVolume);setProcessingBusy(true,'WebGPU preview',false);
   try{
    const mainKey=currentMainViewKey(),previewPlane=planes[mainKey]?mainKey:'axial';
    await renderPlane(previewPlane,++planeRenderRevision[previewPlane],+planes[previewPlane].slider.value);
    if(revision!==filterRebuildRevision)return;
    mark3DStale();footer.textContent='2D preview · WEBGPU COMPUTE · '+stages.length+' stage(s)';return;
   }catch(e){
    if(String(e.message||e)==='__SUPERSEDED__')return;
    setMemoryGpuPreviewActive(false);console.warn('In-memory WebGPU preview unavailable; using CPU stack.',e);
   }finally{setProcessingBusy(false,'WebGPU preview',false)}
  }
  setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();
  for(const key of filterOrder){
   if(!filterState[key])continue;
   await applyCpuFilter(key,base);
   if(revision!==filterRebuildRevision)return;
   base=volume;
  }
  if(!filterOrder.length){
   setVolume(sourceVolume);renderAll();render3D(volume);footer.textContent=tr('original');
  }
 }finally{setDeferAutomatic3D(false);mark3DStale();syncFilterControls()}
}
smoothingType.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
for(const [input,output,key] of [[spikeHoleStrength,spikeHoleStrengthValue,'spikeHole'],[nlmStrength,nlmStrengthValue,'nlm'],[anisotropicStrength,anisotropicStrengthValue,'anisotropic'],[gaussianStrength,gaussianStrengthValue,'gaussian'],[sigmoidStrength,sigmoidStrengthValue,'sigmoid']]){
 input.oninput=()=>{output.value=(+input.value).toFixed(2);if(filterState[key])scheduleFilterRebuild(360)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
sigmoidCenter.oninput=()=>{sigmoidCenterValue.value=Math.round(+sigmoidCenter.value);if(filterState.sigmoid)scheduleFilterRebuild(360)};
sigmoidCenter.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');if(filterState.sigmoid)scheduleFilterRebuild(0)};
spikeHoleThreshold.oninput=()=>{spikeHoleThresholdValue.value=(+spikeHoleThreshold.value).toFixed(3);if(filterState.spikeHole)scheduleFilterRebuild(360)};
spikeHoleThreshold.onchange=()=>{if(filterState.spikeHole)scheduleFilterRebuild(0)};
anisotropicIterations.oninput=()=>{anisotropicIterationsValue.value=Math.round(+anisotropicIterations.value);if(filterState.anisotropic)scheduleFilterRebuild(360)};
anisotropicIterations.onchange=()=>{if(filterState.anisotropic)scheduleFilterRebuild(0)};
spatialPasses.oninput=()=>{spatialPassesValue.value=Math.round(+spatialPasses.value);if(filterState.gaussian)scheduleFilterRebuild(360)};
spatialPasses.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
nlmSearchRadius.oninput=()=>{nlmSearchRadiusValue.value=Math.round(+nlmSearchRadius.value);if(filterState.nlm)scheduleFilterRebuild(380)};
nlmSearchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};
nlmPatchRadius.oninput=()=>{nlmPatchRadiusValue.value=Math.round(+nlmPatchRadius.value);if(filterState.nlm)scheduleFilterRebuild(380)};
nlmPatchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};

for(const [input,output,key,digits] of [
 [bilateralStrength,bilateralStrengthValue,'bilateral',2],[bilateralSpatial,bilateralSpatialValue,'bilateral',2],[bilateralIntensity,bilateralIntensityValue,'bilateral',2],
 [tvWeight,tvWeightValue,'tv',2],[unsharpAmount,unsharpAmountValue,'unsharp',2],[unsharpThreshold,unsharpThresholdValue,'unsharp',2]
]){
 input.oninput=()=>{output.value=(+input.value).toFixed(digits);if(filterState[key])scheduleFilterRebuild(380)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
for(const [input,output,key] of [[bilateralPasses,bilateralPassesValue,'bilateral'],[tvIterations,tvIterationsValue,'tv'],[unsharpRadius,unsharpRadiusValue,'unsharp']]){
 input.oninput=()=>{output.value=Math.round(+input.value);if(filterState[key])scheduleFilterRebuild(380)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
resetFilterBtn.onclick=()=>{filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;smoothingType.value='gaussian';setFilterOrder([]);for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();syncFilterControls();resetProcessing()};
filterRebuild3D.onclick=()=>{if(threeDApplying)cancel3DRebuild();else void rebuildCurrent3D()};
threeBusyCancel.onclick=()=>cancel3DRebuild();
installFilterReorder();

// While a filtered plane's slider moves, show something at once instead of
// waiting for per-slice GPU filtering (owner choice A + caches, build 214),
// best first:
//  1. the filtered slice already computed at full resolution (2D filter caches)
//  2. the GPU volume texture when it holds the current filters (CPU preview copy;
//     not available with the reduced iPad plan)
//  3. the low-res 3D preview cache (filtered if built for these filters)
//  4. the original data (source MPR memory cache / low-res preview)
// The full-resolution filtered slice is computed when the slider is released.
// Slice sliders for planes shown in the 3D view: in 3D-only layouts the 2D
// cards (and their sliders) are hidden, so these drive the real plane sliders.
mpr3DSlicePanelReady.value=true;
$('#mpr3d-opacity')?.addEventListener('input',e=>{const src=mpr3DOpacitySource();if(!src)return;src.value=e.target.value;src.dispatchEvent(new Event('input'));syncMpr3DSliceSliders()});
for(const[p,el]of Object.entries(mpr3DSliceSliders)){
 if(!el)continue;
 const toReal=()=>String(+planes[p].slider.max-(+el.value)); // reversed direction
 el.addEventListener('input',()=>{planes[p].slider.value=toReal();planes[p].slider.dispatchEvent(new Event('input'))});
 el.addEventListener('change',()=>{planes[p].slider.value=toReal();planes[p].slider.dispatchEvent(new Event('change'))});
}
function renderSectionPlaneLive(p){
 if(!volume||!planes[p])return;
 cancelSourceMprWarmup();clearTimeout(planeRenderTimers[p]);planeRenderTimers[p]=null;
 const idx=+planes[p].slider.value,revision=++planeRenderRevision[p];planes[p].label.textContent=idx+1;
 if(p==='coronal'||p==='sagittal')pushCachedMpr3DPlane(p,idx);
 if(paintFastOrthogonalPreview(p,idx))return;
 void renderPlane(p,revision,idx).catch(e=>{if(String(e.message||e)!=='__SUPERSEDED__'){console.warn('Live section render failed.',e);footer.textContent='MPR error: '+String(e.message||e)}});
}
for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>schedulePlaneRender(p);planes[p].slider.onchange=()=>{if(p==='coronal'||p==='sagittal')mpr3DOrthoSliding[p]=false;schedulePlaneRender(p,true)};installMprTouch(p)}

async function loadDemo(){
 let response=null,fromCache=false,cache=null;
 progLabel.textContent='Cache check…';
 bar.style.width='0%';

 if('caches' in window){
  try{
   cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
   if(cache){
    response=await withTimeout(cache.match(DEMO_URL),1200,null);
    if(response){fromCache=true;footer.textContent=tr('demoCache');}
   }
  }catch(e){
   console.warn('Cache lookup skipped.',e);
  }
 }

 if(!response){
  progLabel.textContent='接続中…';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   response=await fetch(DEMO_URL,{mode:'cors',credentials:'omit',signal:controller.signal,cache:'no-store'});
  }finally{
   clearTimeout(timeout);
  }
 }

 if(!response||!response.ok)throw new Error('Demo download failed: HTTP '+(response?.status??'unknown'));

 const reader=response.body?.getReader();let bytes;
 if(reader){
  const chunks=[];let n=0;
  while(true){
   const q=await reader.read();if(q.done)break;if(!q.value)continue;
   chunks.push(q.value);n+=q.value.byteLength;
   byteProgress(n,DEMO_SIZE,fromCache?'Cache':'Download');
  }
  bytes=new Uint8Array(n);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.byteLength}
 }else{
  bytes=new Uint8Array(await response.arrayBuffer());
  byteProgress(bytes.byteLength,bytes.byteLength,fromCache?'Cache':'Download');
 }

 if(!fromCache&&cache){
  const copy=bytes.slice();
  cache.put(DEMO_URL,new Response(copy,{headers:{'Content-Type':'application/zip','Content-Length':String(copy.byteLength)}}))
   .then(()=>updateDemoCacheBadge())
   .catch(e=>console.warn('Demo cache save failed.',e));
 }

 byteProgress(bytes.byteLength,bytes.byteLength,'Unzip');
 const entries=await new Promise((res,rej)=>unzip(bytes,(e,f)=>e?rej(e):res(f)));
 const out=[];for(const [path,b] of Object.entries(entries)){if(path.endsWith('/')||!b.byteLength)continue;out.push(new File([b],path.split('/').pop()||path))}
 footer.textContent=fromCache?tr('demoCache'):tr('demoDone');
 return out;
}
async function updateDemoCacheBadge(){
 if(!('caches' in window))return;
 try{
  const cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
  if(cache&&await withTimeout(cache.match(DEMO_URL),1200,null))demoBtn.textContent='公開マウスCTデモ ✓';
 }catch{}
}
void updateDemoCacheBadge();
async function inspect(files,auto){
 setActiveId(null);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('dicomChecking')+'</strong><span>'+tr('pixelDeferred')+'</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>'+tr('noSeries')+'</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}



const detectedSeries={list:[]};
function renderSeries(series){detectedSeries.list=series;list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.decodedBytes)+' · '+(s.sourceBacked?'フル解像度・ストリーミング':(s.compact?'Int16':'Float32'))+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

// Workspace UI (built for iPad) is also used on desktop Mac by owner request.
// Layout only: performance settings (texture plan, cache limits) stay keyed to
// isIPadRuntime(). URL override: ?ui=classic (old desktop UI) / ?ui=workspace.
function useWorkspaceUi(){
 const q=new URLSearchParams(location.search).get('ui');
 if(q==='classic')return false;if(q==='workspace')return true;
 return isIPadRuntime()||isDesktopMac();
}
function requestIPadSettingsTab(tab){
 if(!useWorkspaceUi())return;
 document.dispatchEvent(new CustomEvent('vrl-ipad-settings-tab',{detail:{tab}}));
}


async function selectSeries(s){
 setActiveId(s.id);setActiveSeries(s);clear3DForSeriesChange();projectSaveBtn.disabled=true;
 requestIPadSettingsTab('display');
 for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);
 selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+(s.sourceBacked?' · full resolution':'')+'</span><span class="ready-badge">CT volume loading…</span>';
 prog.classList.remove('is-hidden');busy(true);let phase='decode';
 try{
  invalidateSourceFilters();
  setSourceVolume(s.sourceBacked?openSourceBackedVolume(s):await decode(s,(x,y)=>progress(x,y)));
  setVolume(sourceVolume);phase='configure';configure(volume);enableProcessingControls(true);scheduleGpuPrewarm();
  let gpuResident=false;
  if(s.sourceBacked){
   const badge=selected.querySelector('.ready-badge');if(badge)badge.textContent='GPU volume…';
   gpuResident=await prepareResidentGpuVolume(sourceVolume);
   if(!gpuResident){
    if(badge)badge.textContent='MPR cache…';
    await prepareSourceMprCache(sourceVolume,(x,y)=>{progress(x,y);const b=selected.querySelector('.ready-badge');if(b)b.textContent='MPR cache '+x+' / '+y});
   }
  }
  const badge=selected.querySelector('.ready-badge');
  if(!gpuResident){if(badge)badge.textContent='3D C/S cache…';await ensureMpr3DPreviewCache()}
  phase='render';renderAll();mark3DStale();
  if(gpuResident){await activateMedicalVolume();mark3DCurrent()}
  if(badge)badge.textContent=s.sourceBacked?(gpuResident?'CT source ready · GPU volume':(volume.mprData?'CT source ready · MPR cached':'CT source ready · streaming MPR')):'CT volume ready · 2D ready';
  footer.textContent=s.sourceBacked?(gpuResident?'Full-resolution source DICOM · GPU-resident MPR':(volume.mprData?'Full-resolution source DICOM · MPR memory cache '+fmt(volume.mprData.byteLength):'Full-resolution source-backed DICOM · streaming MPR')):'CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · '+volume.data.constructor.name+' '+fmt(volume.data.byteLength);
  projectSaveBtn.disabled=false;syncMpr3DSliceSliders();void applyPendingProject();
 }catch(e){
  console.error(e);const label=phase==='decode'?'Decode failed':phase==='configure'?'Configure failed':'Render failed';
  selected.querySelector('.ready-badge').textContent=label;footer.textContent=label+': '+String(e.message||e)
 }finally{prog.classList.add('is-hidden');busy(false);set3DBusy(false)}
}
function openSourceBackedVolume(s){
 return{data:null,mprData:null,mprPlaneBuffers:null,mprSagittalDisplayAll:null,mprSagittalDisplayBuffer:null,mprSagittalDisplayMin:null,mprSagittalDisplayMax:null,sourceBacked:true,series:s,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min:s.min,max:s.max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:'DICOM source'};
}
function initIPadWorkspaceUi(){
 if(!useWorkspaceUi())return;
 const shell=document.querySelector('.app-shell'),workspace=document.querySelector('.workspace'),sidebar=document.querySelector('.sidebar'),sidebarScroll=document.querySelector('.sidebar-scroll'),viewer=document.querySelector('#viewer-grid'),topbar=document.querySelector('.topbar');
 if(!shell||!workspace||!sidebar||!sidebarScroll||!viewer||!topbar)return;
 document.documentElement.classList.add('vrl-ipad-ui','ipad-settings-persistent');
 shell.classList.add('ipad-mode-3d');

 const toolbar=document.createElement('div');
 toolbar.id='ipad-workspace-toolbar';toolbar.className='ipad-workspace-toolbar';
 toolbar.innerHTML='<div class="ipad-view-modes" role="group" aria-label="View mode"><button type="button" class="is-active" data-ipad-view-mode="3d" data-i18n="ipadView3d">3D</button><button type="button" data-ipad-view-mode="2d" data-i18n="ipadView2d">2D</button><button type="button" data-ipad-view-mode="split" data-i18n="ipadViewSplit">分割</button></div><div class="ipad-mpr-tabs" role="tablist" aria-label="MPR plane"><button type="button" class="is-active" data-ipad-mpr="axial">Axial</button><button type="button" data-ipad-mpr="coronal">Coronal</button><button type="button" data-ipad-mpr="sagittal">Sagittal</button></div>';
 topbar.after(toolbar);

 const settingsHead=document.createElement('div');settingsHead.className='ipad-drawer-head ipad-settings-head';
 settingsHead.innerHTML='<strong data-i18n="ipadSettings">設定</strong>';
 sidebar.insertBefore(settingsHead,sidebarScroll);
 const drawerTabs=document.createElement('div');drawerTabs.className='ipad-drawer-tabs';
 drawerTabs.innerHTML='<button type="button" data-ipad-drawer-tab="data" data-i18n="ipadData">データ</button><button type="button" class="is-active" data-ipad-drawer-tab="display" data-i18n="ipadDisplay">表示・Seg</button><button type="button" data-ipad-drawer-tab="edit" data-i18n="ipadEdit">3D編集</button>';
 sidebarScroll.insertBefore(drawerTabs,sidebarScroll.firstChild);

 const panels=[...sidebarScroll.querySelectorAll(':scope > .panel')];
 const dataPanel=panels[0]||null,displayPanel=panels.find(p=>p.classList.contains('compact-panel'))||panels[1]||null;
 if(dataPanel)dataPanel.dataset.ipadDrawerSection='data';
 if(displayPanel)displayPanel.dataset.ipadDrawerSection='display';

 const editDetails=document.querySelector('.three-edit-panel');
 if(editDetails){
  const editPanel=document.createElement('section');editPanel.className='panel ipad-edit-drawer-panel';editPanel.dataset.ipadDrawerSection='edit';
  editPanel.appendChild(editDetails);sidebarScroll.appendChild(editPanel);editDetails.open=true;
 }
 const ctRange=document.querySelector('.ct-range-mode'),gpuQuality=document.querySelector('#ipad-gpu-quality-control'),mprOpacity=document.querySelector('.mpr-opacity-settings');
 if(displayPanel&&ctRange&&gpuQuality){gpuQuality.classList.remove('is-hidden');gpuQuality.style.display='inline-flex';ctRange.insertAdjacentElement('afterend',gpuQuality)}
 if(displayPanel&&mprOpacity)displayPanel.appendChild(mprOpacity);

 const sectionResult=document.querySelector('#section-view-result'),analysisResult=document.querySelector('#volume-analysis-result');
 if(displayPanel&&(sectionResult||analysisResult)){
  const analysisSettings=document.createElement('div');analysisSettings.className='ipad-analysis-settings';
  if(sectionResult)analysisSettings.appendChild(sectionResult);
  if(analysisResult)analysisSettings.appendChild(analysisResult);
  const anchor=gpuQuality?.parentElement===displayPanel?gpuQuality:ctRange;
  if(anchor)anchor.insertAdjacentElement('afterend',analysisSettings);else displayPanel.prepend(analysisSettings);
 }

 const footerBar=document.querySelector('.app-shell > footer');
 if(appVersionBadge&&footerBar)footerBar.appendChild(appVersionBadge);

 let drawerTab='display',viewMode='3d',mprPlane='axial';
 let layoutRefreshToken=0;
 const refreshLayout=()=>{
  const token=++layoutRefreshToken;
  const run=()=>{
   if(token!==layoutRefreshToken)return;
   try{sceneState?.resize?.()}catch{}
   try{if(volume)for(const p of Object.keys(planes))updateMprCanvasPhysicalAspect(p)}catch{}
   try{request3DRender()}catch{}
  };
  requestAnimationFrame(()=>{run();requestAnimationFrame(run)});
  setTimeout(run,120);
 };
 const setDrawerTab=tab=>{
  drawerTab=tab;
  sidebarScroll.querySelectorAll('[data-ipad-drawer-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadDrawerTab===tab));
  sidebarScroll.querySelectorAll('[data-ipad-drawer-section]').forEach(p=>p.classList.toggle('is-ipad-drawer-hidden',p.dataset.ipadDrawerSection!==tab));
  if(tab==='edit'&&editDetails)editDetails.open=true;
  refreshLayout();
 };
 const onSettingsTabRequest=e=>{
  const tab=e?.detail?.tab;
  if(['data','display','edit'].includes(tab))setDrawerTab(tab);
 };
 document.addEventListener('vrl-ipad-settings-tab',onSettingsTabRequest);

 const setMprPlane=plane=>{
  mprPlane=['axial','coronal','sagittal'].includes(plane)?plane:'axial';
  toolbar.querySelectorAll('[data-ipad-mpr]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadMpr===mprPlane));
  document.querySelectorAll('#sub-view-slots .view-slot-sub').forEach(slot=>slot.classList.toggle('is-ipad-active',slot.querySelector('[data-view-key]')?.dataset.viewKey===mprPlane));
  try{schedulePlaneRender(mprPlane,true)}catch{}
  refreshLayout();
 };
 const setViewMode=mode=>{
  viewMode=['3d','2d','split'].includes(mode)?mode:'3d';
  shell.classList.remove('ipad-mode-3d','ipad-mode-2d','ipad-mode-split');shell.classList.add('ipad-mode-'+viewMode);
  toolbar.querySelectorAll('[data-ipad-view-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.ipadViewMode===viewMode));
  setMprPlane(mprPlane);
 };
 drawerTabs.querySelectorAll('[data-ipad-drawer-tab]').forEach(b=>b.addEventListener('click',()=>setDrawerTab(b.dataset.ipadDrawerTab)));
 toolbar.querySelectorAll('[data-ipad-view-mode]').forEach(b=>b.addEventListener('click',()=>setViewMode(b.dataset.ipadViewMode)));
 toolbar.querySelectorAll('[data-ipad-mpr]').forEach(b=>b.addEventListener('click',()=>setMprPlane(b.dataset.ipadMpr)));
 window.addEventListener('orientationchange',refreshLayout,{passive:true});
 window.addEventListener('resize',()=>{if(useWorkspaceUi())refreshLayout()},{passive:true});
 setDrawerTab('data');setMprPlane('axial');setViewMode('3d');applyLanguage(currentLanguage);
}
function residentGpuVolumeBytes(v){return (v?.columns||0)*(v?.rows||0)*(v?.slices||0)*2}
function gpuVolumePlanOptions(){
 if(isIPadRuntime())return{maxTextureBytes:0,targetInPlane:ipadGpuTargetSide};
 if(isIPhoneRuntime())return{maxTextureBytes:96*1024*1024,targetInPlane:0};
 return{maxTextureBytes:0,targetInPlane:0};
}
function gpuVolumeProfileLabel(){
 if(isIPadRuntime())return'iPad '+ipadGpuTargetSide;
 if(isIPhoneRuntime())return'iPhone';
 return'GPU';
}
function shouldAutoPrepareResidentGpu(v){
 const mv=sceneState?.medicalVolume;if(!mv||!v?.sourceBacked)return false;
 const support=mv.support(v,gpuVolumePlanOptions());return !!support.ok;
}
function initIPadGpuQualityControl(){
 if(!ipadGpuQualityControl||!ipadGpuQuality)return;
 if(!isIPadRuntime()){ipadGpuQualityControl.classList.add('is-hidden');ipadGpuQualityControl.style.display='none';return}
 ipadGpuQualityControl.classList.remove('is-hidden');ipadGpuQualityControl.style.display='inline-flex';ipadGpuQuality.value=String(ipadGpuTargetSide);
 ipadGpuQuality.onchange=async()=>{
  const next=+ipadGpuQuality.value===768?768:512;if(next===ipadGpuTargetSide)return;
  setIpadGpuTargetSide(next);
  const mv=sceneState?.medicalVolume,target=sourceVolume||volume,wasVolume=threeRenderMode==='volume'&&!!mv?.active;
  if(!mv||!target?.sourceBacked){updateRenderModeControl(target);return}
  clearResidentMprJobs();setResidentMprReadbackDisabled(true);mv.resetData();
  set3DBusy(true,'iPad GPU '+next+' 準備中…');
  const ok=await prepareResidentGpuVolume(target);
  if(ok&&wasVolume)await activateMedicalVolume();
  else if(ok){mv.setActive(false);setThreeRenderMode('surface');setThreeVolumeOverlay(false);updateRenderModeControl(target);request3DRender()}
  if(ok)footer.textContent='iPad GPU '+next+' · '+(mv.textureDims||[]).join('×')+' · '+fmt(mv.textureBytes);
 };
}
initIPadWorkspaceUi();
initIPadGpuQualityControl();
function clearResidentMprJobs(){
 incResidentMprEpoch(false);
 for(const state of Object.values(residentMprJobs)){
  if(state.pending){for(const waiter of state.pending.waiters)waiter.reject(new Error('__SUPERSEDED__'));state.pending=null}
 }
}
async function prepareResidentGpuVolume(v){
 const mv=sceneState?.medicalVolume;if(!mv||!v?.sourceBacked)return false;
 const planOptions=gpuVolumePlanOptions(),support=mv.support(v,planOptions);if(!support.ok)return false;
 const seriesId=v?.series?.id||null;setResidentGpuUploadSeriesId(seriesId);cancelSourceMprWarmup();
 try{
  const previewSide=(planOptions.maxTextureBytes||planOptions.targetInPlane)?0:384;
  await mv.ensure(v,{prepareBricks:false,previewSide,...planOptions});
  setResidentMprReadbackDisabled(!!mv.isReduced?.(v));
  if(mv.isReduced?.(v)){
   const dims=mv.textureDims||[],profile=gpuVolumeProfileLabel();
   setGpuComputeBackend('WEBGPU '+profile.toUpperCase()+' VOLUME · LINEAR');
   footer.textContent=profile+' GPUボリューム · '+dims.join('×')+' · '+fmt(mv.textureBytes)+' / 2D MPRは原寸ソース';
  }else setGpuComputeBackend('WEBGPU VOLUME RESIDENT');
  return true;
 }catch(e){
  console.warn('GPU resident volume unavailable; using source-backed MPR fallback.',e);setResidentMprReadbackDisabled(true);setGpuComputeBackend('GPU VOLUME FALLBACK',e?.message||e);return false;
 }finally{
  if(residentGpuUploadSeriesId===seriesId)setResidentGpuUploadSeriesId(null);
  set3DBusy(false);
 }
}


/* Full-resolution source-backed filters: exact local processing in bounded tiles. */
function gpuMeshBlockDepth(){
 if(navigator.maxTouchPoints>0)return 2;
 if(!isDesktopMac())return 4;
 const cap=Number(gpuFilterRuntime.device?.limits?.maxStorageBufferBindingSize)||128*1024*1024;
 return cap>=256*1024*1024?32:cap>=128*1024*1024?16:12;
}
function gpuMeshTileStart(){return isDesktopMac()?[1024,1024]:[192,64]}
function gpuResidentSurfaceDrawBudget(){
 if(navigator.maxTouchPoints>0)return 0;
 return isDesktopMac()?48:24;
}
function shouldUseGpuResidentSurface(w,h,d,tx,ty,blockDepth,segmentCount){
 const budget=gpuResidentSurfaceDrawBudget();if(budget<=0)return false;
 const tilesPerBlock=Math.ceil(w/Math.max(1,tx))*Math.ceil(h/Math.max(1,ty));
 const blocks=Math.ceil(d/Math.max(1,blockDepth));
 const estimatedDraws=tilesPerBlock*blocks*Math.max(1,segmentCount||1);
 return estimatedDraws<=budget;
}
function gpuCapacityError(error){
 const m=String(error?.message||error||'').toLowerCase();
 return m.includes('__gpu_smooth_capacity__')||m.includes('out of memory')||m.includes('allocation')||m.includes('buffer limit')||m.includes('binding size')||m.includes('maxstoragebufferbindingsize')||m.includes('maxbuffersize');
}
function scheduleGpuPrewarm(){
 if(gpuPrewarmScheduled||gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
 setGpuPrewarmScheduled(true);
 const run=async()=>{
  setGpuPrewarmScheduled(false);
  if(gpuFilterRuntime.disabled||gpuPrewarmIndex>=GPU_PREWARM_KINDS.length)return;
  const kind=GPU_PREWARM_KINDS[incGpuPrewarmIndex(false)];
  try{await gpuFilterPipeline(kind)}catch(e){console.warn('GPU pipeline prewarm skipped:',kind,e)}
  if(gpuPrewarmIndex<GPU_PREWARM_KINDS.length)scheduleGpuPrewarm();
 };
 if('requestIdleCallback' in window)requestIdleCallback(()=>void run(),{timeout:2500});
 else setTimeout(()=>void run(),180);
}

function clearMpr3DPreviewCache(){
 mpr3DPreviewCache.token++;mpr3DPreviewCache.signature='';mpr3DPreviewCache.buildingSignature='';mpr3DPreviewCache.building=false;mpr3DPreviewCache.planes={axial:null,coronal:null,sagittal:null};mpr3DPreviewCache.dims={axial:null,coronal:null,sagittal:null};
}
function clearSourceSliceCache(){cancelSourceMprWarmup();sourceSliceCache.map.clear();sourceSliceCache.bytes=0;sourceOrthogonalPlaneCache.clear();sourceOrthogonalPlanePending.clear();setSourceOrthogonalPlaneCacheBytes(0);clearMpr3DPreviewCache()}
function paintMpr3DPreview(p,idx,canvas){
 if((p==='coronal'||p==='sagittal')&&paintMpr3DCacheSliceFast(p,idx,canvas))return true;
 return false;
}
function disposeSourceFilterWorkers(){
 const error=new Error('__SUPERSEDED__');
 for(const task of sourceFilterRuntime.queue)task.reject(error);sourceFilterRuntime.queue=[];
 for(const slot of sourceFilterRuntime.workers){if(slot.current)slot.current.reject(error);try{slot.worker.terminate()}catch{}}
 sourceFilterRuntime.workers=[];
}
function invalidateSourceFilters(){
 sourceFilterRuntime.revision++;incSourceRenderRevision(false);
 sourceFilterRuntime.cache.clear();sourceFilterRuntime.cacheBytes=0;disposeSourceFilterWorkers();
}
async function processSourceRegionMasks(series,target,stages,key,revision,segments){
 const halo=sourceFilterHalo(stages),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const bits=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments);
   if(bits instanceof Uint32Array){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return bits}
  }catch(e){
   gpuFilterRuntime.lastError='mask: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU mask execution failed; using exact CPU mask path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:localTarget};
 const values=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return valuesToSegmentBits(values,segments);
}
async function processSourceRegionFaces(series,target,stages,key,revision,segments,gpuResident=true){
 const halo=Math.max(1,sourceFilterHalo(stages)),x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(series.columns,target.x+target.width+halo),y1=Math.min(series.rows,target.y+target.height+halo),z1=Math.min(series.slices.length,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=await readSourceRegion(series,box,revision,true);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const localTarget={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 if(gpuStagesSupported(stages)){
  try{
   const compact=await runGpuSourceFilters(data,box.width,box.height,box.depth,sourceVolume.min,sourceVolume.max,stages,localTarget,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:series.columns,globalH:series.rows,globalD:series.slices.length,spacingX:series.spacingX,spacingY:series.spacingY,spacingZ:series.spacingZ,mesh:true,gpuResident});
   if(compact?.mesh||compact?.compact){if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');return compact}
  }catch(e){
   if(gpuCapacityError(e))throw e;
   gpuFilterRuntime.lastError='mesh: '+String(e?.message||e);if(!gpuFilterRuntime.warned){console.warn('WebGPU face extraction failed; using exact CPU face extraction path.',e);gpuFilterRuntime.warned=true}
  }
 }
 setGpuComputeBackend(gpuFilterRuntime.lastError?'CPU WORKER · GPU FAIL':'CPU WORKER',gpuFilterRuntime.lastError);
 const message={type:'process',id:++sourceFilterRuntime.nextId,buffer:data.buffer,w:box.width,h:box.height,d:box.depth,min:sourceVolume.min,max:sourceVolume.max,stages,target:{x:0,y:0,z:0,width:box.width,height:box.height,depth:box.depth}};
 const filtered=await runSourceFilterWorker(message,key);
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return compactFaceFlags(valuesToFaceFlags(filtered,box.width,box.height,box.depth,localTarget,segments,box,series));
}
async function getFilteredSourceAxialFaceBlock(zStart,coreDepth,series,segments,keyPrefix='3d-face-block'){
 const stages=sourceFilterStages();
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=Math.max(1,sourceFilterHalo(stages)),outDepth=Math.min(d-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(w,h,outDepth,halo,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(w,h,d,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,w-x),height:Math.min(ty,h-y),depth:outDepth});
 while(queue.length){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const target=queue.shift();
  try{
   const compact=await processSourceRegionFaces(series,target,stages,keyPrefix+':'+zStart+':'+target.x+':'+target.y,revision,segments,gpuResident);
   if(compact.mesh){if(compact.gpuResident||compact.vertices?.length)tiles.push(compact);}
   else if(compact.items.length)tiles.push({...target,items:compact.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{tiles,coreDepth:outDepth};
}
async function getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,segments,keyPrefix='3d-mask-block'){
 const stages=sourceFilterStages();if(!stages.length)return null;
 const revision=sourceFilterRuntime.revision,w=series.columns,h=series.rows,d=series.slices.length,halo=sourceFilterHalo(stages),outDepth=Math.min(d-zStart,coreDepth+(zStart+coreDepth<d?1:0));
 const out=new Uint32Array(w*h*outDepth),[tx,ty]=fitSourceTile(w,h,outDepth,halo,384,128);
 for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
  if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processSourceRegionMasks(series,{x,y,z:zStart,width:tw,height:th,depth:outDepth},stages,keyPrefix+':'+zStart,revision,segments);
  for(let zz=0;zz<outDepth;zz++)for(let yy=0;yy<th;yy++){
   const src=(zz*th+yy)*tw,dst=(zz*h+y+yy)*w+x;
   out.set(tile.subarray(src,src+tw),dst);
  }
 }
 if(revision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 return{data:out,depth:outDepth,coreDepth:Math.min(coreDepth,d-zStart)};
}
function segmentMasksFromBits(bits,segments){
 const blockSize=16384,states=new Map(segments.map(({key})=>[key,{mask:new Uint8Array(bits.length),blocks:[],block:new Uint32Array(blockSize),used:0}]));
 for(let i=0;i<bits.length;i++){
  const value=bits[i];if(!value)continue;
  for(let s=0;s<segments.length&&s<4;s++)if(value&(1<<s)){
   const state=states.get(segments[s].key);state.mask[i]=1;
   if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}
   state.block[state.used++]=i;
  }
 }
 for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used}
 return states;
}
function segmentMasksFromValues(data,segments){
 const blockSize=16384,states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(data.length),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
 for(let i=0;i<data.length;i++){const v=data[i];for(const state of states.values())if(v>=state.min&&v<=state.max){state.mask[i]=1;if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}state.block[state.used++]=i}}
 for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used;delete state.min;delete state.max}
 return states;
}

async function applyGpuFiltersToMemoryVolume(v,stages,revision){
 const w=v.columns,h=v.rows,d=v.slices,out=new Float32Array(w*h*d),halo=sourceFilterHalo(stages),coreDepth=gpuMeshBlockDepth(),[tx,ty]=fitSourceTile(w,h,coreDepth,halo,navigator.maxTouchPoints>0?256:(isDesktopMac()?512:384),navigator.maxTouchPoints>0?96:(isDesktopMac()?160:128));
 for(let z=0;z<d;z+=coreDepth){
  const td=Math.min(coreDepth,d-z);
  for(let y=0;y<h;y+=ty)for(let x=0;x<w;x+=tx){
   if(revision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
   const tw=Math.min(tx,w-x),th=Math.min(ty,h-y),tile=await processMemoryRegion(v,{x,y,z,width:tw,height:th,depth:td},stages);
   for(let zz=0;zz<td;zz++)for(let yy=0;yy<th;yy++){
    const src=(zz*th+yy)*tw,dst=((z+zz)*h+y+yy)*w+x;out.set(tile.subarray(src,src+tw),dst);
   }
  }
  progress(Math.min(d,z+td),d);await frameYield();
 }
 if(revision!==filterRebuildRevision)throw new Error('__SUPERSEDED__');
 return out;
}
async function processMemoryMeshRegion(v,target,segments,gpuResident=true){
 const halo=1,x0=Math.max(0,target.x-halo),y0=Math.max(0,target.y-halo),z0=Math.max(0,target.z-halo),x1=Math.min(v.columns,target.x+target.width+halo),y1=Math.min(v.rows,target.y+target.height+halo),z1=Math.min(v.slices,target.z+target.depth+halo);
 const box={x:x0,y:y0,z:z0,width:x1-x0,height:y1-y0,depth:z1-z0},data=readMemoryRegion(v,box),local={x:target.x-x0,y:target.y-y0,z:target.z-z0,width:target.width,height:target.height,depth:target.depth};
 const [sx,sy,sz]=v.spacing;
 const result=await runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,[],local,segments,{boxX:x0,boxY:y0,boxZ:z0,globalW:v.columns,globalH:v.rows,globalD:v.slices,spacingX:sx,spacingY:sy,spacingZ:sz,mesh:true,gpuResident});
 if(result?.mesh||result?.compact)return result;
 throw new Error('__GPU_UNAVAILABLE__');
}
async function getMemoryGpuMeshBlock(v,zStart,coreDepth,segments){
 const outDepth=Math.min(v.slices-zStart,coreDepth),tiles=[],[tileStartX,tileStartY]=gpuMeshTileStart(),[tx,ty]=fitSourceTile(v.columns,v.rows,outDepth,1,tileStartX,tileStartY),queue=[];
 const gpuResident=strongSurfaceSmoothingActive()?false:shouldUseGpuResidentSurface(v.columns,v.rows,v.slices,tx,ty,coreDepth,segments?.length||0);
 for(let y=0;y<v.rows;y+=ty)for(let x=0;x<v.columns;x+=tx)queue.push({x,y,z:zStart,width:Math.min(tx,v.columns-x),height:Math.min(ty,v.rows-y),depth:outDepth});
 while(queue.length){
  const target=queue.shift();
  try{
   const result=await processMemoryMeshRegion(v,target,segments,gpuResident);
   if(result.mesh){if(result.gpuResident||result.vertices?.length)tiles.push(result)}
   else if(result.items.length)tiles.push({...target,items:result.items});
  }catch(e){
   if(!gpuCapacityError(e)||target.width<=16&&target.height<=16)throw e;
   if(target.width>=target.height&&target.width>16){
    const a=Math.floor(target.width/2),b=target.width-a;queue.unshift({...target,x:target.x+a,width:b},{...target,width:a});
   }else{
    const a=Math.floor(target.height/2),b=target.height-a;queue.unshift({...target,y:target.y+a,height:b},{...target,height:a});
   }
   setGpuComputeBackend('WEBGPU RETILE',String(e?.message||e));
  }
 }
 return{tiles,coreDepth:outDepth};
}
function enableProcessingControls(enabled){
 if(!enabled){filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;setFilterOrder([])}
 gaussianBtn.disabled=!enabled;smoothingType.disabled=!enabled||!filterState.gaussian;spikeHoleBtn.disabled=!enabled;nlmBtn.disabled=!enabled;anisotropicBtn.disabled=!enabled;sigmoidBtn.disabled=!enabled;bilateralBtn.disabled=!enabled;tvBtn.disabled=!enabled;unsharpBtn.disabled=!enabled;filterAddSelect.disabled=!enabled;filterAddButton.disabled=!enabled;
 filterAddSelect.title=volume?.sourceBacked?'フル解像度チャンク処理':'';filterAddButton.title='';
 resetFilterBtn.disabled=!enabled;
 surfaceSmoothEnabled.disabled=!enabled;
 surfaceSmoothStrength.disabled=!enabled||!surfaceSmoothEnabled.checked;
 syncFilterControls();
}
function cloneVolumeWithData(base,data){
 return{data,columns:base.columns,rows:base.rows,slices:base.slices,spacing:[...base.spacing],min:base.min,max:base.max,storage:data.constructor.name,sourceBacked:false};
}
// CPU filter stack (fallback when WebGPU compute is not used): read the
// slider parameters, run the kernel from cpu-filters.js, then show the result.
const CPU_FILTERS={
 spikeHole:{label:'Spike / Hole',error:'Spike/Hole',run:v=>{const p={strength:+spikeHoleStrength.value,thresholdRatio:+spikeHoleThreshold.value};return[p,cpuSpikeHole(v,p,progress)]},footer:(p,r)=>'Spike / Hole · '+p.strength.toFixed(2)+' · threshold '+p.thresholdRatio.toFixed(3)+' · '+r.corrected.toLocaleString()+' voxels'},
 nlm:{label:'Fast NLM 3D',error:'NLM',run:v=>{const p={strength:+nlmStrength.value,searchRadius:+nlmSearchRadius.value,patchRadius:+nlmPatchRadius.value};return[p,cpuNlm3D(v,p,progress)]},footer:(p,r)=>'Fast NLM 3D · '+p.strength.toFixed(2)+' · search '+r.searchRadius+' · patch '+r.patchRadius},
 anisotropic:{label:'Anisotropic Diffusion',error:'Anisotropic',run:v=>{const p={strength:+anisotropicStrength.value,iterations:+anisotropicIterations.value};return[p,cpuAnisotropicDiffusion(v,p,progress)]},footer:(p,r)=>'Anisotropic Diffusion · '+p.strength.toFixed(2)+' · '+r.iterations+' iterations'},
 gaussian:{label:'Gaussian 3D',error:'Gaussian',run:v=>{const p={strength:+gaussianStrength.value,passes:+spatialPasses.value};return[p,cpuGaussian3D(v,p,progress)]},footer:p=>'Gaussian 3D · live '+p.strength.toFixed(2)},
 median:{label:'Median 3D',error:'Median',run:v=>{const p={strength:+gaussianStrength.value,passes:+spatialPasses.value};return[p,cpuMedian3D(v,p,progress)]},footer:p=>'Median 3D · live '+p.strength.toFixed(2)},
 sigmoid:{label:'Sigmoid',error:'Sigmoid',run:v=>{const p={strength:+sigmoidStrength.value,center:+sigmoidCenter.value};return[p,cpuSigmoid(v,p,progress)]},footer:(p,r)=>'Sigmoid · '+p.strength.toFixed(2)+' · center '+Math.round(r.centerValue)},
 bilateral:{label:'Bilateral 3D',error:'Bilateral',run:v=>{const p={strength:+bilateralStrength.value,spatialSigma:+bilateralSpatial.value,intensitySigma:+bilateralIntensity.value,passes:+bilateralPasses.value};return[p,cpuBilateral3D(v,p,progress)]},footer:p=>'Bilateral 3D · '+p.strength.toFixed(2)},
 tv:{label:'TV Denoising 3D',error:'TV',run:v=>{const p={weight:+tvWeight.value,iterations:+tvIterations.value};return[p,cpuTvDenoising3D(v,p,progress)]},footer:(p,r)=>'TV Denoising 3D · '+p.weight.toFixed(2)+' · '+r.iterations+' iterations'},
 unsharp:{label:'Unsharp Mask 3D',error:'Unsharp',run:v=>{const p={radius:+unsharpRadius.value,amount:+unsharpAmount.value,threshold:+unsharpThreshold.value};return[p,cpuUnsharpMask3D(v,p,progress)]},footer:p=>'Unsharp Mask 3D · amount '+p.amount.toFixed(2)}
};
function cpuFilterKind(key){return key==='gaussian'&&smoothingType.value==='median'?'median':key}
async function applyCpuFilter(key,baseVolume=volume){
 const f=CPU_FILTERS[cpuFilterKind(key)];if(!baseVolume||!f)return;setProcessingBusy(true,f.label);
 try{
  const [params,pending]=f.run(baseVolume),result=await pending;
  setVolume(cloneVolumeWithData(baseVolume,result.data));renderAll();render3D(volume);footer.textContent=f.footer(params,result);
 }catch(e){console.error(e);footer.textContent=f.error+' error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
function resetProcessing(){
 clearTimeout(liveFilterState.timer);clearTimeout(filterRebuildTimer);incFilterRebuildRevision(false);setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();if(sourceVolume?.sourceBacked)invalidateSourceFilters();liveFilterState.base=null;liveFilterState.key=null;
 filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;syncFilterControls();
 if(!sourceVolume)return;setVolume(sourceVolume);renderAll();mark3DStale();footer.textContent=tr('processingReset');
}
function clearMemoryFilterPreviewCache(){memoryFilterPreviewCache.map.clear();memoryFilterPreviewCache.bytes=0}
function hasGlobalSegmentProcessing(){
 return SEGMENT_PRESET_ORDER.some(key=>{const s=segmentState[key];return s.active&&s.enabled&&segmentNeedsGlobalMask(s)});
}
function setProcessingBusy(busyState,label='Processing',lockControls=true){
 if(processingOverlay){
  processingOverlay.classList.toggle('is-hidden',!busyState||!lockControls);
  processingOverlay.setAttribute('aria-busy',busyState?'true':'false');
 }
 if(processingOverlayLabel)processingOverlayLabel.textContent=busyState&&lockControls?label+' · 処理中…':'';
 if(lockControls){
  resetFilterBtn.disabled=busyState||!sourceVolume;
  gaussianBtn.disabled=spikeHoleBtn.disabled=nlmBtn.disabled=anisotropicBtn.disabled=sigmoidBtn.disabled=busyState||!sourceVolume;smoothingType.disabled=busyState||!sourceVolume||!filterState.gaussian;
  gaussianStrength.disabled=busyState||!sourceVolume||!filterState.gaussian;
  spatialPasses.disabled=busyState||!sourceVolume||!filterState.gaussian;
  spikeHoleStrength.disabled=busyState||!sourceVolume||!filterState.spikeHole;
  spikeHoleThreshold.disabled=busyState||!sourceVolume||!filterState.spikeHole;
  nlmStrength.disabled=busyState||!sourceVolume||!filterState.nlm;
  nlmSearchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
  nlmPatchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
  anisotropicStrength.disabled=busyState||!sourceVolume||!filterState.anisotropic;
  anisotropicIterations.disabled=busyState||!sourceVolume||!filterState.anisotropic;
  sigmoidStrength.disabled=busyState||!sourceVolume||!filterState.sigmoid;
  sigmoidCenter.disabled=busyState||!sourceVolume||!filterState.sigmoid;
  bilateralStrength.disabled=bilateralSpatial.disabled=bilateralIntensity.disabled=bilateralPasses.disabled=busyState||!sourceVolume||!filterState.bilateral;
  tvWeight.disabled=tvIterations.disabled=busyState||!sourceVolume||!filterState.tv;
  unsharpRadius.disabled=unsharpAmount.disabled=unsharpThreshold.disabled=busyState||!sourceVolume||!filterState.unsharp;
  folderBtn.disabled=demoBtn.disabled=busyState;
 }
 prog.classList.toggle('is-hidden',!busyState);
 if(busyState){bar.style.width='0%';progLabel.textContent=label}
}

function setCtSliderRange(el,min,max,step){
 if(!el)return;
 const value=+el.value,lo=Math.min(min,value),hi=Math.max(max,value);
 el.min=String(lo);el.max=String(Math.max(lo+step,hi));el.step=String(step);
 el.value=String(value);
}
function buildCtRangeProfile(v){
 const fullMin=Number.isFinite(v.min)?v.min:0,fullMax=Number.isFinite(v.max)&&v.max>fullMin?v.max:fullMin+1,fullSpan=Math.max(fullMax-fullMin,1e-6);
 const center=Number.isFinite(v.windowCenter)?v.windowCenter:(fullMin+fullMax)/2;
 const width=Number.isFinite(v.windowWidth)&&v.windowWidth>0?v.windowWidth:fullSpan;
 return{fullMin,fullMax,fullSpan,center,width,fullWidthMax:Math.max(fullSpan,width)};
}
function autoAround(value,halfSpan,fullMin,fullMax){
 const v=Number.isFinite(+value)?+value:(fullMin+fullMax)/2;
 let lo=Math.max(fullMin,v-halfSpan),hi=Math.min(fullMax,v+halfSpan);
 if(hi<=lo){lo=fullMin;hi=fullMax}
 return[lo,hi];
}
function applyCtRangeMode(mode=ctRangeMode){
 if(!ctRangeProfile||!volume)return;
 setCtRangeMode(mode==='full'?'full':'auto');
 ctRangeAuto.classList.toggle('is-active',ctRangeMode==='auto');
 ctRangeFull.classList.toggle('is-active',ctRangeMode==='full');
 const p=ctRangeProfile,fullStep=niceCtStep(p.fullSpan),autoStep=niceCtStep(Math.max(p.width*2,p.fullSpan/20));
 if(ctRangeMode==='full'){
  setCtSliderRange(wc,p.fullMin,p.fullMax,fullStep);
  setCtSliderRange(ww,Math.max(fullStep,1e-6),p.fullWidthMax,fullStep);
  setCtSliderRange(sigmoidCenter,p.fullMin,p.fullMax,fullStep);
  for(const key of SEGMENT_PRESET_ORDER){
   setCtSliderRange($('[data-seg-min="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
   setCtSliderRange($('[data-seg-max="'+key+'"]'),p.fullMin,p.fullMax,fullStep);
  }
 }else{
  const half=Math.max(p.width,p.fullSpan/200);
  let r=autoAround(+wc.value,half,p.fullMin,p.fullMax);setCtSliderRange(wc,r[0],r[1],autoStep);
  const currentWidth=Math.max(+ww.value,autoStep),wwLo=Math.max(autoStep,currentWidth-p.width),wwHi=Math.min(p.fullWidthMax,Math.max(currentWidth+p.width,currentWidth*1.5));
  setCtSliderRange(ww,wwLo,Math.max(wwLo+autoStep,wwHi),autoStep);
  r=autoAround(+sigmoidCenter.value,half,p.fullMin,p.fullMax);setCtSliderRange(sigmoidCenter,r[0],r[1],autoStep);
  for(const key of SEGMENT_PRESET_ORDER){
   const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
   let rr=autoAround(+minEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(minEl,rr[0],rr[1],autoStep);
   rr=autoAround(+maxEl.value,half,p.fullMin,p.fullMax);setCtSliderRange(maxEl,rr[0],rr[1],autoStep);
  }
 }
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 sigmoidCenterValue.value=formatCtValue(+sigmoidCenter.value,+sigmoidCenter.step);
 for(const key of SEGMENT_PRESET_ORDER)updateSegmentOutputs(key);
}
function configure(v){
 setCtRangeMode('auto');setCtRangeProfile(buildCtRangeProfile(v));
 const p=ctRangeProfile,center=p.center,initialWidth=p.width;
 wc.min=p.fullMin;wc.max=p.fullMax;wc.value=Math.max(p.fullMin,Math.min(p.fullMax,center));wc.disabled=false;
 ww.min=Math.max(niceCtStep(p.fullSpan),1e-6);ww.max=p.fullWidthMax;ww.value=Math.max(+ww.min,Math.min(p.fullWidthMax,initialWidth));ww.disabled=false;
 sigmoidCenter.min=p.fullMin;sigmoidCenter.max=p.fullMax;sigmoidCenter.value=Math.max(p.fullMin,Math.min(p.fullMax,center));sigmoidCenter.disabled=!filterState.sigmoid;
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [plane,[max,mid]]of Object.entries(vals)){planes[plane].slider.max=max-1;planes[plane].slider.value=Math.floor(mid);planes[plane].slider.disabled=false}
 configureSegments(v);
 ctRangeAuto.disabled=ctRangeFull.disabled=false;applyCtRangeMode('auto');
 volumeAnalysisToggle.disabled=!(v.data||v.mprData||v.sourceBacked);updateRenderModeControl(v);
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  const exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
  const usable=cfg.active;
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=!usable;opening.disabled=closing.disabled=minComponent.disabled=holeFill.disabled=!usable;if(exportBtn)exportBtn.disabled=!usable;if(removeBtn)removeBtn.disabled=!usable;enabled.checked=cfg.enabled;color.value=cfg.color;
  min.min=max.min=Math.floor(v.min);min.max=max.max=Math.ceil(v.max);min.value=cfg.min;max.value=cfg.max;opacity.value=cfg.opacity;opening.value=cfg.opening;closing.value=cfg.closing;minComponent.value=cfg.minComponent;holeFill.checked=cfg.holeFill;$('[data-seg-opening-out="'+key+'"]').value=cfg.opening;$('[data-seg-closing-out="'+key+'"]').value=cfg.closing;$('[data-seg-min-component-out="'+key+'"]').value=cfg.minComponent;cfg._maskCache=null;updateSegmentOutputs(key);
 }
 renderSegmentPresets();
}
function updateSegmentOutputs(key){
 const minEl=$('[data-seg-min="'+key+'"]'),maxEl=$('[data-seg-max="'+key+'"]');
 $('[data-seg-min-out="'+key+'"]').value=formatCtValue(segmentState[key].min,+minEl?.step||1);
 $('[data-seg-max-out="'+key+'"]').value=formatCtValue(segmentState[key].max,+maxEl?.step||1);
 $('[data-seg-opacity-out="'+key+'"]').value=segmentState[key].opacity.toFixed(2);
}
function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);incSourceRenderRevision(false);mark3DStale();if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){request3DRender();threeLabel.textContent=(sceneState.backend||'3D')+' · GPU volume'}}
function scheduleSourceMprWarmup(){
 if(!volume?.sourceBacked||residentGpuUploadSeriesId===volume?.series?.id||residentGpuMprAvailable(volume))return;
 const token=incSourceMprWarmupToken(true);
 const run=async()=>{
  if(token!==sourceMprWarmupToken||!volume?.sourceBacked)return;
  await ensureMpr3DPreviewCache();
  if(token!==sourceMprWarmupToken||!volume?.sourceBacked||sourceFilterStages().length)return;
  for(const p of ['coronal','sagittal']){
   if(token!==sourceMprWarmupToken)return;
   const idx=+planes[p].slider.value,max=p==='coronal'?volume.rows-1:volume.columns-1;
   setSourceMprWarmupPlane(p);
   if(!sourceOrthogonalCacheGet(p,idx)){
    const revision=++planeRenderRevision[p];
    try{await renderPlane(p,revision,idx)}catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('MPR warmup failed.',e)}
   }
   if(sourceMprWarmupPlane===p)setSourceMprWarmupPlane(null);
   const idleRevision=planeRenderRevision[p];
   for(const offset of [-1,1,-2,2]){
    if(token!==sourceMprWarmupToken||idleRevision!==planeRenderRevision[p])return;
    const near=idx+offset;if(near<0||near>max||sourceOrthogonalCacheGet(p,near))continue;
    try{await buildSourceOrthogonalPlane(p,near,volume.series,idleRevision)}catch(e){if(String(e.message||e)==='__SUPERSEDED__')return;console.warn('MPR neighbor warmup failed.',e);break}
    await frameYield();
   }
  }
 };
 if('requestIdleCallback' in window)requestIdleCallback(()=>void run(),{timeout:900});
 else setTimeout(()=>void run(),180);
}
function renderMainMprPreview(){
 if(!volume)return;
 const key=currentMainViewKey(),p=planes[key]?key:'axial';
 schedulePlaneRender(p);
}
function renderAll(){
 if(!volume)return;
 wcVal.value=formatCtValue(+wc.value,+wc.step);wwVal.value=formatCtValue(+ww.value,+ww.step);
 if(volume.sourceBacked&&!sourceFilterStages().length&&(volume.mprData||residentGpuMprAvailable(volume))){
  for(const p of Object.keys(planes))safeRenderPlane(p);
  return;
 }
 if(volume.sourceBacked&&!sourceFilterStages().length){
  safeRenderPlane('axial');
  for(const p of ['coronal','sagittal']){
   const idx=+planes[p].slider.value,cached=sourceOrthogonalCacheGet(p,idx);
   if(cached)paintSourcePlane(planes[p],p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],cached,p,idx);
  }
  scheduleSourceMprWarmup();return;
 }
 for(const p of Object.keys(planes))safeRenderPlane(p);
}


const mprWheelFinalizeTimers={axial:null,coronal:null,sagittal:null};
function installMprTouch(p){const c=planes[p];let id=null,startX=0,startY=0,start=0,moved=false;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startX=e.clientX;startY=e.clientY;start=+c.slider.value;moved=false;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const dx=e.clientX-startX,dy=e.clientY-startY;if(Math.hypot(dx,dy)>5)moved=true;if(volumeAnalysisMode&&!moved)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientWidth/(max+1)),next=Math.round(start+dx/sens);c.slider.value=Math.max(0,Math.min(max,next));schedulePlaneRender(p)};const end=e=>{if(id!==e.pointerId)return;const wasClick=!moved&&e.type==='pointerup';if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null;if(moved)schedulePlaneRender(p,true);if(wasClick&&selectAnalysisRegionFromMpr(p,e))e.preventDefault()};c.canvas.onpointerup=end;c.canvas.onpointercancel=end;c.canvas.addEventListener('wheel',e=>{if(!volume||c.slider.disabled)return;e.preventDefault();const max=+c.slider.max,delta=e.deltaY===0?e.deltaX:e.deltaY,step=delta>0?1:-1;c.slider.value=Math.max(0,Math.min(max,+c.slider.value+step));schedulePlaneRender(p,false);clearTimeout(mprWheelFinalizeTimers[p]);mprWheelFinalizeTimers[p]=setTimeout(()=>schedulePlaneRender(p,true),48)},{passive:false})}

function setMpr3DInteractive(active){
 if(!sceneState)return;sceneState.mprInteractionActive=!!active;
 if(sceneState.mprPlaneGroup)sceneState.mprPlaneGroup.visible=!!sceneState.obj;
 request3DRender();
}
function installMpr3DOverlayControls(){
 document.querySelectorAll('[data-3d-overlay]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset['3dOverlay'];setMpr3DOverlayVisible(key,!mpr3DVisibility[key])}));
}
installMpr3DOverlayControls();


function set3DBusy(busyState,label='3D構築中…',cancelable=true){
 if(threeBusy)threeBusy.classList.toggle('is-hidden',!busyState);
 if(threeBusyLabel)threeBusyLabel.textContent=label;
 if(threeBusyCancel){threeBusyCancel.classList.toggle('is-hidden',!busyState||!cancelable);threeBusyCancel.disabled=!busyState||!cancelable||threeDCancelRequested;threeBusyCancel.textContent=threeDCancelRequested?tr('cancelling3D'):tr('cancel3D')}
}
function currentMainViewKey(){return mainViewSlot?.querySelector('.view-card')?.dataset.viewKey||'3d'}
function swapViewCards(a,b){
 if(!a||!b||a===b)return;
 const placeholder=document.createComment('view-swap'),aParent=a.parentNode;
 aParent.replaceChild(placeholder,a);b.parentNode.replaceChild(a,b);placeholder.replaceWith(b);
 requestAnimationFrame(()=>{sceneState?.resize?.();request3DRender()});
}
function moveViewToMain(key){
 const card=document.querySelector('.view-card[data-view-key="'+key+'"]'),mainCard=mainViewSlot?.querySelector('.view-card');
 if(card&&mainCard&&card!==mainCard)swapViewCards(card,mainCard);
}
function installViewSwapping(){
 document.querySelectorAll('[data-view-main]').forEach(button=>button.addEventListener('click',()=>moveViewToMain(button.dataset.viewMain)));
 let dragCard=null,targetCard=null,pointerId=null;
 const clearTarget=()=>{targetCard?.classList.remove('is-view-drop-target');targetCard=null};
 for(const handle of document.querySelectorAll('[data-view-drag-handle]')){
  handle.addEventListener('pointerdown',e=>{
   dragCard=handle.closest('.view-card');pointerId=e.pointerId;if(!dragCard)return;
   handle.setPointerCapture?.(pointerId);dragCard.classList.add('is-view-dragging');e.preventDefault();
  });
  handle.addEventListener('pointermove',e=>{
   if(!dragCard||e.pointerId!==pointerId)return;clearTarget();
   const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.view-card');
   if(hit&&hit!==dragCard){targetCard=hit;targetCard.classList.add('is-view-drop-target')}
  });
  const end=e=>{
   if(!dragCard||e.pointerId!==pointerId)return;
   const from=dragCard,to=targetCard;clearTarget();from.classList.remove('is-view-dragging');dragCard=null;pointerId=null;
   if(to)swapViewCards(from,to);
  };
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 }
}
installViewSwapping();
async function start3D(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.005,100);camera.position.z=5.2;scene.add(camera);scene.add(new THREE.HemisphereLight(0xffffff,0x182028,2.0));const keyLight=new THREE.DirectionalLight(0xffffff,2.4);keyLight.position.set(2,3,4);scene.add(keyLight);
 const axisWidget=new THREE.Group();axisWidget.name='orientation_axes';camera.add(axisWidget);
 const axisLength=.22,axisOrigin=new THREE.Vector3(0,0,0),axisDefs=[['X',new THREE.Vector3(1,0,0),0xff5a5a],['Y',new THREE.Vector3(0,1,0),0x62d96b],['Z',new THREE.Vector3(0,0,1),0x5d8dff]];
 const makeAxisLabel=(label,color)=>{
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,64,64);ctx.font='700 30px -apple-system,BlinkMacSystemFont,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(label,32,33);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillText(label,32,33);
  const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}),sprite=new THREE.Sprite(material);sprite.scale.set(.09,.09,1);sprite.renderOrder=1002;return sprite;
 };
 for(const[label,dir,color]of axisDefs){
  const arrow=new THREE.ArrowHelper(dir,axisOrigin,axisLength,color,.055,.032);arrow.renderOrder=1001;arrow.line.material.depthTest=false;arrow.line.material.depthWrite=false;arrow.cone.material.depthTest=false;arrow.cone.material.depthWrite=false;axisWidget.add(arrow);
  const marker=makeAxisLabel(label,color);if(label==='Z')marker.position.set(.065,.065,.025);else marker.position.copy(dir).multiplyScalar(axisLength+.05);axisWidget.add(marker);
 }
 const updateAxisWidget=()=>{const depth=1.8,halfH=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*depth/Math.max(camera.zoom,1e-6),halfW=halfH*camera.aspect,pad=.16;axisWidget.position.set(-halfW+pad,-halfH+pad,-depth)};

 let renderer,backend='WEBGL';
 if('gpu' in navigator){
  try{
   const core=await requestVrlGpuDevice(),gpuRenderer=new THREE.WebGPURenderer({antialias:true,alpha:true,device:core.device});gpuRenderer.setPixelRatio(Math.min(devicePixelRatio,2));await gpuRenderer.init();renderer=gpuRenderer;backend='WEBGPU';adoptRendererGpuDevice(gpuRenderer,core.adapter,core.device);
  }catch(error){
   console.warn('WebGPU core init failed; falling back to WebGL.',error);
  }
 }
 if(!renderer){
  renderer=new WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));backend='WEBGL';
 }
 threeLabel.textContent=backend;
 viewport.appendChild(renderer.domElement);
 const sectionClipPlane=new THREE.Plane(new THREE.Vector3(1,0,0),0),sectionClipGroup=backend==='WEBGPU'&&THREE.ClippingGroup?new THREE.ClippingGroup():null;
 if(sectionClipGroup){sectionClipGroup.name='section_clip_group';sectionClipGroup.enabled=false;scene.add(sectionClipGroup)}
 setSceneState({scene,camera,renderer,obj:null,analysisMesh:null,backend,needsRender:true,medicalVolume:null,mprPlaneGroup:null,mprPlaneEntries:null,mprPlaneSignature:'',mprInteractionActive:false,editCutPreview:null,editCutPreviewPoint:null,cutResultPreviewGroup:null,cutResultPreviewKey:null,axisWidget,sectionClipPlane,sectionClipGroup});
 if(backend==='WEBGPU')try{sceneState.medicalVolume=new MedicalVolumeRenderer({device:renderer.backend.device,host:viewport,rendererCanvas:renderer.domElement,onProgress:(a,b)=>set3DBusy(true,(currentLanguage==='ja'?'GPUボリューム準備中… ':'Preparing GPU volume… ')+a+' / '+b),onStatus:label=>setGpuComputeBackend(label)})}catch(e){console.warn('Medical volume renderer unavailable.',e)}
 if(sceneState.medicalVolume)void updateVolumeCacheControl();
 updateGpuStatus();updateRenderModeControl();void ensureGpuFilterDevice().then(()=>updateGpuStatus());
 const pointers=new Map();const pointerStarts=new Map();const MIN_3D_DISTANCE=.05,MAX_3D_DISTANCE=12;let distance=5.2,lastPinch=0,lastCenter=null,lastTwist=null;
 const full3DPixelRatio=Math.min(devicePixelRatio,2);let active3DPixelRatio=full3DPixelRatio,wheelQualityTimer=null,fastKeepOverlays=false,mpr3DHideDuringCameraMoves=false,fastInteractionActive=false,fastInteractionTier=-1;
 const pivotIndicator=document.createElement('div');
 Object.assign(pivotIndicator.style,{position:'absolute',left:'50%',top:'50%',width:'18px',height:'18px',transform:'translate(-50%,-50%)',border:'1px solid rgba(255,255,255,.78)',borderRadius:'50%',boxSizing:'border-box',pointerEvents:'none',zIndex:'12',opacity:'0',transition:'opacity 90ms linear'});
 const pivotDot=document.createElement('div');Object.assign(pivotDot.style,{position:'absolute',left:'50%',top:'50%',width:'4px',height:'4px',transform:'translate(-50%,-50%)',borderRadius:'50%',background:'rgba(255,255,255,.92)'});
 pivotIndicator.appendChild(pivotDot);viewport.appendChild(pivotIndicator);
 const viewControls=document.createElement('div');viewControls.setAttribute('aria-label','3D view controls');
 Object.assign(viewControls.style,{position:'absolute',right:'10px',bottom:'10px',display:'flex',gap:'5px',padding:'5px',border:'1px solid rgba(122,145,154,.55)',borderRadius:'9px',background:'rgba(10,14,16,.78)',backdropFilter:'blur(5px)',zIndex:'13',pointerEvents:'auto'});
 const makeViewButton=(label,title,handler)=>{
  const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);
  Object.assign(b.style,{minWidth:'34px',height:'34px',padding:'0 8px',border:'1px solid rgba(128,151,160,.6)',borderRadius:'7px',background:'rgba(25,33,37,.92)',color:'#e8f0f2',font:'600 13px -apple-system,BlinkMacSystemFont,sans-serif',cursor:'pointer'});
  b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.stopPropagation();handler()});viewControls.appendChild(b);return b;
 };
 viewport.appendChild(viewControls);

 const helpButton=document.createElement('button');
 helpButton.type='button';helpButton.textContent='?';helpButton.title=tr('threeHelp');helpButton.setAttribute('aria-label',tr('threeHelp'));helpButton.setAttribute('aria-expanded','false');
 Object.assign(helpButton.style,{position:'absolute',right:'10px',bottom:'55px',width:'36px',height:'36px',padding:'0',border:'1px solid rgba(128,151,160,.62)',borderRadius:'50%',background:'rgba(25,33,37,.9)',color:'#e8f0f2',font:'700 16px -apple-system,BlinkMacSystemFont,sans-serif',cursor:'pointer',zIndex:'14',pointerEvents:'auto',boxShadow:'none'});

 const helpPanel=document.createElement('div');
 helpPanel.setAttribute('role','dialog');helpPanel.setAttribute('aria-label',tr('threeHelp'));
 Object.assign(helpPanel.style,{position:'absolute',right:'10px',bottom:'98px',width:'min(290px,calc(100% - 20px))',maxHeight:'min(360px,70%)',overflow:'auto',display:'none',padding:'10px 11px',border:'1px solid rgba(122,145,154,.58)',borderRadius:'10px',background:'rgba(10,14,16,.94)',backdropFilter:'blur(7px)',color:'#e8f0f2',font:'12px/1.45 -apple-system,BlinkMacSystemFont,sans-serif',zIndex:'15',pointerEvents:'auto',boxSizing:'border-box'});
 const helpSection=(title,items)=>{
  const section=document.createElement('section');section.style.marginBottom='8px';
  const h=document.createElement('strong');h.textContent=title;Object.assign(h.style,{display:'block',marginBottom:'4px',fontSize:'12px',color:'#d7e4e8'});section.appendChild(h);
  for(const item of items){const row=document.createElement('div');row.textContent=item;Object.assign(row.style,{padding:'2px 0',color:'#bfcfd5'});section.appendChild(row)}
  return section;
 };
 const rebuildHelpPanel=()=>{
  helpButton.title=tr('threeHelp');helpButton.setAttribute('aria-label',tr('threeHelp'));helpPanel.setAttribute('aria-label',tr('threeHelp'));helpPanel.replaceChildren();
  const head=document.createElement('div');Object.assign(head.style,{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'8px'});
  const title=document.createElement('strong');title.textContent=tr('threeHelp');title.style.fontSize='13px';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close');Object.assign(close.style,{width:'30px',height:'30px',padding:'0',border:'0',borderRadius:'6px',background:'transparent',color:'#d7e4e8',fontSize:'18px',cursor:'pointer'});close.addEventListener('click',()=>setHelpOpen(false));
  head.append(title,close);helpPanel.appendChild(head);
  helpPanel.appendChild(helpSection(tr('threeHelpMouse'),[tr('threeHelpRotate'),tr('threeHelpRoll'),tr('threeHelpPan'),tr('threeHelpZoom')]));
  helpPanel.appendChild(helpSection(tr('threeHelpTouch'),[tr('threeHelpTouchRotate'),tr('threeHelpTouchGesture')]));
  helpPanel.appendChild(helpSection(tr('threeHelpQuick'),[tr('threeHelpAxis'),tr('threeHelpStep'),tr('threeHelpPivot')]));
 };
 const setHelpOpen=open=>{const yes=!!open;helpPanel.style.display=yes?'block':'none';helpButton.setAttribute('aria-expanded',yes?'true':'false');if(yes)rebuildHelpPanel()};
 helpButton.addEventListener('pointerdown',e=>e.stopPropagation());helpButton.addEventListener('click',e=>{e.stopPropagation();setHelpOpen(helpPanel.style.display==='none')});
 helpPanel.addEventListener('pointerdown',e=>e.stopPropagation());
 renderer.domElement.addEventListener('pointerdown',()=>setHelpOpen(false));
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&helpPanel.style.display!=='none')setHelpOpen(false)});
 viewport.append(helpButton,helpPanel);

 const showViewPivot=()=>{pivotIndicator.style.opacity='1'};
 const hideViewPivot=()=>{pivotIndicator.style.opacity='0'};
 const setHeavyOverlayInteraction=active=>{
  for(const group of [sceneState?.analysisMesh,sceneState?.cutResultPreviewGroup]){
   if(!group)continue;
   if(active){
    if(group.userData._interactionPrevVisible===undefined)group.userData._interactionPrevVisible=group.visible;
    group.visible=false;
   }else if(group.userData._interactionPrevVisible!==undefined){
    group.visible=!!group.userData._interactionPrevVisible;delete group.userData._interactionPrevVisible;
   }
  }
 };
 const interactionQualityTier=()=>distance<2.15?2:distance<3.45?1:0;
 const setFastInteraction=(active,keepOverlays=false)=>{
  const next=!!active,tier=next?interactionQualityTier():-1;
  // slider drags (keepOverlays) must keep MPR planes visible in the volume:
  // the render loop hides them during fast camera moves only
  fastKeepOverlays=next&&!!keepOverlays;
  if(fastInteractionActive===next&&fastInteractionTier===tier){request3DRender();return}
  fastInteractionActive=next;fastInteractionTier=tier;
  const touch=(navigator.maxTouchPoints||0)>0,ratios=touch?[0.75,0.60,0.48]:[1.0,0.78,0.58];
  active3DPixelRatio=next?Math.min(full3DPixelRatio,ratios[tier]||ratios[0]):full3DPixelRatio;
  renderer.setPixelRatio(active3DPixelRatio);renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);
  sceneState?.medicalVolume?.setInteractive?.(next,next?tier:0);setHeavyOverlayInteraction(next&&!keepOverlays);request3DRender();
 };
 const begin3DInteraction=()=>{setFastInteraction(true);setMpr3DInteractive(true)};
 const end3DInteraction=()=>{setMpr3DInteractive(false);setFastInteraction(false);hideViewPivot()};
 sceneState.setFastInteraction=setFastInteraction;
 const isMousePanStart=e=>e.pointerType==='mouse'&&(e.button===1||e.button===2||e.shiftKey);
 const viewCenterPivot=()=>{
  if(!sceneState.obj)return new THREE.Vector3();
  camera.updateMatrixWorld(true);sceneState.obj.updateMatrixWorld(true);
  const camPos=camera.getWorldPosition(new THREE.Vector3()),forward=camera.getWorldDirection(new THREE.Vector3()).normalize(),objOrigin=sceneState.obj.getWorldPosition(new THREE.Vector3());
  const depth=Math.max(.01,objOrigin.clone().sub(camPos).dot(forward));
  return camPos.addScaledVector(forward,depth);
 };
 const rotateAroundViewCenter=(dx,dy)=>{
  const obj=sceneState.obj;if(!obj)return;
  const pivot=viewCenterPivot(),qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*.008),qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*.008);
  obj.position.sub(pivot).applyQuaternion(qYaw).add(pivot);obj.quaternion.premultiply(qYaw);
  obj.position.sub(pivot).applyQuaternion(qPitch).add(pivot);obj.quaternion.premultiply(qPitch);obj.quaternion.normalize();
 };
 const applyQuaternionAroundViewCenter=q=>{
  const obj=sceneState.obj;if(!obj)return;
  const pivot=viewCenterPivot();obj.position.sub(pivot).applyQuaternion(q).add(pivot);obj.quaternion.premultiply(q);obj.quaternion.normalize();
 };
 const rollAroundViewCenter=angle=>{
  if(!sceneState.obj||!Number.isFinite(angle)||Math.abs(angle)<1e-7)return;
  const axis=camera.getWorldDirection(new THREE.Vector3()).normalize();
  applyQuaternionAroundViewCenter(new THREE.Quaternion().setFromAxisAngle(axis,angle));
 };
 const setAxisView=axis=>{
  const obj=sceneState.obj;if(!obj)return;
  const pivot=viewCenterPivot(),localPivot=obj.worldToLocal(pivot.clone()),target=new THREE.Quaternion();
  if(axis==='x')target.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
  else if(axis==='y')target.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  else target.identity();
  obj.quaternion.copy(target).normalize();obj.updateMatrixWorld(true);
  const moved=localPivot.clone().applyMatrix4(obj.matrixWorld);obj.position.add(pivot.clone().sub(moved));obj.updateMatrixWorld(true);
  showViewPivot();request3DRender();clearTimeout(wheelQualityTimer);wheelQualityTimer=setTimeout(hideViewPivot,380);
 };
 makeViewButton('↶','平面回転 左へ15°',()=>{showViewPivot();rollAroundViewCenter(-Math.PI/12);request3DRender()});
 makeViewButton('↷','平面回転 右へ15°',()=>{showViewPivot();rollAroundViewCenter(Math.PI/12);request3DRender()});
 makeViewButton('X','X軸正面 (+X)',()=>setAxisView('x'));
 makeViewButton('Y','Y軸正面 (+Y)',()=>setAxisView('y'));
 makeViewButton('Z','Z軸正面 (+Z)',()=>setAxisView('z'));
 const pan3D=(dx,dy)=>{if(!sceneState.obj)return;const h=Math.max(renderer.domElement.clientHeight,1),worldPerPixel=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))/h;sceneState.obj.position.x+=dx*worldPerPixel;sceneState.obj.position.y-=dy*worldPerPixel};
 const clear3DPointerState=(pointerId=null)=>{
  if(pointerId!=null){
   pointers.delete(pointerId);pointerStarts.delete(pointerId);
   try{if(renderer.domElement.hasPointerCapture(pointerId))renderer.domElement.releasePointerCapture(pointerId)}catch{}
  }else{
   for(const id of [...pointers.keys()]){try{if(renderer.domElement.hasPointerCapture(id))renderer.domElement.releasePointerCapture(id)}catch{}}
   pointers.clear();pointerStarts.clear();
  }
  if(pointers.size<2){lastPinch=0;lastCenter=null;lastTwist=null}
 };
 sceneState.clearPointerState=clear3DPointerState;
 if(threeEditOverlay&&threeEditOverlay.parentElement!==viewport)viewport.appendChild(threeEditOverlay);
 const resizeEditOverlay=(width=null,height=null)=>{if(!threeEditOverlay)return;const w=Math.round(width??viewport.clientWidth),h=Math.round(height??viewport.clientHeight);if(w<8||h<8)return;if(threeEditOverlay.width!==w)threeEditOverlay.width=w;if(threeEditOverlay.height!==h)threeEditOverlay.height=h};
 const editPoint=e=>{const rect=renderer.domElement.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}};
 const cutSamplesToSurfaceStroke=(samples,mode='pen',screenCurve=null)=>{
  if(!samples?.length||!sceneState?.obj||!volume)return[];
  const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),rect=renderer.domElement.getBoundingClientRect();
  sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const drawn=screenCurve?.length?screenCurve:samples.map(sample=>sample.screen);
  const nearestPointOnStroke=(p)=>{
   let best=null,bestD2=Infinity;if(drawn.length===1)return{x:drawn[0].x,y:drawn[0].y,d2:(p.x-drawn[0].x)**2+(p.y-drawn[0].y)**2};
   for(let i=0;i<drawn.length-1;i++){const a=drawn[i],b=drawn[i+1],dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy,t=len2>1e-9?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len2)):0,qx=a.x+dx*t,qy=a.y+dy*t,d2=(p.x-qx)*(p.x-qx)+(p.y-qy)*(p.y-qy);if(d2<bestD2){bestD2=d2;best={x:qx,y:qy,d2}}}
   return best;
  };
  let anchorWorld=null,anchorMeta=null,anchorScreen=null,bestCameraD2=Infinity;
  if(threeRenderMode==='volume'){
   for(const sample of samples){const surface=sample?.surface;if(!surface)continue;const local=new THREE.Vector3(((surface.x+.5)*vx-px/2)*scale,-((surface.y+.5)*vy-py/2)*scale,((surface.z+.5)*vz-pz/2)*scale),world=local.applyMatrix4(sceneState.obj.matrixWorld),cameraD2=world.distanceToSquared(camera.position);if(cameraD2<bestCameraD2){bestCameraD2=cameraD2;anchorWorld=world;anchorMeta=surface;const ndc=world.clone().project(camera);anchorScreen={x:(ndc.x+1)*.5*Math.max(rect.width,1),y:(1-ndc.y)*.5*Math.max(rect.height,1)}}}
  }else{
   const seen=new Set();
   for(const sample of samples){const surface=sample?.surface,hit=surface?.hit,geom=hit?.object?.geometry,pos=geom?.getAttribute?.('position'),face=hit?.face;if(!pos||!face)continue;for(const vi of [face.a,face.b,face.c]){const id=(hit.object.uuid||'mesh')+':'+vi;if(seen.has(id))continue;seen.add(id);const world=new THREE.Vector3().fromBufferAttribute(pos,vi).applyMatrix4(hit.object.matrixWorld),cameraD2=world.distanceToSquared(camera.position);if(cameraD2<bestCameraD2){bestCameraD2=cameraD2;anchorWorld=world;anchorMeta=surface;const ndc=world.clone().project(camera);anchorScreen={x:(ndc.x+1)*.5*Math.max(rect.width,1),y:(1-ndc.y)*.5*Math.max(rect.height,1)}}}}
  }
  if(!anchorWorld||!anchorMeta||!anchorScreen)return[];
  const curveContact=nearestPointOnStroke(anchorScreen);if(!curveContact)return[];
  const shiftX=anchorScreen.x-curveContact.x,shiftY=anchorScreen.y-curveContact.y,anchorNdc=anchorWorld.clone().project(camera);
  const toVoxel=world=>{const local=sceneState.obj.worldToLocal(world.clone());return{x:(local.x/scale+px/2)/vx,y:(-local.y/scale+py/2)/vy,z:(local.z/scale+pz/2)/vz,ray:{...anchorMeta.ray},right:{...anchorMeta.right},up:{...anchorMeta.up},key:anchorMeta.key}};
  const full=drawn.map(screen=>{const x=screen.x+shiftX,y=screen.y+shiftY,ndcX=(x/Math.max(rect.width,1))*2-1,ndcY=-(y/Math.max(rect.height,1))*2+1;return toVoxel(new THREE.Vector3(ndcX,ndcY,anchorNdc.z).unproject(camera))});
  if(mode==='line'&&full.length>1)return[full[0],full[full.length-1]];return full;
 };
 const sectionDragHit=e=>{
  if(!sectionViewOpen||!sectionViewPlane||analysisEditTool!=='select'||threeRenderMode!=='surface'||!sceneState.obj)return null;
  const entry=sceneState.mprPlaneEntries?.[sectionViewPlane];if(!entry?.mesh?.visible)return null;
  const rect=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2(((e.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((e.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const targets=[entry.mesh,entry.highlight].filter(Boolean);return raycaster.intersectObjects(targets,false)[0]||null;
 };
 const sectionScreenStep=()=>{
  const p=sectionViewPlane,point=sectionLocalPoint(p),step=sectionLocalStep(p);if(!p||!point||!step||!sceneState.obj)return null;
  sceneState.obj.updateMatrixWorld(true);
  const a=point.clone().applyMatrix4(sceneState.obj.matrixWorld).project(camera),b=point.clone().add(step).applyMatrix4(sceneState.obj.matrixWorld).project(camera),rect=renderer.domElement.getBoundingClientRect();
  const x=(b.x-a.x)*rect.width*.5,y=-(b.y-a.y)*rect.height*.5,len2=x*x+y*y;return len2>=.25?{x,y,len2}:null;
 };
 const dragSectionPlane=(start,e)=>{
  const p=start?.sectionPlane;if(!p||sectionViewPlane!==p||!planes[p])return;
  const step=start.sectionScreenStep,dx=e.clientX-start.x,dy=e.clientY-start.y,delta=step?Math.round((dx*step.x+dy*step.y)/step.len2):Math.round(-dy/8),max=+planes[p].slider.max,idx=Math.max(0,Math.min(max,start.sectionIndex+delta));
  if(idx===+planes[p].slider.value)return;
  planes[p].slider.value=idx;planes[p].label.textContent=idx+1;if(sectionPosition)sectionPosition.value=idx;
  updateMpr3DPlanePositions();updateSectionClipPlaneWorld();rebindWebGpuSectionClipGroup();updateSectionViewUi();request3DRender();renderSectionPlaneLive(p);
 };
 const drawEditStroke=mode=>{const ctx=threeEditOverlay?.getContext('2d');if(!ctx)return;ctx.clearRect(0,0,threeEditOverlay.width,threeEditOverlay.height);if(!analysisCutScreen.length)return;ctx.save();ctx.strokeStyle='#00e5ff';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(mode==='line'?[8,5]:[]);ctx.beginPath();ctx.moveTo(analysisCutScreen[0].x,analysisCutScreen[0].y);for(let i=1;i<analysisCutScreen.length;i++)ctx.lineTo(analysisCutScreen[i].x,analysisCutScreen[i].y);if(mode==='lasso'){ctx.closePath();ctx.fillStyle='rgba(0,229,255,.12)';ctx.fill()}ctx.stroke();ctx.restore()};
 const appendCutScreenPoints=(e,mode)=>{
  const rect=renderer.domElement.getBoundingClientRect(),events=typeof e.getCoalescedEvents==='function'&&e.getCoalescedEvents().length?e.getCoalescedEvents():[e];
  for(const ce of events){
   const p={x:ce.clientX-rect.left,y:ce.clientY-rect.top};
   if(mode==='line'){setAnalysisCutScreen([analysisCutScreen[0],p]);continue}
   const last=analysisCutScreen[analysisCutScreen.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=.65)analysisCutScreen.push(p);
  }
  drawEditStroke(mode);
 };
 const resampleCutScreenCurve=(curve,step=3)=>{
  if(!curve?.length)return[];if(curve.length===1)return[{...curve[0]}];
  const out=[{...curve[0]}];let carry=0;
  for(let i=1;i<curve.length;i++){
   const a=curve[i-1],b=curve[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<1e-6)continue;
   let dist=step-carry;
   while(dist<=len){const t=dist/len;out.push({x:a.x+dx*t,y:a.y+dy*t});dist+=step}
   carry=Math.max(0,len-(dist-step));
  }
  const last=curve[curve.length-1],tail=out[out.length-1];if(!tail||Math.hypot(last.x-tail.x,last.y-tail.y)>.5)out.push({...last});
  return out;
 };
 const collectCutSurfaceSamples=async(screenCurve)=>{
  const rect=renderer.domElement.getBoundingClientRect(),samples=[];let preferred=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;
  const volumeMode=threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active;
  const volumeMeta=(picked,screen)=>{
   if(!picked)return null;sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
   const mouse=new THREE.Vector2((screen.x/Math.max(rect.width,1))*2-1,-(screen.y/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
   const inv=sceneState.obj.matrixWorld.clone().invert(),toVoxelDir=vec=>{const q=vec.clone().transformDirection(inv).normalize();return{x:q.x,y:-q.y,z:q.z}};
   return{...picked,ray:toVoxelDir(raycaster.ray.direction),right:toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)),up:toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1)),hit:null,volume:true};
  };
  const probe=async step=>{
   const points=resampleCutScreenCurve(screenCurve,step);let hitCount=0;
   if(volumeMode){
    const clients=points.map(p=>({clientX:rect.left+p.x,clientY:rect.top+p.y}));
    let picked;
    if(!preferred){
     const auto=await sceneState.medicalVolume.pickMany(clients,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER,null),first=auto.find(Boolean);preferred=first?.key||null;
     if(!preferred){for(const screen of points)samples.push({screen,surface:null});return 0}
    }
    picked=await sceneState.medicalVolume.pickMany(clients,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER,preferred);
    for(let i=0;i<points.length;i++){const surface=volumeMeta(picked[i],points[i]);samples.push({screen:points[i],surface});if(surface)hitCount++}
   }else{
    for(let i=0;i<points.length;i++){const screen=points[i],surface=cutPointerVoxel({clientX:rect.left+screen.x,clientY:rect.top+screen.y},renderer.domElement,camera,preferred);samples.push({screen,surface});if(surface){hitCount++;if(analysisEditTargetMode==='auto'&&!preferred)preferred=surface.key||null}if((i&63)===63)await frameYield()}
   }
   return hitCount;
  };
  const primaryStep=volumeMode?3:(sceneState?.cutRaycastAccelerated?3:6);let hits=await probe(primaryStep);
  if(!hits&&primaryStep>2)hits=await probe(2);
  if(analysisEditTargetMode==='auto')setAnalysisEditTargetKey(preferred);else setAnalysisEditTargetKey(analysisEditTargetMode);
  return samples;
 };
 renderer.domElement.oncontextmenu=e=>e.preventDefault();
 renderer.domElement.onpointerdown=e=>{const cutTool=analysisEditTool==='pen'||analysisEditTool==='line',editViewReady=!!sceneState.obj&&(threeRenderMode==='surface'||(threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active)),cutReady=cutTool&&!analysisPendingCut&&!analysisCutApplying&&!analysisEditPreparing&&e.button===0&&!e.altKey&&editViewReady,lassoReady=analysisEditTool==='lasso'&&!analysisPendingCut&&!analysisCutApplying&&!analysisEditPreparing&&!volumeAnalysisBusy&&e.button===0&&!e.altKey&&editViewReady,sectionHit=!cutReady&&!lassoReady&&e.button===0&&!e.altKey?sectionDragHit(e):null,mode=cutReady?(analysisEditTool==='line'?'cut-line':'cut-pen'):lassoReady?'lasso':sectionHit?'section-drag':isMousePanStart(e)?'pan':(e.altKey?'roll':'rotate'),point={x:e.clientX,y:e.clientY,mode,pointerType:e.pointerType};if(lassoReady){setAnalysisCutScreen([editPoint(e)]);drawEditStroke('lasso')}if(!cutReady&&!lassoReady&&!sectionHit){begin3DInteraction();if(mode==='rotate'||mode==='roll')showViewPivot()}pointers.set(e.pointerId,point);pointerStarts.set(e.pointerId,{x:e.clientX,y:e.clientY,mode,sectionPlane:sectionHit?sectionViewPlane:null,sectionIndex:sectionHit?+planes[sectionViewPlane].slider.value:null,sectionScreenStep:sectionHit?sectionScreenStep():null,cutFrame:null});if(sectionHit){renderer.domElement.style.cursor='grabbing';footer.textContent=(currentLanguage==='ja'?sectionPlaneLabel(sectionViewPlane)+'断面をドラッグ中':'Dragging '+sectionPlaneLabel(sectionViewPlane)+' section')}if(cutReady){setAnalysisCutStroke([]);setAnalysisCutScreen([editPoint(e)]);pointerStarts.get(e.pointerId).cutSamples=[];setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateThreeEditUi(analysisEditTargetKey?(tr(analysisEditTargetKey)||analysisEditTargetKey)+' · '+(analysisEditTool==='pen'?tr('cutRegion'):tr('lineCutRegion')):(currentLanguage==='ja'?'切断線を描画中':'Drawing cut stroke'));footer.textContent=currentLanguage==='ja'?'切断線を描画中':'Drawing cut stroke';drawEditStroke(analysisEditTool)}renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size>=2){const[a,b]=[...pointers.values()];lastPinch=Math.hypot(b.x-a.x,b.y-a.y);lastCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2};lastTwist=Math.atan2(b.y-a.y,b.x-a.x)}};
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId),start=pointerStarts.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{...prev,x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;if(prev.mode==='section-drag'){dragSectionPlane(start,e);return}if(prev.mode==='lasso'){appendCutScreenPoints(e,'lasso');return}if(prev.mode==='cut-pen'||prev.mode==='cut-line'){appendCutScreenPoints(e,prev.mode==='cut-line'?'line':'pen');return}if(prev.mode==='pan'){pan3D(dx,dy);request3DRender();return}if(prev.mode==='roll'){const rect=renderer.domElement.getBoundingClientRect(),cx=rect.left+rect.width*.5,cy=rect.top+rect.height*.5,a0=Math.atan2(prev.y-cy,prev.x-cx),a1=Math.atan2(e.clientY-cy,e.clientX-cx);let da=a1-a0;if(da>Math.PI)da-=Math.PI*2;if(da<-Math.PI)da+=Math.PI*2;if(Math.hypot(prev.x-cx,prev.y-cy)<24)da=dx*.008;showViewPivot();rollAroundViewCenter(da);request3DRender();return}showViewPivot();rotateAroundViewCenter(dx,dy);request3DRender();return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},twist=Math.atan2(b.y-a.y,b.x-a.x);if(lastPinch){showViewPivot();distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),MIN_3D_DISTANCE,MAX_3D_DISTANCE);camera.position.z=distance;setFastInteraction(true)}if(lastCenter){pan3D(center.x-lastCenter.x,center.y-lastCenter.y)}if(lastTwist!=null){let da=twist-lastTwist;if(da>Math.PI)da-=Math.PI*2;if(da<-Math.PI)da+=Math.PI*2;if(Math.abs(da)>.001){showViewPivot();rollAroundViewCenter(da)}}lastPinch=d;lastCenter=center;lastTwist=twist;request3DRender()};
 const endPointer=async e=>{const start=pointerStarts.get(e.pointerId),wasSingle=pointers.size===1,isCut=start?.mode==='cut-pen'||start?.mode==='cut-line',isSectionDrag=start?.mode==='section-drag';
  const isLasso=start?.mode==='lasso';
  if(isCut&&e.type==='pointerup')appendCutScreenPoints(e,start.mode==='cut-line'?'line':'pen');
  if(isLasso&&e.type==='pointerup')appendCutScreenPoints(e,'lasso');
  const screenCurve=isCut||isLasso?[...analysisCutScreen]:null;
  clear3DPointerState(e.pointerId);
  if(!pointers.size&&!isCut&&!isLasso&&!isSectionDrag)end3DInteraction();
  if(isLasso){
   setAnalysisCutScreen([]);clearThreeEditOverlay();
   if(e.type!=='pointerup'||!screenCurve||screenCurve.length<3){updateThreeEditUi(currentLanguage==='ja'?'囲みをキャンセルしました':'Lasso cancelled');return}
   void selectRegionsInLasso(screenCurve,renderer.domElement,camera);return;
  }
  if(isSectionDrag){renderer.domElement.style.cursor='';if(start?.sectionPlane===sectionViewPlane)schedulePlaneRender(sectionViewPlane,true);footer.textContent=currentLanguage==='ja'?sectionPlaneLabel(sectionViewPlane)+'断面 '+(+planes[sectionViewPlane].slider.value+1)+' / '+(+planes[sectionViewPlane].slider.max+1):sectionPlaneLabel(sectionViewPlane)+' section '+(+planes[sectionViewPlane].slider.value+1)+' / '+(+planes[sectionViewPlane].slider.max+1);return}
  if(isCut){
   setAnalysisCutStroke(null);
   if(e.type!=='pointerup'||!screenCurve||screenCurve.length<2){setAnalysisCutScreen([]);clearThreeEditOverlay();updateThreeEditUi(currentLanguage==='ja'?'切断線をキャンセルしました':'Cut stroke cancelled');return}
   updateThreeEditUi(currentLanguage==='ja'?'切断面を確定中…':'Resolving cut surface…');footer.textContent=currentLanguage==='ja'?'切断面を確定中…':'Resolving cut surface…';
   await frameYield();
   const cutMode=start.mode==='cut-line'?'line':'pen',cutSamples=await collectCutSurfaceSamples(screenCurve),surfaceStroke=cutSamplesToSurfaceStroke(cutSamples,cutMode,screenCurve),finalStroke=surfaceStroke.length>=2?surfaceStroke:[];
   if(finalStroke.length>=2&&analysisEditTargetKey){
    setAnalysisPendingCut({points:finalStroke,key:analysisEditTargetKey,mode:cutMode});setAnalysisCutScreen([]);clearThreeEditOverlay();sceneState.editCutPreviewPoint=finalStroke[finalStroke.length-1];updateCutPreview(sceneState.editCutPreviewPoint);footer.textContent=currentLanguage==='ja'?'切断予定を作成しました。深さ・幅・角度を調整してください':'Cut plan created. Adjust depth, width and angles.';updateThreeEditUi(tr('cutPendingHint'));
   }else{setAnalysisCutScreen([]);clearThreeEditOverlay();updateThreeEditUi(currentLanguage==='ja'?'切断線が対象表面にありません':'The cut stroke did not hit the target surface')}
   return;
  }
  if(e.type==='pointerup'&&e.button===0&&wasSingle&&start?.mode==='rotate'&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6&&!volumeAnalysisBusy){if(analysisEditTool==='region')void analyzeEditRegionAtPointer(e,renderer.domElement,camera);else if(volumeAnalysisMode)void analyzeVolumeAtPointer(e,renderer.domElement,camera)}
 };
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.onlostpointercapture=e=>{const start=pointerStarts.get(e.pointerId);pointers.delete(e.pointerId);pointerStarts.delete(e.pointerId);if(!analysisPendingCut){setAnalysisCutScreen([]);clearThreeEditOverlay()}renderer.domElement.style.cursor='';if(pointers.size<2){lastPinch=0;lastCenter=null;lastTwist=null}if(!pointers.size&&start?.mode!=='section-drag')end3DInteraction()};
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();begin3DInteraction();showViewPivot();clearTimeout(wheelQualityTimer);distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,MIN_3D_DISTANCE,MAX_3D_DISTANCE);camera.position.z=distance;setFastInteraction(true);request3DRender();wheelQualityTimer=setTimeout(()=>end3DInteraction(),120)},{passive:false});
 const resize=()=>{const rect=viewport.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);if(w<8||h<8)return;camera.aspect=w/h;camera.updateProjectionMatrix();updateAxisWidget();renderer.setPixelRatio(active3DPixelRatio);renderer.setSize(w,h,false);resizeEditOverlay(w,h);sceneState?.medicalVolume?.resize();request3DRender()};sceneState.resize=resize;new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>{if(!sceneState?.needsRender)return;if(viewport.clientWidth<8||viewport.clientHeight<8)return;sceneState.needsRender=false;// 3D hidden (2D-only layout): keep the request until it is shown again
syncVolumeAnalysisOverlay();if(sceneState.obj){axisWidget.quaternion.copy(sceneState.obj.quaternion);if(sectionViewOpen&&sectionViewPlane)updateSectionClipPlaneWorld();if(sceneState.mprPlaneGroup){sceneState.mprPlaneGroup.visible=true;sceneState.mprPlaneGroup.position.copy(sceneState.obj.position);sceneState.mprPlaneGroup.quaternion.copy(sceneState.obj.quaternion);sceneState.mprPlaneGroup.scale.copy(sceneState.obj.scale)}}else if(sceneState.mprPlaneGroup)sceneState.mprPlaneGroup.visible=false;if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){const interactiveVisible=mpr3DHideDuringCameraMoves&&fastInteractionActive&&!fastKeepOverlays?[sectionViewOpen&&sectionViewPlane==='axial'&&sectionSliceImageVisible?1:0,sectionViewOpen&&sectionViewPlane==='coronal'&&sectionSliceImageVisible?1:0,sectionViewOpen&&sectionViewPlane==='sagittal'&&sectionSliceImageVisible?1:0]:[sectionViewOpen&&sectionViewPlane==='axial'?(sectionSliceImageVisible?1:0):(mpr3DVisibility.axial?1:0),sectionViewOpen&&sectionViewPlane==='coronal'?(sectionSliceImageVisible?1:0):(mpr3DVisibility.coronal?1:0),sectionViewOpen&&sectionViewPlane==='sagittal'?(sectionSliceImageVisible?1:0):(mpr3DVisibility.sagittal?1:0)];sceneState.medicalVolume.render(camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER,{indices:[+planes.axial.slider.value,+planes.coronal.slider.value,+planes.sagittal.slider.value],visible:interactiveVisible,opacity:mpr3DVolumeOpacity,windowCenter:+wc.value,windowWidth:+ww.value,section:{active:sectionViewOpen&&!!sectionViewPlane,plane:sectionViewPlane,index:sectionViewPlane?+planes[sectionViewPlane].slider.value:0,reverse:sectionViewReverse,capEnabled:sectionCapEnabled,capOpacity:sectionCapOpacity,hatch:sectionCapHatch}});renderer.render(scene,camera)}else renderer.render(scene,camera)});
}
async function sourceSegmentMaskBlock(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart);
 if(stages.length){
  const block=await getFilteredSourceAxialMaskBlock(zStart,coreDepth,series,[{key,seg}],'analysis:'+analysisRevision);
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const masks=[];
  for(let z=0;z<block.coreDepth;z++){
   const bits=block.data.subarray(z*series.columns*series.rows,(z+1)*series.columns*series.rows),mask=new Uint8Array(bits.length);
   for(let i=0;i<bits.length;i++)mask[i]=(bits[i]&1)?1:0;
   masks.push(mask);
  }
  return masks;
 }
 const masks=[];
 for(let z=0;z<coreDepth;z++){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  const state=(await decodeSourceSegmentMasks(series.slices[zStart+z],[{key,seg}])).get(key);masks.push(state.mask);
 }
 return masks;
}
function sourceAnalysisBlockDepth(w,h){
 const preferred=navigator.maxTouchPoints>0?4:16,maxGroups=65535,workgroupSize=256,plane=Math.max(1,w*h),safe=Math.max(1,Math.floor(maxGroups*workgroupSize/plane));
 return Math.max(1,Math.min(preferred,safe));
}
async function sourceSegmentRunBlockGpu(v,key,seg,zStart,depth,analysisRevision){
 const series=v.series,stages=sourceFilterStages(),coreDepth=Math.min(depth,series.slices.length-zStart),device=await ensureGpuFilterDevice();if(!device)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
 const maxGroups=Number(device.limits?.maxComputeWorkgroupsPerDimension)||65535;if(Math.ceil(series.columns*series.rows*coreDepth/256)>maxGroups)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
 let rawError=null;
 if(!stages.length&&series.slices.slice(zStart,zStart+coreDepth).every(meta=>isNativeDicomTransferSyntax(meta.ts))){
  try{
   const raw=await gpuValidationScope(device,'raw DICOM analysis RLE',()=>extractSourceThresholdRuns(device,series,zStart,coreDepth,seg));
   if(raw){setGpuComputeBackend('WEBGPU ANALYSIS RAW-RLE');return raw}
  }catch(e){rawError=e;console.warn('Raw DICOM GPU RLE unavailable; retrying decoded CT on WebGPU.',e)}
 }
 const halo=sourceFilterHalo(stages),z0=Math.max(0,zStart-halo),z1=Math.min(series.slices.length,zStart+coreDepth+halo),box={x:0,y:0,z:z0,width:series.columns,height:series.rows,depth:z1-z0},data=await readSourceRegion(series,box,analysisRevision,true);
 if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
 const target={x:0,y:0,z:zStart-z0,width:series.columns,height:series.rows,depth:coreDepth};
 try{
  const result=await gpuValidationScope(device,'decoded CT analysis RLE',()=>runGpuSourceFilters(data,box.width,box.height,box.depth,v.min,v.max,stages,target,[{key,seg}],{analysisRuns:true}));
  if(!result?.analysisRuns)throw new Error('__GPU_ANALYSIS_UNAVAILABLE__');
  setGpuComputeBackend(stages.length?'WEBGPU ANALYSIS FILTER+RLE':'WEBGPU ANALYSIS DECODED-RLE',rawError?.message||null);
  return{items:result.items,coreDepth};
 }catch(e){
  if(rawError&&String(e.message||e)==='__GPU_ANALYSIS_UNAVAILABLE__')gpuFilterRuntime.lastError='raw RLE: '+String(rawError.message||rawError);
  throw e;
 }
}
async function connectedComponentVolumeGpuRuns(v,key,seg,x0,y0,z0){
 const device=await ensureGpuFilterDevice();if(!device||segmentNeedsGlobalMask(seg))return null;
 const w=v.columns,h=v.rows,d=v.slices,uf=new RunUnionFind(),sliceRuns=new Array(d),seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity},plane=w*h;
 let prevRows=null,done=0;const blockDepth=sourceAnalysisBlockDepth(w,h);
 try{
  for(let z0b=0;z0b<d;z0b+=blockDepth){
   const coreDepth=Math.min(blockDepth,d-z0b),data=readMemoryRegion(v,{x:0,y:0,z:z0b,width:w,height:h,depth:coreDepth}),target={x:0,y:0,z:0,width:w,height:h,depth:coreDepth};
   const result=await gpuValidationScope(device,'analysis RLE',()=>runGpuSourceFilters(data,w,h,coreDepth,v.min,v.max,[],target,[{key,seg}],{analysisRuns:true}));
   if(!result?.analysisRuns)return null;
   prevRows=consumeGpuAnalysisRuns(result.items,z0b,coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+coreDepth;
   analysisSummary.textContent=(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… ')+done+' / '+d;await frameYield();
  }
 }catch(e){setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',e?.message||e);console.warn('GPU connected-component run extraction failed; CPU analysis will be used.',e);return null}
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];setGpuComputeBackend('WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');return{voxels,mm3,root,uf,sliceRuns};
}
async function connectedComponentVolumeSource(v,key,seg,x0,y0,z0){
 const w=v.columns,h=v.rows,d=v.slices,analysisRevision=sourceFilterRuntime.revision,uf=new RunUnionFind(),sliceRuns=new Array(d);
 const seed={x:Math.max(0,Math.min(w-1,x0)),y:Math.max(0,Math.min(h-1,y0)),z:Math.max(0,Math.min(d-1,z0)),label:null,bestDist2:Infinity};
 let prevRows=null,done=0,gpuUsed=false,hadCpuPath=false;const blockDepth=sourceAnalysisBlockDepth(w,h);
 analysisSummary.textContent=(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… ')+'0 / '+d;
 for(let z0b=0;z0b<d;z0b+=blockDepth){
  if(analysisRevision!==sourceFilterRuntime.revision)throw new Error('__SUPERSEDED__');
  let gpuBlock=null;
  try{gpuBlock=await sourceSegmentRunBlockGpu(v,key,seg,z0b,blockDepth,analysisRevision)}catch(e){if(String(e.message||e)!=='__GPU_ANALYSIS_UNAVAILABLE__'){gpuFilterRuntime.lastError=String(e.message||e);console.warn('GPU source analysis block failed; using CPU mask block.',e)}}
  if(gpuBlock){
   gpuUsed=true;prevRows=consumeGpuAnalysisRuns(gpuBlock.items,z0b,gpuBlock.coreDepth,w,h,seed,uf,prevRows,sliceRuns);done=z0b+gpuBlock.coreDepth;
  }else{
   hadCpuPath=true;setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0b,blockDepth,analysisRevision);
   for(let local=0;local<masks.length;local++){const z=z0b+local,result=sourceRunSlice(masks[local],w,h,z,seed,uf,prevRows);sliceRuns[z]=result.records;prevRows=result.rows;done=z+1}
   setGpuComputeBackend('CPU ANALYSIS · GPU ERROR',gpuFilterRuntime.lastError||'GPU analysis unavailable');
  }
  analysisSummary.textContent=((gpuUsed&&!hadCpuPath)?(currentLanguage==='ja'?'GPU連結成分解析中… ':'GPU connected-component analysis… '):(currentLanguage==='ja'?'連結成分を解析中… ':'Analyzing connected component… '))+done+' / '+d;await frameYield();
 }
 if(seed.label==null)throw new Error(currentLanguage==='ja'?'選択位置から連結成分を特定できませんでした':'Could not identify a connected component at the selected point');
 const root=uf.find(seed.label),voxels=uf.size[root],mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
 if(gpuUsed&&!hadCpuPath)setGpuComputeBackend(sourceFilterStages().length?'WEBGPU ANALYSIS FILTER+RLE · CPU CONNECTIVITY':'WEBGPU ANALYSIS RLE · CPU CONNECTIVITY');
 else if(gpuUsed&&hadCpuPath)setGpuComputeBackend('GPU+CPU ANALYSIS',gpuFilterRuntime.lastError||'Some analysis blocks used the exact CPU path');
 return{voxels,mm3,root,uf,sliceRuns};
}
async function showSourceAnalysisHighlight(v,result,key){
 clearAnalysisHighlight();if(!sceneState?.obj)return;
 const series=v.series,w=v.columns,h=v.rows,d=v.slices,coords=makeSource3DCoordinates(series),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{
  const positions=builder.take();if(!positions)return;
  const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial());
  mesh.name='analysis_'+key+'_'+z;mesh.renderOrder=20;group.add(mesh);
 };
 let prev=null,curr=sourceComponentSliceState(result.sliceRuns[0],w,h,result.root,result.uf),next=d>1?sourceComponentSliceState(result.sliceRuns[1],w,h,result.root,result.uf):null;
 for(let z=0;z<d;z++){
  appendSourceSliceFacesFast(builder,series,z,prev,curr,next,coords);
  if(builder.length>=floatLimit)flush(z);
  prev=curr;curr=next;next=z+2<d?sourceComponentSliceState(result.sliceRuns[z+2],w,h,result.root,result.uf):null;
  if((z&31)===0)await frameYield();
 }
 flush(d-1);
 if(!group.children.length)return;
 sceneState.analysisMesh=group;sceneState.obj.add(group);request3DRender();
}
function surfacePointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const hits=raycaster.intersectObjects(sceneState.obj.children,true);
 const hit=hits.find(h=>h.object?.userData?.analysisRegionId===analysisFocusedRegionId)||(preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):null)||hits.find(h=>segmentKeyFromIntersection(h)||h.object?.userData?.analysisRegionId);
 if(!hit)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone());
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),hit};
}
function surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey=null){
 if(!sceneState?.obj||!volume)return null;
 sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/Math.max(rect.width,1))*2-1,-((event.clientY-rect.top)/Math.max(rect.height,1))*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
 const targets=cutRaycastSourceMeshes(preferredKey),hits=raycaster.intersectObjects(targets,false),hit=preferredKey?hits.find(h=>segmentKeyFromIntersection(h)===preferredKey):hits.find(h=>segmentKeyFromIntersection(h));
 if(!hit)return null;
 const key=segmentKeyFromIntersection(hit);if(!key)return null;
 const v=current3DVolume||volume,[vx,vy,vz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*vx,py=h*vy,pz=d*vz,scale=3.3/Math.max(px,py,pz,1),local=sceneState.obj.worldToLocal(hit.point.clone()),inv=sceneState.obj.matrixWorld.clone().invert(),toVoxelDir=vec=>{const q=vec.clone().transformDirection(inv).normalize();return{x:q.x,y:-q.y,z:q.z}},localRay=toVoxelDir(raycaster.ray.direction),cameraRight=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0)),cameraUp=toVoxelDir(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1));
 return{x:Math.max(0,Math.min(w-1,Math.round((local.x/scale+px/2)/vx))),y:Math.max(0,Math.min(h-1,Math.round((-local.y/scale+py/2)/vy))),z:Math.max(0,Math.min(d-1,Math.round((local.z/scale+pz/2)/vz))),ray:localRay,right:cameraRight,up:cameraUp,hit,key};
}
function cutPointerVoxel(event,canvas,camera,preferredKey=null){
 return surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey);
}
async function segmentKeyAtVoxel(v,x,y,z){
 const w=v.columns,h=v.rows,d=v.slices;if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return null;
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||!(segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg))))continue;
  const runs=await getFinalSegmentRuns(key,v);if(analysisRunsContain(runs,x,y,z))return key;
 }
 let value=null;
 if(v.sourceBacked){
  if(sourceFilterStages().length){
   const values=await getFilteredSourcePlaneValues('axial',z,v.series,'analysis-pick');value=values[y*w+x];
  }else{
   const values=await getCachedSourceSlice(v.series.slices[z]);value=values[y*w+x];
  }
 }else value=v.data[z*h*w+y*w+x];
 for(const key of SEGMENT_PRESET_ORDER){
  const seg=segmentState[key];if(!seg.active||!seg.enabled||segmentEditActive(key)||(v.sourceBacked&&segmentNeedsGlobalMask(seg)))continue;
  if(!v.sourceBacked&&segmentNeedsGlobalMask(seg)){const mask=getProcessedSegmentMask(v,seg);if(mask[z*h*w+y*w+x]===1)return key}
  else if(value>=seg.min&&value<=seg.max)return key;
 }
 return null;
}
async function analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z){
 const [vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,seg=segmentState[key];
 // Filtered source-backed volumes: analyse the cached filtered runs of the
 // segment (built once per filter/segment setting, shared with the edit
 // tools) instead of re-filtering the whole volume on every click.
 if(segmentEditActive(key)||(analysisVolume.sourceBacked&&(segmentNeedsGlobalMask(seg)||sourceFilterStages().length>0))){
  const showRunProgress=(done,total)=>{const text=(currentLanguage==='ja'?'フィルター適用済みの領域を準備中… ':'Preparing filtered segment… ')+done+' / '+total;analysisSummary.textContent=text;if(threeBusyLabel)threeBusyLabel.textContent=text};
  const runs=await getFinalSegmentRuns(key,analysisVolume,showRunProgress),comps=await componentsFromRunsAsync(runs,w,h,d,(phase,done,total)=>{if(threeBusyLabel)threeBusyLabel.textContent=(currentLanguage==='ja'?'領域を解析中… ':'Analyzing region… ')+done+' / '+total});let comp=comps.find(item=>analysisRunsContain(item.runsBySlice,x,y,z));
  if(!comp){for(let r=1;r<=2&&!comp;r++)for(let dz=-r;dz<=r&&!comp;dz++)for(let dy=-r;dy<=r&&!comp;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(ix<0||iy<0||iz<0||ix>=w||iy>=h||iz>=d)continue;comp=comps.find(item=>analysisRunsContain(item.runsBySlice,ix,iy,iz));if(comp)break}}
  if(!comp)throw new Error(currentLanguage==='ja'?'処理後の領域を特定できませんでした':'Could not identify the processed component');
  const mm3=comp.voxels*vx*vy*vz;setGpuComputeBackend('PROCESSED RLE · CPU CONNECTIVITY');return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels:comp.voxels,mm3});
 }
 if(analysisVolume.sourceBacked){
  const result=await connectedComponentVolumeSource(analysisVolume,key,seg,x,y,z),runsBySlice=sourceResultToAnalysisRuns(result,d);
  return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
 }
 const gpuResult=await connectedComponentVolumeGpuRuns(analysisVolume,key,seg,x,y,z);
 if(gpuResult){
  const runsBySlice=sourceResultToAnalysisRuns(gpuResult,d);return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:gpuResult.voxels,mm3:gpuResult.mm3});
 }
 setGpuComputeBackend('CPU ANALYSIS');
 const processedMask=getProcessedSegmentMask(analysisVolume,seg),inside=(ix,iy,iz)=>ix>=0&&iy>=0&&iz>=0&&ix<w&&iy<h&&iz<d&&processedMask[iz*h*w+iy*w+ix]===1;
 if(!inside(x,y,z)){
  let found=null;for(let r=1;r<=2&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(inside(ix,iy,iz)){found=[ix,iy,iz];break}}
  if(!found)throw new Error(currentLanguage==='ja'?'選択位置から領域を特定できませんでした':'Could not identify a component at the selected point');
  [x,y,z]=found;
 }
 const result=await connectedComponentVolume(analysisVolume,seg,x,y,z,processedMask),runsBySlice=maskToAnalysisRuns(result.mask,w,h,d);
 return addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice,voxels:result.voxels,mm3:result.mm3});
}
async function analyzeVolumeAtVoxel(x,y,z,keyHint=null,showResult=true){
 if(!volume||volumeAnalysisBusy)return false;const analysisVolume=current3DVolume||volume;
 setVolumeAnalysisBusy(true);
 if(showResult){volumeAnalysisResult.classList.remove('is-hidden');set3DBusy(true,currentLanguage==='ja'?'体積解析中…':'Analyzing volume…',false);await frameYield()}
 renderAnalysisResults(currentLanguage==='ja'?'解析中…':'Analyzing…');
 try{
  const key=keyHint||await segmentKeyAtVoxel(analysisVolume,x,y,z);
  if(!key){renderAnalysisResults(currentLanguage==='ja'?'選択位置に解析対象の領域がありません':'No analyzable segment at the selected point');return false}
  await analyzeVolumeComponentAtVoxel(analysisVolume,key,x,y,z);return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'体積解析エラー: ':'Volume analysis error: ')+String(e.message||e))}
  return false;
 }finally{
  setVolumeAnalysisBusy(false);
  if(showResult)set3DBusy(false,'',false);
  renderAnalysisResults();
 }
}
// Owner rule: after a 3D edit operation completes, return to "Navigate"
// (operations that failed or found nothing keep the tool for a retry).
function returnToNavigate(){
 if(analysisEditTool==='select')return;
 setAnalysisEditTool('select');setAnalysisEditTargetKey(analysisEditTargetMode==='auto'?null:analysisEditTargetMode);updateAnalysisEditorControls();
}
// Lasso tool: select every connected piece of the target segment(s) whose
// voxels all project inside the drawn loop (owner choice: pieces crossing the
// loop, e.g. the main structure, are never selected). Pieces of one segment
// are merged into a single analysis region so "Delete selected region"
// removes them together, and hundreds of noise specks do not create hundreds
// of regions.
async function selectRegionsInLasso(poly,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const analysisVolume=current3DVolume||volume,[vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices;
 const keys=analysisEditTargetMode==='auto'?SEGMENT_PRESET_ORDER.filter(k=>segmentState[k]?.active&&segmentState[k]?.enabled):[analysisEditTargetMode];
 sceneState.obj.updateMatrixWorld(true);camera.updateMatrixWorld(true);
 const rect=canvas.getBoundingClientRect(),viewProjection=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const project=makeVoxelProjector(analysisVolume,sceneState.obj.matrixWorld.elements,viewProjection.elements,rect.width,rect.height),bounds=polygonBounds(poly);
 setVolumeAnalysisBusy(true);set3DBusy(true,currentLanguage==='ja'?'囲み範囲の領域を解析中…':'Analyzing lasso selection…',false);await frameYield();
 let pieces=0,failed=false;
 try{
  for(const key of keys){
   const runs=await getFinalSegmentRuns(key,analysisVolume);if(!runs)continue;
   const comps=await componentsFromRunsAsync(runs,w,h,d,(phase,done,total)=>{if(threeBusyLabel)threeBusyLabel.textContent=(currentLanguage==='ja'?'囲み範囲の領域を解析中… ':'Analyzing lasso selection… ')+(total?Math.round(done/total*100)+'%':'')});
   const inside=[];
   for(let i=0;i<comps.length;i++){
    if(componentFullyInside(comps[i].runsBySlice,project,poly,{bounds}))inside.push(comps[i]);
    if(i%200===199)await frameYield();
   }
   if(!inside.length)continue;
   let merged=inside[0].runsBySlice,voxels=inside[0].voxels;
   for(let i=1;i<inside.length;i++){merged=unionRunArrays(merged,inside[i].runsBySlice,d);voxels+=inside[i].voxels}
   await addAnalysisRegion(analysisVolume,{key,segmentKeys:[key],runsBySlice:merged,voxels,mm3:voxels*vx*vy*vz,merged:inside.length>1});
   pieces+=inside.length;
  }
  setGpuComputeBackend('PROCESSED RLE · LASSO SELECTION');
 }catch(e){failed=true;if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);renderAnalysisResults((currentLanguage==='ja'?'囲み選択エラー: ':'Lasso selection error: ')+String(e.message||e))}}
 finally{setVolumeAnalysisBusy(false);set3DBusy(false,'',false);renderAnalysisResults()}
 updateAnalysisEditorControls();
 if(failed)return;
 if(pieces)returnToNavigate();
 updateThreeEditUi(pieces?(currentLanguage==='ja'?pieces+'個の塊を選択しました · 「選択領域を削除」で削除できます':pieces+' piece(s) selected · use Delete selected region'):(currentLanguage==='ja'?'囲みの中に完全に入っている領域がありません':'No piece lies completely inside the loop'));
}
async function analyzeEditRegionAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const preferredKey=analysisEditTargetMode==='auto'?null:analysisEditTargetMode;
 let picked=null;
 if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){
  setGpuComputeBackend('WEBGPU VOLUME PICK');
  if(preferredKey){const rect=canvas.getBoundingClientRect(),items=await sceneState.medicalVolume.pickMany([{clientX:event.clientX,clientY:event.clientY}],camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER,preferredKey);picked=items?.[0]||null}
  else picked=await sceneState.medicalVolume.pick(event.clientX,event.clientY,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);
  if(!picked){updateThreeEditUi(currentLanguage==='ja'?'選択できる領域がありません':'No selectable region');return}
 }else{
  picked=surfaceSegmentPointerVoxel(event,canvas,camera,preferredKey);
  if(!picked){updateThreeEditUi(currentLanguage==='ja'?'選択できる領域がありません':'No selectable region');return}
 }
 const key=preferredKey||picked.key;if(!key)return;
 const existing=analysisRegionAtVoxel(picked.x,picked.y,picked.z);
 if(existing?.segmentKeys?.includes(key)){setAnalysisFocusedRegion(existing.id,{x:picked.x,y:picked.y,z:picked.z});updateAnalysisEditorControls();returnToNavigate();updateThreeEditUi(currentLanguage==='ja'?'領域を選択しました · 「選択領域を削除」で削除できます':'Region selected · use Delete selected region');return}
 set3DBusy(true,currentLanguage==='ja'?'領域を解析中…':'Analyzing region…',false);await frameYield();
 let ok=false;try{ok=await analyzeVolumeAtVoxel(picked.x,picked.y,picked.z,key,false)}finally{set3DBusy(false,'',false)}
 if(ok){updateAnalysisEditorControls();returnToNavigate();updateThreeEditUi(currentLanguage==='ja'?'領域を選択しました · 「選択領域を削除」で削除できます':'Region selected · use Delete selected region')}
}
async function analyzeVolumeAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj||volumeAnalysisBusy)return;
 const analysisVolume=current3DVolume||volume,[vx,vy,vz]=analysisVolume.spacing,w=analysisVolume.columns,h=analysisVolume.rows,d=analysisVolume.slices,px=w*vx,py=h*vy,pz=d*vz;
 let key,x,y,z;
 if(threeRenderMode==='volume'&&sceneState.medicalVolume?.active){
  setGpuComputeBackend('WEBGPU VOLUME PICK');
  const picked=await sceneState.medicalVolume.pick(event.clientX,event.clientY,camera,sceneState.obj,segmentState,SEGMENT_PRESET_ORDER);
  if(!picked){renderAnalysisResults(tr('volumeHint'));return}
  key=picked.key;x=picked.x;y=picked.y;z=picked.z;
 }else{
  const rect=canvas.getBoundingClientRect(),mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1),raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const hits=raycaster.intersectObjects(sceneState.obj.children,true),analysisHit=hits.find(h=>h.object?.userData?.analysisRegionId!=null);
  if(analysisHit){const region=analysisRegionById(analysisHit.object.userData.analysisRegionId);if(region){const picked=surfacePointerVoxel(event,canvas,camera,region.segmentKeys[0]);setAnalysisFocusedRegion(region.id,picked?{x:picked.x,y:picked.y,z:picked.z}:null);return}}
  const hit=hits.find(h=>segmentKeyFromIntersection(h));
  if(!hit){renderAnalysisResults(tr('volumeHint'));return}
  key=segmentKeyFromIntersection(hit);const scale=hit.object.userData.displayScale,local=hit.object.worldToLocal(hit.point.clone());
  x=Math.round((local.x/scale+px/2)/vx);y=Math.round((-local.y/scale+py/2)/vy);z=Math.round((local.z/scale+pz/2)/vz);
 }
 await analyzeVolumeAtVoxel(x,y,z,key);
}
async function connectedComponentVolume(v,seg,x0,y0,z0,mask=getProcessedSegmentMask(v,seg)){
 const w=v.columns,h=v.rows,d=v.slices,n=w*h*d,data=v.data,visited=new Uint8Array(n);
 let queue=new Int32Array(65536),head=0,tail=0;
 const grow=()=>{const next=new Int32Array(queue.length*2);next.set(queue);queue=next};
 const start=z0*h*w+y0*w+x0;queue[tail++]=start;visited[start]=1;
 let count=0,steps=0;
 const tryPush=i=>{if(i<0||i>=n||visited[i]||!mask[i])return;visited[i]=1;if(tail>=queue.length)grow();queue[tail++]=i};
 while(head<tail){
  const i=queue[head++];count++;
  const z=Math.floor(i/(h*w)),rem=i-z*h*w,y=Math.floor(rem/w),x=rem-y*w;
  if(x>0)tryPush(i-1);if(x<w-1)tryPush(i+1);if(y>0)tryPush(i-w);if(y<h-1)tryPush(i+w);if(z>0)tryPush(i-h*w);if(z<d-1)tryPush(i+h*w);
  if((++steps&0x3ffff)===0)await frameYield();
 }
 return{voxels:count,mm3:count*v.spacing[0]*v.spacing[1]*v.spacing[2],mask:visited};
}

function createAnalysisMaterial(color=0x00d8ff){
 return new THREE.MeshStandardMaterial({
  color,emissive:color,emissiveIntensity:.55,transparent:true,opacity:.92,
  roughness:.35,metalness:0,side:THREE.DoubleSide,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,flatShading:!surfaceSmoothingActive()
 });
}
function segmentBaseSignature(key,v){
 const s=segmentState[key];return [activeId,key,s.min,s.max,s.opening,s.closing,s.minComponent,s.holeFill,filterRebuildRevision,sourceFilterRuntime.revision,v?.columns,v?.rows,v?.slices].join('|');
}
function clearSegmentEditCache(key,clearEdits=false){
 const st=segmentEditState[key];if(!st)return;st.baseRuns=null;st.baseSignature='';st.finalRuns=null;st.pendingBase=null;
 if(clearEdits){st.keepRuns=null;st.excludeRuns=null;st.cutRuns=null;st.rawCutSurface=false;st.undo=[];st.redo=[];st.revision=0}
}
function clearAllSegmentEdits(){
 for(const key of SEGMENT_PRESET_ORDER){const st=segmentEditState[key];if(st.surfaceGroup?.parent)st.surfaceGroup.parent.remove(st.surfaceGroup);st.surfaceGroup=null;clearSegmentEditCache(key,true)}
 setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);clearCutResultPreview();updateThreeEditUi();
}
function thresholdRunsFromMemory(v,seg){
 const w=v.columns,h=v.rows,d=v.slices,out=new Array(d),plane=w*h;
 if(segmentNeedsGlobalMask(seg))return maskToAnalysisRuns(getProcessedSegmentMask(v,seg),w,h,d);
 for(let z=0;z<d;z++){const rec=[],base=z*plane;for(let y=0;y<h;y++){let x=0,row=base+y*w;while(x<w){while(x<w&&(v.data[row+x]<seg.min||v.data[row+x]>seg.max))x++;if(x>=w)break;const x0=x;while(x+1<w&&v.data[row+x+1]>=seg.min&&v.data[row+x+1]<=seg.max)x++;rec.push(y,x0,x);x++}}out[z]=new Uint32Array(rec)}
 return out;
}
async function sourceRunsForSegment(v,key,seg,onProgress=null){
 if(segmentNeedsGlobalMask(seg)&&v.mprData){
  const memoryView=sourceMprMemoryView(v);
  return thresholdRunsFromMemory(memoryView,seg);
 }
 const d=v.slices,w=v.columns,h=v.rows,out=Array.from({length:d},()=>new Uint32Array(0)),revision=sourceFilterRuntime.revision,blockDepth=sourceAnalysisBlockDepth(w,h);
 onProgress?.(0,d);
 for(let z0=0;z0<d;z0+=blockDepth){
  let gpu=null;try{gpu=await sourceSegmentRunBlockGpu(v,key,seg,z0,blockDepth,revision)}catch(e){console.warn('Edit base GPU RLE failed; using exact CPU RLE path.',e)}
  if(gpu){
   const per=Array.from({length:gpu.coreDepth},()=>[]);
   for(let i=0;i<gpu.items.length;i+=4){const lz=gpu.items[i];if(lz<per.length)per[lz].push(gpu.items[i+1],gpu.items[i+2],gpu.items[i+3])}
   for(let z=0;z<gpu.coreDepth;z++)out[z0+z]=new Uint32Array(per[z]);
  }else{
   const masks=await sourceSegmentMaskBlock(v,key,seg,z0,blockDepth,revision);
   for(let z=0;z<masks.length;z++)out[z0+z]=maskToAnalysisRuns(masks[z],w,h,1)[0];
  }
  onProgress?.(Math.min(d,z0+blockDepth),d);
  if((z0&63)===0)await frameYield();
 }
 return segmentNeedsGlobalMask(seg)?postprocessSourceRuns(out,v,seg):out;
}
async function ensureSegmentBaseRuns(key,v=current3DVolume||volume,onProgress=null,quiet=false){
 if(!v||!segmentState[key])return null;const st=segmentEditState[key],sig=segmentBaseSignature(key,v);
 if(st.baseRuns&&st.baseSignature===sig)return st.baseRuns;
 // One computation per signature: a click during the background prewarm
 // waits for it (and receives its progress) instead of starting a second pass.
 if(st.pendingBase?.signature===sig){if(onProgress)st.pendingBase.listeners.add(onProgress);return st.pendingBase.promise}
 const pending={signature:sig,listeners:new Set(onProgress?[onProgress]:[]),promise:null},report=(done,total)=>{for(const fn of pending.listeners)fn(done,total)};
 pending.promise=(async()=>{
  if(!quiet)setProcessingBusy(true,currentLanguage==='ja'?'編集領域を準備中':'Preparing editable segment',false);
  try{const runs=v.sourceBacked?await sourceRunsForSegment(v,key,segmentState[key],report):thresholdRunsFromMemory(v,segmentState[key]);if(st.pendingBase===pending){st.baseRuns=runs;st.baseSignature=sig}return runs}
  finally{if(st.pendingBase===pending)st.pendingBase=null;if(!quiet)setProcessingBusy(false,'',false)}
 })();
 st.pendingBase=pending;return pending.promise;
}
// When volume analysis mode is turned on (usually in GPU volume view), compute
// each shown segment's filtered runs in the background so the first analysis
// click does not have to re-filter the whole volume. Quiet (no busy UI), one
// segment at a time; stops when analysis mode is turned off, the volume
// changes, or the filters change (`__SUPERSEDED__`). Only source-backed
// volumes with filters need it; a click during it joins the same computation.
function scheduleAnalysisRunPrewarm(){
 const v=current3DVolume||volume;
 if(!v?.sourceBacked||!sourceFilterStages().length)return;
 const keys=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key]?.active&&segmentState[key]?.enabled);
 setTimeout(async()=>{
  for(const key of keys){
   if(!volumeAnalysisMode||(current3DVolume||volume)!==v||!segmentState[key]?.active)return;
   try{await ensureSegmentBaseRuns(key,v,null,true)}catch(e){if(String(e.message||e)!=='__SUPERSEDED__')console.warn('Background analysis prewarm failed for '+key+'; analysis will compute on demand.',e);return}
  }
 },300);
}
async function getFinalSegmentRuns(key,v=current3DVolume||volume,onProgress=null){
 const st=segmentEditState[key],base=await ensureSegmentBaseRuns(key,v,onProgress);if(!base)return null;let runs=base,d=v.slices;
 if(st.keepRuns)runs=intersectRunArrays(runs,st.keepRuns,d);
 if(st.excludeRuns)runs=subtractRunArrays(runs,st.excludeRuns,d);
 st.finalRuns=runs;return runs;
}
function snapshotAnalysisRegionsForSegment(key){
 return analysisRegions.filter(r=>r.segmentKeys.length===1&&r.segmentKeys[0]===key).map(r=>({
  runsBySlice:r.runsBySlice,color:r.color,visible:r.visible,selected:r.selected,focused:r.id===analysisFocusedRegionId,merged:r.merged,groupId:r.groupId||null
 }));
}
function editSnapshot(key){const st=segmentEditState[key];return{keepRuns:st.keepRuns,excludeRuns:st.excludeRuns,cutRuns:st.cutRuns,rawCutSurface:!!st.rawCutSurface,analysisRefs:snapshotAnalysisRegionsForSegment(key)}}
function pushEditUndo(key){const st=segmentEditState[key];st.undo.push(editSnapshot(key));if(st.undo.length>20)st.undo.shift();st.redo=[]}
function restoreEditSnapshot(key,snap){const st=segmentEditState[key];st.keepRuns=snap?.keepRuns||null;st.excludeRuns=snap?.excludeRuns||null;st.cutRuns=snap?.cutRuns||null;st.rawCutSurface=!!snap?.rawCutSurface;st.finalRuns=null;st.revision++}
function setBaseSegmentSurfaceVisibility(key,visible){
 sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||o.userData?.editSurface)return;
  if(o.userData?.segmentKey===key){o.visible=visible;return}
  if(Array.isArray(o.userData?.segmentRanges)&&Array.isArray(o.material))for(const r of o.userData.segmentRanges)if(r.key===key&&o.material[r.materialIndex])o.material[r.materialIndex].visible=visible;
 });
}
async function buildEditableRunsGroup(v,runs,key,shouldContinue=null,forceRaw=false){
 const seg=segmentState[key],st=segmentEditState[key],smooth=!forceRaw&&surfaceSmoothingActive(),hasRawCut=!!(st?.rawCutSurface&&st?.cutRuns);
 if(smooth&&!hasRawCut&&fullVolumeSmoothIsosurfaceFeasible(v)){
  if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
  const mask=maskFromAnalysisRuns(v,runs),mesh=await buildSmoothIsoMesh(v,mask,seg,key,true);
  if(shouldContinue&&!shouldContinue()){if(mesh)dispose(mesh);throw new Error('__SUPERSEDED__')}
  if(!mesh)return null;const group=new THREE.Group();group.add(mesh);return group;
 }
 const coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),limit=(navigator.maxTouchPoints>0?4:8)*1024*1024,pinnedKeys=hasRawCut?new Set():null;
 const params={color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!smooth};
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions,false,null,!forceRaw,pinnedKeys),mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(params));mesh.name='edited_segment_'+key+'_'+z;mesh.userData.segmentKey=key;mesh.userData.editSurface=true;mesh.userData.displayScale=coords.scale;group.add(mesh);if(pinnedKeys)pinnedKeys.clear()};
 try{
  for(let z=0;z<v.slices;z++){
   if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__');
   appendAnalysisRunBoundaryFaces(builder,runs[z],z?runs[z-1]:null,z+1<v.slices?runs[z+1]:null,coords,z,hasRawCut?st.cutRuns[z]:null,hasRawCut&&z?st.cutRuns[z-1]:null,hasRawCut&&z+1<v.slices?st.cutRuns[z+1]:null,pinnedKeys);if(builder.length>=limit)flush(z);
   if((z&15)===0){await frameYield();if(shouldContinue&&!shouldContinue())throw new Error('__SUPERSEDED__')}
  }
  flush(v.slices-1);
  if(smooth&&!hasRawCut)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
  return group.children.length?group:null;
 }catch(e){dispose(group);throw e}
}
function segmentUsesRunSurface(key,v=current3DVolume||volume){
 return segmentEditActive(key)||!!(v?.sourceBacked&&segmentState[key]?.active&&segmentState[key]?.enabled&&segmentNeedsGlobalMask(segmentState[key]));
}
async function refreshEditedSegmentSurface(key,v=current3DVolume||volume,expectedRevision=null){
 if(!sceneState?.obj||!v)return false;const st=segmentEditState[key],isCurrent=()=>expectedRevision==null||st.revision===expectedRevision;
 if(!segmentUsesRunSurface(key,v)){
  if(!isCurrent())return false;
  if(st.surfaceGroup){const old=st.surfaceGroup;if(old.parent)old.parent.remove(old);dispose(old);st.surfaceGroup=null}
  setBaseSegmentSurfaceVisibility(key,true);request3DRender();renderAll();return true;
 }
 const runs=await getFinalSegmentRuns(key,v);if(!isCurrent())return false;
 const group=await buildEditableRunsGroup(v,runs,key,isCurrent);if(!isCurrent()){if(group)dispose(group);return false}
 const old=st.surfaceGroup;setBaseSegmentSurfaceVisibility(key,false);st.surfaceGroup=group;
 if(group)sceneState.obj.add(group);if(old){if(old.parent)old.parent.remove(old);dispose(old)}
 request3DRender();renderAll();return true;
}
async function restoreEditedSegmentSurfaces(v=current3DVolume||volume){
 for(const key of SEGMENT_PRESET_ORDER)if(segmentUsesRunSurface(key,v))await refreshEditedSegmentSurface(key,v);
}
async function rebuildEditedAnalysisForSegment(key,referenceRegions=null){
 const v=current3DVolume||volume;if(!v)return;
 const refs=referenceRegions||snapshotAnalysisRegionsForSegment(key);
 for(const region of analysisRegions.filter(r=>r.segmentKeys.includes(key)))disposeAnalysisRegionMesh(region);
 setAnalysisRegions(analysisRegions.filter(r=>!r.segmentKeys.includes(key)));setAnalysisFocusedRegionId(null);
 if(!refs.length){renderAnalysisResults();renderAll();return}
 const runs=await getFinalSegmentRuns(key,v),comps=componentsFromRuns(runs,v.columns,v.rows,v.slices),usedRefs=new Map();let focusId=null,created=0;
 for(const comp of comps){
  const matches=refs.filter(ref=>analysisRunsOverlap(comp.runsBySlice,ref.runsBySlice));if(!matches.length)continue;
  const primary=matches[0],used=usedRefs.get(primary)||0;usedRefs.set(primary,used+1);
  const id=incNextAnalysisRegionId(false),voxels=comp.voxels,mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2];
  const region={id,regionId:'r'+id,groupId:used===0?primary.groupId:null,key,segmentKeys:[key],runsBySlice:comp.runsBySlice,voxels,mm3,merged:used===0&&!!primary.merged,selected:!!primary.selected,focused:false,visible:primary.visible!==false,meshGroup:null,color:used===0?primary.color:nextAnalysisColor()};
  analysisRegions.push(region);await attachAnalysisRegion(region,v);if(primary.focused&&focusId==null)focusId=id;
  created++;if(created>=64)break;
 }
 if(focusId!=null)setAnalysisFocusedRegion(focusId);else{renderAnalysisResults();renderAll()}
}async function applyEditKeepSelected(){
 const region=analysisRegionById(analysisFocusedRegionId);if(!region||region.segmentKeys.length!==1)return;const key=region.segmentKeys[0],st=segmentEditState[key],refs=snapshotAnalysisRegionsForSegment(key).filter(r=>analysisRunsOverlap(r.runsBySlice,region.runsBySlice));pushEditUndo(key);st.keepRuns=region.runsBySlice;st.excludeRuns=null;st.finalRuns=null;st.revision++;
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,refs)}footer.textContent=currentLanguage==='ja'?'選択領域だけを残しました':'Kept the selected region only';
 returnToNavigate();
}
async function applyEditRemoveSelected(){
 const region=analysisRegionById(analysisFocusedRegionId);if(!region||region.segmentKeys.length!==1)return;const key=region.segmentKeys[0],st=segmentEditState[key],v=current3DVolume||volume,refs=snapshotAnalysisRegionsForSegment(key).filter(r=>!analysisRunsOverlap(r.runsBySlice,region.runsBySlice));
 set3DBusy(true,currentLanguage==='ja'?'選択領域を削除中…':'Deleting selected region…',false);await frameYield();
 try{
  pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,region.runsBySlice,v.slices);st.finalRuns=null;st.revision++;
  if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key,v);await rebuildEditedAnalysisForSegment(key,refs)}
  footer.textContent=currentLanguage==='ja'?'選択領域を削除しました':'Deleted the selected region';
  returnToNavigate();
 }finally{set3DBusy(false,'',false)}
}
async function undoSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].undo.length);if(!key)return;setAnalysisEditTargetKey(key);const st=segmentEditState[key],snap=st.undo.pop();if(!snap)return;st.redo.push(editSnapshot(key));restoreEditSnapshot(key,snap);
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[])}
 updateAnalysisEditorControls();footer.textContent='Undo';
}
async function redoSegmentEdit(){
 const key=analysisEditTargetKey&&segmentEditState[analysisEditTargetKey].redo.length?analysisEditTargetKey:SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].redo.length);if(!key)return;setAnalysisEditTargetKey(key);const st=segmentEditState[key],snap=st.redo.pop();if(!snap)return;st.undo.push(editSnapshot(key));restoreEditSnapshot(key,snap);
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);await rebuildEditedAnalysisForSegment(key,snap.analysisRefs||[])}
 updateAnalysisEditorControls();footer.textContent='Redo';
}
async function resetFocusedSegmentEdit(){
 const region=analysisRegionById(analysisFocusedRegionId),key=analysisEditTargetKey||(region?.segmentKeys?.length===1?region.segmentKeys[0]:null)||SEGMENT_PRESET_ORDER.find(k=>segmentEditActive(k));if(!key)return;setAnalysisEditTargetKey(key);const refs=snapshotAnalysisRegionsForSegment(key);pushEditUndo(key);const st=segmentEditState[key];st.keepRuns=null;st.excludeRuns=null;st.cutRuns=null;st.rawCutSurface=false;st.finalRuns=null;st.revision++;
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){syncGpuVolumeEdits(sourceVolume||volume);clearAnalysisHighlight()}else{await refreshEditedSegmentSurface(key);if(refs.length)await rebuildEditedAnalysisForSegment(key,refs)}
 updateAnalysisEditorControls();footer.textContent=currentLanguage==='ja'?'編集をリセットしました':'Edits reset';
}
function cutDirectionFromPoint(p,yawDeg=0,pitchDeg=0){
 const norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}};
 const base=norm(p?.ray||{x:0,y:0,z:1}),right=norm(p?.right||{x:1,y:0,z:0}),up=norm(p?.up||{x:0,y:1,z:0});
 const yaw=yawDeg*Math.PI/180,pitch=pitchDeg*Math.PI/180,cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 return norm({x:base.x*cy*cp+right.x*sy*cp+up.x*sp,y:base.y*cy*cp+right.y*sy*cp+up.y*sp,z:base.z*cy*cp+right.z*sy*cp+up.z*sp});
}
function cutSurfaceStroke(points,mode='pen',offsetMm=0,v=current3DVolume||volume){
 if(!points?.length)return[];
 const src=mode==='line'&&points.length>1?[points[0],points[points.length-1]]:points;
 if(!v||!offsetMm)return src;
 const [sx,sy,sz]=v.spacing,anchor=src[0],r=anchor?.ray||{x:0,y:0,z:1};
 return src.map(p=>({...p,x:p.x+r.x*offsetMm/sx,y:p.y+r.y*offsetMm/sy,z:p.z+r.z*offsetMm/sz}));
}
function cutPlanDirection(points,yawDeg=0,pitchDeg=0){
 return cutDirectionFromPoint(points?.[0]||null,yawDeg,pitchDeg);
}
function cutSurfaceFrameData(points,mode='pen',offsetMm=0,v=current3DVolume||volume,yawDeg=0,pitchDeg=0){
 const curve=cutSurfaceStroke(points,mode,offsetMm,v),dir=cutPlanDirection(points,yawDeg,pitchDeg);
 if(!v||!curve.length)return{curve,dir,normals:[]};
 const [sx,sy,sz]=v.spacing,norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}},cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,neg=q=>({x:-q.x,y:-q.y,z:-q.z}),delta=(a,b)=>({x:(b.x-a.x)*sx,y:(b.y-a.y)*sy,z:(b.z-a.z)*sz});
 const normals=[];let previous=null;
 for(let i=0;i<curve.length;i++){
  let tangent;
  if(curve.length===1)tangent=norm(curve[0]?.right||{x:1,y:0,z:0});
  else if(i===0)tangent=norm(delta(curve[0],curve[1]));
  else if(i===curve.length-1)tangent=norm(delta(curve[i-1],curve[i]));
  else tangent=norm(delta(curve[i-1],curve[i+1]));
  let normal=cross(tangent,dir),len=Math.hypot(normal.x,normal.y,normal.z);
  if(len<1e-6&&previous)normal={...previous},len=1;
  if(len<1e-6){normal=cross(tangent,curve[i]?.up||curve[0]?.up||{x:0,y:1,z:0});len=Math.hypot(normal.x,normal.y,normal.z)}
  if(len<1e-6){normal=cross(tangent,curve[i]?.right||curve[0]?.right||{x:1,y:0,z:0});len=Math.hypot(normal.x,normal.y,normal.z)}
  if(len<1e-6)normal={x:1,y:0,z:0};else normal=norm(normal);
  if(previous&&dot(normal,previous)<0)normal=neg(normal);
  normals.push(normal);previous=normal;
 }
 return{curve,dir,normals};
}
function cutRunsFromVoxelStroke(v,points,kerfMm,depthMm,yawDeg=0,pitchDeg=0,mode='pen',offsetMm=0){
 const d=v.slices,w=v.columns,h=v.rows,[sx,sy,sz]=v.spacing,rows=Array.from({length:d},()=>new Map()),frame=cutSurfaceFrameData(points,mode,offsetMm,v,yawDeg,pitchDeg),curve=frame.curve,dir=frame.dir,normals=frame.normals;
 if(!curve.length)return rows.map(rowsToRunSlice);
 const norm=q=>{const n=Math.hypot(q.x,q.y,q.z)||1;return{x:q.x/n,y:q.y/n,z:q.z/n}};
 const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
 const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 const addInterval=(z,y,x0,x1)=>{
  if(z<0||y<0||z>=d||y>=h||x1<0||x0>=w)return;
  x0=Math.max(0,x0);x1=Math.min(w-1,x1);if(x1<x0)return;
  const map=rows[z],arr=map.get(y)||[];arr.push([x0,x1]);map.set(y,arr);
 };
 const addSingle=p=>{
  const x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z);addInterval(z,y,x,x);
 };
 if(curve.length<2){addSingle(curve[0]);return rows.map(rowsToRunSlice)}

 const halfKerf=Math.max(0,Number.isFinite(+kerfMm)?+kerfMm*.5:0);
 const depth=Math.max(.1,+depthMm||.1);
 // Conservative solid voxelization: if a voxel cell intersects the swept cut prism,
 // that voxel is included in the cut mask. This deliberately avoids the pinholes that
 // point-sampling produced in GPU volume mode.
 const voxelMargin=.5*Math.hypot(sx,sy,sz)+1e-6;
 const dvec=norm(dir);

 for(let seg=0;seg<curve.length-1;seg++){
  const a=curve[seg],b=curve[seg+1];
  const A={x:a.x*sx,y:a.y*sy,z:a.z*sz},B={x:b.x*sx,y:b.y*sy,z:b.z*sz};
  const e0={x:B.x-A.x,y:B.y-A.y,z:B.z-A.z};
  const segLen=Math.hypot(e0.x,e0.y,e0.z);if(segLen<1e-7)continue;
  const n0=normals[seg]||{x:1,y:0,z:0},n1=normals[seg+1]||n0;
  let nvec=norm({x:n0.x+n1.x,y:n0.y+n1.y,z:n0.z+n1.z});
  // Keep the width axis perpendicular to both the stroke and cut depth.
  const exactN=cross(norm(e0),dvec);if(Math.hypot(exactN.x,exactN.y,exactN.z)>1e-7)nvec=norm(exactN);

  const dn=cross(dvec,nvec),det=dot(e0,dn);
  if(Math.abs(det)<1e-9)continue;

  const corners=[];
  for(const u of [0,1])for(const dep of [0,depth])for(const side of [-halfKerf,halfKerf]){
   const base=u?B:A;
   corners.push({
    x:base.x+dvec.x*dep+nvec.x*side,
    y:base.y+dvec.y*dep+nvec.y*side,
    z:base.z+dvec.z*dep+nvec.z*side
   });
  }
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const p of corners){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);minZ=Math.min(minZ,p.z);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);maxZ=Math.max(maxZ,p.z)}
  minX-=voxelMargin;minY-=voxelMargin;minZ-=voxelMargin;maxX+=voxelMargin;maxY+=voxelMargin;maxZ+=voxelMargin;
  const x0=Math.max(0,Math.floor(minX/sx)),x1=Math.min(w-1,Math.floor(maxX/sx));
  const y0=Math.max(0,Math.floor(minY/sy)),y1=Math.min(h-1,Math.floor(maxY/sy));
  const z0=Math.max(0,Math.floor(minZ/sz)),z1=Math.min(d-1,Math.floor(maxZ/sz));
  const alphaMargin=voxelMargin/segLen;

  for(let z=z0;z<=z1;z++){
   const pz=(z+.5)*sz;
   for(let y=y0;y<=y1;y++){
    const py=(y+.5)*sy;let runStart=-1;
    for(let x=x0;x<=x1;x++){
     const q={x:(x+.5)*sx-A.x,y:py-A.y,z:pz-A.z};
     const alpha=dot(q,dn)/det;
     const beta=dot(e0,cross(q,nvec))/det;
     const gamma=dot(e0,cross(dvec,q))/det;
     const inside=alpha>=-alphaMargin&&alpha<=1+alphaMargin&&beta>=-voxelMargin&&beta<=depth+voxelMargin&&gamma>=-halfKerf-voxelMargin&&gamma<=halfKerf+voxelMargin;
     if(inside){if(runStart<0)runStart=x}
     else if(runStart>=0){addInterval(z,y,runStart,x-1);runStart=-1}
    }
    if(runStart>=0)addInterval(z,y,runStart,x1);
   }
  }
 }
 return rows.map(rowsToRunSlice);
}
async function applyCutStroke(points,key=analysisEditTargetKey,mode='pen'){
 if(!key||!SEGMENT_PRESET_ORDER.includes(key)||!points?.length)return false;
 const v=current3DVolume||volume;if(!v)return false;
 const label=tr(key)||key,st=segmentEditState[key],refs=snapshotAnalysisRegionsForSegment(key);
 try{
  const cut=cutRunsFromVoxelStroke(v,points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,mode,+analysisCutOffset.value||0);
  const cutVoxels=analysisRunsVoxelCount(cut);
  if(!cutVoxels)throw new Error(currentLanguage==='ja'?'切断空間のボクセル化に失敗しました':'Cut volume voxelization produced no voxels');
  pushEditUndo(key);st.excludeRuns=unionRunArrays(st.excludeRuns,cut,v.slices);st.cutRuns=unionRunArrays(st.cutRuns,cut,v.slices);st.rawCutSurface=true;st.finalRuns=null;st.revision++;setAnalysisEditTargetKey(key);
  console.info('[VRL CUT] solid voxel mask',{key,cutVoxels,widthMm:cutWidthMm(),depthMm:+analysisCutDepth.value||5});
  const revision=st.revision;
  if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){
   syncGpuVolumeEdits(sourceVolume||volume);if(refs.length)clearAnalysisHighlight();
   footer.textContent=currentLanguage==='ja'?label+'の切断をGPUボリュームへ反映しました':'Cut applied to GPU volume: '+label;
   updateThreeEditUi(currentLanguage==='ja'?'切断済み · GPUボリューム更新済み':'Cut applied · GPU volume updated');return true;
  }
  footer.textContent=currentLanguage==='ja'?label+'を切断しました · 3D更新中…':'Cut '+label+' · updating 3D…';
  updateThreeEditUi(currentLanguage==='ja'?'切断済み · 3D更新中…':'Cut applied · updating 3D…');
  const current=await refreshEditedSegmentSurface(key,v,revision);
  if(!current||st.revision!==revision)return false;
  if(refs.length){updateThreeEditUi(currentLanguage==='ja'?'3D更新済み · 解析更新中…':'3D updated · refreshing analysis…');await rebuildEditedAnalysisForSegment(key,refs);if(st.revision!==revision)return false}
  footer.textContent=currentLanguage==='ja'?label+'の切断を反映しました':'Cut applied to '+label;return true;
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){console.error(e);footer.textContent=(currentLanguage==='ja'?'切断後の更新に失敗しました: ':'Cut refresh failed: ')+String(e.message||e);updateThreeEditUi(currentLanguage==='ja'?'切断後の更新に失敗しました':'Cut refresh failed')}
  return false;
 }finally{clearThreeEditOverlay();request3DRender()}
}
function setEditTargetHighlight(key=null){
 if(!sceneState?.obj)return;
 sceneState.obj.traverse(o=>{
  if(!o.isMesh)return;
  const direct=o.userData?.segmentKey||null,ranges=Array.isArray(o.userData?.segmentRanges)?o.userData.segmentRanges:null;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(direct){
   for(const m of mats){if(!m)continue;if(m.userData._editBaseEmissive===undefined){m.userData._editBaseEmissive=m.emissiveIntensity??0;m.userData._editBaseOpacity=m.opacity}
    m.emissiveIntensity=key&&direct===key?Math.max(.55,m.userData._editBaseEmissive):m.userData._editBaseEmissive;
    if(key)m.opacity=direct===key?Math.max(.92,m.userData._editBaseOpacity??1):Math.min(.42,m.userData._editBaseOpacity??1);else if(m.userData._editBaseOpacity!==undefined)m.opacity=m.userData._editBaseOpacity;
   }
  }else if(ranges&&Array.isArray(o.material)){
   for(const r of ranges){const m=o.material[r.materialIndex];if(!m)continue;if(m.userData._editBaseEmissive===undefined){m.userData._editBaseEmissive=m.emissiveIntensity??0;m.userData._editBaseOpacity=m.opacity}
    m.emissiveIntensity=key&&r.key===key?Math.max(.55,m.userData._editBaseEmissive):m.userData._editBaseEmissive;
    if(key)m.opacity=r.key===key?Math.max(.92,m.userData._editBaseOpacity??1):Math.min(.42,m.userData._editBaseOpacity??1);else if(m.userData._editBaseOpacity!==undefined)m.opacity=m.userData._editBaseOpacity;
   }
  }
 });
 request3DRender();
}
function setCutResultSourceHidden(key,hidden){
 const root=sceneState?.obj;if(!root||!key)return;
 root.traverse(o=>{
  if(!o.isMesh||o.userData?.cutResultPreview)return;
  const direct=o.userData?.segmentKey||null;
  if(direct===key){
   if(hidden){if(o.userData._cutPreviewVisible===undefined)o.userData._cutPreviewVisible=o.visible;o.visible=false}
   else if(o.userData._cutPreviewVisible!==undefined){o.visible=!!o.userData._cutPreviewVisible;delete o.userData._cutPreviewVisible}
  }
  const ranges=Array.isArray(o.userData?.segmentRanges)?o.userData.segmentRanges:null;
  if(ranges&&Array.isArray(o.material))for(const r of ranges)if(r.key===key){
   const m=o.material[r.materialIndex];if(!m)continue;
   if(hidden){if(m.userData._cutPreviewVisible===undefined)m.userData._cutPreviewVisible=m.visible;m.visible=false}
   else if(m.userData._cutPreviewVisible!==undefined){m.visible=!!m.userData._cutPreviewVisible;delete m.userData._cutPreviewVisible}
  }
 });
}
function clearCutResultPreview(){
 incCutResultPreviewRevision(false);clearTimeout(cutResultPreviewTimer);setCutResultPreviewTimer(null);
 const state=sceneState;if(!state)return;
 state.medicalVolume?.clearPreviewRuns?.();
 const key=state.cutResultPreviewKey,group=state.cutResultPreviewGroup;
 if(group){if(group.parent)group.parent.remove(group);dispose(group)}
 state.cutResultPreviewGroup=null;state.cutResultPreviewKey=null;
 if(key)setCutResultSourceHidden(key,false);
 request3DRender();
}
function scheduleCutResultPreview(delay=180){
 clearTimeout(cutResultPreviewTimer);const pending=analysisPendingCut;
 if(!pending?.key||analysisCutApplying||!sceneState?.obj){sceneState?.medicalVolume?.clearPreviewRuns?.();return}
 const revision=incCutResultPreviewRevision(true);
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){
  setCutResultPreviewTimer(setTimeout(()=>{
   setCutResultPreviewTimer(null);
   if(revision!==cutResultPreviewRevision||pending!==analysisPendingCut||analysisCutApplying)return;
   try{
    const v=sourceVolume||current3DVolume||volume;
    const cut=cutRunsFromVoxelStroke(v,pending.points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,pending.mode,+analysisCutOffset.value||0);
    if(revision!==cutResultPreviewRevision||pending!==analysisPendingCut)return;
    sceneState.medicalVolume.setPreviewRuns(pending.key,cut,SEGMENT_PRESET_ORDER,v);request3DRender();
   }catch(e){console.warn('GPU cut preview failed.',e);sceneState?.medicalVolume?.clearPreviewRuns?.()}
  },Math.min(delay,90)));return;
 }
 setCutResultPreviewTimer(setTimeout(()=>{setCutResultPreviewTimer(null);void rebuildCutResultPreview(revision,pending)},delay));
}
async function rebuildCutResultPreview(revision,pending){
 const state=sceneState,v=current3DVolume||volume,key=pending?.key;
 if(!state?.obj||!v||!key||analysisCutApplying||pending!==analysisPendingCut)return;
 try{
  const current=await getFinalSegmentRuns(key,v);
  if(revision!==cutResultPreviewRevision||pending!==analysisPendingCut)return;
  const cut=cutRunsFromVoxelStroke(v,pending.points,cutWidthMm(),+analysisCutDepth.value||5,+analysisCutYaw.value||0,+analysisCutPitch.value||0,pending.mode,+analysisCutOffset.value||0);
  const removedRuns=intersectRunArrays(current,cut,v.slices),isCurrent=()=>revision===cutResultPreviewRevision&&pending===analysisPendingCut&&!analysisCutApplying;
  let group=await buildEditableRunsGroup(v,removedRuns,key,isCurrent,true);
  if(!isCurrent()){if(group)dispose(group);return}
  if(!group)group=new THREE.Group();
  group.name='cut_remove_preview';
  group.traverse?.(o=>{
   if(!o.isMesh)return;
   o.userData.cutResultPreview=true;
   const mats=Array.isArray(o.material)?o.material:[o.material];
   for(const m of mats){
    if(!m)continue;
    if(m.color?.set)m.color.set(0xff5a36);
    if(m.emissive?.set)m.emissive.set(0xff3b12);
    m.emissiveIntensity=1.15;m.transparent=true;m.opacity=.88;m.depthTest=false;m.depthWrite=false;
    if('polygonOffset' in m){m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-2}
   }
   o.renderOrder=120;
  });
  const old=state.cutResultPreviewGroup;
  if(old){if(old.parent)old.parent.remove(old);dispose(old)}
  if(state.cutResultPreviewKey)setCutResultSourceHidden(state.cutResultPreviewKey,false);
  setCutResultSourceHidden(key,false);
  state.cutResultPreviewKey=key;state.cutResultPreviewGroup=group;state.obj.add(group);request3DRender();
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__')console.warn('Cut removal preview failed.',e);
 }
}
function cutPreviewDirection(point){return cutDirectionFromPoint(point,+analysisCutYaw.value||0,+analysisCutPitch.value||0)}
function updateCutPreview(point=null){
 const state=sceneState,obj=state?.obj;if(!state||!obj)return;
 if(state.editCutPreview){if(state.editCutPreview.parent)state.editCutPreview.parent.remove(state.editCutPreview);dispose(state.editCutPreview);state.editCutPreview=null}
 const pending=analysisPendingCut;
 if(!pending){state.editCutPreviewPoint=point||null;if(!analysisCutApplying)clearCutResultPreview();request3DRender();return}
 const v=current3DVolume||volume,frame=cutSurfaceFrameData(pending.points,pending.mode,+analysisCutOffset.value||0,v,+analysisCutYaw.value||0,+analysisCutPitch.value||0),curve=frame.curve,normals=frame.normals;
 scheduleCutResultPreview();if(!v||curve.length<2){request3DRender();return}
 const [sx,sy,sz]=v.spacing,w=v.columns,h=v.rows,d=v.slices,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),depthMm=Math.max(.1,+analysisCutDepth.value||5),depthWorld=depthMm*scale,halfKerfMm=Math.max(0,cutWidthMm())*.5,halfKerfWorld=halfKerfMm*scale,dir=new THREE.Vector3(frame.dir.x,-frame.dir.y,frame.dir.z).normalize();
 const localPoint=p=>new THREE.Vector3((p.x*sx-px/2)*scale,-(p.y*sy-py/2)*scale,(p.z*sz-pz/2)*scale);
 const localNormal=(n,i)=>{
  if(n){const q=new THREE.Vector3(n.x,-n.y,n.z);if(q.lengthSq()>1e-12)return q.normalize()}
  const a=curve[Math.max(0,i-1)],b=curve[Math.min(curve.length-1,i+1)],t=new THREE.Vector3((b.x-a.x)*sx,-(b.y-a.y)*sy,(b.z-a.z)*sz).normalize(),q=new THREE.Vector3().crossVectors(t,dir);
  return q.lengthSq()>1e-12?q.normalize():new THREE.Vector3(0,1,0);
 };
 // Exact requested geometry:
 // upper = drawn/contact curve; lower = same curve translated by configured depth.
 const upper=curve.map(localPoint),lower=upper.map(p=>p.clone().addScaledVector(dir,depthWorld)),normalVecs=upper.map((_,i)=>localNormal(normals?.[i],i));
 const offsetRow=(row,sign)=>row.map((p,i)=>p.clone().addScaledVector(normalVecs[i],halfKerfWorld*sign));
 const upperNeg=offsetRow(upper,-1),upperPos=offsetRow(upper,1),lowerNeg=offsetRow(lower,-1),lowerPos=offsetRow(lower,1);
 const quad=(arr,a,b,c,d)=>arr.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z,a.x,a.y,a.z,c.x,c.y,c.z,d.x,d.y,d.z);
 const curtainFaces=(aRow,bRow)=>{const out=[];for(let i=0;i<aRow.length-1;i++)quad(out,aRow[i],aRow[i+1],bRow[i+1],bRow[i]);return out};
 const ribbonFaces=(aRow,bRow)=>{const out=[];for(let i=0;i<aRow.length-1;i++)quad(out,aRow[i],bRow[i],bRow[i+1],aRow[i+1]);return out};
 const group=new THREE.Group();group.name='cut_preview';

 // Active CAD curtain: always visible, including the part inside the 3D model.
 const activeGeom=new THREE.BufferGeometry();activeGeom.setAttribute('position',new THREE.Float32BufferAttribute(curtainFaces(upper,lower),3));activeGeom.computeVertexNormals();
 const active=new THREE.Mesh(activeGeom,new THREE.MeshBasicMaterial({color:0x00d8ff,transparent:true,opacity:.16,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));
 active.name='cut_preview_active_surface';active.renderOrder=124;group.add(active);

 // Exact cut-width prism, built from the same +/- width/2 geometry used by cutRunsFromVoxelStroke().
 if(halfKerfWorld>1e-7){
  const volumeFaces=[];
  const pushFaces=faces=>volumeFaces.push(...faces);
  pushFaces(curtainFaces(upperNeg,lowerNeg));
  pushFaces(curtainFaces(lowerPos,upperPos));
  pushFaces(ribbonFaces(upperNeg,upperPos));
  pushFaces(ribbonFaces(lowerPos,lowerNeg));
  const first=0,last=upper.length-1;
  quad(volumeFaces,upperNeg[first],lowerNeg[first],lowerPos[first],upperPos[first]);
  quad(volumeFaces,upperNeg[last],upperPos[last],lowerPos[last],lowerNeg[last]);
  const vg=new THREE.BufferGeometry();vg.setAttribute('position',new THREE.Float32BufferAttribute(volumeFaces,3));vg.computeVertexNormals();
  const vm=new THREE.Mesh(vg,new THREE.MeshBasicMaterial({color:0x16c8e8,transparent:true,opacity:.075,depthTest:false,depthWrite:false,side:THREE.FrontSide}));
  vm.name='cut_preview_width_volume';vm.renderOrder=122;group.add(vm);
 }

 const lineMat=(color,opacity=1)=>new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false});
 const addLineSegments=(points,material,name,order)=>{if(!points.length)return;const g=new THREE.BufferGeometry().setFromPoints(points),line=new THREE.LineSegments(g,material);line.name=name;line.renderOrder=order;group.add(line)};
 const addCurve=(dst,row)=>{for(let i=0;i<row.length-1;i++)dst.push(row[i],row[i+1])};

 // Upper/lower outlines are exact copies of the same curve.
 const outline=[];addCurve(outline,upper);addCurve(outline,lower);outline.push(upper[0],lower[0],upper[upper.length-1],lower[lower.length-1]);
 addLineSegments(outline,lineMat(0x00e5ff,.98),'cut_preview_active_outline',130);

 // Contact edge is explicit.
 const contact=[];addCurve(contact,upper);
 addLineSegments(contact,lineMat(0xffffff,1),'cut_preview_contact_edge',133);

 // Exact width boundary curves.
 if(halfKerfWorld>1e-7){
  const widthEdges=[];addCurve(widthEdges,upperNeg);addCurve(widthEdges,upperPos);addCurve(widthEdges,lowerNeg);addCurve(widthEdges,lowerPos);
  widthEdges.push(upperNeg[0],upperPos[0],lowerNeg[0],lowerPos[0],upperNeg[upperNeg.length-1],upperPos[upperPos.length-1],lowerNeg[lowerNeg.length-1],lowerPos[lowerPos.length-1]);
  addLineSegments(widthEdges,lineMat(0x65efff,.90),'cut_preview_width_outline',129);
 }

 // CAD hatch only on the active curtain.
 const sampleCurve=t=>{const u=THREE.MathUtils.clamp(t,0,1)*(upper.length-1),i=Math.min(upper.length-2,Math.floor(u)),f=u-i;return upper[i].clone().lerp(upper[i+1],f)};
 const hatchPoints=[],hatchCount=Math.max(7,Math.min(15,Math.round(upper.length/3))),steps=8,slope=.055;
 for(let hIdx=0;hIdx<hatchCount;hIdx++){
  const base=(hIdx+.5)/hatchCount;let prev=null;
  for(let k=0;k<=steps;k++){
   const dv=k/steps,t=base+slope*(dv-.5);
   if(t<0||t>1){prev=null;continue}
   const p=sampleCurve(t).addScaledVector(dir,dv*depthWorld);
   if(prev)hatchPoints.push(prev,p.clone());
   prev=p;
  }
 }
 addLineSegments(hatchPoints,lineMat(0x91f4ff,.72),'cut_preview_hatch',131);

 obj.add(group);state.editCutPreview=group;state.editCutPreviewPoint=curve[curve.length-1];request3DRender();
}
function updateThreeEditUi(message=null){
 configureCutControlRanges();refreshCutControlReadouts();
 const enabledKeys=SEGMENT_PRESET_ORDER.filter(k=>segmentState[k].active&&segmentState[k].enabled);
 const surfaceUsable=!!sceneState?.obj&&enabledKeys.length>0&&(threeRenderMode==='surface'||(threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active));
 const modeLabel=analysisEditTool==='lasso'?tr('lassoSelectRegion'):analysisEditTool==='region'?tr('selectEditRegion'):analysisEditTool==='pen'?tr('cutRegion'):analysisEditTool==='line'?tr('lineCutRegion'):tr('editNavigate');
 const targetLabel=analysisEditTargetMode==='auto'?tr('editAuto'):(tr(analysisEditTargetMode)||analysisEditTargetMode);
 analysisNavigateButton?.classList.toggle('is-active',analysisEditTool==='select');
 analysisSelectRegionButton?.classList.toggle('is-active',analysisEditTool==='region');
 analysisLassoButton?.classList.toggle('is-active',analysisEditTool==='lasso');
 analysisCutButton?.classList.toggle('is-active',analysisEditTool==='pen');
 analysisLineCutButton?.classList.toggle('is-active',analysisEditTool==='line');
 if(analysisNavigateButton)analysisNavigateButton.disabled=!sceneState?.obj||analysisCutApplying||!!analysisPendingCut;
 if(analysisSelectRegionButton)analysisSelectRegionButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisLassoButton)analysisLassoButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisCutButton)analysisCutButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisLineCutButton)analysisLineCutButton.disabled=!surfaceUsable||analysisCutApplying||!!analysisPendingCut;
 if(analysisEditTargetSelect){
  for(const option of analysisEditTargetSelect.options){if(option.value==='auto'){option.disabled=false;continue}option.disabled=!(segmentState[option.value]?.active&&segmentState[option.value]?.enabled)}
  if(analysisEditTargetMode!=='auto'&&analysisEditTargetSelect.querySelector('option[value="'+analysisEditTargetMode+'"]')?.disabled){setAnalysisEditTargetMode('auto');setAnalysisEditTargetKey(analysisPendingCut?.key||null)}
  analysisEditTargetSelect.value=analysisEditTargetMode;analysisEditTargetSelect.disabled=!surfaceUsable||analysisCutApplying||!!(analysisPendingCut&&analysisPendingCut.key);
 }
 if(threeEditStatus){
  if(message)threeEditStatus.textContent=message;
  else if(!sceneState?.obj)threeEditStatus.textContent=currentLanguage==='ja'?'3Dを構築すると編集できます':'Build the 3D surface to edit';
  else if(!enabledKeys.length)threeEditStatus.textContent=currentLanguage==='ja'?'編集する組織セグメントを追加してください':'Add a tissue segment to edit';
  else threeEditStatus.textContent=modeLabel+' · '+targetLabel+' · '+(+analysisCutWidth.value).toFixed(2)+' mm × '+(+analysisCutDepth.value).toFixed(1)+' mm · '+(+analysisCutYaw.value).toFixed(1)+'° / '+(+analysisCutPitch.value).toFixed(1)+'°';
 }
 if(analysisCutApply)analysisCutApply.disabled=analysisCutApplying||!analysisPendingCut||!analysisPendingCut.key;
 if(analysisCutCancel)analysisCutCancel.disabled=analysisCutApplying||!analysisPendingCut;
 if(analysisCutConfirm)analysisCutConfirm.classList.toggle('is-hidden',!analysisPendingCut||analysisCutApplying);
 for(const control of [analysisCutWidth,analysisCutDepth,analysisCutYaw,analysisCutPitch,analysisCutOffset])if(control)control.disabled=analysisCutApplying;
 if(threeEditHelp){
  if(analysisCutApplying)threeEditHelp.textContent=currentLanguage==='ja'?'切断結果を3Dへ反映しています…':'Applying cut result to 3D…';
  else if(analysisPendingCut)threeEditHelp.textContent=tr('cutPendingHint');
  else if(analysisEditTool==='region')threeEditHelp.textContent=tr('editRegionHint');
  else if(analysisEditTool==='lasso')threeEditHelp.textContent=tr('editLassoHint');
  else if(analysisEditTool==='pen')threeEditHelp.textContent=tr('editPenHint');
  else if(analysisEditTool==='line')threeEditHelp.textContent=tr('editLineHint');
  else if(surfaceUsable)threeEditHelp.textContent=currentLanguage==='ja'?'ペン切断または直線切断を選択してください。対象「自動」は最初に触れた組織を編集します。':'Choose Pen cut or Line cut. Auto targets the first tissue you touch.';
  else threeEditHelp.textContent=tr('editAutoHint');
 }
 const cutInteractionReady=(analysisEditTool==='pen'||analysisEditTool==='line')&&!analysisPendingCut&&!analysisCutApplying&&!!sceneState?.obj&&(threeRenderMode==='surface'||(threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active));
 viewport?.classList.toggle('is-editing-3d',cutInteractionReady);
 viewport?.classList.toggle('is-editing-pen',cutInteractionReady&&analysisEditTool==='pen');
 viewport?.classList.toggle('is-editing-line',cutInteractionReady&&analysisEditTool==='line');
 const visualTarget=(analysisEditTool==='select'||analysisEditTool==='region')?null:(analysisEditTargetMode==='auto'?analysisEditTargetKey:analysisEditTargetMode);
 setEditTargetHighlight(visualTarget);
 if(analysisEditTool==='select')updateCutPreview(null);
 else if(sceneState?.editCutPreviewPoint)updateCutPreview(sceneState.editCutPreviewPoint);
}
function updateAnalysisEditorControls(){
 const region=analysisRegionById(analysisFocusedRegionId),single=region?.segmentKeys?.length===1,regionKey=single?region.segmentKeys[0]:null;
 const surfaceUsable=!!sceneState?.obj&&SEGMENT_PRESET_ORDER.some(k=>segmentState[k].active&&segmentState[k].enabled)&&(threeRenderMode==='surface'||(threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active));
 const historyKey=analysisEditTargetKey||regionKey||SEGMENT_PRESET_ORDER.find(k=>segmentEditState[k].undo.length||segmentEditState[k].redo.length||segmentEditActive(k)),historyState=historyKey?segmentEditState[historyKey]:null;
 if(!surfaceUsable&&(analysisEditTool==='region'||analysisEditTool==='lasso'||analysisEditTool==='pen'||analysisEditTool==='line'))setAnalysisEditTool('select');
 if(analysisNavigateButton)analysisNavigateButton.disabled=!sceneState?.obj;
 if(analysisSelectRegionButton)analysisSelectRegionButton.disabled=!surfaceUsable;
 if(analysisLassoButton)analysisLassoButton.disabled=!surfaceUsable;
 if(analysisCutButton)analysisCutButton.disabled=!surfaceUsable;
 if(analysisLineCutButton)analysisLineCutButton.disabled=!surfaceUsable;
 if(analysisEditRemoveSelected)analysisEditRemoveSelected.disabled=!regionKey;
 if(analysisRemoveSelected)analysisRemoveSelected.disabled=!regionKey;
 if(analysisKeepSelected)analysisKeepSelected.disabled=!regionKey;
 if(analysisUndo)analysisUndo.disabled=!historyState?.undo?.length;
 if(analysisRedo)analysisRedo.disabled=!historyState?.redo?.length;
 if(analysisResetEdit)analysisResetEdit.disabled=!historyKey||!segmentEditActive(historyKey);
 if(analysisExportSelected)analysisExportSelected.disabled=!region;
 updateThreeEditUi();
}
function ensureAnalysisRoot(){
 if(sceneState?.analysisMesh?.parent===sceneState?.obj)return sceneState.analysisMesh;
 const root=new THREE.Group();root.name='analysis_regions';sceneState.analysisMesh=root;sceneState?.obj?.add(root);return root;
}
async function buildAnalysisRunsGroup(v,runsBySlice,key,id,color){
 const d=v.slices,coords=v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{const positions=builder.take();if(!positions)return;const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial(color));mesh.name='analysis_'+key+'_'+id+'_'+z;mesh.renderOrder=20;mesh.userData.analysisRegionId=id;mesh.userData.displayScale=coords.scale;group.add(mesh)};
 for(let z=0;z<d;z++){
  appendAnalysisRunBoundaryFaces(builder,runsBySlice[z],z>0?runsBySlice[z-1]:null,z+1<d?runsBySlice[z+1]:null,coords,z);
  if(builder.length>=floatLimit)flush(z);if((z&31)===0)await frameYield();
 }
 flush(d-1);return group.children.length?group:null;
}
function analysisRegionName(region){
 return region.merged?(tr('mergedRegion')+' '+region.id):(tr('analysisRegion')+' '+region.id);
}
function renderAnalysisResults(statusText=null){
 if(!analysisSummary||!analysisRegionList)return;
 analysisSummary.replaceChildren();
 if(statusText){
  analysisSummary.textContent=statusText;
 }else if(!analysisRegions.length){
  analysisSummary.textContent=tr('volumeHint');
 }else{
  const focused=analysisRegionById(analysisFocusedRegionId)||analysisRegions[analysisRegions.length-1];
  const count=document.createElement('div');count.textContent=tr('analysisRegions')+': '+analysisRegions.length;count.style.cssText='font-size:11px;color:#cfe0e7;margin-bottom:7px';
  analysisSummary.appendChild(count);
  if(focused){
   const card=document.createElement('div');card.style.cssText='display:grid;gap:7px;padding:9px 10px;border:1px solid #3a515c;border-radius:9px;background:#10171a;margin-bottom:8px';
   const title=document.createElement('strong');title.textContent=(currentLanguage==='ja'?'解析結果 · ':'Result · ')+analysisRegionName(focused);title.style.cssText='font-size:11px;color:#e9f5f8';
   const volumeRow=document.createElement('div');volumeRow.style.cssText='display:flex;align-items:baseline;justify-content:space-between;gap:10px';
   const volumeLabel=document.createElement('span');volumeLabel.textContent=currentLanguage==='ja'?'体積':'Volume';volumeLabel.style.cssText='font-size:10px;color:#9db0b8';
   const volumeValue=document.createElement('strong');volumeValue.textContent=focused.mm3.toFixed(2)+' mm³';volumeValue.style.cssText='font-size:18px;line-height:1;color:#f1fbff;font-variant-numeric:tabular-nums;white-space:nowrap';
   volumeRow.append(volumeLabel,volumeValue);
   const meta=document.createElement('div');meta.textContent=focused.segmentKeys.map(k=>tr(k)||k).join(' + ')+' · '+focused.voxels.toLocaleString()+' voxels';meta.style.cssText='font-size:10px;line-height:1.35;color:#9fb2ba;overflow-wrap:anywhere';
   card.append(title,volumeRow,meta);analysisSummary.appendChild(card);
  }
 }
 analysisMergeButton.disabled=analysisRegions.filter(r=>r.selected).length<2||volumeAnalysisBusy;
 analysisClearButton.disabled=!analysisRegions.length||volumeAnalysisBusy;updateAnalysisEditorControls();
 analysisRegionList.replaceChildren();
 for(const region of analysisRegions){
  const row=document.createElement('div');row.className='analysis-region-row'+(region.id===analysisFocusedRegionId?' is-focused':'');row.dataset.regionId=String(region.id);row.onclick=e=>{if(e.target.closest('button,input'))return;setAnalysisFocusedRegion(region.id)};
  const select=document.createElement('input');select.type='checkbox';select.checked=!!region.selected;select.className='analysis-region-select';select.title=tr('mergeSelected');select.onchange=()=>{region.selected=select.checked;renderAnalysisResults()};
  const swatch=document.createElement('span');swatch.className='analysis-region-swatch';swatch.style.background=analysisColorCss(region.color);swatch.title=analysisColorCss(region.color);
  const info=document.createElement('div');info.className='analysis-region-info';
  const title=document.createElement('strong');title.textContent=analysisRegionName(region);
  const keys=document.createElement('span');keys.textContent=region.segmentKeys.map(k=>tr(k)||k).join(' + ');
  const value=document.createElement('span');value.textContent=region.mm3.toFixed(2)+' mm³ · '+region.voxels.toLocaleString()+' voxels';value.style.cssText='white-space:normal;overflow:visible;text-overflow:clip';
  info.append(title,keys,value);
  const visible=document.createElement('button');visible.type='button';visible.className='analysis-region-button';visible.textContent=region.visible?tr('hideRegion'):tr('showRegion');visible.onclick=()=>{region.visible=!region.visible;if(region.meshGroup)region.meshGroup.visible=region.visible;request3DRender();renderAnalysisResults()};
  const remove=document.createElement('button');remove.type='button';remove.className='analysis-region-button analysis-region-delete';remove.textContent=tr('deleteRegion');remove.onclick=()=>removeAnalysisRegion(region.id);
  row.append(select,swatch,info,visible,remove);analysisRegionList.append(row);
 }
}
function disposeAnalysisRegionMesh(region){
 if(!region?.meshGroup)return;if(region.meshGroup.parent)region.meshGroup.parent.remove(region.meshGroup);dispose(region.meshGroup);region.meshGroup=null;
}
function removeAnalysisRegion(id){
 const idx=analysisRegions.findIndex(r=>r.id===id);if(idx<0)return;
 disposeAnalysisRegionMesh(analysisRegions[idx]);analysisRegions.splice(idx,1);
 if(analysisFocusedRegionId===id)setAnalysisFocusedRegionId(null);
 if(!analysisRegions.length&&sceneState?.analysisMesh){if(sceneState.analysisMesh.parent)sceneState.analysisMesh.parent.remove(sceneState.analysisMesh);sceneState.analysisMesh=null}
 request3DRender();renderAnalysisResults();for(const p of Object.keys(planes))schedulePlaneRender(p);
}
async function attachAnalysisRegion(region,v,forExport=false){
 // GPU volume view: regions are coloured inside the volume (syncVolumeAnalysisOverlay), no mesh.
 // STL export still needs the mesh (built on demand, kept hidden in volume view).
 if(!forExport&&volumeAnalysisOverlayActive()){request3DRender();return}
 const group=await buildAnalysisRunsGroup(v,region.runsBySlice,region.key,region.id,region.color);region.meshGroup=group;if(group){group.visible=region.visible;ensureAnalysisRoot().add(group)}request3DRender();
}
async function addAnalysisRegion(v,{key,segmentKeys,runsBySlice,voxels,mm3,merged=false}){
 const existing=analysisRegions.find(r=>r.segmentKeys.includes(key)&&analysisRunsOverlap(r.runsBySlice,runsBySlice));
 if(existing){existing.selected=true;existing.visible=true;if(existing.meshGroup)existing.meshGroup.visible=true;renderAnalysisResults();request3DRender();return existing}
 const id=incNextAnalysisRegionId(false),region={id,regionId:'r'+id,groupId:merged?'g'+id:null,key,segmentKeys:[...new Set(segmentKeys)],runsBySlice,voxels,mm3,merged,selected:false,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};
 analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);return region;
}
async function mergeSelectedAnalysisRegions(){
 if(volumeAnalysisBusy)return;const selected=analysisRegions.filter(r=>r.selected);if(selected.length<2){renderAnalysisResults(tr('mergeNeedsTwo'));return}
 const v=current3DVolume||volume;if(!v)return;setVolumeAnalysisBusy(true);renderAnalysisResults(tr('mergingRegions'));
 try{
  const runsBySlice=unionAnalysisRuns(selected,v.slices),voxels=analysisRunsVoxelCount(runsBySlice),mm3=voxels*v.spacing[0]*v.spacing[1]*v.spacing[2],segmentKeys=[...new Set(selected.flatMap(r=>r.segmentKeys))],key=segmentKeys.length===1?segmentKeys[0]:'merged';
  for(const region of selected)disposeAnalysisRegionMesh(region);
  const ids=new Set(selected.map(r=>r.id));setAnalysisRegions(analysisRegions.filter(r=>!ids.has(r.id)));
  const id=incNextAnalysisRegionId(false),region={id,regionId:'r'+id,groupId:'g'+id,key,segmentKeys,runsBySlice,voxels,mm3,merged:true,selected:false,focused:false,visible:true,meshGroup:null,color:nextAnalysisColor()};analysisRegions.push(region);await attachAnalysisRegion(region,v);setAnalysisFocusedRegion(region.id);
 }finally{setVolumeAnalysisBusy(false);renderAnalysisResults()}
}
function volumeAnalysisOverlayActive(){return threeRenderMode==='volume'&&!!sceneState?.medicalVolume?.active&&!volumeAnalysisOverlayFailed.value}
const volumeAnalysisOverlayFailed={value:false};
// Called every rendered frame (cheap when nothing changed). In GPU volume view,
// upload the visible regions' runs so the volume shader colours them, and hide
// any region meshes left from the surface view. In the surface view, build the
// display mesh lazily for regions analysed in volume view.
function syncVolumeAnalysisOverlay(){
 const mv=sceneState?.medicalVolume,v=current3DVolume||volume;
 if(volumeAnalysisOverlayActive()){
  for(const r of analysisRegions)if(r.meshGroup)r.meshGroup.visible=false;
  const shown=analysisRegions.filter(r=>r.visible&&r.runsBySlice);
  const signature=(mv.seriesId||'')+'|'+(mv.textureDims||[]).join('x')+'|'+shown.map(r=>r.id+':'+r.color+':'+(r.focused?1:0)+':'+r.voxels).join(',');
  try{mv.setAnalysisRuns(shown.map(r=>({runs:r.runsBySlice,color:Number(r.color??0x00d8ff),focused:!!r.focused})),v,signature)}
  catch(e){console.warn('GPU volume analysis overlay failed; using region meshes.',e);volumeAnalysisOverlayFailed.value=true;mv.clearAnalysisRuns?.();for(const r of analysisRegions)if(r.visible&&!r.meshGroup)void attachAnalysisRegion(r,v)}
  return;
 }
 if(mv?.analysisOverlaySignature)mv.clearAnalysisRuns();
 if(!v||!sceneState?.obj)return;
 for(const r of analysisRegions){
  if(r.meshGroup){r.meshGroup.visible=r.visible;continue}
  if(r.visible&&!r.meshPending){r.meshPending=true;attachAnalysisRegion(r,v).finally(()=>{r.meshPending=false})}
 }
}
function resetAnalysisRegistryAfterRebuild(){
 setAnalysisRegions([]);setAnalysisFocusedRegionId(null);setNextAnalysisRegionId(1);setNextAnalysisColorIndex(0);if(sceneState)sceneState.analysisMesh=null;renderAnalysisResults();
}
function clearAnalysisHighlight(){
 if(sceneState?.analysisMesh){const root=sceneState.analysisMesh;if(root.parent)root.parent.remove(root);dispose(root);sceneState.analysisMesh=null}
 setAnalysisRegions([]);setAnalysisFocusedRegionId(null);setNextAnalysisRegionId(1);setNextAnalysisColorIndex(0);request3DRender();renderAnalysisResults();
}
function showAnalysisHighlight(v,mask,key){
 clearAnalysisHighlight();if(!sceneState?.obj||!mask)return;
 const group=buildMaskSurface(v,mask,key);if(!group)return;
 sceneState.analysisMesh=group;sceneState.obj.add(group);request3DRender();
}
function buildMaskSurface(v,mask,key){
 const coords=makeVolume3DCoordinates(v),group=new THREE.Group(),builder=new Float32FaceBuilder(),floatLimit=(navigator.maxTouchPoints>0?4:8)*1024*1024;
 const flush=z=>{
  const positions=builder.take();if(!positions)return;
  const geometry=geometryFromSourcePositions(positions),mesh=new THREE.Mesh(geometry,createAnalysisMaterial());
  mesh.name='analysis_'+key+'_'+z;mesh.renderOrder=20;group.add(mesh);
 };
 for(let z=0;z<v.slices;z++){
  appendDecodedMaskSliceFaces(builder,v,mask,z,coords);
  if(builder.length>=floatLimit)flush(z);
 }
 flush(v.slices-1);return group.children.length?group:null;
}


async function smoothIsosurfaceGeometry(v,mask,strength){
 const w=v.columns,h=v.rows,d=v.slices;if(!mask||mask.length!==w*h*d)return null;
 const {data,fw,fh,fd}=await smoothMaskScalarField(mask,w,h,d,strength),plane=fw*fh,[sx,sy,sz]=v.spacing,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1),iso=.5;
 const positions=[],indices=[],edgeVertices=new Map();
 const cubeCorners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const tetEdges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const gridId=(x,y,z)=>z*plane+y*fw+x,field=(x,y,z)=>data[gridId(x,y,z)];
 const world=(x,y,z)=>[((x-.5)*sx-px/2)*scale,-((y-.5)*sy-py/2)*scale,((z-.5)*sz-pz/2)*scale];
 const edgeVertex=(ax,ay,az,bx,by,bz,va,vb)=>{
  const ia=gridId(ax,ay,az),ib=gridId(bx,by,bz),lo=Math.min(ia,ib),hi=Math.max(ia,ib),key=lo+':'+hi,found=edgeVertices.get(key);if(found!==undefined)return found;
  const den=vb-va,t=Math.abs(den)<1e-8?.5:Math.max(0,Math.min(1,(iso-va)/den)),pa=world(ax,ay,az),pb=world(bx,by,bz),id=positions.length/3;
  positions.push(pa[0]+(pb[0]-pa[0])*t,pa[1]+(pb[1]-pa[1])*t,pa[2]+(pb[2]-pa[2])*t);edgeVertices.set(key,id);return id;
 };
 const pcoord=id=>[positions[id*3],positions[id*3+1],positions[id*3+2]];
 const emit=(tri,out)=>{
  const a=pcoord(tri[0]),b=pcoord(tri[1]),cc=pcoord(tri[2]),abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2],acx=cc[0]-a[0],acy=cc[1]-a[1],acz=cc[2]-a[2],nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
  if(nx*nx+ny*ny+nz*nz<1e-14)return;
  if(nx*out[0]+ny*out[1]+nz*out[2]<0){const t=tri[1];tri[1]=tri[2];tri[2]=t}indices.push(tri[0],tri[1],tri[2]);
 };
 for(let z=0;z<fd-1;z++){
  for(let y=0;y<fh-1;y++)for(let x=0;x<fw-1;x++){
   const cv=new Array(8),cg=new Array(8);let min=Infinity,max=-Infinity;
   for(let k=0;k<8;k++){const q=cubeCorners[k],gx=x+q[0],gy=y+q[1],gz=z+q[2],vv=field(gx,gy,gz);cv[k]=vv;cg[k]=[gx,gy,gz];if(vv<min)min=vv;if(vv>max)max=vv}
   if(min>=iso||max<iso)continue;
   for(const tet of tets){
    let inCount=0,outCount=0,ix=0,iy=0,iz=0,ox=0,oy=0,oz=0;
    for(const k of tet){const g=cg[k],p=world(g[0],g[1],g[2]);if(cv[k]>=iso){inCount++;ix+=p[0];iy+=p[1];iz+=p[2]}else{outCount++;ox+=p[0];oy+=p[1];oz+=p[2]}}
    if(inCount===0||inCount===4)continue;
    let crossings=[];
    for(const e of tetEdges){const ka=tet[e[0]],kb=tet[e[1]],va=cv[ka],vb=cv[kb];if((va>=iso)===(vb>=iso))continue;const a=cg[ka],b=cg[kb];crossings.push(edgeVertex(a[0],a[1],a[2],b[0],b[1],b[2],va,vb))}
    crossings=[...new Set(crossings)];
    const out=[ox/Math.max(1,outCount)-ix/Math.max(1,inCount),oy/Math.max(1,outCount)-iy/Math.max(1,inCount),oz/Math.max(1,outCount)-iz/Math.max(1,inCount)];
    if(crossings.length===3)emit([crossings[0],crossings[1],crossings[2]],out);
    else if(crossings.length===4){
     let cx=0,cy=0,cz=0;const pts=crossings.map(id=>{const p=pcoord(id);cx+=p[0];cy+=p[1];cz+=p[2];return{id,p}});cx/=4;cy/=4;cz/=4;
     let nl=Math.hypot(out[0],out[1],out[2])||1,nx=out[0]/nl,ny=out[1]/nl,nz=out[2]/nl;
     let ux=pts[0].p[0]-cx,uy=pts[0].p[1]-cy,uz=pts[0].p[2]-cz,ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
     let vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
     pts.sort((aa,bb)=>{const ap=aa.p,bp=bb.p,ax=ap[0]-cx,ay=ap[1]-cy,az=ap[2]-cz,bx=bp[0]-cx,by=bp[1]-cy,bz=bp[2]-cz;return Math.atan2(ax*vx+ay*vy+az*vz,ax*ux+ay*uy+az*uz)-Math.atan2(bx*vx+by*vy+bz*vz,bx*ux+by*uy+bz*uz)});
     emit([pts[0].id,pts[1].id,pts[2].id],out);emit([pts[0].id,pts[2].id,pts[3].id],out);
    }
   }
  }
  if((z&3)===3)await frameYield();
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
 taubinSmoothGeometry(geometry,Math.max(0,strength));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
async function buildSmoothIsoMesh(v,mask,seg,key,editSurface=false){
 const geometry=await smoothIsosurfaceGeometry(v,mask,+surfaceSmoothStrength.value);if(!geometry)return null;
 const material=new THREE.MeshStandardMaterial({color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:false}),mesh=new THREE.Mesh(geometry,material);
 mesh.name='segment_'+key+'_isosurface';mesh.userData.segmentKey=key;mesh.userData.editSurface=!!editSurface;mesh.userData.displayScale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;return mesh;
}
function fullVolumeSmoothIsosurfaceFeasible(v){
 if(!v)return false;
 const w=Number(v.columns)||0,h=Number(v.rows)||0,d=Number(v.slices)||0;
 if(w<=0||h<=0||d<=0)return false;
 const voxels=w*h*d,padded=(w+2)*(h+2)*(d+2);
 // Minimum working set before mesh arrays: binary mask + two Float32 scalar fields.
 const estimatedBytes=voxels+padded*8;
 const limit=(navigator.maxTouchPoints||0)>0?48*1024*1024:96*1024*1024;
 return estimatedBytes<=limit;
}
async function render3DSmoothIsosurface(v){
 if(!sceneState||!surfaceSmoothingActive())return false;
 const revision=incSourceRenderRevision(true),previous=sceneState.obj,group=new THREE.Group();if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 set3DBusy(true,'3D等値面を構築中…');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';
 try{
  for(let ai=0;ai<active.length;ai++){
   const {key,seg}=active[ai];if(revision!==sourceRenderRevision){dispose(group);return null}
   footer.textContent=(currentLanguage==='ja'?'滑らかな3D表面を構築中… ':'Building smooth 3D surface… ')+(ai+1)+' / '+active.length;
   let mask;
   if(v.sourceBacked){
    const runs=await ensureSegmentBaseRuns(key,v);if(revision!==sourceRenderRevision){dispose(group);return null}
    mask=maskFromAnalysisRuns(v,runs);
   }else mask=getProcessedSegmentMask(v,seg);
   const mesh=await buildSmoothIsoMesh(v,mask,seg,key,false);if(mesh)group.add(mesh);await frameYield();
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(active.length&&!group.children.some(o=>o?.isMesh))throw new Error('Smooth isosurface produced no mesh');
  if(previous){previous.parent?.remove(previous);dispose(previous)}sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  setGpuComputeBackend('CPU ISOSURFACE · WEBGPU RENDER');threeLabel.textContent=(sceneState.backend||'3D')+' · smooth isosurface';footer.textContent=currentLanguage==='ja'?'3D滑面表示 · フル解像度':'3D smooth surface · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){dispose(group);set3DBusy(false);console.error(e);threeLabel.textContent=(sceneState.backend||'3D')+' · smooth surface error';footer.textContent='3D isosurface error: '+String(e.message||e);mark3DStale();request3DRender();return false}
}
function geometryFromSourcePositions(positions,alreadyGpuSmoothed=false,normals=null,applySmoothing=true,pinnedKeys=null){
 if(!positions||!positions.length)return null;
 let geometry;
 if(surfaceSmoothingActive()&&!alreadyGpuSmoothed&&applySmoothing){
  geometry=indexedGeometryFromTrianglePositions(positions);
  let pinned=null;
  if(pinnedKeys?.size){pinned=new Set();const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++){const k=Math.fround(p.getX(i))+','+Math.fround(p.getY(i))+','+Math.fround(p.getZ(i));if(pinnedKeys.has(k))pinned.add(i)}}
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value,pinned);
 }else{
  geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  if(alreadyGpuSmoothed&&normals?.length===positions.length)geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3);
 }
 return geometry;
}
function consolidateSegmentForStrongSmoothing(group,key,strength){
 const meshes=(group?.children||[]).filter(m=>m?.isMesh&&m.userData?.segmentKey===key&&!m.userData?.gpuResident);
 if(!meshes.length)return null;
 let floats=0;for(const mesh of meshes)floats+=mesh.geometry?.getAttribute?.('position')?.array?.length||0;
 if(!floats)return null;
 const positions=new Float32Array(floats);let q=0;
 for(const mesh of meshes){const a=mesh.geometry.getAttribute('position').array;positions.set(a,q);q+=a.length}
 const geometry=indexedGeometryFromTrianglePositions(positions);taubinSmoothGeometry(geometry,strength);
 const first=meshes[0],material=Array.isArray(first.material)?first.material[0].clone():first.material.clone(),merged=new THREE.Mesh(geometry,material);
 merged.name='segment_'+key+'_global_smooth';merged.userData.segmentKey=key;merged.userData.displayScale=first.userData.displayScale;if(first.userData.editSurface)merged.userData.editSurface=true;
 for(const mesh of meshes){mesh.parent?.remove(mesh);dispose(mesh)}
 group.add(merged);return merged;
}
async function decodeSourceSegmentMasks(meta,segments){
 if(!isNativeDicomTransferSyntax(meta.ts)){
  const values=await getCachedSourceSlice(meta),n=meta.rows*meta.columns,blockSize=16384,states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
  for(let i=0;i<n;i++){const value=values[i];for(const state of states.values())if(value>=state.min&&value<=state.max){state.mask[i]=1;if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}state.block[state.used++]=i}}
  for(const state of states.values()){if(state.used)state.blocks.push(state.block.subarray(0,state.used));state.block=null;delete state.used;delete state.min;delete state.max}
  return states;
 }
 const bpp=meta.bits===8?1:meta.bits===16?2:0;
 if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 let bytes,offset=meta.pixelOffset;
 if(offset!=null){
  bytes=new Uint8Array(await meta.file.slice(offset,offset+meta.rows*meta.columns*bpp).arrayBuffer());
  offset=0;
 }else{
  const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
  if(!el)throw new Error('Pixel Data missing');bytes=all;offset=el.dataOffset;
 }
 const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=meta.rows*meta.columns,blockSize=16384;
 const states=new Map(segments.map(({key,seg})=>[key,{mask:new Uint8Array(n),blocks:[],block:new Uint32Array(blockSize),used:0,min:seg.min,max:seg.max}]));
 const pushIndex=(state,i)=>{
  if(state.used===state.block.length){state.blocks.push(state.block);state.block=new Uint32Array(blockSize);state.used=0}
  state.block[state.used++]=i;
 };
 for(let i=0;i<n;i++){
  let raw;
  if(meta.bits===8){raw=bytes[offset+i];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(offset+i*2,little):view.getUint16(offset+i*2,little);
  const value=Math.fround(raw*meta.slope+meta.intercept);
  for(const state of states.values()){
   if(value>=state.min&&value<=state.max){state.mask[i]=1;pushIndex(state,i)}
  }
 }
 for(const state of states.values()){
  if(state.used)state.blocks.push(state.block.subarray(0,state.used));
  state.block=null;delete state.used;delete state.min;delete state.max;
 }
 return states;
}
function appendGpuMeshTile(positionsByKey,normalsByKey,tile,active){
 let faceOffset=0;
 for(let s=0;s<active.length&&s<4;s++){
  const faces=tile.counts[s]||0,floatCount=faces*18;
  if(floatCount){const builder=positionsByKey.get(active[s].key);if(builder){builder.appendArray(tile.vertices.subarray(faceOffset*18,faceOffset*18+floatCount));builder.hasGpuMesh=true;if(!tile.gpuSmoothed)builder.allGpuSmoothed=false;}if(tile.gpuSmoothed&&tile.normals){normalsByKey.get(active[s].key)?.appendArray(tile.normals.subarray(faceOffset*18,faceOffset*18+floatCount));}}
  faceOffset+=faces;
 }
}
function addGpuResidentTileMesh(group,tile,active,materialParamsByKey,displayScale,name){
 if(!tile?.gpuResident||!tile.positionAttribute)return false;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',tile.positionAttribute);if(tile.normalAttribute)geometry.setAttribute('normal',tile.normalAttribute);
 const materials=[],ranges=[];let start=0,total=0;
 for(let s=0;s<active.length&&s<4;s++){
  const count=(tile.counts[s]||0)*6,key=active[s].key;
  if(count){const materialIndex=materials.length;materials.push(new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));geometry.addGroup(start,count,materialIndex);ranges.push({key,start,count,materialIndex});}
  start+=count;total+=count;
 }
 if(!total){geometry.dispose();return false}
 geometry.setDrawRange(0,total);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),3.6);
 const mesh=new THREE.Mesh(geometry,materials);mesh.name=name;mesh.userData.segmentRanges=ranges;mesh.userData.displayScale=displayScale;mesh.userData.gpuResident=true;mesh.userData.gpuPositionReady=false;mesh.userData.gpuCompletion=tile.completion||null;
 if(ranges.length===1)mesh.userData.segmentKey=ranges[0].key;
 group.add(mesh);return true;
}
async function render3DSourceBacked(v){
 if(!sceneState||!v.series)return;
 const revision=incSourceRenderRevision(true),series=v.series,previous=sceneState.obj;
 const group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 const processedActive=active.filter(({seg})=>segmentNeedsGlobalMask(seg)&&!!v.mprData),streamActive=active.filter(({seg})=>!(segmentNeedsGlobalMask(seg)&&!!v.mprData));
 threeLabel.textContent=(sceneState.backend||'3D')+' · building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);
  syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeSource3DCoordinates(series),positionsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(streamActive.map(({key})=>[key,new Float32FaceBuilder()])),strongSmooth=strongSurfaceSmoothingActive();
 const materialParamsByKey=new Map(streamActive.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}]));
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,positions=builder.take(),geometry=geometryFromSourcePositions(positions,alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();
  if(geometry){
   const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));
   mesh.name='segment_'+key+'_full_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
  }
 };
 try{
  for(const {key,seg} of processedActive){
   const memoryView=sourceMprMemoryView(v);
   const runs=thresholdRunsFromMemory(memoryView,seg),processedGroup=await buildEditableRunsGroup(v,runs,key);
   if(processedGroup){processedGroup.name='processed_segment_'+key;group.add(processedGroup)}
   await frameYield();
  }
  const filtered=sourceFilterStages().length>0,useGpuMesh=streamActive.length>0&&(filtered||('gpu' in navigator&&!gpuFilterRuntime.disabled));
  if(useGpuMesh){
   const filterBlockDepth=gpuMeshBlockDepth();
   for(let z0=0;z0<series.slices.length;z0+=filterBlockDepth){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const block=await getFilteredSourceAxialFaceBlock(z0,filterBlockDepth,series,streamActive,'3d:'+revision);
    for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,streamActive,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,streamActive);else appendSourceFacesFromCompactTile(positionsByKey,series,tile,streamActive,coords)}}
    const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+series.slices.length);await frameYield()}
   }
  }else if(streamActive.length){
   let prev=null,curr=await decodeSourceSegmentMasks(series.slices[0],streamActive);
   let next=streamActive.length&&series.slices.length>1?await decodeSourceSegmentMasks(series.slices[1],streamActive):null;
   for(let z=0;z<series.slices.length;z++){
    if(revision!==sourceRenderRevision){dispose(group);return}
    const nz=z+2,nextPromise=streamActive.length&&nz<series.slices.length?decodeSourceSegmentMasks(series.slices[nz],streamActive):Promise.resolve(null);
    for(const {key} of streamActive)appendSourceSliceFacesFast(positionsByKey.get(key),series,z,prev?.get(key),curr.get(key),next?.get(key),coords);
    const flush=(z%chunkDepth===chunkDepth-1)||z===series.slices.length-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
    if(flush){for(const {key} of streamActive)flushSegment(key,z);footer.textContent='3D building · CPU · '+(z+1)+' / '+series.slices.length;set3DBusy(true,'3D構築中… '+(z+1)+' / '+series.slices.length);await frameYield()}
    prev=curr;curr=next;next=await nextPromise;
   }
  }
  if(revision!==sourceRenderRevision){dispose(group);return}
  if(strongSmooth){
   for(const {key} of streamActive)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}
  const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution');
  if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · source DICOM · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · source DICOM · no resampling';set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);
  if(revision===sourceRenderRevision){threeLabel.textContent=(sceneState.backend||'3D')+' · build error';footer.textContent='3D build error: '+String(e.message||e);set3DBusy(false);mark3DStale()}
  if(String(e.message||e)!=='__SUPERSEDED__')console.error(e);
 }
}

async function render3DMemoryGpu(v){
 const device=await ensureGpuFilterDevice();if(!device)return false;
 const revision=incSourceRenderRevision(true),previous=sceneState.obj,group=new THREE.Group();
 if(previous){group.position.copy(previous.position);group.quaternion.copy(previous.quaternion);group.scale.copy(previous.scale)}
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled).map(key=>({key,seg:segmentState[key]}));
 threeLabel.textContent=(sceneState.backend||'3D')+' · GPU building…';set3DBusy(true,'3D構築中…');
 if(!active.length){
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }
 const chunkDepth=navigator.maxTouchPoints>0?32:64,meshFloatLimit=(navigator.maxTouchPoints>0?6:12)*1024*1024,coords=makeVolume3DCoordinates(v),positionsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),normalsByKey=new Map(active.map(({key})=>[key,new Float32FaceBuilder()])),materialParamsByKey=new Map(active.map(({key,seg})=>[key,{color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55,flatShading:!surfaceSmoothingActive()}])),strongSmooth=strongSurfaceSmoothingActive();
 let residentTileCount=0,cpuTileCount=0;
 const flushSegment=(key,z)=>{
  const builder=positionsByKey.get(key);if(!builder?.length)return;
  const alreadyGpuSmoothed=builder.hasGpuMesh&&!builder.hasCpuMesh&&builder.allGpuSmoothed,normalsBuilder=normalsByKey.get(key),normals=alreadyGpuSmoothed?normalsBuilder?.take():null,geometry=geometryFromSourcePositions(builder.take(),alreadyGpuSmoothed,normals,!strongSmooth);if(!alreadyGpuSmoothed)normalsBuilder?.take();if(!geometry)return;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParamsByKey.get(key)));mesh.name='segment_'+key+'_gpu_'+z;mesh.userData.segmentKey=key;mesh.userData.displayScale=coords.scale;group.add(mesh);
 };
 try{
  const blockDepth=gpuMeshBlockDepth();
  for(let z0=0;z0<v.slices;z0+=blockDepth){
   if(revision!==sourceRenderRevision){dispose(group);return null}
   const block=await getMemoryGpuMeshBlock(v,z0,blockDepth,active);
   for(let ti=0;ti<block.tiles.length;ti++){const tile=block.tiles[ti];if(tile.gpuResident){if(addGpuResidentTileMesh(group,tile,active,materialParamsByKey,coords.scale,'segment_gpu_resident_'+z0+'_'+ti))residentTileCount++}else{cpuTileCount++;if(tile.mesh)appendGpuMeshTile(positionsByKey,normalsByKey,tile,active);else appendSourceFacesFromCompactTile(positionsByKey,{columns:v.columns,rows:v.rows},tile,active,coords)}}
   const lastZ=z0+block.coreDepth-1,flush=((lastZ+1)%chunkDepth===0)||lastZ===v.slices-1||[...positionsByKey.values()].some(b=>b.length>=meshFloatLimit);
   if(flush){for(const {key} of active)flushSegment(key,lastZ);footer.textContent='3D building · '+gpuFilterRuntime.lastBackend+' · '+(lastZ+1)+' / '+v.slices;set3DBusy(true,'3D構築中… '+(lastZ+1)+' / '+v.slices);await frameYield()}
  }
  if(revision!==sourceRenderRevision){dispose(group);return null}
  if(strongSmooth){
   for(const {key} of active)consolidateSegmentForStrongSmoothing(group,key,+surfaceSmoothStrength.value);
   setGpuComputeBackend('WEBGPU MESH · CPU GLOBAL SMOOTH');
  }
  if(previous){previous.parent?.remove(previous);dispose(previous)}
  sceneState.obj=group;sceneState.scene.add(group);syncSectionClipParent();if(sectionViewOpen&&sectionViewPlane){updateSectionClipPlaneWorld();applySectionClippingMaterials(group)}const resident=residentTileCount>0&&cpuTileCount===0,mixed=residentTileCount>0&&cpuTileCount>0;threeLabel.textContent=(sceneState.backend||'3D')+(resident?' · GPU resident':mixed?' · GPU/CPU full resolution':' · full resolution · GPU');if(resident){setGpuComputeBackend(surfaceSmoothingActive()?'WEBGPU GPU-RESIDENT MESH+SMOOTH':'WEBGPU GPU-RESIDENT MESH');footer.textContent='3D full resolution · GPU resident · no vertex readback'}else if(mixed){setGpuComputeBackend('GPU+CPU FULL RESOLUTION');footer.textContent='3D full resolution · GPU+CPU exact geometry · GPU-resident evaluation unavailable'}else footer.textContent='3D full resolution · '+gpuFilterRuntime.lastBackend;set3DBusy(false);request3DRender();mark3DCurrent();return true;
 }catch(e){
  dispose(group);set3DBusy(false);
  if(revision!==sourceRenderRevision||threeDCancelRequested)return null;
  if(String(e.message||e)!=='__GPU_UNAVAILABLE__')console.warn('GPU decoded-volume mesh failed.',e);
  return false;
 }
}
async function render3D(v,force=false){
 if(!sceneState)return false;
 if(deferAutomatic3D&&!force){mark3DStale();return false}
 let ok;
 if(v.sourceBacked)ok=await render3DSourceBacked(v);
 else ok=await render3DMemoryGpu(v);
 if(ok!==true){
  if(ok===null||threeDCancelRequested)return false;
  threeLabel.textContent=(sceneState.backend||'3D')+(surfaceSmoothingActive()?' · smooth surface error':' · 3D build error');
  footer.textContent=currentLanguage==='ja'?(surfaceSmoothingActive()?'表面平滑化3Dの構築に失敗しました。以前の3D表示を保持しています。':'3D生成に失敗しました。以前の3D表示を保持しています。'):(surfaceSmoothingActive()?'Smooth 3D build failed. The previous 3D view was preserved.':'3D build failed. The previous 3D view was preserved.');
  mark3DStale();return false;
 }
 await restoreEditedSegmentSurfaces(v);
 if((analysisEditTool==='pen'||analysisEditTool==='line')&&threeRenderMode==='surface'){
  try{await ensureEditRaycastReady(null,currentLanguage==='ja'?'3D編集データを更新中':'Refreshing 3D edit data')}
  catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'3D編集データ更新エラー: ':'3D edit refresh error: ')+String(e.message||e)}
 }
 return true;
}
function meshSegmentRanges(mesh,key){
 const pos=mesh?.geometry?.getAttribute?.('position');if(!pos)return[];
 if(mesh.userData?.segmentKey===key)return[{start:0,count:mesh.geometry.index?mesh.geometry.index.count:pos.count}];
 return Array.isArray(mesh.userData?.segmentRanges)?mesh.userData.segmentRanges.filter(r=>r.key===key):[];
}
function segmentKeyFromIntersection(hit){
 const direct=hit?.object?.userData?.segmentKey;if(direct)return direct;
 const mi=hit?.face?.materialIndex,ranges=hit?.object?.userData?.segmentRanges;
 if(Array.isArray(ranges)&&Number.isInteger(mi)){const match=ranges.find(r=>r.materialIndex===mi);if(match)return match.key}
 return null;
}
async function ensureGpuResidentCpuPositions(key=null,label='GPU readback'){
 const renderer=sceneState?.renderer;if(!renderer||typeof renderer.getArrayBufferAsync!=='function')return;
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(!o.isMesh||!o.userData?.gpuResident||o.userData?.gpuPositionReady)return;if(key&&meshSegmentRanges(o,key).length===0)return;meshes.push(o)});
 if(!meshes.length)return;
 const previousBackend=gpuFilterRuntime.lastBackend;setGpuComputeBackend('WEBGPU GPU-RESIDENT READBACK');setProcessingBusy(true,label);
 try{
  for(const mesh of meshes){
   if(mesh.userData.gpuCompletion)await mesh.userData.gpuCompletion;
   const attr=mesh.geometry.getAttribute('position'),buffer=await renderer.getArrayBufferAsync(attr),values=new Float32Array(buffer);
   if(values.length!==attr.array.length)throw new Error('GPU position readback size mismatch');
   attr.array.set(values);mesh.userData.gpuPositionReady=true;mesh.geometry.computeBoundingSphere();
  }
 }finally{setProcessingBusy(false,label);setGpuComputeBackend(previousBackend)}
}
function gpuResidentReadbackPending(key=null){
 let pending=false;sceneState?.obj?.traverse?.(o=>{if(pending||!o.isMesh||!o.userData?.gpuResident||o.userData?.gpuPositionReady)return;if(key&&meshSegmentRanges(o,key).length===0)return;pending=true});return pending;
}
async function cutBvhModule(){
 if(!cutBvhModulePromise)setCutBvhModulePromise(import('https://esm.sh/three-mesh-bvh@0.9.15?deps=three@0.186.0').catch(e=>{console.warn('Cut BVH acceleration unavailable.',e);setCutBvhModulePromise(null);return null}));
 return cutBvhModulePromise;
}
function segmentCutRaycastProxy(mesh){
 if(!mesh?.geometry)return null;
 if(mesh.userData?.gpuResident&&!mesh.userData.gpuPositionReady)return null;
 const src=mesh.geometry.getAttribute?.('position');if(!src?.array?.length)return null;
 let proxy=mesh.userData.cutRaycastProxy;
 if(!proxy){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(src.array,src.itemSize||3,src.normalized||false));
  const index=mesh.geometry.index;if(index?.array)geometry.setIndex(new THREE.BufferAttribute(index.array,1,index.normalized||false));
  geometry.setDrawRange(mesh.geometry.drawRange.start,mesh.geometry.drawRange.count);
  for(const g of mesh.geometry.groups||[])geometry.addGroup(g.start,g.count,g.materialIndex);
  geometry.computeBoundingSphere();
  setCutRaycastMaterial(cutRaycastMaterial||new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const materialCount=Math.max(1,Array.isArray(mesh.material)?mesh.material.length:1),materials=Array.from({length:materialCount},()=>cutRaycastMaterial);
  proxy=new THREE.Mesh(geometry,materials);proxy.matrixAutoUpdate=false;
  proxy.userData.segmentKey=mesh.userData.segmentKey||null;
  proxy.userData.segmentRanges=Array.isArray(mesh.userData.segmentRanges)?mesh.userData.segmentRanges.map(r=>({...r})):[];
  proxy.userData.displayScale=mesh.userData.displayScale;proxy.userData.cutRaycastProxy=true;proxy.userData.sourceMesh=mesh;
  mesh.userData.cutRaycastProxy=proxy;
 }
 mesh.updateMatrixWorld(true);proxy.matrixWorld.copy(mesh.matrixWorld);return proxy;
}
function cutRaycastSourceMeshes(key=null){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{
  if(!o.isMesh||o.userData?.cutResultPreview)return;
  const hasSegment=!!o.userData?.segmentKey||Array.isArray(o.userData?.segmentRanges)&&o.userData.segmentRanges.length;
  if(!hasSegment)return;
  if(key&&meshSegmentRanges(o,key).length===0)return;
  meshes.push(o);
 });return meshes;
}
async function ensureCutRaycastAcceleration(key=null){
 const mod=await cutBvhModule(),meshes=cutRaycastSourceMeshes(key);if(!mod){if(sceneState)sceneState.cutRaycastAccelerated=false;return 0}
 const {MeshBVH,acceleratedRaycast}=mod;let built=0,ready=0;
 for(const mesh of meshes){
  const proxy=segmentCutRaycastProxy(mesh);if(!proxy)continue;
  if(!proxy.geometry.boundsTree){
   proxy.geometry.boundsTree=new MeshBVH(proxy.geometry,{indirect:true,verbose:false,targetLeafSize:16});
   proxy.raycast=acceleratedRaycast;built++;await frameYield();
  }else if(proxy.raycast!==acceleratedRaycast)proxy.raycast=acceleratedRaycast;
  if(proxy.geometry.boundsTree)ready++;
 }
 if(sceneState)sceneState.cutRaycastAccelerated=ready>0&&ready===meshes.length;
 return built;
}
async function ensureEditRaycastReady(key=null,label='3D edit data'){
 for(let attempt=0;attempt<4;attempt++){
  const obj=sceneState?.obj;
  await ensureGpuResidentCpuPositions(key,label);
  if(sceneState?.obj===obj&&!gpuResidentReadbackPending(key))return true;
  await frameYield();
 }
 if(gpuResidentReadbackPending(key))throw new Error('3D edit mesh changed during preparation');
 return true;
}
function cutRaycastTargets(){
 const targets=[];for(const mesh of cutRaycastSourceMeshes()){const proxy=segmentCutRaycastProxy(mesh);if(proxy)targets.push(proxy)}
 return targets;
}
function currentSegmentMeshes(key){
 const meshes=[];sceneState?.obj?.traverse?.(o=>{if(o.isMesh&&o.geometry&&meshSegmentRanges(o,key).length)meshes.push(o)});return meshes;
}
function currentSegmentDisplayScale(key){
 const mesh=currentSegmentMeshes(key)[0];return Number(mesh?.userData?.displayScale)||1;
}
function currentSegmentVolumeMm3(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return 0;
 const scale=currentSegmentDisplayScale(key),inv3=1/Math.max(scale*scale*scale,1e-18),cross=new THREE.Vector3();let signed=0;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(a,b,c)=>{signed+=a.dot(cross.crossVectors(b,c))/6});
 return Math.abs(signed)*inv3;
}
function currentSegmentTriangleCount(key){
 let count=0;for(const mesh of currentSegmentMeshes(key))for(const range of meshSegmentRanges(mesh,key))count+=Math.floor(range.count/3);return count;
}
// ---- Project files (.vrlab, see docs/project-file.js) ----
// Original-resolution record of filters, segments, 3D edits and display state.
// Loading replays the settings through the same controls a user would touch,
// so UI, state and scheduled recomputation stay consistent; only the 3D edit
// masks (no UI equivalent) are written directly.
const FILTER_PARAM_INPUTS={spikeHole:{strength:spikeHoleStrength,threshold:spikeHoleThreshold},nlm:{strength:nlmStrength,searchRadius:nlmSearchRadius,patchRadius:nlmPatchRadius},anisotropic:{strength:anisotropicStrength,iterations:anisotropicIterations},gaussian:{mode:smoothingType,strength:gaussianStrength,passes:spatialPasses},sigmoid:{strength:sigmoidStrength,center:sigmoidCenter},bilateral:{strength:bilateralStrength,spatialSigma:bilateralSpatial,intensitySigma:bilateralIntensity,passes:bilateralPasses},tv:{weight:tvWeight,iterations:tvIterations},unsharp:{radius:unsharpRadius,amount:unsharpAmount,threshold:unsharpThreshold}};
const segmentControl=(attr,key)=>$('[data-seg-'+attr+'="'+key+'"]');
const pendingProject={value:null};
const applyVolumeAfterFilterRebuild={value:false};
function setControlValue(el,value){if(!el||value==null)return;el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
function setControlChecked(el,checked){if(!el||el.checked===!!checked)return;el.checked=!!checked;el.dispatchEvent(new Event('change',{bubbles:true}))}
function gatherProject(){
 const series=activeSeries,slices=series.slices.length;
 const project={
  app:{version:APP_VERSION,build:APP_BUILD},savedAt:new Date().toISOString(),
  dataset:datasetFingerprint(series),
  display:{windowCenter:wc.value,windowWidth:ww.value,ctRangeMode,slices:Object.fromEntries(Object.keys(planes).map(p=>[p,+planes[p].slider.value]))},
  filters:{order:filterOrder.filter(k=>filterState[k]).map(key=>({key,params:Object.fromEntries(Object.entries(FILTER_PARAM_INPUTS[key]||{}).map(([name,el])=>[name,el.value]))}))},
  segments:Object.fromEntries(SEGMENT_PRESET_ORDER.map(key=>{const g=segmentState[key];return[key,{active:!!g.active,enabled:!!g.enabled,color:g.color,opacity:g.opacity,min:g.min,max:g.max,opening:g.opening,closing:g.closing,minComponent:g.minComponent,holeFill:!!g.holeFill}]})),
  surfaceSmoothing:{enabled:!!surfaceSmoothEnabled?.checked,strength:surfaceSmoothStrength?.value??null},
  // were these filters applied to 3D (volume or surfaces) when saved? A loaded
  // project then restores the 3D state too, not only the 2D preview.
  threeD:{filtersApplied:!!currentFilterSignature()&&(gpuVolumeDataSignature()===currentFilterSignature()||!threeDDirty)},
  edits:{},
 };
 const binaries={};
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key],entry={};
  for(const kind of['keep','exclude']){const runs=st[kind+'Runs'];if(runs){const path='edits/'+key+'-'+kind+'.bin';binaries[path]=encodeRuns(runs,slices);entry[kind]=path}}
  if(Object.keys(entry).length)project.edits[key]=entry;
 }
 return{project,binaries};
}
// iPad/iPhone: the share sheet's "Save to Files" lets the user pick the DICOM
// folder directly (browsers cannot write into the opened folder; Safari has no
// File System Access API). Mac's share sheet has no folder target, so Macs and
// anything without file sharing download instead. navigator.share must run in
// the click's user activation, so nothing is awaited before it.
async function deliverProjectFile(bytes,name){
 if(isIPadRuntime()||isIPhoneRuntime()){
  const file=new File([bytes],name,{type:'application/octet-stream'});
  if(navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:name});return'shared'}
   catch(e){if(e?.name==='AbortError')return'cancelled';console.warn('Share failed; downloading instead.',e)}
  }
 }
 // octet-stream: with application/zip Safari/iOS renames the download to *.zip
 downloadBlob(new Blob([bytes],{type:'application/octet-stream'}),name);
 return'downloaded';
}
async function saveProject(){
 if(!volume||!activeSeries)return;
 const ja=currentLanguage==='ja';
 try{
  const{project,binaries}=gatherProject(),bytes=packProject(project,binaries);
  const base=(activeSeries.description||'project').replace(/[^\w\-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'project';
  const how=await deliverProjectFile(bytes,base+'_'+new Date().toISOString().slice(0,10)+PROJECT_EXTENSION),size=fmt(bytes.byteLength);
  footer.textContent=how==='cancelled'?(ja?'プロジェクトの保存をキャンセルしました':'Project save cancelled')
   :how==='shared'?(ja?'プロジェクトを書き出しました · '+size+' · 「"ファイル"に保存」でDICOMフォルダを選ぶと、次回はフォルダを開くだけで自動適用されます':'Project exported · '+size+' · choose the DICOM folder in "Save to Files" to apply it automatically next time')
   :(ja?'プロジェクトを保存しました · '+size+' · DICOMフォルダに入れておくと、フォルダを開くだけで自動適用されます':'Project saved · '+size+' · keep it in the DICOM folder to apply it automatically when the folder is opened');
 }catch(e){console.error(e);footer.textContent=(ja?'プロジェクトを保存できませんでした: ':'Could not save project: ')+String(e.message||e)}
}
async function applyPendingProject(){
 const pending=pendingProject.value;if(!pending)return;
 const ja=currentLanguage==='ja',ds=pending.project.dataset||{},label=(ds.description||'')+' · '+ds.columns+'×'+ds.rows+'×'+ds.slices;
 if(!volume||!activeSeries){footer.textContent=ja?'プロジェクトを読み込みました。対応するDICOM（'+label+'）を開くと適用します':'Project loaded. Open the matching DICOM ('+label+') to apply it';return}
 if(!compareFingerprints(ds,datasetFingerprint(activeSeries)).ok){
  const match=detectedSeries.list.find(s=>s!==activeSeries&&compareFingerprints(ds,datasetFingerprint(s)).ok);
  if(match){await selectSeries(match);return}
  const issues=compareFingerprints(ds,datasetFingerprint(activeSeries)).issues.join(', ');
  footer.textContent=ja?'このプロジェクトは別のデータ用です（'+label+'、不一致: '+issues+'）。対応するDICOMを開くと適用します':'This project belongs to other data ('+label+'; mismatch: '+issues+'). Open the matching DICOM to apply it';
  return;
 }
 pendingProject.value=null;
 try{await applyProject(pending);footer.textContent=ja?'プロジェクトを適用しました':'Project applied'}
 catch(e){console.error(e);footer.textContent=(ja?'プロジェクトを適用できませんでした: ':'Could not apply project: ')+String(e.message||e)}
}
async function applyProject({project,files}){
 // validate and decode edits first, so a broken file changes nothing
 const dims={slices:activeSeries.slices.length,columns:activeSeries.columns,rows:activeSeries.rows},edits={};
 for(const[key,entry]of Object.entries(project.edits||{})){
  if(!SEGMENT_PRESET_ORDER.includes(key))continue;edits[key]={};
  for(const kind of['keep','exclude'])if(entry?.[kind]){const bytes=files[entry[kind]];if(!bytes)throw new Error('missing '+entry[kind]);edits[key][kind]=decodeRuns(bytes,dims)}
 }
 // filters (replayed through the filter controls)
 resetFilterBtn.click();
 for(const{key,params}of project.filters?.order||[]){
  if(!FILTER_CATALOG_ORDER.includes(key))continue;addFilter(key);
  for(const[name,value]of Object.entries(params||{}))setControlValue(FILTER_PARAM_INPUTS[key]?.[name],value);
 }
 // display
 const display=project.display||{};
 if(display.ctRangeMode)applyCtRangeMode(display.ctRangeMode);
 setControlValue(wc,display.windowCenter);setControlValue(ww,display.windowWidth);
 // segments
 for(const key of SEGMENT_PRESET_ORDER){
  const g=project.segments?.[key];if(!g)continue;
  if(!g.active){if(segmentState[key].active)removeSegmentPreset(key);continue}
  if(!segmentState[key].active)addSegmentPreset(key);
  setControlValue(segmentControl('color',key),g.color);
  setControlValue(segmentControl('max',key),g.max);setControlValue(segmentControl('min',key),g.min);setControlValue(segmentControl('max',key),g.max);
  setControlValue(segmentControl('opacity',key),g.opacity);setControlValue(segmentControl('opening',key),g.opening);
  setControlValue(segmentControl('closing',key),g.closing);setControlValue(segmentControl('min-component',key),g.minComponent);
  setControlChecked(segmentControl('hole-fill',key),g.holeFill);setControlChecked(segmentControl('enabled',key),g.enabled);
 }
 // surface smoothing
 if(project.surfaceSmoothing){setControlChecked(surfaceSmoothEnabled,project.surfaceSmoothing.enabled);setControlValue(surfaceSmoothStrength,project.surfaceSmoothing.strength)}
 // 3D edits (voxel masks at original resolution)
 for(const key of SEGMENT_PRESET_ORDER){
  const st=segmentEditState[key],e=edits[key]||{};
  st.keepRuns=e.keep||null;st.excludeRuns=e.exclude||null;st.cutRuns=null;st.finalRuns=null;st.undo=[];st.redo=[];st.revision++;
 }
 if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active)syncGpuVolumeEdits(sourceVolume||volume);
 // slice positions
 for(const[p,idx]of Object.entries(display.slices||{}))if(planes[p]&&Number.isFinite(+idx))planes[p].slider.value=String(Math.max(0,Math.min(+planes[p].slider.max,+idx)));
 // 3D: projects without the flag (saved before build 206) count as applied
 const applied=project.threeD?.filtersApplied??!!(project.filters?.order||[]).length;
 if(applied&&currentFilterSignature()&&(sourceVolume||volume)?.sourceBacked){
  gpuVolumeApplied.seriesId=(sourceVolume||volume)?.series?.id??null;gpuVolumeApplied.signature=currentFilterSignature();
  applyVolumeAfterFilterRebuild.value=true; // see rebuildActiveFilters
 }
 clearAnalysisHighlight();renderAll();scheduleSegment3D();updateAnalysisEditorControls();updateVolumeFilterBadge();
}
volumeCacheClearBtn.onclick=async()=>{
 const cache=await volumeCache();if(!cache||!confirm(tr('volumeCacheConfirm')))return;
 try{await cache.clear();footer.textContent=tr('volumeCacheCleared')}catch(e){console.warn(e)}
 void updateVolumeCacheControl();
};
projectSaveBtn.onclick=()=>void saveProject();
projectOpenBtn.onclick=()=>openFilePicker('project');
projectInput.onchange=async e=>{
 const input=e.target,file=input.files?.[0];input.value='';if(!file)return;
 try{pendingProject.value=unpackProject(new Uint8Array(await file.arrayBuffer()));await applyPendingProject()}
 catch(e){console.error(e);footer.textContent=(currentLanguage==='ja'?'プロジェクトを開けませんでした: ':'Could not open project: ')+String(e.message||e)}
};
function downloadBlob(blob,filename){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();const url=a.href;a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function exportFocusedAnalysisRegionStl(){
 const region=analysisRegionById(analysisFocusedRegionId),v=current3DVolume||volume;if(!region||!v)return;if(!region.meshGroup)await attachAnalysisRegion(region,v,true);
 const scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale,blob=groupToBinaryStl(region.meshGroup,'region-'+region.id,1/Math.max(scale,1e-12));if(!blob)return;
 const filename='virtual-rodent-region-'+region.id+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
function currentSegmentToBinaryStl(key){
 const meshes=currentSegmentMeshes(key);if(!meshes.length)return null;
 const triCount=currentSegmentTriangleCount(key),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer),header=new TextEncoder().encode('Virtual Rodent Lab '+key);
 new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));view.setUint32(80,triCount,true);
 const scale=currentSegmentDisplayScale(key),inverseScale=1/Math.max(scale,1e-12),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();let off=84;
 for(const mesh of meshes)for(const range of meshSegmentRanges(mesh,key))eachGeometryTriangleRange(mesh.geometry,range.start,range.count,(aa,bb,cc)=>{
  const a=aa.clone().multiplyScalar(inverseScale),b=bb.clone().multiplyScalar(inverseScale),c=cc.clone().multiplyScalar(inverseScale);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 });
 return new Blob([buffer],{type:'model/stl'});
}
async function exportSegmentStl(key){
 if(!sceneState?.obj||threeDDirty){footer.textContent=currentLanguage==='ja'?'STL: 先に3Dを再構築してください':'STL: rebuild 3D first';return}
 let blob=null;
 if(segmentEditActive(key)){
  if(!segmentEditState[key].surfaceGroup)await refreshEditedSegmentSurface(key);
  const v=current3DVolume||volume,scale=(v.sourceBacked?makeSource3DCoordinates(v.series):makeVolume3DCoordinates(v)).scale;blob=groupToBinaryStl(segmentEditState[key].surfaceGroup,'edited-'+key,1/Math.max(scale,1e-12));
 }else{
  try{await ensureGpuResidentCpuPositions(key,currentLanguage==='ja'?'STL用メッシュを取得中':'Preparing STL mesh')}catch(e){console.error(e);footer.textContent='STL readback error: '+String(e.message||e);return}
  blob=currentSegmentToBinaryStl(key);
 }
 if(!blob){footer.textContent='STL: segment is empty';return}
 const names={bone:'bone',soft:'soft-tissue',fat:'fat',lung:'lung'},filename='virtual-rodent-'+(names[key]||key)+'.stl';downloadBlob(blob,filename);footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+filename;
}
function taubinSmoothGeometry(geometry,strength,pinned=null){
 const pos=geometry.getAttribute('position');
 const index=geometry.index;
 if(!pos||!index||strength<=0)return;
 const vertexCount=pos.count;
 const neighbors=Array.from({length:vertexCount},()=>[]);
 const addNeighbor=(a,b)=>{const list=neighbors[a];for(let i=0;i<list.length;i++)if(list[i]===b)return;list.push(b)};
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  addNeighbor(a,b);addNeighbor(a,c);
  addNeighbor(b,a);addNeighbor(b,c);
  addNeighbor(c,a);addNeighbor(c,b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const baseStrength=Math.min(strength,1),lambda=.34*baseStrength,mu=-.36*baseStrength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(pinned?.has(i)||ns.length===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.length;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(strength<=1?2+strength*4:strength<=3?6+(strength-1)*18:42+(strength-3)*24));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function resetVolume(){incSourceRenderRevision(false);setThreeDCancelRequested(false);setCurrent3DVolume(null);setAnalysisEditPreparing(false);setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();invalidateSourceFilters();clearSourceSliceCache();setActiveSeries(null);setSectionViewOpen(false);clearSectionView();updateSectionViewUi();if(threeRenderMode==='volume')setThreeVolumeOverlay(false);setThreeRenderMode('surface');sceneState?.medicalVolume?.resetData();clearAllSegmentEdits();clearAnalysisHighlight();smoothingType.value='gaussian';setFilterOrder([]);for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();setVolumeAnalysisMode(false);setVolumeAnalysisBusy(false);volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');sectionViewToggle.disabled=true;volumeAnalysisResult.classList.add('is-hidden');clearAnalysisHighlight();incFilterRebuildRevision(false);filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;setVolume(null);setSourceVolume(null);enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;setCtRangeProfile(null);setCtRangeMode('auto');ctRangeAuto.disabled=ctRangeFull.disabled=true;ctRangeAuto.classList.add('is-active');ctRangeFull.classList.remove('is-active');for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}set3DBusy(false);updateRenderModeControl(null);updateAnalysisEditorControls();updateThreeEditUi();request3DRender();set3DState('current');threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{const release=()=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()};const pending=c.userData?.gpuCompletion;if(pending?.then)pending.then(release,release);else release()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
void ensureLatestDeployedBuild();
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
