# Exact extraction steps used for "phase 2d part 3, step 3" (run from repo root
# on the pre-PR docs/, build 232). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
L=$($C renderAnalysisResults removeAnalysisRegion disposeAnalysisRegionMesh setAnalysisFocusedRegion analysisRegionRepresentativeVoxel analysisRegionName resetAnalysisRegistryAfterRebuild --list | tail -n +3); $X docs/app.js docs/analysis-results.js $L
L=$($C refreshGpuVolumeData updateVolumeCacheControl syncGpuVolumeEdits gpuVolumeDataSignature gpuVolumeApplied --list | tail -n +3); $X docs/app.js docs/gpu-volume-data.js $L
L=$($C rebuildCurrent3D --list | tail -n +3); $X docs/app.js docs/rebuild-3d.js $L
L=$($C rebuildActiveFilters renderFilterOrder addFilter removeFilter moveFilter installFilterReorder syncFilterControls scheduleFilterRebuild beginLiveFilter scheduleLiveFilter finishLiveFilter --list | tail -n +3); $X docs/app.js docs/filter-pipeline.js $L
