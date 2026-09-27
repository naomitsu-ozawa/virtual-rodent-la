# Exact extraction steps used for "phase 2d part 2, step 3" (run from repo root
# on the pre-PR docs/, build 221). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
L=$($C segmentState SEGMENT_PRESET_ORDER segmentEditState segmentEditActive segmentNeedsGlobalMask getProcessedSegmentMask segmentMaskVolumeId segmentMaskVolumeIds activeMprSegments --list | tail -n +3)
$X docs/app.js docs/segments.js $L
L=$($C updateSectionViewUi sectionPlaneLabel rebindWebGpuSectionClipGroup updateSectionClipPlaneWorld sectionLocalNormal sectionLocalPoint --list | tail -n +3)
$X docs/app.js docs/section-view.js $L
L=$($C renderPlane safeRenderPlane schedulePlaneRender paintSourcePlane --list | tail -n +3)
$X docs/app.js docs/mpr-render.js $L
