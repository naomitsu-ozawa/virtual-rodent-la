# Exact extraction steps used for "phase 2d part 3, step 4" (run from repo root
# on the pre-PR docs/, build 233). Kept as a record. The build markers move to
# docs/version.js first; tools/bump-build.mjs and the build-consistency test
# were changed to read them there in the same PR.
set -e
X="node tools/extract-module.mjs"
C="node tools/closure.mjs docs/app.js"
$X docs/app.js docs/version.js APP_VERSION APP_BUILD
L=$($C addSegmentPreset renderSegmentPresets removeSegmentPreset updateSegmentOutputs applyCtRangeMode setCtSliderRange setControlValue setControlChecked autoAround scheduleSegment3D clearSegmentEditCache clearAnalysisHighlight --list | tail -n +3); $X docs/app.js docs/segment-ui.js segmentControl $L
L=$($C applyProject saveProject deliverProjectFile loadDemo applyPendingProject --list | tail -n +3); $X docs/app.js docs/project-io.js $L
mv docs/project-io.js docs/data-load.js  # renamed: it also holds series selection, volume opening and demo loading
