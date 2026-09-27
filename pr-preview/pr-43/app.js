
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { MedicalVolumeRenderer, extractSourceThresholdRuns } from './medical-volume.js?v=20260927-build234';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
import { clampRangeValue, ctDigits, esc, fmt, formatCtValue, frameYield, hexRgb, isDesktopMac, isIPadRuntime, isIPhoneRuntime, multi, niceCtStep, num, numberOr, rangeNumber, rangePrecision, rangeStep, safePair, safeTriple, withTimeout } from './utils.js?v=20260927-build234';
import { COMPRESSED_DICOM_TRANSFER_SYNTAXES, NATIVE_DICOM_TRANSFER_SYNTAXES, canDecodeToInt16, dicomImageFrameInfo, encapsulatedFrameBytes, expandParsedFrames, groupSeries, isNativeDicomTransferSyntax, parseDicomHeader, parseFiles, parsedSliceMeta, sourceRangeFromMetadata } from './dicom.js?v=20260927-build234';
import { boxBlur3D, buildThresholdMask, compactFaceFlags, fillMaskHoles, morphMask, removeSmallMaskComponents, smoothMaskScalarField, thresholdSourceMask, valuesToFaceFlags, valuesToSegmentBits } from './mask-ops.js?v=20260927-build234';
import { RunUnionFind, analysisRunRows, analysisRunSliceState, analysisRunsContain, analysisRunsOverlap, analysisRunsVoxelCount, complementRunArrays, componentAtVoxel, componentTouchesVolumeBoundary, componentsFromRuns, componentsFromRunsAsync, consumeGpuAnalysisRuns, forEachUncoveredRun, intersectRunArrays, intersectRunSlice, maskFromAnalysisRuns, maskToAnalysisRuns, mergeIntervals, morphSourceRunArrays, postprocessSourceRuns, rowIntervalsFromRuns, rowsToRunSlice, runArraysBinary, runsSliceToMask, sourceComponentSliceState, sourceResultToAnalysisRuns, sourceRunSlice, sourceRunSliceFromRanges, subtractRunArrays, subtractRunSlice, unionAnalysisRuns, unionOverlappingRuns, unionRunArrays, unionRunSlice } from './run-length.js?v=20260927-build234';
import { Float32FaceBuilder, appendAnalysisRunBoundaryFaces, appendDecodedMaskSliceFaces, appendSourceFacesFromCompactTile, appendSourceSliceFaces, appendSourceSliceFacesFast, appendSourceSliceFacesFromBits, appendSourceSliceFacesFromFlags, eachGeometryTriangle, eachGeometryTriangleRange, geometryToBinaryStl, groupToBinaryStl, groupTriangleCount, indexedGeometryFromTrianglePositions, makeSource3DCoordinates, makeVolume3DCoordinates } from './mesh-geometry.js?v=20260927-build234';
import { I18N, tr } from './i18n.js?v=20260927-build234';
import { GPU_PREWARM_KINDS, gpuFilterShader, normalizeVrlWgsl } from './gpu-shaders.js?v=20260927-build234';
import { activeId, activeSeries, analysisCutApplying, analysisCutScreen, analysisCutStroke, analysisEditPreparing, analysisEditTargetKey, analysisEditTargetMode, analysisEditTool, analysisFocusedRegionId, analysisPendingCut, analysisRegions, ctRangeMode, ctRangeProfile, current3DVolume, currentLanguage, cutBvhModulePromise, cutControlPreviewRaf, cutRaycastMaterial, cutResultPreviewRevision, cutResultPreviewTimer, deferAutomatic3D, dicomCodecModulePromise, filterOrder, filterRebuildRevision, filterRebuildTimer, gpuPrewarmIndex, gpuPrewarmScheduled, incCutResultPreviewRevision, incFilterRebuildRevision, incGpuPrewarmIndex, incNextAnalysisColorIndex, incNextAnalysisRegionId, incNextSegmentMaskVolumeId, incResidentMprEpoch, incSourceMprWarmupToken, incSourceRenderRevision, ipadGpuTargetSide, memoryGpuPreviewActive, mpr3DSurfaceOpacity, mpr3DVolumeOpacity, mpr3DWindowLutKey, mpr3DWindowLutTable, nextAnalysisColorIndex, nextAnalysisRegionId, nextSegmentMaskVolumeId, precisionRangeDrag, residentGpuUploadSeriesId, residentMprEpoch, residentMprReadbackDisabled, sceneState, sectionAutoPlane, sectionCapEnabled, sectionCapHatch, sectionCapOpacity, sectionSliceImageVisible, sectionViewOpen, sectionViewPlane, sectionViewReverse, segmentRenderTimer, setActiveId, setActiveSeries, setAnalysisCutApplying, setAnalysisCutScreen, setAnalysisCutStroke, setAnalysisEditPreparing, setAnalysisEditTargetKey, setAnalysisEditTargetMode, setAnalysisEditTool, setAnalysisFocusedRegionId, setAnalysisPendingCut, setAnalysisRegions, setCtRangeMode, setCtRangeProfile, setCurrent3DVolume, setCurrentLanguage, setCutBvhModulePromise, setCutControlPreviewRaf, setCutRaycastMaterial, setCutResultPreviewRevision, setCutResultPreviewTimer, setDeferAutomatic3D, setDicomCodecModulePromise, setFilterOrder, setFilterRebuildRevision, setFilterRebuildTimer, setGpuPrewarmIndex, setGpuPrewarmScheduled, setIpadGpuTargetSide, setMemoryGpuPreviewActive, setMpr3DSurfaceOpacity, setMpr3DVolumeOpacity, setMpr3DWindowLutKey, setMpr3DWindowLutTable, setNextAnalysisColorIndex, setNextAnalysisRegionId, setNextSegmentMaskVolumeId, setPrecisionRangeDrag, setResidentGpuUploadSeriesId, setResidentMprEpoch, setResidentMprReadbackDisabled, setSceneState, setSectionAutoPlane, setSectionCapEnabled, setSectionCapHatch, setSectionCapOpacity, setSectionSliceImageVisible, setSectionViewOpen, setSectionViewPlane, setSectionViewReverse, setSegmentRenderTimer, setSmoothingRefreshTimer, setSourceMprWarmupPlane, setSourceMprWarmupToken, setSourceOrthogonalPlaneCacheBytes, setSourceRenderRevision, setSourceVolume, setThreeDApplying, setThreeDCancelRequested, setThreeDDirty, setThreeRenderMode, setVolume, setVolumeAnalysisBusy, setVolumeAnalysisMode, smoothingRefreshTimer, sourceMprWarmupPlane, sourceMprWarmupToken, sourceOrthogonalPlaneCacheBytes, sourceRenderRevision, sourceVolume, threeDApplying, threeDCancelRequested, threeDDirty, threeRenderMode, volume, volumeAnalysisBusy, volumeAnalysisMode } from './state.js?v=20260927-build234';
import { $, analysisClearButton, analysisCutApply, analysisCutButton, analysisCutCancel, analysisCutConfirm, analysisCutDepth, analysisCutDepthValue, analysisCutOffset, analysisCutOffsetValue, analysisCutPitch, analysisCutPitchValue, analysisCutWidth, analysisCutWidthValue, analysisCutYaw, analysisCutYawValue, analysisEditRemoveSelected, analysisEditTargetSelect, analysisExportSelected, analysisKeepSelected, analysisLassoButton, analysisLineCutButton, analysisMergeButton, analysisNavigateButton, analysisRedo, analysisRegionList, analysisRemoveSelected, analysisResetEdit, analysisSelectRegionButton, analysisSummary, analysisUndo, anisotropicBtn, anisotropicIterations, anisotropicIterationsValue, anisotropicStrength, anisotropicStrengthValue, app, appVersionBadge, bar, bilateralBtn, bilateralIntensity, bilateralIntensityValue, bilateralPasses, bilateralPassesValue, bilateralSpatial, bilateralSpatialValue, bilateralStrength, bilateralStrengthValue, ctRangeAuto, ctRangeFull, demoBtn, filter3DState, filterAddButton, filterAddSelect, filterControlList, filterRebuild3D, folderBtn, folderInput, footer, gaussianBtn, gaussianStrength, gaussianStrengthValue, ipadGpuQuality, ipadGpuQualityControl, languageToggle, list, mainViewSlot, mpr3DSliceSliders, mprSurfaceOpacity, mprSurfaceOpacityValue, mprVolumeOpacity, mprVolumeOpacityValue, nlmBtn, nlmPatchRadius, nlmPatchRadiusValue, nlmSearchRadius, nlmSearchRadiusValue, nlmStrength, nlmStrengthValue, planes, processingOverlay, processingOverlayLabel, prog, progLabel, projectInput, projectOpenBtn, projectSaveBtn, renderModeToggle, resetFilterBtn, sectionCapEnabledControl, sectionCapHatchControl, sectionCapOpacityControl, sectionCapOpacityValue, sectionPosition, sectionPositionValue, sectionReverse, sectionSliceImageControl, sectionViewReadout, sectionViewResult, sectionViewToggle, segmentAddButton, segmentAddSelect, segmentControls, selected, sigmoidBtn, sigmoidCenter, sigmoidCenterValue, sigmoidStrength, sigmoidStrengthValue, smoothingType, spatialPasses, spatialPassesValue, spikeHoleBtn, spikeHoleStrength, spikeHoleStrengthValue, spikeHoleThreshold, spikeHoleThresholdValue, state, status, subViewSlots, surfaceSmoothEnabled, surfaceSmoothStrength, surfaceSmoothValue, threeBusy, threeBusyCancel, threeBusyLabel, threeEditHelp, threeEditOverlay, threeEditStatus, threeFilterBadge, threeLabel, tvBtn, tvIterations, tvIterationsValue, tvWeight, tvWeightValue, unsharpAmount, unsharpAmountValue, unsharpBtn, unsharpRadius, unsharpRadiusValue, unsharpThreshold, unsharpThresholdValue, viewport, volumeAnalysisResult, volumeAnalysisToggle, volumeCacheClearBtn, wc, wcVal, ww, wwVal } from './ui-shell.js?v=20260927-build234';
import { latestOnlyRunner } from './latest-runner.js?v=20260927-build234';
import { strongSurfaceSmoothingActive, surfaceSmoothingActive } from './settings.js?v=20260927-build234';
import { GPU_FILTER_KEYS, acquireGpuWorkBuffer, adoptRendererGpuDevice, clearGpuBufferPool, createGpuResidentFloat3Attribute, destroyGpuResidentAttribute, ensureGpuFilterDevice, finishGpuResidentTemps, gpuAdapterLabel, gpuBufferBucketSize, gpuComputeWorkgroupSize, gpuDeviceMode, gpuDeviceRequestDescriptor, gpuFilterPipeline, gpuFilterRuntime, gpuPoolLimit, gpuSmallBuffer, gpuStagesSupported, gpuValidationScope, installGpuErrorListener, releaseGpuWorkBuffer, requestVrlGpuAdapter, requestVrlGpuDevice, runGpuSourceFilters, setGpuComputeBackend, updateGpuStatus, verifyGpuComputeDevice, verifyGpuPipelineSet } from './gpu-compute.js?v=20260927-build234';
import { cachedSagittalDisplayPlane, cachedSourceMprPlane, decode, decodeCompressedDicomSlice, decodeSourceSlice, getDicomCodecModule, prepareSourceMprCache, readSourceColumn, readSourceRow, readSourceRows, sourceMprCacheLimit, sourceMprDecodeConcurrency, sourceSliceCache } from './volume-io.js?v=20260927-build234';
import { componentFullyInside, makeVoxelProjector, polygonBounds } from './lasso.js?v=20260927-build234';
import { PROJECT_EXTENSION, compareFingerprints, datasetFingerprint, decodeRuns, encodeRuns, isProjectArchiveName, packProject, projectFromEntries, unpackProject } from './project-file.js?v=20260927-build234';
import { cacheKey, openVolumeCache, textureCacheHandle } from './gpu-volume-cache.js?v=20260927-build234';
import { createSourceFilterSlot, ensureSourceFilterWorkers, filterState, fitSourceTile, getCachedSourceSlice, getFilteredMemoryPlaneValues, getFilteredSourceAxialBlock, getFilteredSourcePlaneValues, memoryFilterPreviewCache, memoryFilterPreviewGet, memoryFilterPreviewSet, memoryPreviewCacheLimit, planeRenderRevision, processMemoryRegion, processSourceRegion, pumpSourceFilterWorkers, readMemoryRegion, readSourceRegion, readSourceSubregion, runSourceFilterWorker, sourceFilterCacheGet, sourceFilterCacheLimit, sourceFilterCacheSet, sourceFilterHalo, sourceFilterRuntime, sourceFilterSignature, sourceFilterStages, sourceFilterWorkerMain, sourceSliceCacheLimit, sourceTileBudget } from './source-filters.js?v=20260927-build234';
import { buildSourceOrthogonalPlane, readResidentGpuMprPlane, readSourceOrthogonalStrip, residentGpuMprAvailable, residentMprJobs, sourceOrthogonalCacheGet, sourceOrthogonalCacheLimit, sourceOrthogonalCacheSet, sourceOrthogonalPlaneCache, sourceOrthogonalPlanePending } from './mpr-orthogonal.js?v=20260927-build234';
import { gpuVolumeRefresh, mark3DCurrent, mark3DStale, request3DRender, set3DBusy, set3DState, updateVolumeFilterBadge } from './scene3d.js?v=20260927-build234';
import { cpuAnisotropicDiffusion, cpuBilateral3D, cpuGaussian3D, cpuMedian3D, cpuNlm3D, cpuSigmoid, cpuSpikeHole, cpuTvDenoising3D, cpuUnsharpMask3D } from './cpu-filters.js?v=20260927-build234';
import { disposeMprPlaneGroup, ensureMpr3DPlanes, ensureMpr3DPreviewCache, makeMprPlaneLabel, mpr3DCacheImage, mpr3DOpacitySource, mpr3DOrthoSliding, mpr3DPreviewCache, mpr3DPreviewMap, mpr3DPreviewPlan, mpr3DPreviewSignature, mpr3DVisibility, mpr3DWindowLut, paintMpr3DCacheSliceFast, pushCachedMpr3DPlane, refreshMpr3DPlaneTexture, restoreSectionAutoPlane, setMpr3DOverlayVisible, showSectionPlaneOverlay, syncMpr3DOverlayPresentation, syncMpr3DSliceSliders, updateMpr3DPlanePositions } from './mpr3d-overlay.js?v=20260927-build234';
import { SEGMENT_PRESET_ORDER, activeMprSegments, getProcessedSegmentMask, segmentEditActive, segmentEditState, segmentMaskVolumeId, segmentMaskVolumeIds, segmentNeedsGlobalMask, segmentState, sourceMprMemoryView } from './segments.js?v=20260927-build234';
import { rebindWebGpuSectionClipGroup, sectionLocalNormal, sectionLocalPoint, sectionPlaneLabel, updateSectionClipPlaneWorld, updateSectionViewUi } from './section-view.js?v=20260927-build234';
import { analysisColorCss, buildSourceOrthogonalNeighborhood, cancelSourceMprWarmup, currentFilterSignature, drawAnalysisOverlay, filteredPlaneDims, filteredPlaneRunners, gpuVolumeShowsCurrentFilters, mprPaintCache, orthogonalHighResPrefetch, paintFastOrthogonalPreview, paintInstantPlaneWhileSliding, paintResidentCachedMprPreview, paintSourcePlane, perSliceFilteredActive, planeRenderTimers, prefetchOrthogonalHighRes, renderAll, renderPlane, renderPlaneMemoryFiltered, renderPlaneSourceBacked, reusableMprImage, safeRenderPlane, schedulePlaneRender, scheduleSourceMprWarmup, updateMprCanvasPhysicalAspect } from './mpr-render.js?v=20260927-build234';
import { setProcessingBusy } from './busy.js?v=20260927-build234';
import { decodeSourceSegmentMasks, ensureSegmentBaseRuns, getFilteredSourceAxialMaskBlock, getFinalSegmentRuns, processSourceRegionMasks, segmentBaseSignature, sourceAnalysisBlockDepth, sourceRunsForSegment, sourceSegmentMaskBlock, sourceSegmentRunBlockGpu, thresholdRunsFromMemory } from './segment-runs.js?v=20260927-build234';
import { buildEditableRunsGroup, buildSmoothIsoMesh, consolidateSegmentForStrongSmoothing, dispose, fullVolumeSmoothIsosurfaceFeasible, geometryFromSourcePositions, smoothIsosurfaceGeometry, taubinSmoothGeometry } from './surface-mesh.js?v=20260927-build234';
import { analysisRegionById, clearCutResultPreview, configureCutControlRanges, cutDirectionFromPoint, cutPlanDirection, cutRunsFromVoxelStroke, cutSurfaceFrameData, cutSurfaceStroke, cutWidthMm, rebuildCutResultPreview, refreshCutControlReadouts, scheduleCutResultPreview, setCutResultSourceHidden, setEditTargetHighlight, updateAnalysisEditorControls, updateCutPreview, updateThreeEditUi } from './edit-tools.js?v=20260927-build234';
import { addGpuResidentTileMesh, appendGpuMeshTile, applySectionClippingMaterials, ensureEditRaycastReady, ensureGpuResidentCpuPositions, getFilteredSourceAxialFaceBlock, getMemoryGpuMeshBlock, gpuCapacityError, gpuMeshBlockDepth, gpuMeshTileStart, gpuResidentReadbackPending, gpuResidentSurfaceDrawBudget, meshSegmentRanges, processMemoryMeshRegion, processSourceRegionFaces, refreshEditedSegmentSurface, render3D, render3DMemoryGpu, render3DSourceBacked, restoreEditedSegmentSurfaces, segmentUsesRunSurface, setBaseSegmentSurfaceVisibility, shouldUseGpuResidentSurface, syncSectionClipParent } from './surface-build.js?v=20260927-build234';
import { analysisRegionName, analysisRegionRepresentativeVoxel, disposeAnalysisRegionMesh, removeAnalysisRegion, renderAnalysisResults, resetAnalysisRegistryAfterRebuild, setAnalysisFocusedRegion } from './analysis-results.js?v=20260927-build234';
import { filteredSourceSliceProvider, gpuVolumeApplied, gpuVolumeCacheFor, gpuVolumeDataSignature, gpuVolumeEditDescriptors, gpuVolumePlanOptions, gpuVolumeTarget, refreshGpuVolumeData, syncGpuVolumeEdits, updateVolumeCacheControl, volumeCache, volumeCacheBudget, volumeCacheState } from './gpu-volume-data.js?v=20260927-build234';
import { CPU_FILTERS, applyCpuFilter, applyGpuFiltersToMemoryVolume, buildCpuFilteredVolumeFor3D, clearMemoryFilterPreviewCache, cloneVolumeWithData, cpuFilterKind, mark3DUpdating, progress, rebuildCurrent3D, surfaceRebuildPending } from './rebuild-3d.js?v=20260927-build234';
import { FILTER_CATALOG_ORDER, addFilter, applyVolumeAfterFilterRebuild, beginLiveFilter, currentMainViewKey, disposeSourceFilterWorkers, finishLiveFilter, hasGlobalSegmentProcessing, installFilterReorder, invalidateSourceFilters, liveFilterState, moveFilter, rebuildActiveFilters, removeFilter, renderFilterOrder, scheduleFilterRebuild, scheduleLiveFilter, syncFilterControls } from './filter-pipeline.js?v=20260927-build234';
import { APP_BUILD, APP_VERSION } from './version.js?v=20260927-build234';
import { addSegmentPreset, applyCtRangeMode, autoAround, clearAnalysisHighlight, clearSegmentEditCache, removeSegmentPreset, renderSegmentPresets, scheduleSegment3D, segmentControl, setControlChecked, setControlValue, setCtSliderRange, updateSegmentOutputs } from './segment-ui.js?v=20260927-build234';
import { DEMO_SIZE, DEMO_URL, FILTER_PARAM_INPUTS, activateMedicalVolume, applyPendingProject, applyProject, buildCtRangeProfile, busy, byteProgress, clear3DForSeriesChange, clearResidentMprJobs, configure, configureSegments, deliverProjectFile, detectedSeries, downloadBlob, enableProcessingControls, ensureVolumeTransformProxy, gatherProject, gpuVolumeProfileLabel, loadDemo, openSourceBackedVolume, pendingProject, prepareResidentGpuVolume, requestIPadSettingsTab, saveProject, scheduleGpuPrewarm, selectSeries, setSurfaceMeshesHiddenForVolume, setThreeVolumeOverlay, updateDemoCacheBadge, updateRenderModeControl, useWorkspaceUi } from './data-load.js?v=20260927-build234';
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

// GPU volume + filters (source-backed series only; that is what the GPU volume
// renderer supports). Filters apply to 2D immediately; the volume is updated
// only by an explicit "3D rebuild" (owner decision: the rewrite takes time).
// The texture is rewritten in place with filtered slices streamed from
// getFilteredSourceAxialBlock, so no full filtered copy is kept in memory.
// Data the volume should show: the filters applied by the last 3D rebuild of
// this series, if they are still the current settings; otherwise the original.
// Device-local cache of filtered GPU volume textures (stage 2 of the save
// plan, docs/gpu-volume-cache.js). Keyed by dataset fingerprint + filter
// signature + texture plan, so iPad 512/768 and Mac full size are separate.

function deactivateMedicalVolume(){
 const mv=sceneState?.medicalVolume;if(mv)mv.setActive(false);setThreeVolumeOverlay(false);setThreeRenderMode('surface');syncMpr3DOverlayPresentation();updateRenderModeControl();
 threeLabel.textContent=sceneState?.backend||'3D';request3DRender();
 if(threeDDirty)mark3DStale();else mark3DCurrent();
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
function bindLiveSlider(input,output,key,fn){
 input.addEventListener('pointerdown',()=>beginLiveFilter(key));
 input.addEventListener('input',()=>{
  output.value=(+input.value).toFixed(2);
  scheduleLiveFilter(key,fn);
 });
 input.addEventListener('change',()=>finishLiveFilter(key,fn));
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

void updateDemoCacheBadge();
async function inspect(files,auto){
 setActiveId(null);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('dicomChecking')+'</strong><span>'+tr('pixelDeferred')+'</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>'+tr('noSeries')+'</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}



function renderSeries(series){detectedSeries.list=series;list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.decodedBytes)+' · '+(s.sourceBacked?'フル解像度・ストリーミング':(s.compact?'Int16':'Float32'))+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

// Workspace UI (built for iPad) is also used on desktop Mac by owner request.
// Layout only: performance settings (texture plan, cache limits) stay keyed to
// isIPadRuntime(). URL override: ?ui=classic (old desktop UI) / ?ui=workspace.


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


/* Full-resolution source-backed filters: exact local processing in bounded tiles. */

function clearMpr3DPreviewCache(){
 mpr3DPreviewCache.token++;mpr3DPreviewCache.signature='';mpr3DPreviewCache.buildingSignature='';mpr3DPreviewCache.building=false;mpr3DPreviewCache.planes={axial:null,coronal:null,sagittal:null};mpr3DPreviewCache.dims={axial:null,coronal:null,sagittal:null};
}
function clearSourceSliceCache(){cancelSourceMprWarmup();sourceSliceCache.map.clear();sourceSliceCache.bytes=0;sourceOrthogonalPlaneCache.clear();sourceOrthogonalPlanePending.clear();setSourceOrthogonalPlaneCacheBytes(0);clearMpr3DPreviewCache()}
function paintMpr3DPreview(p,idx,canvas){
 if((p==='coronal'||p==='sagittal')&&paintMpr3DCacheSliceFast(p,idx,canvas))return true;
 return false;
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

// CPU filter stack (fallback when WebGPU compute is not used): read the
// slider parameters, run the kernel from cpu-filters.js, then show the result.
function resetProcessing(){
 clearTimeout(liveFilterState.timer);clearTimeout(filterRebuildTimer);incFilterRebuildRevision(false);setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();if(sourceVolume?.sourceBacked)invalidateSourceFilters();liveFilterState.base=null;liveFilterState.key=null;
 filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;syncFilterControls();
 if(!sourceVolume)return;setVolume(sourceVolume);renderAll();mark3DStale();footer.textContent=tr('processingReset');
}

function renderMainMprPreview(){
 if(!volume)return;
 const key=currentMainViewKey(),p=planes[key]?key:'axial';
 schedulePlaneRender(p);
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
function clearAllSegmentEdits(){
 for(const key of SEGMENT_PRESET_ORDER){const st=segmentEditState[key];if(st.surfaceGroup?.parent)st.surfaceGroup.parent.remove(st.surfaceGroup);st.surfaceGroup=null;clearSegmentEditCache(key,true)}
 setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);clearCutResultPreview();updateThreeEditUi();
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
function snapshotAnalysisRegionsForSegment(key){
 return analysisRegions.filter(r=>r.segmentKeys.length===1&&r.segmentKeys[0]===key).map(r=>({
  runsBySlice:r.runsBySlice,color:r.color,visible:r.visible,selected:r.selected,focused:r.id===analysisFocusedRegionId,merged:r.merged,groupId:r.groupId||null
 }));
}
function editSnapshot(key){const st=segmentEditState[key];return{keepRuns:st.keepRuns,excludeRuns:st.excludeRuns,cutRuns:st.cutRuns,rawCutSurface:!!st.rawCutSurface,analysisRefs:snapshotAnalysisRegionsForSegment(key)}}
function pushEditUndo(key){const st=segmentEditState[key];st.undo.push(editSnapshot(key));if(st.undo.length>20)st.undo.shift();st.redo=[]}
function restoreEditSnapshot(key,snap){const st=segmentEditState[key];st.keepRuns=snap?.keepRuns||null;st.excludeRuns=snap?.excludeRuns||null;st.cutRuns=snap?.cutRuns||null;st.rawCutSurface=!!snap?.rawCutSurface;st.finalRuns=null;st.revision++}
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
function cutPreviewDirection(point){return cutDirectionFromPoint(point,+analysisCutYaw.value||0,+analysisCutPitch.value||0)}
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

function segmentKeyFromIntersection(hit){
 const direct=hit?.object?.userData?.segmentKey;if(direct)return direct;
 const mi=hit?.face?.materialIndex,ranges=hit?.object?.userData?.segmentRanges;
 if(Array.isArray(ranges)&&Number.isInteger(mi)){const match=ranges.find(r=>r.materialIndex===mi);if(match)return match.key}
 return null;
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
// iPad/iPhone: the share sheet's "Save to Files" lets the user pick the DICOM
// folder directly (browsers cannot write into the opened folder; Safari has no
// File System Access API). Mac's share sheet has no folder target, so Macs and
// anything without file sharing download instead. navigator.share must run in
// the click's user activation, so nothing is awaited before it.
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

function resetVolume(){incSourceRenderRevision(false);setThreeDCancelRequested(false);setCurrent3DVolume(null);setAnalysisEditPreparing(false);setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();invalidateSourceFilters();clearSourceSliceCache();setActiveSeries(null);setSectionViewOpen(false);clearSectionView();updateSectionViewUi();if(threeRenderMode==='volume')setThreeVolumeOverlay(false);setThreeRenderMode('surface');sceneState?.medicalVolume?.resetData();clearAllSegmentEdits();clearAnalysisHighlight();smoothingType.value='gaussian';setFilterOrder([]);for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();setVolumeAnalysisMode(false);setVolumeAnalysisBusy(false);volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');sectionViewToggle.disabled=true;volumeAnalysisResult.classList.add('is-hidden');clearAnalysisHighlight();incFilterRebuildRevision(false);filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;setVolume(null);setSourceVolume(null);enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;setCtRangeProfile(null);setCtRangeMode('auto');ctRangeAuto.disabled=ctRangeFull.disabled=true;ctRangeAuto.classList.add('is-active');ctRangeFull.classList.remove('is-active');for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}set3DBusy(false);updateRenderModeControl(null);updateAnalysisEditorControls();updateThreeEditUi();request3DRender();set3DState('current');threeLabel.textContent=sceneState?.backend||'3D'}
void ensureLatestDeployedBuild();
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
