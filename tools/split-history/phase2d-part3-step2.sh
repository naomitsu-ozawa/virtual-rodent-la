# Exact extraction steps used for "phase 2d part 3, step 2" (run from repo root
# on the pre-PR docs/, build 231). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
$X --append docs/app.js docs/mpr-render.js renderAll scheduleSourceMprWarmup
L=$($C set3DBusy set3DState mark3DCurrent mark3DStale updateVolumeFilterBadge --list | tail -n +3); $X --append docs/app.js docs/scene3d.js $L
L=$($C render3D --list | tail -n +3); $X docs/app.js docs/surface-build.js $L
