# Exact extraction steps used for "phase 2d part 3, step 1" (run from repo root
# on the pre-PR docs/, build 230). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
L=$($C setProcessingBusy --list | tail -n +3); $X docs/app.js docs/busy.js $L
L=$($C getFinalSegmentRuns ensureSegmentBaseRuns thresholdRunsFromMemory sourceRunsForSegment sourceSegmentMaskBlock decodeSourceSegmentMasks getFilteredSourceAxialMaskBlock processSourceRegionMasks sourceSegmentRunBlockGpu sourceAnalysisBlockDepth segmentBaseSignature --list | tail -n +3); $X docs/app.js docs/segment-runs.js $L
L=$($C smoothIsosurfaceGeometry buildSmoothIsoMesh taubinSmoothGeometry geometryFromSourcePositions buildEditableRunsGroup consolidateSegmentForStrongSmoothing fullVolumeSmoothIsosurfaceFeasible dispose --list | tail -n +3); $X docs/app.js docs/surface-mesh.js $L
L=$($C updateAnalysisEditorControls --list | tail -n +3); $X docs/app.js docs/edit-tools.js $L
