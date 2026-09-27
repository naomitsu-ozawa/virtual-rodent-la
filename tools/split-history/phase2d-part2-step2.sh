# Exact extraction steps used for "phase 2d part 2, step 2" (run from repo root
# on the pre-PR docs/, build 216). Kept as a record.
set -e
X="node tools/extract-module.mjs"
$X --append docs/app.js docs/ui-shell.js mpr3DSliceSliders
$X docs/app.js docs/scene3d.js request3DRender
L=$(node tools/closure.mjs docs/app.js ensureMpr3DPreviewCache paintMpr3DCacheSliceFast --list | tail -n +3)
$X docs/app.js docs/mpr3d-overlay.js $L
