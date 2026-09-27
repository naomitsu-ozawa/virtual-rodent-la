# Exact extraction steps used for "phase 2d part 3, step 5" (run from repo root
# on the pre-PR docs/, build 234). Kept as a record.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
$X --append docs/app.js docs/i18n.js applyLanguage
$X docs/app.js docs/workspace-ui.js initIPadWorkspaceUi initIPadGpuQualityControl
L=$($C analyzeVolumeAtPointer analyzeEditRegionAtPointer selectRegionsInLasso analyzeVolumeAtVoxel applyEditKeepSelected applyEditRemoveSelected undoSegmentEdit redoSegmentEdit resetFocusedSegmentEdit applyCutStroke mergeSelectedAnalysisRegions exportFocusedAnalysisRegionStl exportSegmentStl syncVolumeAnalysisOverlay scheduleAnalysisRunPrewarm clearAllSegmentEdits render3DSmoothIsosurface currentSegmentVolumeMm3 currentSegmentTriangleCount --list | tail -n +3); $X docs/app.js docs/analysis-ops.js $L
