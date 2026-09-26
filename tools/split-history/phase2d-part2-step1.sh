# Exact extraction steps used for "phase 2d part 2, step 1" (run from repo root
# on the pre-PR docs/, build 215). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
L1=$($C getFilteredSourcePlaneValues getFilteredMemoryPlaneValues getFilteredSourceAxialBlock memoryFilterPreviewGet sourceFilterCacheGet --list | tail -n +3)
$X docs/app.js docs/source-filters.js $L1
L2=$($C buildSourceOrthogonalPlane readResidentGpuMprPlane sourceOrthogonalCacheGet --list | tail -n +3)
$X docs/app.js docs/mpr-orthogonal.js $L2
