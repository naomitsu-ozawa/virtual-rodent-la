
import { mark3DCurrent, mark3DStale, set3DState } from './three-state.js?v=20260927-build265';
import { gpuVolumeRefresh, set3DBusy, updateVolumeFilterBadge } from './three-status.js?v=20260927-build265';
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { MedicalVolumeRenderer, extractSourceThresholdRuns } from './medical-volume.js?v=20260927-build265';
import { unzip } from 'https://esm.sh/fflate@0.8.2';
import { clampRangeValue, ctDigits, esc, fmt, formatCtValue, frameYield, hexRgb, isDesktopMac, isIPadRuntime, isIPhoneRuntime, multi, niceCtStep, num, numberOr, rangeNumber, rangePrecision, rangeStep, safePair, safeTriple, withTimeout } from './utils.js?v=20260927-build265';
import { COMPRESSED_DICOM_TRANSFER_SYNTAXES, NATIVE_DICOM_TRANSFER_SYNTAXES, canDecodeToInt16, dicomImageFrameInfo, encapsulatedFrameBytes, expandParsedFrames, groupSeries, isNativeDicomTransferSyntax, parseDicomHeader, parseFiles, parsedSliceMeta, sourceRangeFromMetadata } from './dicom.js?v=20260927-build265';
import { boxBlur3D, buildThresholdMask, compactFaceFlags, fillMaskHoles, morphMask, removeSmallMaskComponents, smoothMaskScalarField, thresholdSourceMask, valuesToFaceFlags, valuesToSegmentBits } from './mask-ops.js?v=20260927-build265';
import { RunUnionFind, analysisRunRows, analysisRunSliceState, analysisRunsContain, analysisRunsOverlap, analysisRunsVoxelCount, complementRunArrays, componentAtVoxel, componentTouchesVolumeBoundary, componentsFromRuns, componentsFromRunsAsync, consumeGpuAnalysisRuns, forEachUncoveredRun, intersectRunArrays, intersectRunSlice, maskFromAnalysisRuns, maskToAnalysisRuns, mergeIntervals, morphSourceRunArrays, postprocessSourceRuns, rowIntervalsFromRuns, rowsToRunSlice, runArraysBinary, runsSliceToMask, sourceComponentSliceState, sourceResultToAnalysisRuns, sourceRunSlice, sourceRunSliceFromRanges, subtractRunArrays, subtractRunSlice, unionAnalysisRuns, unionOverlappingRuns, unionRunArrays, unionRunSlice } from './run-length.js?v=20260927-build265';
import { Float32FaceBuilder, appendAnalysisRunBoundaryFaces, appendDecodedMaskSliceFaces, appendSourceFacesFromCompactTile, appendSourceSliceFaces, appendSourceSliceFacesFast, appendSourceSliceFacesFromBits, appendSourceSliceFacesFromFlags, eachGeometryTriangle, eachGeometryTriangleRange, geometryToBinaryStl, groupToBinaryStl, groupTriangleCount, indexedGeometryFromTrianglePositions, makeSource3DCoordinates, makeVolume3DCoordinates } from './mesh-geometry.js?v=20260927-build265';
import { I18N, applyLanguage, tr } from './i18n.js?v=20260927-build265';
import { GPU_PREWARM_KINDS, gpuFilterShader, normalizeVrlWgsl } from './gpu-shaders.js?v=20260927-build265';
import { activeId, activeSeries, analysisCutApplying, analysisCutScreen, analysisCutStroke, analysisEditPreparing, analysisEditTargetKey, analysisEditTargetMode, analysisEditTool, analysisFocusedRegionId, analysisPendingCut, analysisRegions, ctRangeMode, ctRangeProfile, current3DVolume, currentLanguage, cutBvhModulePromise, cutControlPreviewRaf, cutRaycastMaterial, cutResultPreviewRevision, cutResultPreviewTimer, deferAutomatic3D, dicomCodecModulePromise, filterOrder, filterRebuildRevision, filterRebuildTimer, gpuPrewarmIndex, gpuPrewarmScheduled, incCutResultPreviewRevision, incFilterRebuildRevision, incGpuPrewarmIndex, incNextAnalysisColorIndex, incNextAnalysisRegionId, incNextSegmentMaskVolumeId, incResidentMprEpoch, incSourceMprWarmupToken, incSourceRenderRevision, ipadGpuTargetSide, memoryGpuPreviewActive, mpr3DSurfaceOpacity, mpr3DVolumeOpacity, mpr3DWindowLutKey, mpr3DWindowLutTable, nextAnalysisColorIndex, nextAnalysisRegionId, nextSegmentMaskVolumeId, precisionRangeDrag, residentGpuUploadSeriesId, residentMprEpoch, residentMprReadbackDisabled, sceneState, sectionAutoPlane, sectionCapEnabled, sectionCapHatch, sectionCapOpacity, sectionSliceImageVisible, sectionViewOpen, sectionViewPlane, sectionViewReverse, segmentRenderTimer, setActiveId, setActiveSeries, setAnalysisCutApplying, setAnalysisCutScreen, setAnalysisCutStroke, setAnalysisEditPreparing, setAnalysisEditTargetKey, setAnalysisEditTargetMode, setAnalysisEditTool, setAnalysisFocusedRegionId, setAnalysisPendingCut, setAnalysisRegions, setCtRangeMode, setCtRangeProfile, setCurrent3DVolume, setCurrentLanguage, setCutBvhModulePromise, setCutControlPreviewRaf, setCutRaycastMaterial, setCutResultPreviewRevision, setCutResultPreviewTimer, setDeferAutomatic3D, setDicomCodecModulePromise, setFilterOrder, setFilterRebuildRevision, setFilterRebuildTimer, setGpuPrewarmIndex, setGpuPrewarmScheduled, setIpadGpuTargetSide, setMemoryGpuPreviewActive, setMpr3DSurfaceOpacity, setMpr3DVolumeOpacity, setMpr3DWindowLutKey, setMpr3DWindowLutTable, setNextAnalysisColorIndex, setNextAnalysisRegionId, setNextSegmentMaskVolumeId, setPrecisionRangeDrag, setResidentGpuUploadSeriesId, setResidentMprEpoch, setResidentMprReadbackDisabled, setSceneState, setSectionAutoPlane, setSectionCapEnabled, setSectionCapHatch, setSectionCapOpacity, setSectionSliceImageVisible, setSectionViewOpen, setSectionViewPlane, setSectionViewReverse, setSegmentRenderTimer, setSmoothingRefreshTimer, setSourceMprWarmupPlane, setSourceMprWarmupToken, setSourceOrthogonalPlaneCacheBytes, setSourceRenderRevision, setSourceVolume, setThreeDApplying, setThreeDCancelRequested, setThreeDDirty, setThreeRenderMode, setVolume, setVolumeAnalysisBusy, setVolumeAnalysisMode, smoothingRefreshTimer, sourceMprWarmupPlane, sourceMprWarmupToken, sourceOrthogonalPlaneCacheBytes, sourceRenderRevision, sourceVolume, threeDApplying, threeDCancelRequested, threeDDirty, threeRenderMode, volume, volumeAnalysisBusy, volumeAnalysisMode } from './state.js?v=20260927-build265';
import { $, analysisClearButton, analysisCutApply, analysisCutButton, analysisCutCancel, analysisCutConfirm, analysisCutDepth, analysisCutDepthValue, analysisCutOffset, analysisCutOffsetValue, analysisCutPitch, analysisCutPitchValue, analysisCutWidth, analysisCutWidthValue, analysisCutYaw, analysisCutYawValue, analysisEditRemoveSelected, analysisEditTargetSelect, analysisExportSelected, analysisKeepSelected, analysisLassoButton, analysisLineCutButton, analysisMergeButton, analysisNavigateButton, analysisRedo, analysisRegionList, analysisRemoveSelected, analysisResetEdit, analysisSelectRegionButton, analysisSummary, analysisUndo, anisotropicBtn, anisotropicIterations, anisotropicIterationsValue, anisotropicStrength, anisotropicStrengthValue, app, appVersionBadge, bar, bilateralBtn, bilateralIntensity, bilateralIntensityValue, bilateralPasses, bilateralPassesValue, bilateralSpatial, bilateralSpatialValue, bilateralStrength, bilateralStrengthValue, ctRangeAuto, ctRangeFull, demoBtn, filter3DState, filterAddButton, filterAddSelect, filterControlList, filterRebuild3D, folderBtn, folderInput, footer, gaussianBtn, gaussianStrength, gaussianStrengthValue, ipadGpuQuality, ipadGpuQualityControl, languageToggle, list, mainViewSlot, mpr3DSliceSliders, mprSurfaceOpacity, mprSurfaceOpacityValue, mprVolumeOpacity, mprVolumeOpacityValue, nlmBtn, nlmPatchRadius, nlmPatchRadiusValue, nlmSearchRadius, nlmSearchRadiusValue, nlmStrength, nlmStrengthValue, planes, processingOverlay, processingOverlayLabel, prog, progLabel, projectInput, projectOpenBtn, projectSaveBtn, renderModeToggle, resetFilterBtn, sectionCapEnabledControl, sectionCapHatchControl, sectionCapOpacityControl, sectionCapOpacityValue, sectionPosition, sectionPositionValue, sectionReverse, sectionSliceImageControl, sectionViewReadout, sectionViewResult, sectionViewToggle, segmentAddButton, segmentAddSelect, segmentControls, selected, sigmoidBtn, sigmoidCenter, sigmoidCenterValue, sigmoidStrength, sigmoidStrengthValue, smoothingType, spatialPasses, spatialPassesValue, spikeHoleBtn, spikeHoleStrength, spikeHoleStrengthValue, spikeHoleThreshold, spikeHoleThresholdValue, state, status, subViewSlots, surfaceSmoothEnabled, surfaceSmoothStrength, surfaceSmoothValue, threeBusy, threeBusyCancel, threeBusyLabel, threeEditHelp, threeEditOverlay, threeEditStatus, threeFilterBadge, threeLabel, tvBtn, tvIterations, tvIterationsValue, tvWeight, tvWeightValue, unsharpAmount, unsharpAmountValue, unsharpBtn, unsharpRadius, unsharpRadiusValue, unsharpThreshold, unsharpThresholdValue, viewport, volumeAnalysisResult, volumeAnalysisToggle, volumeCacheClearBtn, wc, wcVal, ww, wwVal } from './ui-shell.js?v=20260927-build265';
import { latestOnlyRunner } from './latest-runner.js?v=20260927-build265';
import { strongSurfaceSmoothingActive, surfaceSmoothingActive } from './settings.js?v=20260927-build265';
import { GPU_FILTER_KEYS, acquireGpuWorkBuffer, adoptRendererGpuDevice, clearGpuBufferPool, createGpuResidentFloat3Attribute, destroyGpuResidentAttribute, ensureGpuFilterDevice, finishGpuResidentTemps, gpuAdapterLabel, gpuBufferBucketSize, gpuComputeWorkgroupSize, gpuDeviceMode, gpuDeviceRequestDescriptor, gpuFilterPipeline, gpuFilterRuntime, gpuPoolLimit, gpuSmallBuffer, gpuStagesSupported, gpuValidationScope, installGpuErrorListener, releaseGpuWorkBuffer, requestVrlGpuAdapter, requestVrlGpuDevice, runGpuSourceFilters, setGpuComputeBackend, updateGpuStatus, verifyGpuComputeDevice, verifyGpuPipelineSet } from './gpu-compute.js?v=20260927-build265';
import { cachedSagittalDisplayPlane, cachedSourceMprPlane, decode, decodeCompressedDicomSlice, decodeSourceSlice, getDicomCodecModule, prepareSourceMprCache, readSourceColumn, readSourceRow, readSourceRows, sourceMprCacheLimit, sourceMprDecodeConcurrency, sourceSliceCache } from './volume-io.js?v=20260927-build265';
import { componentFullyInside, makeVoxelProjector, polygonBounds } from './lasso.js?v=20260927-build265';
import { PROJECT_EXTENSION, compareFingerprints, datasetFingerprint, decodeRuns, encodeRuns, isProjectArchiveName, packProject, projectFromEntries, unpackProject } from './project-file.js?v=20260927-build265';
import { cacheKey, openVolumeCache, textureCacheHandle } from './gpu-volume-cache.js?v=20260927-build265';
import { createSourceFilterSlot, ensureSourceFilterWorkers, filterState, fitSourceTile, getCachedSourceSlice, getFilteredMemoryPlaneValues, getFilteredSourceAxialBlock, getFilteredSourcePlaneValues, memoryFilterPreviewCache, memoryFilterPreviewGet, memoryFilterPreviewSet, memoryPreviewCacheLimit, planeRenderRevision, processMemoryRegion, processSourceRegion, pumpSourceFilterWorkers, readMemoryRegion, readSourceRegion, readSourceSubregion, runSourceFilterWorker, sourceFilterCacheGet, sourceFilterCacheLimit, sourceFilterCacheSet, sourceFilterHalo, sourceFilterRuntime, sourceFilterSignature, sourceFilterStages, sourceFilterWorkerMain, sourceSliceCacheLimit, sourceTileBudget, currentFilterSignature } from './source-filters.js?v=20260927-build265';
import { buildSourceOrthogonalPlane, readResidentGpuMprPlane, readSourceOrthogonalStrip, residentGpuMprAvailable, residentMprJobs, sourceOrthogonalCacheGet, sourceOrthogonalCacheLimit, sourceOrthogonalCacheSet, sourceOrthogonalPlaneCache, sourceOrthogonalPlanePending } from './mpr-orthogonal.js?v=20260927-build265';
import { request3DRender } from './scene3d.js?v=20260927-build265';
import { makeAxisWidget, create3DRenderer, makeViewOverlays, makeViewRotation, makeCutTools } from './scene-view.js?v=20260927-build265';
import { cpuAnisotropicDiffusion, cpuBilateral3D, cpuGaussian3D, cpuMedian3D, cpuNlm3D, cpuSigmoid, cpuSpikeHole, cpuTvDenoising3D, cpuUnsharpMask3D } from './cpu-filters.js?v=20260927-build265';
import { disposeMprPlaneGroup, ensureMpr3DPlanes, ensureMpr3DPreviewCache, makeMprPlaneLabel, mpr3DCacheImage, mpr3DOpacitySource, mpr3DOrthoSliding, mpr3DPreviewCache, mpr3DPreviewMap, mpr3DPreviewPlan, mpr3DPreviewSignature, mpr3DVisibility, mpr3DWindowLut, paintMpr3DCacheSliceFast, pushCachedMpr3DPlane, refreshMpr3DPlaneTexture, restoreSectionAutoPlane, setMpr3DOverlayVisible, showSectionPlaneOverlay, syncMpr3DOverlayPresentation, syncMpr3DSliceSliders, updateMpr3DPlanePositions } from './mpr3d-overlay.js?v=20260927-build265';
import { SEGMENT_PRESET_ORDER, activeMprSegments, getProcessedSegmentMask, segmentEditActive, segmentEditState, segmentMaskVolumeId, segmentMaskVolumeIds, segmentNeedsGlobalMask, segmentState, sourceMprMemoryView } from './segments.js?v=20260927-build265';
import { rebindWebGpuSectionClipGroup, sectionLocalNormal, sectionLocalPlane, sectionLocalPoint, sectionLocalStep, sectionPlaneLabel, updateSectionClipPlaneWorld, updateSectionViewUi } from './section-view.js?v=20260927-build265';
import { analysisColorCss, buildSourceOrthogonalNeighborhood, cancelSourceMprWarmup, drawAnalysisOverlay, filteredPlaneDims, filteredPlaneRunners, gpuVolumeShowsCurrentFilters, mprPaintCache, orthogonalHighResPrefetch, paintFastOrthogonalPreview, paintInstantPlaneWhileSliding, paintResidentCachedMprPreview, paintSourcePlane, perSliceFilteredActive, planeRenderTimers, prefetchOrthogonalHighRes, renderAll, renderPlane, renderPlaneMemoryFiltered, renderPlaneSourceBacked, renderSectionPlaneLive, reusableMprImage, safeRenderPlane, schedulePlaneRender, scheduleSourceMprWarmup, updateMprCanvasPhysicalAspect } from './mpr-render.js?v=20260927-build265';
import { setProcessingBusy } from './busy.js?v=20260927-build265';
import { decodeSourceSegmentMasks, ensureSegmentBaseRuns, getFilteredSourceAxialMaskBlock, getFinalSegmentRuns, processSourceRegionMasks, segmentBaseSignature, sourceAnalysisBlockDepth, sourceRunsForSegment, sourceSegmentMaskBlock, sourceSegmentRunBlockGpu, thresholdRunsFromMemory, setSegmentStatus } from './segment-runs.js?v=20260927-build265';
import { buildEditableRunsGroup, buildSmoothIsoMesh, consolidateSegmentForStrongSmoothing, dispose, fullVolumeSmoothIsosurfaceFeasible, geometryFromSourcePositions, smoothIsosurfaceGeometry, taubinSmoothGeometry } from './surface-mesh.js?v=20260927-build265';
import { analysisRegionById, clearCutResultPreview, configureCutControlRanges, cutDirectionFromPoint, cutPlanDirection, cutRunsFromVoxelStroke, cutSurfaceFrameData, cutSurfaceStroke, cutWidthMm, rebuildCutResultPreview, refreshCutControlReadouts, scheduleCutResultPreview, setCutResultSourceHidden, setEditTargetHighlight, updateAnalysisEditorControls, updateCutPreview, updateThreeEditUi } from './edit-tools.js?v=20260927-build265';
import { addGpuResidentTileMesh, appendGpuMeshTile, applySectionClippingMaterials, ensureEditRaycastReady, ensureGpuResidentCpuPositions, getFilteredSourceAxialFaceBlock, getMemoryGpuMeshBlock, gpuCapacityError, gpuMeshBlockDepth, gpuMeshTileStart, gpuResidentReadbackPending, gpuResidentSurfaceDrawBudget, meshSegmentRanges, processMemoryMeshRegion, processSourceRegionFaces, refreshEditedSegmentSurface, render3D, render3DMemoryGpu, render3DSourceBacked, restoreEditedSegmentSurfaces, segmentUsesRunSurface, setBaseSegmentSurfaceVisibility, shouldUseGpuResidentSurface, syncSectionClipParent } from './surface-build.js?v=20260927-build265';
import { analysisRegionName, analysisRegionRepresentativeVoxel, disposeAnalysisRegionMesh, removeAnalysisRegion, renderAnalysisResults, resetAnalysisRegistryAfterRebuild, setAnalysisFocusedRegion } from './analysis-results.js?v=20260927-build265';
import { filteredSourceSliceProvider, gpuVolumeApplied, gpuVolumeCacheFor, gpuVolumeDataSignature, gpuVolumeEditDescriptors, gpuVolumePlanOptions, gpuVolumeTarget, refreshGpuVolumeData, syncGpuVolumeEdits, updateVolumeCacheControl, volumeCache, volumeCacheBudget, volumeCacheState } from './gpu-volume-data.js?v=20260927-build265';
import { CPU_FILTERS, applyCpuFilter, applyGpuFiltersToMemoryVolume, buildCpuFilteredVolumeFor3D, clearMemoryFilterPreviewCache, cloneVolumeWithData, cpuFilterKind, mark3DUpdating, progress, rebuildCurrent3D, surfaceRebuildPending } from './rebuild-3d.js?v=20260927-build265';
import { FILTER_CATALOG_ORDER, addFilter, applyVolumeAfterFilterRebuild, beginLiveFilter, currentMainViewKey, disposeSourceFilterWorkers, finishLiveFilter, hasGlobalSegmentProcessing, installFilterReorder, invalidateSourceFilters, liveFilterState, moveFilter, rebuildActiveFilters, removeFilter, renderFilterOrder, scheduleFilterRebuild, scheduleLiveFilter, syncFilterControls } from './filter-pipeline.js?v=20260927-build265';
import { APP_BUILD, APP_VERSION } from './version.js?v=20260927-build265';
import { addSegmentPreset, applyCtRangeMode, autoAround, clearAnalysisHighlight, clearSegmentEditCache, removeSegmentPreset, renderSegmentPresets, scheduleSegment3D, segmentControl, setControlChecked, setControlValue, setCtSliderRange, updateSegmentOutputs, THIN_SLIDERS, formatMmVoxels, thinSliderValue } from './segment-ui.js?v=20260927-build265';
import { syncProcessedSegmentsToVolume, DEMO_SIZE, DEMO_URL, FILTER_PARAM_INPUTS, activateMedicalVolume, applyPendingProject, applyProject, buildCtRangeProfile, busy, byteProgress, clear3DForSeriesChange, clearResidentMprJobs, configure, configureSegments, deliverProjectFile, detectedSeries, downloadBlob, enableProcessingControls, ensureVolumeTransformProxy, gatherProject, gpuVolumeProfileLabel, loadDemo, openSourceBackedVolume, pendingProject, prepareResidentGpuVolume, requestIPadSettingsTab, saveProject, scheduleGpuPrewarm, selectSeries, setSurfaceMeshesHiddenForVolume, setThreeVolumeOverlay, updateDemoCacheBadge, updateRenderModeControl, useWorkspaceUi } from './data-load.js?v=20260927-build265';
import { initIPadGpuQualityControl, initIPadWorkspaceUi } from './workspace-ui.js?v=20260927-build265';
import { ANALYSIS_REGION_COLORS, addAnalysisRegion, analysisRegionAtVoxel, analyzeEditRegionAtPointer, analyzeVolumeAtPointer, analyzeVolumeAtVoxel, analyzeVolumeComponentAtVoxel, applyCutStroke, applyEditKeepSelected, applyEditRemoveSelected, attachAnalysisRegion, buildAnalysisRunsGroup, clearAllSegmentEdits, clearThreeEditOverlay, connectedComponentVolume, connectedComponentVolumeGpuRuns, connectedComponentVolumeSource, createAnalysisMaterial, currentSegmentDisplayScale, currentSegmentMeshes, currentSegmentToBinaryStl, currentSegmentTriangleCount, currentSegmentVolumeMm3, cutPointerVoxel, cutRaycastSourceMeshes, editSnapshot, ensureAnalysisRoot, exportFocusedAnalysisRegionStl, exportSegmentStl, mergeSelectedAnalysisRegions, nextAnalysisColor, pushEditUndo, rebuildEditedAnalysisForSegment, redoSegmentEdit, render3DSmoothIsosurface, resetFocusedSegmentEdit, restoreEditSnapshot, returnToNavigate, scheduleAnalysisRunPrewarm, segmentKeyAtVoxel, segmentKeyFromIntersection, selectRegionsInLasso, snapshotAnalysisRegionsForSegment, surfacePointerVoxel, surfaceSegmentPointerVoxel, syncVolumeAnalysisOverlay, undoSegmentEdit, volumeAnalysisOverlayActive } from './analysis-ops.js?v=20260927-build265';
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
// diagnostic while an opacity slider moves: 2D repaint time and the last 3D volume frame time
function reportDrawTimes(ms2d=null){const f=sceneState?.medicalVolume?.lastFrameMs,ja=currentLanguage==='ja';footer.textContent=(ms2d==null?'':(ja?'2D描画 ':'2D paint ')+Math.round(ms2d)+' ms · ')+(ja?'3D描画 ':'3D frame ')+(f==null?'—':Math.round(f)+' ms')}
if(mprSurfaceOpacity)mprSurfaceOpacity.oninput=()=>{setMpr3DSurfaceOpacity(Math.max(0,Math.min(1,+mprSurfaceOpacity.value/100)));updateMpr3DOpacityControls();syncMpr3DOverlayPresentation();reportDrawTimes()};
if(mprVolumeOpacity)mprVolumeOpacity.oninput=()=>{setMpr3DVolumeOpacity(Math.max(0,Math.min(1,+mprVolumeOpacity.value/100)));updateMpr3DOpacityControls();syncMpr3DOverlayPresentation();reportDrawTimes()};
updateMpr3DOpacityControls();
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
segmentAddButton.onclick=()=>{addSegmentPreset(segmentAddSelect.value);syncProcessedSegmentsToVolume()};
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
// segment cards collapse to their header row (name, visibility, colour); remembered per device
for(const btn of document.querySelectorAll('[data-seg-collapse]')){
 const key=btn.dataset.segCollapse,card=btn.closest('.segment-card'),storeKey='vrl.segCollapsed.'+key;
 const apply=collapsed=>{card?.classList.toggle('is-collapsed',collapsed);btn.setAttribute('aria-expanded',String(!collapsed))};
 try{apply(localStorage.getItem(storeKey)==='1')}catch{}
 btn.onclick=()=>{const collapsed=!card?.classList.contains('is-collapsed');apply(collapsed);try{localStorage.setItem(storeKey,collapsed?'1':'0')}catch{}};
}
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderMainMprPreview();scheduleSegment3D()};
 color.onchange=()=>renderAll();
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;segmentState[key]._maskCache=null;clearSegmentEditCache(key,false);updateSegmentOutputs(key);renderMainMprPreview();scheduleSegment3D()};
 min.onchange=max.onchange=()=>{if(ctRangeMode==='auto')applyCtRangeMode('auto');renderAll()};
 // opacity is a render setting: in the GPU volume view only redraw 3D while the
 // slider moves (the 2D planes, hidden there, were repainted on every tick);
 // the 2D view repaints on release (onchange)
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);
  if(threeRenderMode==='volume'&&sceneState?.medicalVolume?.active){request3DRender();reportDrawTimes();return}
  const t2=performance.now();renderMainMprPreview();reportDrawTimes(performance.now()-t2);scheduleSegment3D()};
 opacity.onchange=()=>renderAll();
 const invalidateSegment=(full=false)=>{segmentState[key]._maskCache=null;segmentState[key]._maskCacheKey='';clearSegmentEditCache(key,false);clearAnalysisHighlight();if(full)renderAll();else renderMainMprPreview();scheduleSegment3D();if(full&&threeRenderMode==='volume')syncGpuVolumeEdits(sourceVolume||volume);if(full&&(volume?.sourceBacked||threeRenderMode==='volume')&&segmentNeedsGlobalMask(segmentState[key]))void prepareSourceSegmentPostprocess(key)};
 opening.oninput=()=>{segmentState[key].opening=+opening.value;$('[data-seg-opening-out="'+key+'"]').value=opening.value;invalidateSegment(false)};
 opening.onchange=()=>invalidateSegment(true);
 closing.oninput=()=>{segmentState[key].closing=+closing.value;$('[data-seg-closing-out="'+key+'"]').value=closing.value;invalidateSegment(false)};
 closing.onchange=()=>invalidateSegment(true);
 minComponent.oninput=()=>{segmentState[key].minComponent=+minComponent.value;$('[data-seg-min-component-out="'+key+'"]').value=minComponent.value;invalidateSegment(false)};
 minComponent.onchange=()=>invalidateSegment(true);
 holeFill.onchange=()=>{segmentState[key].holeFill=holeFill.checked;invalidateSegment(true)};
 // thin-region sliders: whole-volume distance fields, so recompute on release only
 for(const [attr,field] of THIN_SLIDERS){
  const el=$('[data-seg-'+attr+'="'+key+'"]'),out=$('[data-seg-'+attr+'-out="'+key+'"]');if(!el)continue;
  el.oninput=()=>{out.value=formatMmVoxels(thinSliderValue(el))};
  el.onchange=()=>{const mm=thinSliderValue(el);if(mm===segmentState[key][field])return;segmentState[key][field]=mm;out.value=formatMmVoxels(mm);if(!segmentNeedsGlobalMask(segmentState[key]))setSegmentStatus(key,'');invalidateSegment(true)};
 }
 exportBtn.onclick=()=>void exportSegmentStl(key);
 removeBtn.onclick=()=>removeSegmentPreset(key);
}
async function prepareSourceSegmentPostprocess(key){
 const v=current3DVolume||volume;if(!(v?.sourceBacked||threeRenderMode==='volume')||!segmentState[key]?.active||!segmentState[key]?.enabled||!segmentNeedsGlobalMask(segmentState[key]))return;
 try{
  await ensureSegmentBaseRuns(key,v);
  // the GPU volume may be active even while the 2D view is shown; always resync
  if(sceneState?.medicalVolume?.active||threeRenderMode==='volume')syncGpuVolumeEdits(sourceVolume||volume);
  // no mesh while working in the volume view (meshes are built only for STL
  // export); a run surface built here stayed on screen as streaks (build 248-253)
  if(sceneState?.obj&&threeRenderMode!=='volume')await refreshEditedSegmentSurface(key,v);
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


function residentGpuVolumeBytes(v){return (v?.columns||0)*(v?.rows||0)*(v?.slices||0)*2}
function shouldAutoPrepareResidentGpu(v){
 const mv=sceneState?.medicalVolume;if(!mv||!v?.sourceBacked)return false;
 const support=mv.support(v,gpuVolumePlanOptions());return !!support.ok;
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
 const {axisWidget,updateAxisWidget}=makeAxisWidget(camera);

 let {renderer,backend}=await create3DRenderer();
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
 const {pivotIndicator,makeViewButton,showViewPivot,hideViewPivot}=makeViewOverlays(renderer);
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
 const {viewCenterPivot,rotateAroundViewCenter,applyQuaternionAroundViewCenter,rollAroundViewCenter}=makeViewRotation(camera);
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
 const {cutSamplesToSurfaceStroke,sectionDragHit,sectionScreenStep,dragSectionPlane,drawEditStroke,appendCutScreenPoints,resampleCutScreenCurve,collectCutSurfaceSamples}=makeCutTools(renderer,camera);
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
// Owner rule: after a 3D edit operation completes, return to "Navigate"
// (operations that failed or found nothing keep the tool for a retry).
// Lasso tool: select every connected piece of the target segment(s) whose
// voxels all project inside the drawn loop (owner choice: pieces crossing the
// loop, e.g. the main structure, are never selected). Pieces of one segment
// are merged into a single analysis region so "Delete selected region"
// removes them together, and hundreds of noise specks do not create hundreds
// of regions.

// When volume analysis mode is turned on (usually in GPU volume view), compute
// each shown segment's filtered runs in the background so the first analysis
// click does not have to re-filter the whole volume. Quiet (no busy UI), one
// segment at a time; stops when analysis mode is turned off, the volume
// changes, or the filters change (`__SUPERSEDED__`). Only source-backed
// volumes with filters need it; a click during it joins the same computation.
function cutPreviewDirection(point){return cutDirectionFromPoint(point,+analysisCutYaw.value||0,+analysisCutPitch.value||0)}
// Called every rendered frame (cheap when nothing changed). In GPU volume view,
// upload the visible regions' runs so the volume shader colours them, and hide
// any region meshes left from the surface view. In the surface view, build the
// display mesh lazily for regions analysed in volume view.
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

function resetVolume(){incSourceRenderRevision(false);setThreeDCancelRequested(false);setCurrent3DVolume(null);setAnalysisEditPreparing(false);setAnalysisEditTool('select');setAnalysisEditTargetKey(null);setAnalysisEditTargetMode('auto');setAnalysisCutStroke(null);setAnalysisCutScreen([]);setAnalysisPendingCut(null);if(analysisEditTargetSelect)analysisEditTargetSelect.value='auto';setMemoryGpuPreviewActive(false);clearMemoryFilterPreviewCache();invalidateSourceFilters();clearSourceSliceCache();setActiveSeries(null);setSectionViewOpen(false);clearSectionView();updateSectionViewUi();if(threeRenderMode==='volume')setThreeVolumeOverlay(false);setThreeRenderMode('surface');sceneState?.medicalVolume?.resetData();clearAllSegmentEdits();clearAnalysisHighlight();smoothingType.value='gaussian';setFilterOrder([]);for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();setVolumeAnalysisMode(false);setVolumeAnalysisBusy(false);volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');sectionViewToggle.disabled=true;volumeAnalysisResult.classList.add('is-hidden');clearAnalysisHighlight();incFilterRebuildRevision(false);filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;setVolume(null);setSourceVolume(null);enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;setCtRangeProfile(null);setCtRangeMode('auto');ctRangeAuto.disabled=ctRangeFull.disabled=true;ctRangeAuto.classList.add('is-active');ctRangeFull.classList.remove('is-active');for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill','surface-mm','thickness-mm']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.obj.parent?.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}set3DBusy(false);updateRenderModeControl(null);updateAnalysisEditorControls();updateThreeEditUi();request3DRender();set3DState('current');threeLabel.textContent=sceneState?.backend||'3D'}
void ensureLatestDeployedBuild();
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
