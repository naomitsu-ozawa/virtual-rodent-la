# Agent Log

This file is a running record of work done on this repository by AI coding
agents (Claude or others). It exists so that any agent picking up work later
has enough context to continue without re-deriving decisions from scratch.

## How to use this file

- **Before starting work**: read `docs/IMPLEMENTATION_PLAN.md` for the
  feature roadmap, then read the most recent entries here for context on
  what was just done and why.
- **One branch per task.** Name branches descriptively
  (`chore/...`, `refactor/...`, `feat/...`, `test/...`).
- **When finishing a session or task**, append a new entry below (newest on
  top) using the template. Do not edit or delete prior entries — this is an
  append-only log.
- Commit messages should explain *why*, not just *what*; this file is for
  the fuller context that doesn't fit in a commit message (alternatives
  considered, open questions, follow-up work).

## Entry template

```
## YYYY-MM-DD — <branch-name>

**Agent:** <name/model>
**Task:** <one-line summary>

### What changed
- ...

### Why
- ...

### Follow-up / open questions
- ...
```

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-part removal on the GPU, build 268)

**Agent:** Claude
**Task:** Owner's order after PR #51: (1) boot check in CI, then (3) move thin-part removal (B)
to the GPU.

### What changed
- (1) was dropped: the CI runs of builds 255/256 were cancelled, not green, and the smoke test
  already fails on page errors. Corrected in this log and in the plan.
- `gpuOpenRuns` (gpu-compute.js): an opening by a ball on a 0/1 mask of the segment runs, block-wise.
  It uses the `airDist` shader in two new modes: 1 = erosion distance, 2 = distance to the eroded core.
  The kept voxels are read with the analysis RLE. It runs after A and before Opening etc.
  (`postprocessWithGpuOpen` in segment-runs.js), with a CPU fallback.
- JS mirror test: the shader steps equal the CPU ball-stamping kernel (`tests/unit/air-dist.test.js`).

### Open questions / follow-up
- Not checked on the device.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (speed, collapsible cards, builds 259-267)

**Agent:** Claude
**Task:** Make the air-boundary exclusion and the 3D view usable on the owner's iPad data
(1024×1024×1784).

### What changed
- 259: 2D overlay uses a per-plane mask of the processed runs (`runsPlaneMask`) instead of a
  per-pixel scan of the slice's runs.
- 260-262: diagnostics (step timings, 2D/3D draw times, GPU failure reason) and
  `tools/boot-check.mjs` (`npm run boot-check`: offline Chromium startup check that fails on any
  page error). Run it before every push.
- 261: 3D segment opacity slider only redraws the volume while it moves (the owner meant the
  3D opacity; I first treated it as a 2D problem).
- 263: the actual reason the GPU air layers fell back to the CPU. Blocks with the 8-voxel halo
  need more than 65535 workgroups in one dimension. The filter/RLE passes now dispatch 2D grids,
  and `gid.x` is rewritten to the flattened index in `gpuFilterPipeline`.
- 264: one class-RLE pass (`classRunCount/Write`) for all distance layers; larger blocks
  with air layers; the kept count sums the disjoint layers. Device: first run 227 s → 78 s,
  slider change 11 s → 0.3 s.
- 265-266: segment cards collapse to the header row, collapsed by default (remembered per device).
- 267: diagnostics only with `?debug`. The normal status reads "処理完了 · Ns · 残り X% · 3D反映済み".

### Open questions / follow-up
- 3D volume frame about 56 ms on the iPad (the raycast itself); not addressed.
- Correction: the CI runs of the non-starting builds 255/256 were cancelled (superseded by
  the next push), not green. The smoke test fails on any page error, so it does catch a
  non-starting app. boot-check is the local, offline equivalent to run before pushing.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (startup fix, speed, builds 257-258)

**Agent:** Claude
**Task:** Build 255/256 did not start: app.js imported an export removed in 255. Then the
owner reported that both the air-boundary processing and the 3D view after it are heavy.

### What changed
- Build 257: removed the stale import. New `tests/static/named-imports.test.js` checks that every
  named import between docs/ modules resolves (it fails on build 256). The iPad kept serving
  the broken index.html from cache; `?b=257` loaded the new one.
- Build 258, 3D: `editAllows` binary-searches the sorted row intervals instead of
  scanning them (processed fat rows have many intervals).
- Build 258, processing: `airDist` compute shader, three separable passes giving the exact
  squared distance to air within 8 voxels (about 40 reads per voxel instead of a 2601-voxel
  ball). The analysis RLE returns the segment split into 8 distance layers plus
  "farther" (`airLayersMemo`). A slider change only unions layers, with no GPU pass. JS
  mirror test: `tests/unit/air-dist.test.js`.

### Open questions / follow-up
- Not checked on the device. (Wrongly noted at the time: the CI runs of builds 255/256 were
  cancelled, not green; the smoke test does catch startup failures.)

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (no mesh in volume view; revert 250/253, builds 254-256)

**Agent:** Claude
**Task:** The 3D "streaks" were a run-surface mesh built in the background in the volume
view (`prepareSourceSegmentPostprocess` → `refreshEditedSegmentSurface`), and it stayed after
the segment was removed. Builds 250 (keep-mask footprint mapping) and 253 (exclude mask of
removed voxels, GPU failure reason) were aimed at the wrong cause. The owner asked for them to be removed.

### What changed
- Build 254: no run surface in volume mode; a removed segment's surface group is disposed.
- Build 255: the analysis overlay no longer falls back to meshes in volume mode (it reports the error).
  The no-mesh rule and the device-check rule were added to the architecture rules.
- Build 256: reverted builds 250 and 253, including build 252's tweak of the footprint mapping.
  Build 252's run sorting, resync and "3D反映済み" status stay.

### Lesson
- Follow the owner's rules (no meshes in the volume view). Trace every path before asking
  for a device check (large data; a reload resets everything).

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (3D keep mask, GPU air exclusion, builds 250-251)

**Agent:** Claude
**Task:** The owner's 3D screenshot showed the kept fat as streaks. The run was still too slow for device checks.

### What changed
- Build 250: `gpuRunsForTextureFootprint`, used for keep masks on reduced textures. A texel is kept
  if any source voxel in its footprint is kept (tests in `tests/unit/keep-footprint.test.js`).
- Build 251: new `airExclude` compute shader. It runs on the filtered block before the
  analysis RLE and gives segment voxels with air (< segment min) within the ball a value
  below min, so the RLE drops them. There is no body mask and no CPU pass for A. The block halo
  grows by the ball's z radius, and the raw-DICOM RLE path is skipped when A is on. Results are memoized
  per segment (`airRunsMemo`). If any block fails on the GPU, the CPU route (build 249) is used.
- The status reads "処理完了 · Ns · GPU · …" on the GPU route.

### Open questions / follow-up
- Not checked on the device. B (thickness) is still CPU.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region speed, build 249)

**Agent:** Claude
**Task:** Build 248 works (inside body 100%, 61% of the fat kept) but takes 216 s, too slow for device checks.
The owner also reports that the 3D view still shows parts of the rim and renders wrongly
(screenshot pending).

### What changed
- `runGpuSourceFilters` analysis-RLE mode returns one run set per segment from
  one filtered block (`itemsList`). The filters run once.
- `thresholdSourceRuns` takes extra threshold ranges. The body mask is read from the same
  blocks as the segment instead of a second full filtered pass (about 100 s saved).
  It is seeded into the body memo and stored in the run cache.

### Open questions / follow-up
- The thin-region CPU step (about 50 s on the iPad) is still on the CPU.
- 3D keep-mask rendering on the reduced texture: waiting for the screenshot.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region: air threshold, builds 246-248)

**Agent:** Claude
**Task:** Build 245 still removed all fat or left the rim. Stopped guessing and added
diagnostics to the segment status.

### What changed
- Builds 246-247: the done status shows kept voxels, the body share, the share of the segment
  inside the body mask, spacing and dimensions.
- Device result: body mask 10.5%, fat inside it 0.0%. The fat range of this
  dataset lies below the fixed -500 HU "body" threshold.
- Build 248: air = values below the segment's lower bound (`sourceBodyRuns(v, …, seg.min)`,
  `suppressThinMask` uses `opts.min`). Test added.
- Lesson: after the first device failure, gather diagnostics before trying the next fix.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region fixes, build 245)

**Agent:** Claude
**Task:** Owner, on the iPad with build 244: the status stayed on "1/3" for all three phases,
processing took 257 s, and the whole fat segment disappeared.

### What changed
- `report` in `ensureSegmentBaseRuns` dropped the phase argument; now forwarded.
- Body mask bound was `max: v.max`; a missing or estimated max of a source series
  (NaN) would make every voxel air and remove the whole segment. This is the
  suspected cause, not proven. The bound is now fixed at 1e30, and an empty body mask skips A with a warning.
- Thresholded runs before post-processing are kept per segment
  (`rawRunsMemo`), so changing only a post-processing setting skips the GPU
  threshold pass.
- The "done" status shows the percentage of voxels kept, so a wrong result is visible.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region status and all-air rim, build 244)

**Agent:** Claude
**Task:** Owner, on the iPad with build 243: could not tell whether processing was running
at all, and the 1-pixel rim was still there (in 2D also around gut gas). Asked for real
progress reporting.

### What changed
- Per-segment status line in each segment card, fed by `ensureSegmentBaseRuns`
  with phase-tagged progress (threshold / air mask / thin-region removal).
- A now uses all air (skin, gut gas, lungs, holder), not only exterior air.

### Open questions / follow-up
- Still need the owner's timing on device. If it is minutes, move the kernels
  to WebGPU.

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region suppression fix, build 243)

**Agent:** Claude
**Task:** On the iPad with the owner's large data, build 242 did not remove the
surface shell, and the browser crashed.

### What changed
- Measured in node on 1024² slices: memory was fine (about 100 MB extra), but the
  EDT kernels took 170-560 ms per slice (about 5-17 min for 1784 slices). Each
  slider release started a new pass, and earlier passes kept running.
- Kernels now stamp balls around boundary voxels. The result is exactly the same as
  the EDT (tested against it) and it is about 4× faster. The exterior flood uses a typed stack.
- Base-run computations stop at block boundaries once the segment signature
  changes (`alive` passed through `sourceRunsForSegment` and `postprocessSourceRuns`).
- Thickness slider max 16 → 8 voxels.

### Open questions / follow-up
- Still CPU: roughly minutes on the iPad for the full volume. If that is too slow,
  move A to the GPU (per-slice work suits compute shaders).

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (thin-region suppression, build 242)

**Agent:** Claude
**Task:** Owner asked for a way to ignore the thin membrane that the fat
segment picks up over the body surface. Discussed and agreed: both A (exclude
within N mm of the body surface) and B (remove parts N mm thick or thinner),
selectable together, UI in mm.

### What changed
- New `docs/thin-suppress.js` (pure): exact EDT with spacing, per-slice exterior
  air, box and block-wise stack kernels. Tests in `tests/unit/thin-suppress.test.js`.
- Wired into `getProcessedSegmentMask` (in-memory) and `postprocessSourceRuns`
  (source-backed, with body runs from `sourceBodyRuns`). Added to signatures,
  the run-cache key, projects and the UI (2 sliders per segment card).
- GPU volume view now shows post-processed segments as keep masks. This also
  makes the existing Opening etc. visible in volume mode.

### Open questions / follow-up
- Not checked on a device (CI has no GPU). Check on the iPad with the owner's
  1024×1024×1784 data: speed of the extra body pass and the EDT, and whether
  the volume-view keep mask looks right on the reduced texture.
- If CPU time is too slow, move the EDT to WebGPU (the plan's original idea).

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (hide slide diagnostic, build 241)

**Agent:** Claude (Claude Code)
**Task:** Hide the "2D <plane> while sliding: …" footer diagnostic added in
builds 224–227.

### What changed
- `mpr-render.js` `reportSlidePath` writes the footer only when the page is
  opened with `?debug` (`SLIDE_PATH_DEBUG`). Kept rather than removed so the
  2D image source can still be checked on a device.
- Build 240 → 241.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (break up start3D, build 240)

**Agent:** Claude (Claude Code)
**Task:** Break up `start3D` (291 lines).

### Approach
- `start3D`'s pointer handlers, wheel/pinch camera control, fast-interaction
  quality and the render loop share mutable locals (`distance`, `pointers`,
  `fastInteractionActive`, `wheelQualityTimer`, …); they stay in start3D.
- Statement ranges that use none of those locals were wrapped in factories
  in the new `docs/scene-view.js`, **verbatim**; each factory takes the
  start3D locals the statements used (`camera`, `renderer`) as parameters
  of the same name and returns what start3D uses afterwards:
  - `makeAxisWidget(camera)` → `{axisWidget, updateAxisWidget}`
  - `create3DRenderer()` → `{renderer, backend}` (WebGPU, WebGL fallback)
  - `makeViewOverlays(renderer)` → pivot indicator, `makeViewButton`,
    show/hide pivot (plus the help button/panel)
  - `makeViewRotation(camera)` → view-centre pivot rotations
  - `makeCutTools(renderer, camera)` → cut stroke screen handling, surface
    projection and sample collection, section-plane dragging
- Helpers they needed from app.js moved first: `sectionLocalStep`,
  `sectionLocalPlane` → section-view.js, `renderSectionPlaneLive` →
  mpr-render.js, `cutPointerVoxel` → analysis-ops.js.
- Verified against the build-239 app.js: all 55 moved statements appear
  verbatim in scene-view.js and the other 57 start3D statements verbatim in
  app.js (`tools/split-history/start3d-split-verify.mjs`; the transform is
  `start3d-split-apply.mjs`).
- start3D 291 → 112 lines; app.js 1017 → 822. Build 239 → 240.

### Notes
- Behaviour change risk: the factories run at the same point in start3D as
  the statements did, so creation order is unchanged. Needs a device check
  (renderer init, view buttons, help panel, axis widget, cut pen/line,
  lasso, section drag).
- scene-view.js imports three.js from the CDN, so it cannot be unit-tested
  in Node; `resampleCutScreenCurve` would be a candidate if moved to a pure
  module.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (untangle import cycles, build 239)

**Agent:** Claude (Claude Code)
**Task:** Remove the module import cycles noted in build 238.

### Cause
- One strongly connected component of 7 modules (scene3d, mpr-render,
  mpr3d-overlay, edit-tools, segment-runs, run-cache, gpu-volume-data). Root:
  the 3D status helpers appended to `scene3d.js` in build 232 import
  `currentFilterSignature` (mpr-render.js) and `updateAnalysisEditorControls`
  (edit-tools.js), while those modules import `request3DRender` from
  scene3d.js.

### What changed (verbatim moves; only import lists changed)
- `scene3d.js` is a leaf again: `request3DRender` only.
- New `three-status.js`: `gpuVolumeRefresh`, `updateVolumeFilterBadge`,
  `set3DBusy` (no edit-tools dependency).
- New `three-state.js`: `set3DState`, `mark3DStale`, `mark3DCurrent` (these
  call `updateAnalysisEditorControls`; only high-level modules import them).
- `currentFilterSignature` moved from mpr-render.js to source-filters.js.
- New `tools/retarget-imports.mjs`: after moving exported declarations,
  points every other module's import of them at the new module.
  (`extract-module.mjs` refuses sources that already export.)
- `verify-split HEAD docs/scene3d.js,docs/mpr-render.js,docs/source-filters.js
  <all 5 files>` → OK, 67 statements.
- New test `tests/static/no-import-cycles.test.js`: the docs/*.js module
  graph must be a DAG and no module may import app.js.
- Build 238 → 239.

### Rule going forward
- Keep leaf modules (state, ui-shell, scene3d, three-status, source-filters,
  segments, …) free of imports from feature modules; the test enforces no
  cycles.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (keep/delete all selected regions, build 236)

**Agent:** Claude (Claude Code)
**Task:** Owner report: with two or more regions selected in the volume
analysis list, "keep selected" / "delete selected" applied to only one.

### Cause
- `applyEditKeepSelected` / `applyEditRemoveSelected` used only the focused
  region (`analysisFocusedRegionId`); the list checkboxes (`region.selected`,
  also used by "merge selected") were ignored. Pre-existing, not from the
  module split.

### What changed
- `edit-tools.js`: `editTargetRegions()` — every ticked region, or the
  focused one when none is ticked; regions merged across segments are
  skipped (edits are per segment). The keep/delete buttons are enabled
  from it.
- `analysis-ops.js`: both operations group the targets by segment and apply
  once per segment (keep = union of the targets' runs; delete = add the
  union to `excludeRuns`), with one undo entry per segment. Undo/redo still
  act on one segment at a time, so an edit that spanned two segments takes
  two undos.
- Build 235 → 236.
- Same PR, build 237 — owner: having to tick each region is poor UX. New
  analysis regions (`addAnalysisRegion`) and merged regions now start
  ticked (`selected:true`), so "click the parts, then keep/delete selected"
  acts on all of them; untick a region to leave it out. "Merge selected"
  also uses the ticked regions.
- Same PR, build 238 — owner asked why the first analysis after reopening
  is not "from the cache". The GPU volume cache holds the reduced display
  texture; analysis runs were only kept in memory. New device cache for the
  per-segment filtered runs:
  - `docs/run-pack.js`: `packRuns` / `unpackRuns` (one blob, format tag,
    slice count check; unit-tested in `tests/unit/run-pack.test.js`).
  - `docs/run-cache.js`: key = dataset fingerprint + filter signature +
    segment settings (stable across sessions); stored in the GPU volume
    cache DB as a 1-slice entry (`info.kind='segment-runs'`), same LRU
    budget and "clear cache" button.
  - `segment-runs.js` `ensureSegmentBaseRuns`: source-backed volumes try the
    cache first (progress jumps to N/N on a hit), otherwise compute and
    store in the background.
- Module import cycles exist since the split appended functions to existing
  modules (e.g. scene3d.js ↔ mpr-render.js, scene3d.js ↔ edit-tools.js; now
  also via run-cache.js → gpu-volume-data.js → scene3d.js). They only
  involve functions called after evaluation, so they work, but should be
  untangled (follow-up).

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 3, step 5, build 235)

**Agent:** Claude (Claude Code)
**Task:** Workspace UI and the volume-analysis / edit operations. Verbatim
moves.

### What changed
- `applyLanguage` appended to `i18n.js` (app-wide language switch).
- `docs/workspace-ui.js` (2): `initIPadWorkspaceUi`,
  `initIPadGpuQualityControl`.
- `docs/analysis-ops.js` (48): volume analysis from 3D/MPR clicks and the
  lasso, connected components (GPU/CPU/source-backed), the analysis run
  prewarm, the GPU-volume region overlay sync, edit operations (keep /
  remove / undo / redo / reset / cut stroke apply / merge), cut raycast
  acceleration (three-mesh-bvh), analysis region meshes (surface view and
  STL), segment STL export and stats.
- app.js 1601 → 1017 lines. `verify-split HEAD docs/app.js,docs/i18n.js
  docs/app.js docs/i18n.js docs/workspace-ui.js docs/analysis-ops.js` → OK,
  204 statements. Moved non-primitive consts: literals.
- Exact commands: `tools/split-history/phase2d-part3-step5.sh`.
- Build 234 → 235.

### Left in app.js
- `start3D` (291 lines) — needs a real refactor, device check required.
- Event wiring (~92 top-level statements) and small UI glue (slider
  precision drag, section view controls, file pickers, view swapping, MPR
  touch). Keep as the composition root.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 3, step 4, build 234)

**Agent:** Claude (Claude Code)
**Task:** Project load/save, demo loading. Verbatim moves plus one tooling
change.

### What changed
- Build markers moved to `docs/version.js` (`APP_VERSION`, `APP_BUILD`),
  because `gatherProject` writes them into saved projects and modules cannot
  import from app.js. `tools/bump-build.mjs` now rewrites them there and
  `tests/static/build-consistency.test.js` reads them there (checked by
  running the bump 233 → 234).
- `docs/segment-ui.js` (13): segment preset list add/remove/render, segment
  output labels, CT range mode/slider range, control setters,
  `segmentControl` (a lookup function, flagged as a DOM const by the tools).
- `docs/data-load.js` (33): series selection, source-backed volume opening,
  resident GPU volume preparation/activation, CT range profile, segment
  configuration, demo download/cache badge, project gather/save/deliver
  (share sheet)/apply (+ pending project), `FILTER_PARAM_INPUTS`. Named for
  its content; extracted as project-io.js and renamed.
- app.js 2054 → 1601 lines. `verify-split HEAD docs/app.js docs/app.js
  docs/version.js docs/segment-ui.js docs/data-load.js` → OK, 250 statements.
  Moved non-primitive consts: literals, or objects of ui-shell elements
  (evaluated after ui-shell).
- Exact commands: `tools/split-history/phase2d-part3-step4.sh`.
- Build 233 → 234.

### Rule change
- The build markers live in `docs/version.js`; use `npm run bump-build`.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 3, step 3, build 233)

**Agent:** Claude (Claude Code)
**Task:** 3D rebuild flow and filter UI. Verbatim moves.

### What changed
- `docs/analysis-results.js` (7): analysis result list UI, region focus /
  removal / naming, registry reset after a rebuild.
- `docs/gpu-volume-data.js` (13): GPU volume data refresh, texture cache
  (IndexedDB) state and control, edit descriptors, filtered slice provider.
- `docs/rebuild-3d.js` (11): `rebuildCurrent3D`, the CPU-filtered volume for
  3D (`buildCpuFilteredVolumeFor3D`), `CPU_FILTERS` / `applyCpuFilter`
  (landed here because the 3D path uses them first; the filter UI imports
  them), `mark3DUpdating`, `surfaceRebuildPending`.
- `docs/filter-pipeline.js` (18): `rebuildActiveFilters`, filter order /
  add / remove / move / drag reorder, control sync, live filter state,
  source filter invalidation.
- app.js 2492 → 2054 lines. `verify-split HEAD docs/app.js docs/app.js
  docs/analysis-results.js docs/gpu-volume-data.js docs/rebuild-3d.js
  docs/filter-pipeline.js` → OK, 299 statements verbatim. Non-primitive
  consts moved: literal initialisers or closures only.
- Exact commands: `tools/split-history/phase2d-part3-step3.sh`.
- Build 232 → 233.

### Next
- Remaining in app.js: `start3D` (closure now 32 decls), project
  load/save + demo, workspace UI, event wiring.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 3, step 2, build 232)

**Agent:** Claude (Claude Code)
**Task:** 3D surface build. Verbatim moves.

### What changed
- `renderAll`, `scheduleSourceMprWarmup` (2D) appended to `mpr-render.js`.
- 3D status UI appended to `scene3d.js`: `set3DBusy`, `set3DState`,
  `mark3DCurrent`, `mark3DStale`, `updateVolumeFilterBadge`,
  `gpuVolumeRefresh` (literal initialiser).
- New `docs/surface-build.js` (24): `render3D`, `render3DSourceBacked`,
  `render3DMemoryGpu`, GPU mesh tiles (resident/CPU), mesh blocks, edited
  segment surface restore/refresh, edit raycast readiness, section clipping
  materials.
- app.js 2895 → 2492 lines. `verify-split HEAD
  docs/app.js,docs/mpr-render.js,docs/scene3d.js docs/app.js
  docs/mpr-render.js docs/scene3d.js docs/surface-build.js` → OK, 360
  statements verbatim.
- Closures now: `rebuildCurrent3D` 63 → 31, `rebuildActiveFilters` 59 → 27,
  `start3D` 42.
- Exact commands: `tools/split-history/phase2d-part3-step2.sh`.
- Build 231 → 232.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 3, step 1, build 231)

**Agent:** Claude (Claude Code)
**Task:** Segmentation/mesh area. Verbatim moves.

### Finding
- `set3DState` (called by `mark3DCurrent`/`mark3DStale` from every 3D
  build) ends with `updateAnalysisEditorControls()`, whose closure (37 decls)
  is the hub that tied the 3D build and the filter UI to the edit/cut tools.
  Moving that cluster out first shrinks the rest.

### What changed
- `docs/busy.js`: `setProcessingBusy`.
- `docs/segment-runs.js` (11): per-segment runs for source-backed and
  in-memory volumes (`ensureSegmentBaseRuns`, `getFinalSegmentRuns`,
  `sourceRunsForSegment`, GPU/CPU block extraction, `segmentBaseSignature`).
- `docs/surface-mesh.js` (8): isosurface smoothing, Taubin, geometry from
  positions, editable runs group, strong-smoothing consolidation, `dispose`.
- `docs/edit-tools.js` (17): edit/cut UI (`updateAnalysisEditorControls`,
  `updateThreeEditUi`, cut preview/result preview, cut stroke geometry,
  control readouts, `analysisRegionById`).
- app.js 3621 → 2895 lines. `verify-split HEAD docs/app.js docs/app.js
  docs/busy.js docs/segment-runs.js docs/surface-mesh.js docs/edit-tools.js`
  → OK, 368 statements verbatim; no non-primitive consts moved.
- Closures after the move: `render3D` 69 → 32 decls, `rebuildCurrent3D`
  100 → 63, `rebuildActiveFilters` 112 → 59.
- Exact commands: `tools/split-history/phase2d-part3-step1.sh`.
- Build 230 → 231.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (CPU filter kernels, build 230)

**Agent:** Claude (Claude Code)
**Task:** First step of the "filter pipeline" feature area: the CPU 3D
filter stack (fallback when WebGPU compute is not used).

### Why not a verbatim move
- Each `apply*` function (Gaussian, Median, Spike/Hole, NLM, Anisotropic,
  Bilateral, TV, Unsharp, Sigmoid) ended with `renderAll(); render3D(volume)`,
  so its dependency closure was ~72 declarations / ~1170 lines (3D build,
  edit tools). They were split into pure kernels + one UI wrapper instead.

### What changed
- New `docs/cpu-filters.js`: `cpuGaussian3D`, `cpuMedian3D`, `cpuSpikeHole`,
  `cpuNlm3D`, `cpuAnisotropicDiffusion`, `cpuBilateral3D`,
  `cpuTvDenoising3D`, `cpuUnsharpMask3D`, `cpuSigmoid` —
  `(v, params, onProgress) → {data, ...stats}`. The loop bodies were copied
  by script from the old functions; only the slider reads became `params.*`.
  Verified voxel-identical against the old functions (taken from git HEAD,
  run with the same slider values on a random 9×8×7 volume with a spike).
- `app.js`: `CPU_FILTERS` table (label, error prefix, parameter read,
  footer text) + `applyCpuFilter(key, base)` (busy state, run, setVolume,
  renderAll, render3D, footer). The two duplicated 9-branch dispatch chains
  (`buildCpuFilteredVolumeFor3D`, `rebuildActiveFilters`) became one call.
  Only visible difference: the Gaussian footer shows the strength read at
  the start instead of re-reading the slider at the end.
- Tests: `tests/unit/cpu-filters.test.js` (constant volume invariant, spike
  removal, identity at strength 0, sigmoid range/order, progress, stats).
- app.js 3859 → 3621 lines. Build 229 → 230.

### Next
- The filter UI/pipeline (`rebuildActiveFilters`, order/add/remove, live
  filter state) has a 112-declaration closure through the 3D build and edit
  tools; it needs the segmentation/mesh-building area split first, or a
  similar "pure part + thin wrapper" approach.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 2, step 3, build 222)

**Agent:** Claude (Claude Code)
**Task:** Third step of the MPR feature-module split: 2D plane rendering,
with the segment-state and section-view helpers it pulled in moved to their
own modules first. Verbatim moves.

### What changed
- `docs/segments.js` (10 decls): `segmentState`, `SEGMENT_PRESET_ORDER`,
  `segmentEditState`, `segmentEditActive`, `segmentNeedsGlobalMask`,
  `getProcessedSegmentMask`, `segmentMaskVolumeId(s)`, `activeMprSegments`,
  and `sourceMprMemoryView` (pulled in by the mask helpers).
- `docs/section-view.js` (6 decls): section view UI and clip-plane helpers.
- `docs/mpr-render.js` (24 decls): `schedulePlaneRender`, `renderPlane`,
  `safeRenderPlane`, memory/source-backed/filtered plane renderers,
  `paintSourcePlane`, instant images while sliding, orthogonal high-res
  prefetch, 2D analysis overlay drawing, paint caches and timers.
- app.js 4072 → 3838 lines. `verify-split HEAD docs/app.js docs/app.js
  docs/segments.js docs/section-view.js docs/mpr-render.js` → OK, 410
  statements verbatim. Non-primitive consts moved have literal initialisers
  or only create closures (`filteredPlaneRunners` builds `latestOnlyRunner`
  closures without running them).
- Exact commands: `tools/split-history/phase2d-part2-step3.sh`.
- Build 221 → 222.

### Same PR, build 223: 2D slices lag behind the slider with filters (iPad)
- Owner (pre-existing, same on build 221; reported before): with filters on,
  2D slices do not follow the slider, update only a while after release,
  and sometimes not at all; the 3D view follows in real time.
- Cause: the instant image while sliding (`paintInstantPlaneWhileSliding`)
  uses the GPU volume only through its CPU preview copy, which the reduced
  iPad texture plan does not have, and `extractPlane` refused reduced
  textures because `mprPlaneShader` read source voxel coordinates directly.
  So on iPad each drag step fell back to filtering a full-resolution slice.
- Fix: `mprPlaneShader.huAt` maps source voxels to the nearest texel of the
  texture (`textureDimensions`; identity at full resolution).
  `extractPlane(..., {allowReduced})` reads reduced textures only when asked.
  `gpuSlidePreviewRunners` (mpr-render.js): while a filtered plane's slider
  moves and nothing instant is cached, read the plane from the GPU volume
  when it holds the current filters (`gpuVolumeShowsCurrentFilters`), one
  latest-only read per plane; the full-resolution filtered slice is still
  rendered on release. Exact paths (unfiltered orthogonal planes cached as
  exact) keep refusing reduced textures.
- CI has no GPU: WGSL parses; behaviour must be checked on the iPad.
- Owner on build 223: still not following. Build 224 adds a diagnostic:
  while a filtered slider moves, the footer shows the 2D image source
  ("2D <plane> while sliding: filtered | filtered-gpu | filtered-preview |
  original-preview | original | gpu N ms | gpu-read-empty | full-resolution
  filter (GPU volume not used: <reason>)"). Use it to find the path on the
  device before changing more.
- Build 224 on the iPad showed "full-resolution filter (GPU volume not used:
  GPU readback disabled after an error)". Not an error: `app.js` sets
  `residentMprReadbackDisabled` on purpose when the texture is reduced
  (`setResidentMprReadbackDisabled(!!mv.isReduced?.(v))`) so exact readback
  never uses it. Build 225: the slide preview checks only
  `mv.hasResident(target)` (it never caches values as exact); the misleading
  reason text is removed.
- Build 225 on the iPad: heavy flicker while sliding, images from other
  positions in every direction. Each drag step picked whichever source was
  available (cached full-res filtered slice, low-res 3D preview, unfiltered
  original, or the GPU read), so resolution, filtering and latency changed
  step by step. Build 226: when the GPU volume holds the current filters,
  every drag step uses only the GPU read (latest-only per plane); the other
  instant sources are used only when it is unavailable.
- Build 226 on the iPad: occasional flicker while sliding; jerky only in the
  2D-only layout after the section view was shown in 3D (split layout is
  smooth); slider thumb and finger/pen drift apart (open question: also on
  build 221? slower than the finger, or lagging?). Build 227: the 3D render
  loop skips frames while the 3D viewport has no size (2D-only layout) and
  keeps the request until it is shown; footer now shows "gpu read N ms ·
  paint M ms" to measure the 2D path on the device.
- Build 227 on the iPad: jerkiness fixed, 2D fast. Pen: no flicker but the
  thumb drifts far from the pen; touch: heavy flicker. Cause: the global
  precision drag sets `value = start + dx/width*span*gain` (gain .48 mouse/
  pen, .36 touch) — the pen drift is that gain — while iPad Safari also
  runs the native range touch behaviour, so the value alternated between the
  finger position and the precision value. Build 228: `touchstart` on a range
  is prevented (except in `.sidebar-scroll`, where vertical scrolling may
  start on a slider) and `touchmove` during an active precision drag.
- Owner: touch flicker gone. Slice sliders should follow pen and touch 1:1;
  other sliders keep the precision drag. Build 229: `SLICE_SLIDER_SELECTOR`
  (`#axial/#coronal/#sagittal-slider`, `#mpr3d-slider-*`,
  `#section-position`) drags absolutely: the value comes from the pointer
  position on the slider (a tap jumps there), so the thumb stays under the
  pen/finger. Other ranges unchanged (gain .48 mouse/pen, .36 touch).

### Next
- Remaining feature areas in app.js (see the plan's "Refactoring backlog"):
  filter pipeline UI, segmentation UI + mesh building, analysis/edit/cut
  tools, project load/save, workspace UI, then breaking up `start3D`.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (analysis prewarm, build 219)

**Agent:** Claude (Claude Code)
**Task:** Follow-up to build 218 (owner confirmed on iPad that analysis now
finishes and later clicks are fast): make the first analysis click fast too.

### Owner workflow (important for future work)
- The owner works and views in **GPU volume mode**. The surface mesh is
  built only once, right before STL export. So features must not assume a
  surface build has happened, and must not add work to the surface build.
  (First version of this PR prewarmed after the surface build: wrong
  trigger, changed before merge.)

### What changed
- `scheduleAnalysisRunPrewarm()`: when volume analysis mode is turned on,
  compute each shown segment's filtered runs in the background (300 ms
  later, one segment at a time, no busy UI). Only for source-backed volumes
  with filters. Stops when analysis mode is turned off, the analysed volume
  changes, the segment is hidden, or the filters change (`__SUPERSEDED__`).
- `ensureSegmentBaseRuns(key, v, onProgress, quiet)`: one computation per
  signature. A second caller with the same signature (an analysis click
  while the prewarm runs) joins the pending promise and receives its
  progress; `quiet` skips `setProcessingBusy` so the background pass does
  not touch the left progress bar. `clearSegmentEditCache` drops the
  pending entry (its result is then not stored).
- Build 218 → 219.

### Same PR, build 220: analysis regions drawn in the GPU volume (no mesh)
- Owner: volume analysis must not use meshes either (meshes only for STL).
  Before, every analysed region got a display mesh (`buildAnalysisRunsGroup`)
  even in GPU volume view.
- `medical-volume.js`: new storage buffer `analysisOverlay` (binding 10;
  one buffer so the fragment stage stays at 8 storage buffers, the WebGPU
  default limit — it already used 7). Layout: `[0]=1`, `[1..rows+1]` row
  offsets, then `(x0|x1<<16, rgb|focused<<24|valid<<31)` pairs per texture
  row. `analysisOverlayAt(tc)` in the raycast shader recolours a segment
  surface hit that lies in a region (focused regions brighter/opaque); the
  cut preview keeps priority. `setAnalysisRuns(regions, v, signature)`
  packs runs (via `gpuRunsForTexture`, so reduced iPad textures work) and
  skips the upload when the signature is unchanged; `clearAnalysisRuns()`.
  Unit test: `tests/unit/volume-analysis-overlay.test.js`.
- `app.js`: `attachAnalysisRegion` builds no mesh in GPU volume view;
  `syncVolumeAnalysisOverlay()` runs at the start of each rendered frame:
  in volume view it uploads visible regions (signature = series, texture
  dims, id/colour/focus/voxels) and hides leftover region meshes; in surface
  view it builds missing region meshes lazily. STL export of a region still
  builds its mesh on demand (`attachAnalysisRegion(region, v, true)`). If the
  GPU upload fails, falls back to region meshes (`volumeAnalysisOverlayFailed`).
- Not verifiable in CI (no GPU): WGSL parses (wgsl-shaders test), packing is
  unit-tested; colouring must be checked on a device.

### Same PR, build 221: speckled colouring on reduced iPad textures
- Owner screenshot (iPad GPU 512, source 1024×1024×1784): the region was
  coloured but speckled with uncoloured texels. `gpuRunsForTexture`
  point-samples one source voxel per texel, so thin cortical shells miss
  many texels. Dilate the region by one texel on reduced textures (as the
  cut preview already does). Side effect: up to one texel (~2 source voxels
  at 512) of colour can spill onto a touching neighbour; volumes are
  computed at source resolution and unaffected.

### Follow-up
- The GPU volume texture already holds the filtered volume
  (`gpuVolumeShowsCurrentFilters`); extracting runs from it would avoid
  re-filtering entirely. Needs GPU work verifiable only on a device.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (analysis cache, build 218)

**Agent:** Claude (Claude Code)
**Task:** Owner report (iPad, own DICOM folder, filters on, analysis started
from 3D): volume analysis stays at "解析中…" and never reaches the usual
"n / N" progress.

### Cause (from reading the code; not reproducible here: no GPU, CDNs blocked)
- On a source-backed volume with filters on, every analysis click re-read
  the whole volume from DICOM and re-ran all filters block by block
  (`connectedComponentVolumeSource`, 4 slices per block on touch devices),
  although the 3D surface had just been built from the same filtered data.
  Progress text was first written after the first block, which with heavy
  filters (NLM) or the CPU fallback can take very long on iPad, so it
  looked stuck. Not caused by the module split (the moved functions are
  byte-identical; call structure unchanged).

### What changed
- `analyzeVolumeComponentAtVoxel`: for source-backed volumes with filter
  stages, use `getFinalSegmentRuns` (the per-segment filtered-run cache the
  edit tools already use, keyed by `segmentBaseSignature`: segment
  settings, `filterRebuildRevision`, `sourceFilterRuntime.revision`, dims)
  + `componentsFromRunsAsync`. The first click computes the runs once; later
  clicks with the same filter/segment settings reuse them. Connectivity is
  the same as before (both paths use `sourceRunSlice*` +
  `unionOverlappingRuns`), so volumes are unchanged.
- Progress: `sourceRunsForSegment` / `ensureSegmentBaseRuns` /
  `getFinalSegmentRuns` take an optional `onProgress(done,total)`; the
  analysis shows "フィルター適用済みの領域を準備中… n / N" from 0. The
  uncached path (no filters) now shows "0 / N" before its first block.
- Build 217 → 218.

### Follow-up
- First click is still one full filtered pass. Next: fill the run cache
  while the 3D surface is built from filtered data, so even the first
  click is instant.
- If analysis still never finishes on the device (not just slow), look for
  a GPU call that never resolves (e.g. `gpuValidationScope` / device lost on
  iPad); ask the owner for the GPU status text.

---

## 2026-09-27 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 2, step 2)

**Agent:** Claude (Claude Code)
**Task:** Second step of the MPR feature-module split: the 3D preview cache
and the MPR-in-3D overlay, verbatim.

### What changed (all verbatim moves)
- `mpr3DSliceSliders` (DOM const) appended to `docs/ui-shell.js`. It now
  queries `#mpr3d-slider-*` when ui-shell.js runs instead of at its old
  line in app.js; the elements come from the template and nothing before
  the old line recreates them (the only `innerHTML` writes there build new
  toolbar/drawer nodes), so it holds the same nodes.
- New `docs/scene3d.js`: `request3DRender` (3 lines, state only). Kept out
  of the overlay module because 67 call sites across the app use it; this
  module is meant to receive the 3D scene code (`start3D`) later.
- New `docs/mpr3d-overlay.js` (22 decls): 3D preview cache build/paint
  (`ensureMpr3DPreviewCache`, `paintMpr3DCacheSliceFast`, window LUT,
  preview plan/map), overlay plane objects and positions, the 7-function
  overlay cycle, the 3D slice panel sync (`syncMpr3DSliceSliders`,
  `mpr3DOpacitySource`), and their state objects (`mpr3DPreviewCache`,
  `mpr3DCacheImage`, `mpr3DVisibility`, `mpr3DOrthoSliding`; literal
  initialisers).
- app.js 4321 → 4088 lines. `verify-split HEAD docs/app.js,docs/ui-shell.js
  docs/app.js docs/ui-shell.js docs/scene3d.js docs/mpr3d-overlay.js` → OK,
  581 statements verbatim.
- Exact commands: `tools/split-history/phase2d-part2-step2.sh`.
- Build 216 → 217.

### Next (step 3)
- 2D plane rendering: `renderPlane`, `paintSourcePlane`,
  `schedulePlaneRender`, instant-image path. Its closure also pulls in
  segment-mask helpers (`getProcessedSegmentMask`, `activeMprSegments`, …)
  and analysis overlay drawing; consider moving those first as their own
  module.
- `mpr3DSlicePanelReady` stays in app.js (used by the panel wiring).

---

## 2026-09-26 — claude/dicom-viewer-handoff-eaqyyu (phase 2d part 2, step 1)

**Agent:** Claude (Claude Code)
**Task:** First step of the MPR feature-module split: move the lowest
layers (filtered-slice computation and orthogonal plane building) out of
`docs/app.js`, verbatim.

### What changed (all verbatim moves)
- `docs/source-filters.js` (30 decls): source-filter worker pool
  (`sourceFilterWorkerMain` is still serialised via `toString()` into a
  Blob worker), region reads and tiling, per-slice filtered plane values
  for source-backed and in-memory volumes, both filter caches,
  `filterState`, `sourceFilterStages` / `sourceFilterSignature`, and
  `planeRenderRevision` (pulled in because `getFilteredMemoryPlaneValues`
  checks it).
- `docs/mpr-orthogonal.js` (10 decls): coronal/sagittal plane building
  from source rows/columns, its cache, and resident-GPU MPR plane readback.
- app.js 4662 → 4321 lines. `verify-split HEAD docs/app.js docs/app.js
  docs/source-filters.js docs/mpr-orthogonal.js` → OK, 470 statements
  verbatim. Non-primitive consts moved (all literal/`new Map()`
  initialisers, no side effects): `sourceFilterRuntime`,
  `memoryFilterPreviewCache`, `filterState`, `planeRenderRevision`,
  `sourceOrthogonalPlaneCache`, `sourceOrthogonalPlanePending`,
  `residentMprJobs`.
- Exact commands: `tools/split-history/phase2d-part2-step1.sh`.
- Build 215 → 216.

### Findings / plan for the next steps
- The whole MPR closure (seeds `schedulePlaneRender`, `paintSourcePlane`,
  `ensureMpr3DPreviewCache`, `paintInstantPlaneWhileSliding`) was 103
  declarations / ~890 lines, too large for one reviewable PR; hence the
  bottom-up steps.
- Only blocker left for the rest: `mpr3DSliceSliders` (DOM const declared
  in app.js, not in ui-shell.js) used by `syncMpr3DSliceSliders`. Move it
  to `ui-shell.js` first (or keep the 3D slice panel in app.js).
- Step 2: 3D preview cache + MPR-in-3D overlay (`ensureMpr3DPreviewCache`,
  `paintMpr3DCacheSliceFast`, overlay plane functions, the 7-function
  cycle). Step 3: 2D plane rendering (`renderPlane`, `paintSourcePlane`,
  `schedulePlaneRender`); it also pulls in segment-mask and analysis
  overlay helpers, which may be better moved first as their own module.
- `filterState` / `planeRenderRevision` ended up in `source-filters.js`
  because of the dependency closure; fine for now, revisit when the filter
  UI module is extracted.
- E2E could not run in the Claude Code cloud container: its network policy
  blocks the CDNs (jsdelivr, esm.sh), so the app never boots there. Lint and
  unit tests ran locally; E2E ran in GitHub CI on the PR.

---

## 2026-09-26 — claude/dicom-viewer-handoff-eaqyyu

**Agent:** Claude (Claude Code, handed over from the claude.ai chat)
**Task:** Checkpoint at a natural pause after PR #30 (builds 211–215) was
merged into `main`. No code changes.

### State at this point
- `main` = build 215 (`2026.09.26-215`). The MPR / 3D-plane work is
  complete: real-time 3D plane follow during slice drags, 3D slice panel
  (sliders reversed, opacity row), planes visible during camera moves,
  instant 2D images while dragging filtered slices.
- Details are in the `fix/mpr3d-live-follow` entry below.

### Follow-up / open questions
- Check on a real iPad: rotation performance with planes kept visible
  (`mpr3DHideDuringCameraMoves=false`; set true to restore the old
  behaviour).
- With the reduced iPad GPU plan there is no CPU preview copy, so instant
  images while dragging filtered slices fall back to the low-res preview or
  the original data.
- CI has no GPU: the filtered GPU paths are covered only by manual checks on
  the Pages preview.
- Next candidates (from `IMPLEMENTATION_PLAN.md`): finish splitting
  `docs/app.js` (UI shell, feature modules), dual-threshold bone extraction,
  3D connectivity cleanup, brush/eraser correction, moving heavy processing
  off the main thread, compressed DICOM Transfer Syntax support.

---

## 2026-09-26 — fix/mpr3d-live-follow

**Agent:** Claude (via claude.ai)
**Task:** Owner report: (1) planes shown in the 3D view have no slice UI in
3D-only layouts; (2) in split view, the 3D planes no longer follow slice
drags in real time (a feature built in builds 124–127). Owner had filters on.

### Cause of (2) — regression from build 194 (PR #21)
- Compared with 184.10, all live-3D-MPR functions are identical; the only
  difference in `schedulePlaneRender` was my 90 ms debounce for per-slice
  filtered planes. The **axial** 3D plane copies the 2D axial canvas
  (`refreshMpr3DPlaneTexture` at the end of `paintSourcePlane`), so while
  the debounce held 2D rendering during a drag, the 3D axial plane froze.
  (Coronal/sagittal use `pushCachedMpr3DPlane` during slides and were not
  affected.)

### What changed
- `docs/latest-runner.js`: `latestOnlyRunner(task)` — never concurrent,
  re-runs once with the latest state after each run, intermediate requests
  dropped (unit-tested). `schedulePlaneRender` now uses one runner per plane
  for per-slice filtered planes during drags (the revision is not bumped on
  every step, so the in-flight render is not superseded). Real-time follow
  again, without the GPU work pile-up that made drags jerky. Debounce removed.
- 3D slice sliders: `#mpr3d-slice-controls` under the 3D overlay buttons,
  one row per plane visible in 3D (`mpr3DVisibility`). They drive the real
  plane sliders via input/change events and are kept in sync from
  `schedulePlaneRender`, `syncMpr3DOverlayPresentation`,
  `setMpr3DOverlayVisible` and series load. The global precision-drag and
  slider fast-interaction logic apply to them automatically.
- E2E `tests/e2e/mpr3d-sliders.spec.js` (in CI): slider appears with the
  plane, drives the 2D slice, follows the 2D slider, hides with the plane.
  CI cannot exercise the filtered GPU path (no WebGPU).
- Build → 211.

### Follow-up in the same PR (build 212): planes vanished in GPU volume mode
- Owner: in GPU volume mode, the 3D plane images disappear while dragging
  either slice slider (3D or 2D).
- Cause — regression from build 191 (PR #20, slider fast interaction): in
  volume mode the planes are drawn by the volume renderer from
  `render(..., {indices, visible, ...})`; the render loop passes
  `visible` = section-view planes only while `fastInteractionActive` (by
  design for camera rotation). PR #20 turned fast interaction on for every
  slider drag, so slice drags hid the planes. (Lesson: check every consumer
  of a shared flag before reusing it.)
- Fix: `setFastInteraction(active, keepOverlays)` records
  `fastKeepOverlays`; the render loop hides planes only when
  `fastInteractionActive && !fastKeepOverlays`. Camera moves unchanged.
  Slice indices are passed to the renderer every frame, so planes follow
  drags in real time again.

### Follow-up (build 213): owner feedback on 212
- Planes now visible while dragging sliders, but hidden while rotating:
  that is the original 184.10 behaviour (render loop hides regular planes
  during camera moves). Owner prefers them visible →
  `mpr3DHideDuringCameraMoves=false` (set true to restore; watch rotation
  performance on iPad).
- Plane opacity slider was far away (the workspace UI moves
  `.mpr-opacity-settings` into the drawer). Added an "Opacity" row to the
  3D slice panel (`#mpr3d-opacity`) proxying `mprVolumeOpacity` in volume
  mode or `mprSurfaceOpacity` otherwise; synced from
  `updateMpr3DOpacityControls`. That function is also called at startup,
  before the panel constants exist (TDZ) → guarded by
  `mpr3DSlicePanelReady`. Lint/unit tests cannot catch this ordering; the
  E2E page-error checks do.
- 2D update latency with filters: the runner waits for the in-flight
  (already stale) slice, so up to two computations of delay.

### Follow-up (build 214): owner choice "A, but use the caches"
- While a filtered plane's slider moves, `paintInstantPlaneWhileSliding`
  shows the best image available immediately: (1) the full-resolution
  filtered slice from the 2D filter caches (`sourceFilterCacheGet` /
  `memoryFilterPreviewGet`, key `signature|plane|index`); (2) the GPU
  volume's CPU preview copy when the texture holds the current filters
  (`gpuVolumeShowsCurrentFilters`, `paintResidentCachedMprPreview(p,idx,
  true)`; not available with the reduced iPad plan, which has no preview
  copy); (3) the low-res 3D preview cache (its signature includes the
  filter stages, so it is filtered when built for them); (4) original data
  (source MPR memory cache / unfiltered preview). The runner is used only
  when nothing instant exists. The full-resolution filtered slice is
  computed on release (change event → immediate render).
- An instant image bumps `planeRenderRevision[p]`, so an older slice still
  being filtered skips its paint instead of overwriting the newer image.

### Follow-up (build 215): reversed 3D slider direction
- Owner: reverse the direction of all three 3D-panel slice sliders (2D
  sliders unchanged). Implemented by value mapping (3D value v ↔ slice
  max − v), not CSS `direction:rtl`, because the global precision-drag
  handler maps pointer movement to value increases.

---

## 2026-09-26 — feat/project-save-share

**Agent:** Claude (via claude.ai)
**Task:** Owner: can "Save project" write straight into the DICOM folder?
Not automatically: the folder opened via `<input webkitdirectory>` is
read-only and Safari (iPad/Mac) lacks the File System Access API. Owner chose
option A: save through the share sheet.

### What changed
- `deliverProjectFile(bytes, name)`: on iPad/iPhone, if
  `navigator.canShare({files})`, call `navigator.share` so "Save to Files"
  can target the DICOM folder (the Files app remembers the last folder).
  Share must run inside the click's user activation, so nothing is awaited
  before it (`saveProject` builds the zip synchronously). AbortError →
  "cancelled", nothing saved; other errors → download fallback. Mac and
  other platforms keep downloading (Mac's share sheet has no folder target).
- Footer messages for shared / cancelled / downloaded.
- E2E `tests/e2e/project-share.spec.js` (in CI): iPad UA + stubbed share →
  share gets a `.vrlab`, no download; cancel → nothing saved; Linux →
  download. `tests/helpers/dicom-folder.js` now shared with
  folder-project.spec.js.
- Build → 210.

---

## 2026-09-26 — feat/folder-project-autoload

**Agent:** Claude (via claude.ai)
**Task:** Owner wish: opening a project should also load its DICOM. Not
possible in browsers (no access to files the user did not pick; Safari has
no File System Access API). Owner chose option A: the reverse direction.

### What changed
- "DICOMフォルダを開く": `.vrlab` files in the picked folder are excluded
  from DICOM parsing; the newest (by lastModified) becomes the pending
  project; after `inspect`, the matching series (fingerprint) is selected
  automatically and `selectSeries` applies the project when ready. Footer
  says which project is applied (and "newest of N" when several). A project
  that matches no series in the folder is reported, nothing is applied.
- Save hint: "keep it in the DICOM folder to apply it automatically".
- E2E `tests/e2e/folder-project.spec.js` (runs in CI with the smoke tests,
  no download): synthetic 16×16×12 DICOM folder + a newer matching project
  (gaussian) + an older non-matching one (unsharp) → series auto-selected,
  gaussian restored, unsharp not. CI step now lists this file explicitly.
- Build → 208.

### Follow-up in the same PR (build 209): Safari saved projects as .zip
- Owner: downloads arrive as zip, so the folder autoload did not find them.
  With Blob type `application/zip`, Safari/iOS appends ".zip". Fixes:
  - save with `application/octet-stream` so the name stays `*.vrlab`;
  - `isProjectArchiveName()` also accepts `*.zip`; archives < 200 MB are
    tried with `unpackProject`, non-project zips go back to DICOM parsing;
  - extracted archives (iOS Files app): `projectFromEntries()` rebuilds a
    project from `…/project.json` + `…/edits/*.bin` (webkitRelativePath);
    those files are excluded from DICOM parsing;
  - "プロジェクトを開く" accepts .zip too.
- Tests: unit (names, extracted folder, invalid folder); E2E: .vrlab
  (newest wins), `*.vrlab.zip`, extracted folder with an edit mask
  (decoded before settings apply, so the restored filter proves it; one
  series only → project files not parsed as DICOM).

---

## 2026-09-26 — fix/file-picker-reopen

**Agent:** Claude (via claude.ai)
**Task:** Owner report (iPad): after cancelling the DICOM-folder or project
file picker, the picker does not open again.

### What changed
- Known iPadOS Safari behaviour: a picker opened via `input.click()` on a
  hidden file input may not reopen on the same element after cancel.
  `openFilePicker(name)` now replaces the input with a fresh clone
  (`cloneNode(false)`: same id/attributes, `onchange` copied) before each
  open; handlers read `e.target`. `filePickers` holds the current elements
  (the imported DOM refs cannot be reassigned).
- Smoke test: each button opens a chooser on every click, and the inputs
  are replaced rather than duplicated. (CI Chromium cannot reproduce the
  iPad bug itself.)
- Build → 207.

---

## 2026-09-26 — fix/project-restore-3d-filters

**Agent:** Claude (via claude.ai)
**Task:** Owner report on 205 (iPad, source-backed data, GPU volume):
after opening a project + DICOM, the filters were restored in 2D but the GPU
volume showed "not updated · press Rebuild 3D". Expected: the saved state
(filters applied to 3D) is restored.

### Cause
- Since the explicit-apply change, the volume shows filters only after
  "Rebuild 3D" (`gpuVolumeApplied`), and project files did not record
  whether filters had been applied to 3D, so loading restored 2D only.

### What changed
- Projects save `threeD.filtersApplied` (current filters applied to the
  GPU volume, or 3D not stale).
- Loading: if applied (or the flag is missing — files saved before 206
  count as applied when they contain filters) on a source-backed series,
  set `gpuVolumeApplied` to the restored signature and set
  `applyVolumeAfterFilterRebuild`; the source-backed filter rebuild consumes
  it after it has settled (`revision===filterRebuildRevision`) and calls
  `refreshGpuVolumeData()` — so the rewrite is not superseded by the
  rebuilds the replay triggers. If the volume is activated later,
  `activateMedicalVolume` uses the filtered target anyway. With the same
  data/filters/plan the texture comes from the device cache.
- E2E round-trip checks `threeD.filtersApplied` is written.
- Build → 206.

---

## 2026-09-26 — feat/mac-workspace-ui

**Agent:** Claude (via claude.ai)
**Task:** Owner: "make the Mac UI the same as iPad; the iPad UI is easier".

### What changed
- New `useWorkspaceUi()` in app.js = `isIPadRuntime() || isDesktopMac()`,
  with URL override `?ui=classic` (old desktop layout) / `?ui=workspace`
  (force, used by CI). It now guards only the **layout** code:
  `initIPadWorkspaceUi`, `requestIPadSettingsTab`, the workspace resize
  refresh.
- **Performance settings stay iPad-only** (`isIPadRuntime()`): GPU texture
  plan (512/768 target side) and its selector, source slice/orthogonal cache
  limits, volume-io memory limit. So Mac keeps full-size textures/caches.
- CSS for the workspace UI is keyed on `html.vrl-ipad-ui` only (no
  touch/pointer media queries), so it applies unchanged on Mac.
- Smoke tests: `?ui=workspace` boots with toolbar + drawer; `?ui=classic`
  and default Linux stay classic.
- Names still say "iPad" (`initIPadWorkspaceUi`, `vrl-ipad-ui`, i18n
  `ipad*`) — kept to avoid churn; they now mean "workspace UI".
- Build → 203 (202 is used by the open PR #23 preview).

---

## 2026-09-26 — feat/gpu-volume-cache (save plan, stage 2)

**Agent:** Claude (via claude.ai)
**Task:** Device-resolution cache of filtered GPU volume textures.
Built on top of PR #23 (project files) — merge #23 first.

### What changed
- `docs/gpu-volume-cache.js` (IndexedDB; OPFS writable streams are not
  reliably available on iPad Safari): stores **exactly the bytes uploaded to
  the volume texture**, per texture slice, for filtered data. Stores:
  `entries` {key, slices, bytesPerSlice, bytes, info, complete, created,
  lastUsed} and `slices` [key, index] → Uint8Array. `cacheKey()` = SHA-256
  of {format, dataset fingerprint, filter signature, texture plan, reduced}
  — iPad 512 / 768 and Mac full size are separate entries. Entries become
  visible only after `commit()` (interrupted uploads never hit). LRU
  `prune(budget)` plus removal of stale partial entries.
  `textureCacheHandle()` adapts it for the renderer; storage errors (quota,
  eviction) disable the handle instead of failing the upload; a hit that
  fails mid-read drops the entry.
- `MedicalVolumeRenderer.ensure()`: for filtered data with
  `v.textureCache(info)`, a hit uploads the stored slices as-is (no
  filtering, packing or resampling; full and reduced paths); a miss stores
  every uploaded slice and commits after the validation scope passes.
  `lastCacheHit` is exposed. Unfiltered uploads never use the cache.
- `app.js`: `gpuVolumeTarget()` adds `textureCache` for filtered targets;
  budget = min(quota×0.3, 1.5 GB iPad / 4 GB other), ≥ 256 MB; prune before
  writing; `navigator.storage.persist()` requested once. Footer shows
  "loaded from cache" on hits. New 3D-panel chip "キャッシュ削除 · <size>"
  (hidden without a WebGPU volume renderer).
- Tests: cache module with fake-indexeddb (key, miss→commit→hit,
  interrupted entry, incomplete commit, layout mismatch, quota error, LRU
  prune) and **ensure() driven by a fake WebGPU device** (full and reduced
  plans: a miss stores, a hit uploads identical bytes without calling the
  slice provider; a different plan is a separate entry; the unfiltered path
  never asks the cache).
- Build → 204 (202: PR #23, 203: PR #24).
- Process note: a scripted doc update aborted on an assertion and the
  commit went out without it; fixed in a follow-up commit. Check scripted
  edit steps succeeded before committing.

---

## 2026-09-26 — feat/project-file (save plan, stage 1)

**Agent:** Claude (via claude.ai)
**Task:** Owner-approved save plan. Stage 1: portable project files.

### Agreed plan (owner)
- **Original resolution = the record**: project file with filter settings,
  segment settings, 3D edits, display state (this PR). 2D, measurements
  and exports stay original resolution.
- **Device-resolution cache**: filtered GPU-volume texture bytes (iPad
  512/768 or Mac plan) in OPFS, keyed by dataset fingerprint + filter
  signature + texture plan (stage 2). Browser storage may be evicted
  (Safari), so it is only a cache; files are the record.
- Optional later: Mac full-resolution filtered cache, NRRD/NIfTI export.

### What changed
- `docs/project-file.js` (pure, unit-tested): `.vrlab` = zip of
  `project.json` + `edits/<segment>-<keep|exclude>.bin`. Format
  `virtual-rodent-lab-project`, version 1 (newer versions are rejected with
  an "update the app" message). `datasetFingerprint(series)` (series UID,
  columns/rows/slices, spacing) + `compareFingerprints`. Edit masks are
  run-length (`VLR1` magic, LE uint32, per-slice offsets) and validated on
  load (slice count, bounds). DICOM data is never embedded.
- `app.js`: "プロジェクト保存 / プロジェクトを開く" in the top bar.
  Saved: filter order + parameter input values, window C/W, CT range mode,
  slice positions, segment settings, surface smoothing, keep/exclude edit
  masks. Not saved: undo history, camera, analysis regions.
- Loading replays settings through the existing controls (`addFilter`,
  input/change events, `addSegmentPreset`/`removeSegmentPreset`) so UI,
  state and scheduling stay consistent; edit masks are decoded/validated
  first (a broken file changes nothing) and then written to
  `segmentEditState`. If no/other data is open the project stays pending;
  if a matching series is in the detected list it is selected
  automatically; `selectSeries` applies a pending project when ready.
- Tests: unit (fingerprint, run binary incl. corrupt data, zip, version
  gate); E2E demo round-trip (gaussian + strength + bone segment → save →
  reload → open → restored). 3D edits are not covered by E2E (needs a 3D
  build in CI) — covered by the binary round-trip unit tests.
- Build → 199 (192–196: PR #21, 197–198: PR #22, both unmerged).
- Expect merge conflicts with PR #21/#22 in the ui-shell import line,
  ui-shell template/exports and i18n (all additive).
## 2026-09-26 — fix/filter-2d-preview

**Agent:** Claude (via claude.ai)
**Task:** Owner report: filter effect is not visible in 2D (also on 189).

### Root cause (bug present since at least build 150)
- `renderPlane(p, revision, idx)` returns immediately unless `revision`
  equals `planeRenderRevision[p]`. `rebuildActiveFilters` called
  `await renderPlane(previewPlane)` with no revision in both the in-memory
  WebGPU preview path and the full-resolution (source-backed) path, so the
  preview was never drawn — while the footer still said
  "2D preview · WEBGPU COMPUTE · N stage(s)". The CPU path renders via its
  own apply* functions and was unaffected (CI uses it, so CI never showed
  the bug). Checked archive/previews: same call in builds 150–184.

### What changed
- Both calls now pass `++planeRenderRevision[previewPlane]` and the slider
  index (same as `safeRenderPlane`), so the filtered main-view plane is
  actually painted. On GPU failure the existing fallback to the CPU stack
  now also becomes reachable.
- `tests/static/render-plane-calls.test.js`: every `renderPlane(...)` call
  in docs/*.js must pass 3 arguments (verified to fail on the old code).
- `tests/e2e/demo.spec.js`: adding a Gaussian filter must change the axial
  canvas (CPU path in CI).
- Build 191 → 192.

### Follow-up in the same PR: keep the GPU volume on filter changes (owner choice "A", step 1)
- Owner report on the preview: pressing "add filter" makes the 3D volume
  disappear. Pre-existing since <= build 172: `scheduleFilterRebuild`
  called `deactivateMedicalVolume()` in volume mode, which also switches to
  surface mode (no mesh built yet → empty 3D view). Reason: the GPU volume
  renderer uploads the original DICOM pixel bytes (`packedRgSlice`, rg8unorm
  texture keyed by series id) and **cannot display filtered data**;
  `activateMedicalVolume` refused to start while filters were active.
- Step 1 (this PR): filter changes no longer deactivate the volume; volume
  mode may be entered while filters are active; a badge
  (`#three-filter-badge`, i18n `volumeUnfiltered`) says the volume shows
  the original CT; "3D rebuild" with active filters from volume mode
  switches to surface first (same end result as before). Badge updated from
  `set3DState` and `updateRenderModeControl`.
- Step 2 (next PR): upload filtered volumes to the GPU volume renderer
  (convert CT values back to stored 16-bit values, pack rg8, reduced/mobile
  path and bricks too, texture keyed by series + filter signature).
- Build 192 → 193.

### Step 2 in the same PR: filters shown in the GPU volume (build 194)
- Owner feedback on 193: wants filters in the GPU volume; filter changes
  feel slow; 2D slice dragging is jerky with filters.
- Key constraint found: `MedicalVolumeRenderer.support()` accepts only
  **source-backed** series (decoded size > 256 MB, `dicom.js`), and uploads
  raw DICOM pixel bytes into an rg8 "16-bit" texture decoded in the
  shaders as `(lo + hi*256 - signedBias) * slope + intercept`. The owner's
  volume-mode data is therefore source-backed; an in-memory filtered copy
  (first idea) does not apply and would not fit on iPad.
- Renderer (`medical-volume.js`):
  - `packCtSlice(values, calibration)`: CT values → same rg8 encoding
    (exact inverse of the shader decode; tests/unit/volume-pack.test.js).
  - `ensure(v)`: if `v.filterSignature` + `v.sliceData(z)` are present,
    upload those slices; same series + texture plan but different data
    **rewrites the existing texture in place** (no second texture on iPad;
    the image changes progressively). `dataSignature` is part of the cache
    key ('partial' while rewriting). `v.isCancelled()` aborts uploads.
- App (`app.js`):
  - `gpuVolumeTarget()`: source volume + `filterSignature` + a slice
    provider over `getFilteredSourceAxialBlock` (8-slice blocks), i.e. the
    same GPU filters as the full-resolution 2D/3D paths, streamed.
  - `refreshGpuVolumeData()`: runs when filter settings **settle**
    (`scheduleFilterRebuild(0)`: add/remove/change events; not during
    slider drags), after a 3D rebuild, and via `activateMedicalVolume`.
    Token-based cancellation; duplicate requests for the same settings are
    skipped. Removing all filters rewrites the original data back.
  - Badge (`volumeUnfiltered`) now means "volume does not match current
    filters yet" (pending / partial / removed).
  - The step-1 "switch to surface on filtered 3D rebuild" is removed.
  - `schedulePlaneRender`: per-slice filtered planes (memory GPU preview
    or source-backed with filters) wait for a 90 ms pause during slider
    drags instead of filtering every step.
- Not verifiable in CI (no WebGPU). Device checks: filtered volume after
  releasing a filter slider, progressive update + badge, removing filters
  restores the original, 2D slice drags smoother with filters.
- Build 193 → 194.

### Owner decision on 194: explicit apply for the GPU volume (build 195)
- "Automatic volume update on filter changes takes too long; apply
  explicitly, and only 2D updates immediately."
- Removed the automatic `refreshGpuVolumeData()` on settled filter changes
  (and the `settled` parameter). The volume is rewritten only by
  **"3D rebuild"** (`rebuildCurrent3D` records `gpuVolumeApplied =
  {seriesId, signature}` and then refreshes the volume). Removing filters
  is also applied by rebuild.
- `gpuVolumeDataSignature()` = signature applied by the last rebuild of this
  series if it still equals the current settings, else '' (original).
  Entering volume mode uses it (applied filters, or the original CT).
- Badge: shown while the volume texture differs from the current filter
  settings; text `volumeFilterPending` ("not updated · press Rebuild 3D")
  or `volumeFilterUpdating` during a rewrite. `volumeUnfiltered` removed.
- 2D: immediate preview + 90 ms slice-drag debounce unchanged.

### Owner report on 195: "Rebuild 3D builds meshes, not the volume" (build 196)
- `rebuildCurrent3D` always built surface meshes (`render3D`) and only then
  rewrote the volume. The meshes are created after `setThreeVolumeOverlay
  (true)` hid the old ones, so they were drawn over the volume, and the
  mesh build was most of the wait.
- Now in volume mode (active GPU volume, source-backed series) "Rebuild 3D"
  only records the applied filters and rewrites the volume texture
  (`refreshGpuVolumeData`), then marks 3D current. `surfaceRebuildPending`
  makes the switch back to surface mode rebuild the meshes; a normal
  surface rebuild clears it. `cancel3DRebuild` also cancels a running
  volume rewrite (token bump).

### Open question for the owner
- Only the main view plane is re-rendered with the preview (by design,
  for speed); the other planes show the filter once they are re-rendered
  (e.g. when scrolled). Whether all planes should refresh is a UX choice.
## 2026-09-26 — feat/lasso-region-select

**Agent:** Claude (via claude.ai)
**Task:** Owner request: in 3D edit, select everything enclosed by a pen
loop, to delete small noise in bulk. (PR #21 — filter work — is on hold
while the owner tests other data.)

### Behavior (owner choice: only pieces COMPLETELY inside the loop)
- New tool button "囲んで選択 / Lasso select" next to "領域選択"
  (`#analysis-lasso-select`, tool state `analysisEditTool==='lasso'`).
- Drawing reuses the pen-cut stroke capture (`analysisCutScreen`,
  `appendCutScreenPoints`), drawn as a closed, lightly filled loop.
- On release, `selectRegionsInLasso`: for each target segment (the edit
  target, or all active+enabled segments in auto mode) take
  `getFinalSegmentRuns`, split with `componentsFromRunsAsync`, keep
  components whose voxels all project inside the loop, merge them into
  **one analysis region per segment** (`unionRunArrays`, `merged:true`),
  so the existing "Delete selected region" removes them together.
- Screen-space loop → selects through depth (hidden noise included).
  Pieces crossing the loop (main structure) are never selected.

### Geometry (`docs/lasso.js`, unit-tested)
- `makeVoxelProjector`: voxel → canvas px, using the same voxel placement
  as `makeVolume3DCoordinates` / `surfaceSegmentPointerVoxel`; test checks
  equality with three.js `Vector3.project`.
- `componentFullyInside`: tests run ends plus every 4th voxel along runs,
  stops at the first point outside/behind the camera (large bodies are
  rejected fast); polygon bbox pre-check; even-odd point-in-polygon.

### Owner rule: return to "Navigate" after each 3D edit operation (build 198)
- `returnToNavigate()` (tool → 'select', target key reset like cut apply)
  is called after: region select (both success paths), lasso select when
  something was selected, cut cancel, "Delete selected region" (success),
  "Keep selected region". Cut apply already returned to Navigate.
- Failures / empty results keep the tool active so the user can retry;
  Undo/Redo do not change the tool.

### Notes
- Build 191 → 197 (192–196 are used by the unmerged PR #21 preview).
- Expect a merge conflict with PR #21 in app.js's ui-shell import line and
  i18n.js (both add names/keys); resolve by keeping both.
- WebGPU volume mode uses the same `sceneState.obj` transform as the region
  tool; verify on device in both surface and volume modes.

---

## 2026-09-26 — feat/slider-fast-interaction

**Agent:** Claude (via claude.ai)
**Task:** Keep sliders responsive while the 3D view uses GPU volume rendering.

### What changed (behavior change, small)
- `start3D`: `setFastInteraction(active, keepOverlays=false)` — new optional
  flag skips `setHeavyOverlayInteraction` (which hides the analysis mesh
  and the cut-result preview during camera moves). Exposed as
  `sceneState.setFastInteraction`.
- New `sliderFastInteraction` + `beginSliderFastInteraction()` /
  `endSliderFastInteraction(delay)` next to the global range handlers:
  - pointer drag: begins on the first real movement (not on tap), ends
    120 ms after release;
  - wheel on a slider: begins per tick, ends 220 ms after the last tick.
  - Only when `threeRenderMode==='volume'` and the GPU volume renderer is
    active; mesh mode unchanged. Applies to every range input (all of them
    can trigger 3D re-renders, e.g. MPR planes shown in 3D).
- Effect: same reduced pixel ratio / volume render resolution as camera
  rotation (touch: 0.75/0.60/0.48 by distance tier), full resolution
  restored after the slider is released. Overlays stay visible so live cut
  sliders still show the result.
- Build 190 → 191.

### Verification
- lint + 119 tests; CI demo E2E. CI cannot exercise WebGPU volume
  rendering → owner verifies on device: drag surface smoothing / cut
  sliders in volume mode (should be light, slightly blurrier while
  dragging, sharp after release; cut preview visible while dragging).

---

## 2026-09-26 — refactor/ui-shell (phase 2c + 2d part 1)

**Agent:** Claude (via claude.ai)
**Task:** UI shell module, first feature modules.

### What changed (all verbatim moves)
- `docs/ui-shell.js`: `app`, the `app.innerHTML=<template>` statement, `$`,
  all 141 DOM element consts and `planes`. It runs when imported, i.e.
  before app.js's body; the template was already app.js's first side
  effect, so ordering relative to other side effects is unchanged.
- `docs/gpu-compute.js` (28 decls): WebGPU device/adapter management,
  buffer pool, pipeline cache, `runGpuSourceFilters`, GPU status text.
- `docs/volume-io.js` (13 decls): pixel decode (native + compressed via
  the lazily imported codec), source slice cache, row/column reads, MPR
  cache preparation.
- `docs/settings.js`: surface-smoothing setting readers (were pulled in by
  the GPU cluster but are UI settings).
- Appended: `parseFiles` → `dicom.js`, `tr` → `i18n.js`.
- app.js 4949 → 4229 lines. `verify-split HEAD docs/app.js,docs/dicom.js,
  docs/i18n.js <all files>` → OK, 621 statements verbatim.
- Exact commands: `tools/split-history/phase2c-2d-part1.sh`.
- Build 189 → 190.

### Tool changes
- `extract-module.mjs`: `@line:N` moves a top-level expression statement
  verbatim (refuses if any side-effect statement precedes it);
  `--append` adds to an existing module, merging imports (no duplicates,
  no self-imports) and extending the existing import in the source.
  Generated header no longer claims "no module state".
- `verify-split.mjs`: originals may be a comma-separated list (needed when
  appending to modules that already existed at the base revision).
- `closure.mjs`: `--list` flag parsing fixed.
- Tests for all of the above in `tests/tools/`.

### Findings
- The top-level dependency graph is almost a DAG: 369 SCCs for 382
  declarations; largest cycle is 7 functions (MPR-in-3D plane overlay).
  So feature modules can be extracted bottom-up without import cycles.
- Mistake during this session: resetting only some files mid-way left
  app.js and modules inconsistent; resolved by resetting docs/ fully and
  re-running the recorded script. Lesson: reset the whole working set, and
  delete untracked outputs (extract-module refuses to overwrite them).

### Owner report during review: "some sliders are heavy" (surface smoothing, 3D edit)
- Cause found by the owner: the 3D view was in **GPU volume rendering**
  mode; every slider change re-renders the volume at full resolution.
  189 is also heavy in volume mode ("relatively lighter").
- Side-by-side measurements of main (189) vs this PR (190) in CI, with a
  temporary workflow (removed before merge): Chromium and WebKit (JSC, as
  on iPad), demo loaded, all visible sliders — synchronous handler cost
  < 1 ms in both, frame-bound input timing and drag steps equal within
  noise (x0.84–x1.05, one noisy x1.44 on 2.2→3.2 ms). No JS-side slowdown
  from the module split. GPU rendering cannot be measured in CI (no GPU);
  GPU code is identical, so the perceived difference is most likely
  device variance (thermal/GPU state/test order).
- Notes: GitHub caps annotations at 10 per step (later lines are lost);
  `performance.now()` in WebKit is coarse (sub-ms handlers read as 0).
  `scripts/serve-docs.mjs` now accepts a directory argument (kept).
- Follow-up PR: use the existing fast-interaction (reduced resolution)
  mode while range sliders are dragged in volume mode.

### Next (2d part 2)
- Remaining feature areas in app.js: MPR rendering/caches, 3D scene
  (`start3D` is a single 278-line function), segmentation UI + mesh
  building, filter pipeline UI, analysis/edit/cut tools, iPad workspace
  UI, event wiring (83 top-level side-effect statements stay in app.js).

---

## 2026-09-26 — refactor/state-module (phase 2b)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 2b — move shared mutable state out of app.js.

### What changed
- New `docs/state.js`: all 64 top-level `let`s of app.js as `export let x`,
  each with a setter `setX(v){return x=v}` and, where needed,
  `incX(prefix)` / `decX(prefix)` (`prefix?++x:x++`).
- app.js: reads unchanged (ES module live bindings); the **230 write
  sites** rewritten by `tools/state-codemod.mjs` (208 assignments, 22
  `++`/`--`). Rules: `x=e`→`setX(e)`, `x op= e`→`setX(x op (e))`,
  `x ||= e`→`(x||setX(e))`, `x++`→`incX(false)`, `++x`→`incX(true)`.
- `tools/verify-state-codemod.mjs origin/main docs/app.js docs/app.js
  docs/state.js` → `OK: 64 bindings moved; 230 write sites rewritten per
  rule; all other code identical`. It walks the old and new syntax trees
  in parallel (write sites located with eslint-scope, so shadowing locals
  are excluded) and checks state.js initialisers + helper bodies.
- Tests: `tests/tools/state-codemod.test.js` (sample with shadowing,
  nested/compound/logical/update writes; helper value semantics; verifier
  rejects 4 kinds of tampering). 106 passing.
- Build 188 → 189.

### Why this design
- Imported bindings are read-only, so feature code that writes state could
  not move out of app.js. Live bindings + setters keep ~1200 read sites
  untouched and make the change mechanical and provable, instead of
  rewriting every `volume` into `state.volume`.
- Initialisers are all literals / `[]` / `new Uint32Array(256)`, so
  evaluating them when state.js loads (before app.js's body) is safe.

### Rules going forward
- Write shared state **only via its setter**; ESLint `no-import-assign`
  (in `npm run lint` / CI) rejects direct assignment to imported state.
- New top-level mutable state belongs in `docs/state.js` with a setter.

### Next
- 2c: `docs/ui-shell.js` (template + `app.innerHTML` + DOM element consts).
- 2d: feature modules via `tools/closure.mjs` + `extract-module.mjs`
  (extract-module re-imports state bindings and setters automatically,
  since they are now imports of app.js).

---

## 2026-09-26 — refactor/split-app-js-phase2 (phase 2a)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 2a — GPU shader module, tool fixes, state plan.

### What changed
- `gpuFilterShader(kind)` → `gpuFilterShader(kind, workgroupSize)`: the 20
  `@workgroup_size(${gpuFilterRuntime.workgroupSize})` uses now take the
  parameter; the single caller (`gpuFilterPipeline`) passes
  `gpuFilterRuntime.workgroupSize` at the same moment → identical WGSL.
  This is the only intentional code change (separate commit, `acf8293`).
- Moved verbatim to `docs/gpu-shaders.js`: `gpuFilterShader`,
  `normalizeVrlWgsl`, `GPU_PREWARM_KINDS`. app.js 5439 → 4972 lines.
  verify-split vs `origin/main`: only the 2 functions above differ.
- `medical-volume.js`: `export` added to `volumeShader`, `brickShader`,
  `volumePickShader`, `mprPlaneShader` (test hooks, no behavior change).
- `tests/unit/wgsl-shaders.test.js`: parses all 20 compute shader kinds
  (19 prewarmed + `faceExtract`) and the 4 render shaders with
  `wgsl_reflect` in Node. Catches WGSL syntax/structure errors in CI
  (which has no GPU); does not replace device testing (no type checks).
- Build 187 → 188.

### Tool bug found and fixed (important)
- acorn-walk reports assignment targets / patterns as `VariablePattern`,
  not `Identifier`. `extract-module.mjs`'s false-positive filter and the new
  `closure.mjs` only visited `Identifier`, so code that **only writes** a
  top-level `let` could pass the dependency check. Fixed (visit both);
  regression tests in `tests/tools/extract-module.test.js` (run in CI).
- Impact on already-merged work: none. Phase-1 moved only pure code, and a
  missed write would be an undeclared assignment, which the `no-undef`
  lint (clean) would have reported.
- New `tools/closure.mjs <file> <seeds…> [--list]`: computes how far a
  cluster can move and which `let`s / DOM-element consts block it.

### Findings for phase 2b/2c
- 64 top-level `let`s, ~1459 references. Most are read far more than
  written: `sceneState` 301 refs / 1 assignment, `volume` 255 / 17,
  `sourceVolume` 108 / 2, `currentLanguage` 77 / 1.
- DOM element consts (`status`, `footer`, `viewport`, …) are declared in
  app.js lines ~236–242, right after `app.innerHTML = <template>` (line
  ~43). The template has no external interpolations.

### Plan (next PRs)
- **2b state module**: move all `let`s to `docs/state.js` as
  `export let x`, plus generated setters (`setX(v){return x=v}`, and
  inc/dec helpers preserving postfix/prefix values). Reads stay unchanged
  (ES module live bindings); only the ~250 write sites change, via an AST
  codemod (not by hand). Verify: lint, tests, demo E2E, device preview.
- **2c UI shell**: move `$`, the template + `app.innerHTML`, and the DOM
  element consts to `docs/ui-shell.js` (evaluated before app.js's body, so
  the DOM exists when other modules import the elements).
- **2d features**: with state + UI importable, use `closure.mjs` /
  `extract-module.mjs` to move feature areas (GPU compute runtime, MPR,
  3D scene, segmentation UI, filters, analysis/edit tools).

---

## 2026-09-26 — refactor/split-app-js-phase1 (redone on 184.10)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 1 — split `docs/app.js` into modules, starting
with the parts that hold no application state.

The first attempt was based on the mistakenly promoted build 185 (see the
INCIDENT entry below). The branch was reset onto the restored 184.10 `main`
and the split re-run with the same tools; the 185-based attempt is kept on
local-only ref `old/phase1-on-185` (not needed).

### What changed
- New modules (code moved **verbatim**, only `export` added):
  `docs/utils.js`, `docs/i18n.js`, `docs/dicom.js`, `docs/mask-ops.js`,
  `docs/run-length.js`, `docs/mesh-geometry.js`. `docs/app.js`
  6216 → 5439 lines; 92 top-level declarations moved (incl.
  `componentsFromRunsAsync`, new in 184.x).
- `tools/verify-split.mjs origin/main docs/app.js <all modules>` →
  `OK: 768 top-level statements moved/kept verbatim` — i.e. everything
  from 184.1–184.10 is present unchanged.
- Build **184 (184.10) → 187**. 185 = abandoned preview, 186 = withdrawn
  first version of this PR's preview; skipped to avoid browser-cache mixups.
- Tooling (in `tools/`, dev-only, not deployed):
  - `analyze-toplevel.mjs` — lists top-level declarations, which are
    mutable and which are "pure". Heuristic; stateful consts such as
    `filterState`, `segmentState`, `mprPaintCache` can be mis-reported.
  - `extract-module.mjs` — moves named declarations to a new module and
    inserts the import. Aborts if moved code depends on anything that stays
    behind (no import cycles), if a name is `let`/`var`, or reassigned.
  - `verify-split.mjs` — proves a split only moved code (ignores the
    APP_VERSION/APP_BUILD values).
  - `bump-build.mjs` (`npm run bump-build [N]`) — updates APP_VERSION /
    APP_BUILD, version.json and every `?v=` tag (incl. free-form suffixes).
- Guardrails: `eslint.config.js` (`npm run lint`, `no-undef` etc.), clean
  on 184.10 before and after; in CI. Build-consistency test covers every
  relative import in every module.
- Tests: 62 passing (+1 todo). Unit tests for dicom (synthetic DICOM
  writer in `tests/helpers/synthetic-dicom.js`), mask-ops, run-length,
  mesh-geometry (binary STL), utils.
- CI: public Zenodo demo E2E runs on every PR; Playwright `github`
  reporter; actions bumped to v7.

### Findings
- `groupSeries` sorts slices by ImagePositionPatient z only and ignores
  ImageOrientationPatient → non-axial acquisitions may be ordered wrongly
  (`it.todo` in tests/unit/dicom.test.js; PLAN "slice ordering").
- CI has no GPU (WebGL + CPU fallback). WebGPU paths are only verified on
  the owner's device via the PR preview URL.
- Agents without `Actions: Read` can read failures through check-run
  annotations: `GET /repos/{repo}/check-runs/{job_id}/annotations`.

### Follow-up (phase 2 plan)
- `gpuFilterShader` (~465 lines of WGSL) depends on `gpuFilterRuntime`;
  pass needed values as parameters, then move to `docs/gpu-shaders.js`.
- Explicit state module for the ~63 reassigned `let`s (volume,
  sourceVolume, sceneState, …) as properties of an exported object, per
  feature area.
- Then split by feature: MPR, 3D scene/renderer, segmentation UI, filter
  pipeline, analysis/edit tools, UI construction.

---

## 2026-09-26 — fix/restore-build-184-10 (INCIDENT)

**Agent:** Claude (via claude.ai)
**Task:** Restore production to the owner's real latest build.

### What went wrong
- In `chore/cleanup-previews-promote-185` the agent promoted
  `docs/preview-185` to production because it had the **highest folder
  number**. The repo had been cloned with `--depth 1`, so history was not
  checked. In fact `preview-185` stopped at 15:47 (2026-09-25 JST), while
  the owner kept iterating `preview-184` as 184.1 … **184.10** until 17:02
  (commit `a776076` "Mark preview 184.10", the tip of `main` at the time).
- Result: production (and the PR #14 refactor, which was based on it) lost
  184.1–184.10: 3D region selection, enclosed-structure / containment-based
  region deletion fixes, GPU edit-mask alignment (texture space), analysis
  spinner, live cut sliders, grouped cut-confirmation UI, split-view resize
  fixes. 184.1 had already absorbed 185's "explicit volume result" work,
  so 184.10 is a superset of 185 in behavior.
- The owner noticed on the device preview.

### What changed
- `docs/{app.js,index.html,medical-volume.js,style.css,version.json}`
  restored byte-for-byte from `archive/previews:docs/preview-184/`
  (build 184, version `2026.09.25-184.10`), except `export` re-added to
  `volumeTexturePlan` in medical-volume.js (unit-test hook, no behavior
  change). 185-only CSS (`.analysis-result-*`) is gone; 184.10 does not
  use it.
- `tests/static/build-consistency.test.js` relaxed to the owner's real
  conventions: APP_VERSION may end in `-<build>.<iteration>`; cache tags
  are `?v=YYYYMMDD-build<build>` plus an optional free-form suffix
  (e.g. `-groupedcut1`), and may differ per file. The strict version would
  have rejected the owner's own verified build.

### Lessons (rules for agents)
- **Always `git fetch --unshallow` (or clone without `--depth`) before
  making decisions from history.**
- "Latest" = most recent commit / the tip of `main`'s `APP_VERSION`, never
  the highest folder or build number. Check `git log -- <path>` dates.
- When promoting or replacing deployed code, diff feature sets against the
  current tip and ask the owner if anything disappears.
- Tests encoding conventions must be derived from the owner's actual
  practice, not assumed.

---

## 2026-09-26 — ci/pages-previews

**Agent:** Claude (via claude.ai)
**Task:** Restore the owner's device-testing workflow without committing
preview folders to `main`.

### Context (important for all agents)
- The owner has **no local development environment**. The
  `docs/preview-NNN/` folders (archived in the first cleanup) were how each
  build was tested on a real device (iPad/Mac, WebGPU) through GitHub
  Pages. Removing them without a replacement removed the only way to test.
  Do not propose local checks (`npm run serve`) as the owner's
  verification step; use PR preview URLs.

### What changed
- `.github/workflows/pages.yml`:
  - push to `main` → `docs/` deployed to the root of the `gh-pages`
    branch (JamesIves/github-pages-deploy-action, `clean-exclude:
    pr-preview/`, `force: false`).
  - same-repo PRs → `docs/` deployed to `gh-pages:/pr-preview/pr-<N>/`
    (rossjrw/pr-preview-action), link posted as a sticky PR comment,
    preview removed when the PR is closed/merged.
- One-time owner action (agent PAT has no Pages permission): Settings →
  Pages → Source "Deploy from a branch", branch `gh-pages`, `/ (root)`.
  Previously `main` + `/docs`.
- The app only uses relative URLs (`./app.js`, `./version.json`, …), so it
  works unchanged under the preview subpath; `ensureLatestDeployedBuild`
  compares against the preview's own `version.json`.

### Follow-up / open questions
- Previews share the production origin, so browser storage/caches (e.g.
  the demo cache `virtual-rodent-demo-v2`) are shared with production.
  Harmless today; keep in mind if storage formats change.
- `gh-pages` history grows with each deploy; it can be reset as an orphan
  branch occasionally without affecting `main`.

---

## 2026-09-26 — test/setup-infra

**Agent:** Claude (via claude.ai)
**Task:** Priority #2 — set up test infrastructure and GitHub Actions CI.

### What changed
- Three test layers:
  1. **Static checks** (`tests/static/`, Vitest): `node --check` on every
     `docs/*.js`, and a build-marker consistency test (APP_BUILD /
     APP_VERSION in `docs/app.js`, `docs/version.json`, the `?v=...-buildNNN`
     cache-busting queries in `docs/index.html`, and the medical-volume.js
     import tag must all agree).
  2. **Unit tests** (`tests/unit/`, Vitest): `volumeTexturePlan` from
     `docs/medical-volume.js`. The only production-code change in this
     branch is adding `export` to that function (no behavior change).
  3. **Browser smoke tests** (`tests/e2e/`, Playwright/Chromium): app boots
     with no uncaught page errors, main controls render, version badge
     shows the build from version.json with no `?build=` reload, and the
     JA/EN toggle works. `demo.spec.js` downloads the Zenodo demo and only
     runs with `RUN_DEMO_E2E=1` (Actions: "Run workflow" → run_demo).
- `vitest.config.js` aliases the exact CDN import URLs to the same pinned
  npm packages (three 0.186.0, dicom-parser 1.8.21, fflate 0.8.2), so app
  modules can be imported in Node without network. Versions are pinned
  exactly in package.json; **if a CDN URL version changes, update the
  alias and package.json together.**
- `scripts/serve-docs.mjs`: zero-dependency static server for `docs/`
  (mimics GitHub Pages). Used by Playwright; also `npm run serve`.
- `.github/workflows/ci.yml`: runs on push to main, PRs, and manually.
  Job `unit` → job `e2e` (uploads Playwright report on failure).
- npm scripts: `test`, `test:watch`, `test:e2e`, `test:e2e:demo`, `serve`.

### Why
- The build-marker test targets a real failure mode of this repo:
  `ensureLatestDeployedBuild()` force-reloads when markers disagree, and
  markers were being hand-edited per preview build.
- `docs/app.js` has top-level DOM side effects, so it cannot be imported in
  Node yet. Real unit coverage of DICOM parsing, segmentation, filters etc.
  becomes possible after priority #3 (module split); extract pure logic
  into importable modules and add tests there as part of that work.
- E2E runs against the real CDN imports (as deployed), so CDN/module-graph
  breakage is caught.

### Notes for agents pushing from outside a local checkout
- A fine-grained PAT needs **Contents: RW**, **Pull requests: RW**, and
  **Workflows: RW** (pushes touching `.github/workflows/` are rejected
  without it). Reading Actions job logs via the API additionally needs
  **Actions: Read**; without it, `/actions/jobs/{id}/logs` returns 403, but
  run/job/step status is still readable.
- CI triggers on push to `main`, on PRs, and manually. Pushing a feature
  branch alone does not run CI — open a PR.
- First CI run on PR #13: both jobs green (smoke tests step ~7 s).

### Follow-up / open questions
- Headless CI has no GPU; WebGPU paths are not exercised, only boot and
  (with swiftshader) potentially WebGL. GPU correctness still needs manual
  testing on real devices.
- Candidate next tests after the split: DICOM header parsing / series
  grouping with synthetic DICOM files, RescaleSlope/Intercept calibration,
  slice ordering, STL export geometry, filter kernels on tiny volumes.

---

## 2026-09-26 — chore/cleanup-previews-promote-185

**Agent:** Claude (Sonnet, via claude.ai)
**Task:** Repository cleanup (priority #1 from planning discussion) — retire
committed preview snapshots and promote the newest preview to be the
canonical `docs/` build.

### What changed
- Created branch `archive/previews`, pointing at the pre-cleanup `main`
  commit (`a776076`), before any deletion. This branch is the permanent
  archive of `docs/preview-137` through `docs/preview-185` (49 snapshot
  directories, ~25 MB) and the previously-deployed build 172. Nothing was
  deleted from git history — `archive/previews` and `main`'s prior history
  both still contain the full previous state.
- Discovered that `docs/preview-185` was actually *ahead* of the live
  `docs/app.js` (build 172 on `main` vs. build 185 in the newest preview).
  Per instruction, promoted build 185 to be the canonical build:
  - `docs/preview-185/{app.js,style.css,medical-volume.js,index.html}` →
    copied over the corresponding `docs/` files.
  - `docs/version.json` updated to `{"build": "185", "version":
    "2026.09.25-185"}`.
- Removed all 49 `docs/preview-*` directories from the working tree
  (`git rm -r`), since they are preserved on `archive/previews`.
- Added this file (`docs/AGENT_LOG.md`) to establish the work-log
  convention going forward.

### Why
- The repo owner asked to "evacuate" (退避) rather than destroy the preview
  history — a branch preserves it without rewriting git history (no force
  push, no broken clones/forks) while getting the dead weight off `main`.
- Promoting build 185 rather than keeping build 172 was an explicit
  instruction after we found 185 was newer and internally self-consistent
  (its own `index.html`/`app.js` cache-busting query strings already matched
  each other at `build185`).

### Follow-up / open questions
- Root-level `index.html` (project root, used for local `vite` dev) points
  to `/docs/style.css` and `/docs/app.js` with **no cache-busting query
  string**, unlike `docs/index.html` which pins
  `?v=20260925-build185`. This was pre-existing and left as-is, but worth
  deciding whether local dev should also cache-bust.
- Did not diff build 172 → 185 line-by-line for behavior changes; worth a
  quick read-through before assuming build 185 is safe, since the repo
  owner may not have manually reviewed every incremental preview either.
- Next priorities per the ranking discussion: (1) this cleanup — done, then
  (2) test infrastructure, (3) splitting `docs/app.js` into modules,
  (4) feature work from `IMPLEMENTATION_PLAN.md`'s "Next priorities".

## Build 272 — 3D volume resolution selector on desktop too

Owner: the Mac has more memory but its GPU is no faster than the iPad Air, so
full-size 3D was sluggish. The iPad 512/768 selector now shows on desktop as
"GPU" with 512 (default) / 768 / Full; Full is desktop-only. iPhone unchanged.
Not verified on a device yet.

## Build 273 — full GPU status bar

The green top chip truncates; a bar above the footer now shows the full
Render/Compute/adapter text (and the last GPU error). Top chip unchanged.

## Build 274 — top GPU chip hidden

Owner: the bar above the footer replaces it. #gpu-status stays in the DOM
(hidden) as the text source; the renderer-error path also writes the bar.

## Build 275 — zero-size texture error (owner: status showed "GPU FAIL · uncaptured: createTexture ... size is zero")

Not a compute kernel (no shader kind in the message; medical-volume textures
are inside error scopes). Only unguarded path found: set3DInteraction setSize
with the hidden 3D viewport (0x0 in 2D mode) -> guarded like resize(). Cause
not proven, so createTexture is wrapped to record label/size/caller of any
zero-size request; it is appended to the error in the status bar.

## Build 276 — 3D pixel budget

Owner: Mac 3D slow even with one segment when zoomed in; iPad fine (36 ms).
Volume ray casting cost ~ pixels covered. Desktop used ratios 0.9/0.7/0.52
(touch 0.72/0.58/0.46) on a larger window. Now the same ratios everywhere and
a budget: 0.45/0.32/0.22 MP while dragging, 1.8 MP at rest. iPad sizes are
below the budget, so unchanged there. Mac memory reload: cause unknown.

## Build 277 — 3D frame time always in the status bar

Owner noticed the GPU draw time was not shown: the ?debug footer text only
updated on opacity/slice changes. The GPU frame time (onSubmittedWorkDone),
fps and ray-cast canvas size now show in the bottom bar after each frame
(max 4/s), without ?debug; cleared when the volume view is off.

## Build 278 — iPad-sized 3D budget

Mac M1 at rest 1516x813 = 137 ms; iPad M2 8 ms. Owner: make it the same as
the iPad. Budgets now 0.25/0.18/0.12 MP dragging, 1.0 MP at rest (estimated
iPad Air 3D view size; confirm with the iPad status-bar size).

## Build 279 — 3D frame diagnostics

Mac: 640x343 took 207 ms (1516x813: 137 ms), so the time is not pixel-bound.
Status bar now splits: 3D = volume pass after earlier queued GPU work,
待ち = GPU work queued before the frame, three = three.js render() CPU time,
間隔 = time between volume frames (real fps).

## Build 280 — settings dialog

⚙ 設定 in the top bar opens a tabbed dialog (描画 / デバッグ; add a tab button
+ panel in ui-shell.js to extend). Stored per device in localStorage
(vrl.settings.v1, docs/app-settings.js; docs/settings.js is an unrelated
older module). 描画: 3D resolution (moved from the toolbar chip), quality while
dragging / at rest (pixel budgets), ray step, frame-time display. デバッグ:
same as ?debug, switchable without reload (the *_DEBUG flags are functions).

## Build 281 — area-averaged reduced 3D texture

Owner: switching 3D resolution from 512 looked jagged ("not smoothed").
The reduced texture picked one source voxel per texel (nearest); 1024->768
picks an irregular 1,1,2 pattern. Now each texel is the in-plane area average
of its source footprint (z still picks slices). Cache key gains "-avg" so old
nearest-picked caches are not reused. Not verified on a device.

## Build 282 — trilinear sampling for the full-size volume

Owner: Full looked jagged. huAt used textureSampleLevel (linear) only when
textureDims.w=1, which was set for reduced textures; full size used
textureLoad (nearest). Now always 1. rg8 lo/hi bytes interpolate linearly, so
the combined u16 is the trilinear value.

## Build 283 — interpolation setting

Settings > 描画 > 補間: なし (nearest) / 線形 (default) / なめらか / よりなめらか.
Passed as textureDims.w; 2/3 also widen the gradient difference to 2/3
voxels for smoother shading of voxel steps.

## Build 284 — per-filter GPU timing (diagnostics)

With debug on, the segment status lists f:<filter> GPU time per stage
(median, gaussian, bilateral, nlm, anisotropic, tv, sigmoid, spikeHole,
unsharp) to pick which filters to optimise. Reads per voxel from the
shaders: nlm (2s+1)^3*(2p+1)^3, bilateral up to 7^3, median 27 + sort.

## Build 285 — timings for the 3D rebuild too

Owner asked where the timings are: they were only in the segment status. With
debug on, the footer now shows "3D再構築 Ns · [read, f:<filter> ...]" after a
filtered GPU volume rebuild (not on a cache hit).

## Build 286 — fused gaussian

Owner measurement (build 285, Mac, gaussian 0.60 x4, full volume): 3D rebuild
88.4 s = f:gaussian 63.8 s, read 58.0 s, upload 5.1 s (read and GPU overlap).
Gaussian ran passes x 3 axes = 12 full-block dispatches. Now one (2n+1)-tap
pass per axis (gaussianK, weights from gaussianPassKernel = the 3-tap kernel
convolved n times): 3 dispatches. Same result except within n voxels of the
volume edge (clamp once instead of per pass). Read is the next target.

## Build 287 — readable status lines

Owner could not find the timing line (11px grey footer text). The footer
message is now a second bar under the GPU bar: 12px, light text, bordered, wraps.

## Build 288 — filter cards fit the side panel

Owner: filter UI was cut off (title wrapped, type select and sliders clipped).
Title on its own row, reorder/remove buttons + type select below, sliders
shrink to the card width.

## Build 289 — bigger filtered GPU-volume blocks

Build 288 measurement: 3D rebuild 75.5 s = read 53.4, f:gaussian 50.3,
upload 4.8. The rebuild used 8-slice blocks in 384x128 tiles, so gaussian x4
read 16 slices per 8 kept and ran 24 tiles per block. Blocks are now whole
slices, as deep as volumeBlockBudget() allows (desktop 256 MB, iPad 64 MB,
capped by maxStorageBufferBindingSize): 1024x1024 -> ~55 core slices on a Mac,
8 (untiled) on iPad. Not verified on a device.

## Build 290 — region STL uses the segment surface settings

Owner: the region STL was raw voxel faces, unlike the screen. Region export
now builds its mesh with buildEditableRunsGroup (the segment surface path:
surface smoothing / smooth isosurface when feasible), ignoring the segment cut
faces, only for the export (disposed after, nothing added to the scene).
Not verified on a device.

## Build 291 — 3D rebuild errors visible

Owner: build 289 showed a broken volume; footer still said "Full-resolution
filters", so the rebuild never reported. refreshGpuVolumeData now shows start
("3D再構築中…"), superseded restarts, errors (volume partly updated) and a
GPU filter -> CPU fallback in the status bar. Diagnostics only.

## Build 292 — 2D dispatch for extract / mesh passes

Build 291 showed the cause: "x(229376) > dimensionMax(65535)". The filter
result extract pass (and the mesh count/corner/write passes) dispatched
workgroups in 1D; with ~56-slice 1024x1024 blocks that is 229376 groups. They
now use gpuDispatch1D like the filter passes (shaders already get the gid
rewrite). Static test forbids raw size-dependent dispatches in gpu-compute.js.

## Build 293 — read breakdown (diagnostics)

Debug timings now split read into read:file (File.slice().arrayBuffer),
read:decode (u16 -> HU float loop), read:yield (frameYield every 2 slices)
and count slice-cache hits/misses, in the 3D rebuild line and the segment
status. Build 292 baseline: 3D rebuild 54.0 s, read 28.9 s.

## Build 294 — faster source reads

Build 293 on the Mac: 3D rebuild 40.1 s; read 26.6 s = file 8.7, decode 6.9,
yield 7.0; gaussian 20.9; slice cache miss 2070 (1784 slices). Changes:
readSourceRegion reads 4 slices ahead in parallel, copies whole-width boxes
straight from the cached slice, and yields by time (30 ms) instead of every 2
slices; decodeSourceSlice uses a Uint16/Int16Array view for little-endian
16-bit data (test: equal to the DataView path); concurrent misses share one
decode. Not measured on a device yet.

## Build 295 — no swap: 96 MB filtered blocks

Owner (Mac, 3D 512): the filtered 3D rebuild swapped heavily, disk nearly
full. Swap is not acceptable. 256 MB blocks keep the block, two GPU buffers,
the readback and copies alive at once (unified memory). volumeBlockBudget is
now 96 MB on every device (~15 kept 1024x1024 slices, untiled). Build 294:
41.8 s, read 12.4, gaussian 23.5. Check for swap in Activity Monitor.

## Build 296 — cache management

Owner: the GPU volume cache grew (one entry per filter setting). Settings >
キャッシュ: (1) auto-prune on by default: storing a filtered volume removes
entries of the same dataset + 3D resolution with another filter; segment
results likewise per dataset (main segment runs only); (2) list of entries with
per-entry delete and clear-all; (3) limit auto (old rule, up to 4 GB) or
0.5/1/2/4 GB. Entries from older builds carry no dataset info, so only the
list / LRU removes them.

## Build 297 — trim cache to the new limit

Owner: changing the limit did not remove anything. Lowering it now asks to
delete least recently used entries over the limit; a "上限に合わせて整理"
button does the same on demand.

## Build 298 — resize diagnostics + "lower resolution while dragging" switch

Owner: swap jumps when zooming/dragging the 3D view. Each interaction tier
change (and wheel zoom changes the tier) resizes the volume canvas and the
three.js canvas, reallocating their buffers. Status bar now shows
"resize volume/three" counts; settings 描画 has 操作中に解像度を下げる (default
on). Off = no resizes during drags (slower drags) - a test to confirm the cause.

## Build 300 — fixed-size 3D canvases while dragging

Build 299 (memory limit) reverted: it capped caches unrelated to the swap
the owner sees while dragging/zooming the 3D view. The volume canvas now
keeps its at-rest size; drags render into cached lower-resolution textures
(one per drag size, dropped when the canvas size changes) that are scaled
onto it. In the volume view the three.js canvas no longer changes pixel ratio
during drags. Status bar: "resize volume/three" and "drag targets" counts.

## Build 301 — status lines no longer resize the 3D view

Build 300 on the Mac: resize 98/0, drag targets 37, 3 fps while dragging,
swap still grew, page ~5-6 GB. The canvas size kept changing because the two
status lines (updated 4x/s) wrapped to different heights and the 3D view
filled the rest. Both lines now have a fixed 2-line height and scroll.

## Build 302 — no forced canvas reset on drag start/stop

Build 301: still resize 43, drag targets 23, 3 fps (GPU 9 ms, interval 344 ms),
page 5.1 GB. setInteractive() called resize(true), which re-assigned the canvas
size (a full canvas reset and a drop of the drag targets) on every drag
start/stop and tier change. It now resizes only when the size changes.

## Build 303 — memory ledger (diagnostics)

Build 302: drag resizes gone (resize 1/0, 3 drag targets, 4 ms interval), but
the page still holds ~4.75 GB and swap rose a little at one peak. With debug
on, the status bar lists every 2 s: GPU textures/buffers created on the shared
device (live bytes, top labels; destroy() and GC subtract) and the app caches
(slice, orthogonal, filter, preview, GPU pool, in-memory MPR arrays).

## Build 304 — no 3.5 GB sagittal copy on desktops

Memory ledger (build 303, Mac): after load the page held 2.78 GB; during the
filtered rebuild 6.22 GB with "mpr 3568MB". buildMpr3DPreview allocated a full
Uint16 sagittal copy (w*h*d*2) with no limit when maxTouchPoints===0 (iPad: <=1
GB only). Desktop limit is now 512 MB (iPad unchanged); larger data uses the
orthogonal plane cache for sagittal planes like iPad.

## Build 305 — filtered 3D rebuild: next block in flight

Build 304: 3D rebuild 32.5 s (gaussian 18.6, read 11.0), page ~1.5 GB, no swap.
filteredSourceSliceProvider now starts block N+1 when block N is requested, so
its reads overlap block N filtering/upload. At most two blocks in flight (about
2 x the 96 MB block budget plus GPU buffers). Watch swap when measuring.

## Build 306 — rebuild status when debug is off

iPad (debug off): the footer stayed at "3D再構築中…" after the rebuild finished;
only the debug branch replaced it. Now "3D再構築 完了 Ns" always (the cache-hit
path already shows its own message).

## Build 307 — rebuild time breakdown (diagnostics)

Build 305 Mac: 24.6 s (gaussian 15.2 with per-stage sync, read 10.3). Debug
per-stage GPU syncs now need ?stagetimes (they serialise the GPU). New
timings: gpu:wait (mapAsync = all GPU work of a block incl. upload), gpu:copy
(result back to JS), block:copy, tex:wait (upload loop waiting for a block),
tex:pack, tex:reduce (512/768 area average); count "filter blocks".

## Build 308 — one filtering pass for the 3D volume and its C/S preview

Build 307 Mac: 25.8 s, gpu:wait 26.1 s, filter blocks 1564 (expected ~120):
the filtered 3D C/S preview filtered the whole volume again (4-slice blocks,
384x128 tiles) in parallel with the GPU volume rebuild. refreshGpuVolumeData now
opens a shared preview (beginSharedMpr3DPreview) fed by the rebuild blocks;
ensureMpr3DPreviewCache waits for it instead of filtering. A cache hit (no
blocks) falls back to the old preview path.

## Build 309 — more parallel slice reads

Build 308 Mac: read 9.9 s (file 21.8 s summed over 4 parallel reads, decode
2.3, yield 1.6). Read-ahead 4 -> 8 slices (?ahead=N to try 1-32), UI yield
every 60 ms instead of 30 ms.

## Build 310 — read-ahead back to 4

Same build 309, Mac: ahead=4 20.6 s (read 8.3), ahead=8 23.3 s (read 7.3 but
longer overall). Default back to 4; the 60 ms UI yield stays (23.1 -> 20.6 s).

## Build 311 — GPU packing/reduction for the filtered 512/768 volume

Build 310 Mac (filtered, 512): 20.6 s incl. gpu:copy 3.1, block:copy 0.6,
tex:pack 1.8, tex:reduce 2.2 (7.5 GB of float blocks read back). With a
reduced plan the filter pass now also runs packReduce (area average + CT->u16 +
rg8 packing, rows padded to 256 B) and reads back only the packed texture
slices (~0.45 GB total) plus full-res float planes for the z the 3D C/S
preview needs (option B: preview detail unchanged). Upload waits every 64
instead of 16 slices. Full resolution keeps the float path; CPU fallback keeps
the old path. Small rounding differences vs the CPU path (average before vs
after u16 rounding, <=0.5 raw). Not measured on a device yet.

## Build 312 — segment processing reads the next block ahead

Mac, fat + air boundary, no filter: 20 s = read 6.7, gpu distance 7.2, sort
1.6, filters 1.6, upload 1.2 - all sequential per block. sourceSegmentRunBlockGpu
now starts reading the next block (same box rules) before this block goes to
the GPU (one block ahead, ~150 MB).

## Build 313 — pruned airDist

gpu distance was 7.2 s (Mac, fat + air boundary). airDist now visits offsets
by increasing |k| and stops once (k*s)^2 >= g (all later terms are >= that),
so air voxels read 1 value and voxels near air a few, instead of 2n+1 per axis.
Applies to the thin-part opening passes too. Unit test: pruned == full scan.

## Build 315 — per-axis airDist timing (diagnostics)

With ?debug&stagetimes the segment status shows pre-dist (work queued before
the distance passes) and dist:x/y/z(n=..) GPU times, to decide how to speed up
the remaining 5.7 s of gpu distance.

## Build 316 — airDist x pass through workgroup memory

Owner measurement (build 315, Mac): dist:x(n=8) 3.8 s, dist:y 1.1 s, dist:z 0.9 s.
The x pass never hits the early break for body voxels with no air within n,
so each read 2n+1 storage values. New kernel 'airDistX' loads the workgroup's
span [base-n, base+WG+n) into shared memory once and scans it; same result
(JS mirror test vs the untiled pass, modes 0/1/2, unaligned widths). Used for
axis 0 when n <= 64, otherwise the old kernel.

## Build 317 — diagnostics: first-write cost before the x pass

Build 316 (tiled x pass) moved dist:x only 3.8 → 3.6 s, so storage reads were
not the cost. With ?debug&stagetimes the output buffer is now cleared first and
timed as 'dist:touch', to tell a first-write cost of that buffer apart from the
x pass itself.

## Build 318 — keep the block work buffers between segment blocks

Build 317: dist:touch 2.2 s (a clear of the output buffer), x then 2.9 s. A
1024²×38 block lands in the 256 MB bucket, above half the Mac pool limit, so
both work buffers were destroyed and re-created every block and WebGPU
zero-filled each new buffer on first use. thresholdSourceRuns now wraps its
block loop in begin/endGpuBufferRetention: released work buffers stay pooled
(max 2 per size) until the loop ends, then the pool is trimmed back to its
limit. Peak memory is unchanged (the buffers exist during each block anyway).

## Record: builds 319–329 (closed PRs #67 and #68, not merged)

Disk cache of the slice bytes (PR #67, builds 319–326) — dropped by the owner
- Read test (Mac, 1024×1024×1784, 2 MB slices): 1-byte file read 3.1 ms;
  1 read in flight 428 MB/s, 4: 352, 8: 219, 16: 108; 4 Web Workers 254 MB/s.
  In the real segment run the read-ahead of 4 is fastest (ahead=1 26 s,
  2 20 s, 4 14–16 s), so it stays 4.
- A raw slice cache in IndexedDB (builds 320–325) made opening slower and the
  2D slice slider laggy, and never showed a speed-up; it was reverted.
  Container Chromium: IDB/OPFS reads were not clearly cheaper than file reads.
- Owner's decision: the OS/browser file cache covers repeated reads (2nd run
  read 15 s -> 7 s); a disk cache only for data larger than the browser can hold.
- Lessons: never put chunked cache reads on the random 2D path; nothing may run
  in the background while data loads; the owner's cache limit is 2 GB.

Other filters (PR #68, builds 327–329) — no gain, closed
- NLM centre patch read once: bit-identical, but on the Mac main 24.9 s /
  f:nlm 15.9 s vs 26.6 s / 17.6 s (no gain).
- NLM workgroup-memory tile kernel: bit-identical, 3× slower on the Mac
  (f:nlm(tile) 57.3 s).
- Bilateral spatial-weight table: bit-identical, not faster on SwiftShader.
- Median/sigmoid/spike/anisotropic/TV are 7-point stencils; unsharp and
  gaussian were optimised earlier. No exact speed-up left.
- SwiftShader WebGPU works in this container (localhost page, flags
  --enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader
  --use-webgpu-adapter=swiftshader): good for bit-exact shader checks, not
  for timing (workgroup memory is emulated on the CPU).

Held (owner): read-only prefetch to lower the 3D rebuild memory peak (~3.5 GB).

## Build 331 — no per-OS branches: every desktop behaves like the Mac

Owner: Windows must behave like the Mac/iPad, without model detection, and
nothing that works on the Mac/iPad may change. isDesktopMac() (Mac + no touch)
is replaced by isDesktopRuntime() (no touch, not iPhone): Windows and Linux now
get the Mac's budgets (GPU buffer pool 256 MB, mesh blocks/tiles, source tiles,
filter tiles, resident surface draws, sagittal MPR copy) and the workspace UI
(default everywhere but the iPhone; ?ui=classic still works). For a Mac or an
iPad every branch evaluates exactly as before. Touch devices keep the touch
budgets. PR #70 (a non-Apple texture cap) was closed: it was a model branch and
Full is an explicit heavy option, 512 is the default.
Local e2e cannot boot the app in this container (main fails the same tests);
CI runs them.

## Build 333 — build 332 reverted (RENDER_ATTACHMENT did not help)

Owner (Windows, build 332): Full still fails with the same Dawn staging error;
512/768 work. The extra texture usage is removed again so the Mac/iPad texture
is exactly as before. Remaining options: split the volume texture along z into
parts that each fit maxBufferSize (one shader path for all devices), or keep
Full unavailable where it does not fit.

## Build 334 — test: RENDER_ATTACHMENT on the volume texture again

Dawn d3d12/TextureD3D12.cpp ClearTexture: a color texture without
D3D12_RESOURCE_FLAG_ALLOW_RENDER_TARGET is lazy-cleared by uploading a
zero-filled buffer the size of the whole subresource through the
DynamicUploader (3.74 GB for Full here -> over the 2 GB maxBufferSize); with
RenderAttachment usage it is cleared with ClearRenderTargetView instead. So
build 332's change should avoid the staging buffer; its Windows test may have
run a stale page. Re-deployed as build 334 for a check with the build number
visible. Owner's Chrome: 154.0.8037.58 Stable (Windows).
(aa55710 was pushed with cherry-pick conflict markers; fixed in the next commit.)

## Build 334+ — VR feasibility page (docs/xr/index.html; open as /xr/)

Owner: target Meta Quest 3 / 3S; wants to "hold" the current 3D view in VR
(volume preferred, to be decided on the device). Standalone page, no app code:
reports WebGPU + limits, WebXR immersive-vr/ar, XRGPUBinding (WebGPU inside
WebXR) and XRWebGLLayer, and two buttons that open a 5 s VR session clearing
the view with WebGL2 or with WebGPU (XRGPUBinding projection layer) and report
the frame rate. Result decides: WebGPU renderer straight into VR, or a WebGL2
volume path for VR only.
Also noted: on dual-GPU Windows laptops Chrome uses the integrated GPU
(powerPreference is ignored); set Chrome to "High performance" in Windows
Settings > System > Display > Graphics (chrome://flags may be blocked by policy).
Owner's RTX laptop: Full 28 ms after the switch (Intel: 202 ms).

Result (owner, borrowed Meta Quest, /xr/ page): no XRGPUBinding (WebGPU cannot
draw into VR there); the WebGL2 VR session ran at 90 fps. -> a VR mode needs its
own WebGL2 renderer (volume raycast in WebGL2 + XRWebGLLayer), fed by the same
data as the WebGPU view.

## Build 335 — practice dataset on the site + button

Owner uploaded a practice DICOM series to docs/demo/sample1/ (branch demo-data,
merged here): Rigaku R_mCT2, 512 × 512 × 512 slices, 0.148 mm isotropic,
16-bit uncompressed, 259 MB. Header check: PatientName "Sample", ID "1", no
institution/physician/operator/serial. index.json lists the 512 files.
New button 練習データ（512³） (all devices) runs loadSampleDemo(): same-origin
fetch of index.json and the slices (6 in flight), then the usual inspect()
path. For the Quest: no URL typing or folder picker needed. The container
cannot boot the app (esm.sh / jsDelivr blocked), so only index.json and a
slice were fetched locally; the button needs a device check.

## Build 336 — VR prototype (WebXR + WebGL2)

New module docs/vr-view.js and button VRで見る (shown only when
navigator.xr supports immersive-vr). WebGL2 because Quest has no XRGPUBinding
(build 335 check: WebGL2 + XRWebGLLayer reached 90 fps). VR-specific: the
three.js WebGLRenderer with renderer.xr, a GLSL3 port of volumeShader()
(same segment test, 6-step hit refinement, gradient normal, shading
constants, background), CPU brick min/max (8³) for empty-space skipping,
controller grab (grip or trigger: move/rotate; both hands: scale) and an fps
panel. Shared with the other platforms: gpuVolumeTarget() (filters applied
when the 3D view has them), volumeTexturePlan (512 per side), reduceSliceArea,
packedRgSlice (now exported) / packCtSlice, segmentState (read every frame).
Not shown yet: processed edits, cuts, section view, MPR planes.
Checked in the container: lint, unit tests, boot-check, and the shader
compiled and drew a lit volume in headless Chromium WebGL2. Needs a Quest test.

## Build 337 — VR menu, background, speed settings (diagnostic)

Owner, build 336 on Quest: the volume shows, 20–25 fps (risk of motion
sickness); wants a background and UI. Not guessing the bottleneck: the menu
switches the likely levers and shows fps for each, so the owner can report
which one matters. Settings: detail (ray step ×1 / ×1.5 / ×2), foveation
(off / mid / high, renderer.xr.setFoveation), resolution (framebuffer scale
100 / 80 / 60 %, from the next VR entry; stored in localStorage). Menu also
has segment show/hide (VR only, app state untouched), reset position and
exit; the trigger presses a button when the ray points at the menu,
otherwise grabs. Background: gradient dome and floor grid. The volume is now
premultiplied and blended over the background instead of painting the
background colour itself.

## Build 338 — VR: volume drawn at reduced resolution

Owner, build 337: bone only at the coarsest step ≈30 fps; enlarging with both
hands drops to 16 fps, so the cost follows the covered pixels. The ray-marched
volume is now drawn per eye into an offscreen target (100 / 70 / 50 % per axis,
default 50 % = 1/4 of the pixels) and a composite material on the same box
upscales it in the main XR pass (only box pixels touched). Menu: volume
resolution (live), detail, foveation, refresh rate (session.supportedFrameRates,
when offered). The framebuffer-scale setting (next entry only) is removed.
Composite shader compiled and sampled correctly in headless Chromium; the XR
path itself needs the Quest.

## Build 339 — VR diagnostics (measure before the next change)

Owner, build 338: enlarged ≈15 fps whatever the settings (volume resolution
included); smallest ≈80–90 fps; 50 % looks acceptable. Resolution not helping
means either the reduced path is not what runs, or the cost is not per-pixel
ray marching. Not guessing: the menu line now shows GPU ms of the volume pass
and of the main XR pass (EXT_disjoint_timer_query_webgl2, when offered), JS ms
per frame, the offscreen and XR target sizes and eye count, and the holder
scale. New diagnostics row: normal / box only (no marching) / loop-count heat
map (blue few iterations → red ≥1024). All three shader modes compiled and
drew in headless Chromium.

## Build 340 — VR: automatic volume resolution

Owner, build 339 (bone, enlarged): box only 90 fps; normal and loop-count
modes drop; loop-count map blue (iterations well under 1024); 100 % slower
than 50 %. So the cost is marched pixels × per-ray work, and 50 % is still too
many pixels when the volume fills both eyes. New default 自動: every 0.5 s the
XR frame interval is compared with the target rate; over budget lowers the
factor (down to 25 %), within budget raises it (up to 80 %). One offscreen
target at 80 %, only the viewports change, so no reallocation. Manual 100 /
70 / 50 % stay. Settings key renamed (old saved indices no longer match).

## Build 341 — VR diagnostics for the per-ray cost

Owner, build 340: enlarged, auto settles at 25 % and ≈30 fps — too coarse to
observe. 25 % is 1/4 of the pixels of 50 % yet only ≈2× faster, so a large
per-ray cost remains besides the pixel count. Candidates, each now switchable
(not guessed): shading at hits (6-step refinement + 6-sample gradient) →
diagnostic 陰影なし; empty-space test per step → スキップなし (expected
slower; shows how much skipping saves); texture reads of the 512³ volume →
data 256³ (2×2×2 average built on first use, same step so the loop count
stays comparable).

## Build 342 — VR: 256³ default, per-segment simple display

Owner, build 341: no skipping very slow; 256³ data comfortable (also without
enlarging) and its smoothing looks fine for observation; no shading unsuitable
for the segment being looked at but acceptable for the others. So texture
reads of 512³ were the main per-ray cost. Data 256³ (2×2×2 average of the
512 plan) is now the saved default, 512³ selectable. Segment buttons cycle
normal → simple (no hit refinement, no gradient; segC.w) → hidden, VR only.

## Build 343 — AR (passthrough) view

Owner: wants a transparent background; two buttons, VRで見る and ARで見る.
ARで見る starts an immersive-ar session (Quest passthrough): alpha WebGL
context, no scene background, dome and grid not added, transparent clears.
Everything else (data, volume pass, menu, grab) is the same code. Each button
shows only when isSessionSupported says so.

Owner, build 343 on Quest: VR and AR both fine (no problems).

## Build 344 — VR/AR hand-held section with oblique slice

Owner: wants section analysis in VR, moving the plane freely, with the slice
image shown at the plane's angle and a chosen opacity. B/Y (xr-standard
button 5) toggles a square frame on that controller (plane normal = the
controller's local X, held like a blade); the holding hand's trigger leaves
the plane fixed in the volume (attached to the volume holder), trigger again
picks it up. Every frame the plane goes to the volume's object space and its
normal is flipped so the eye is on the removed side. Ray shader: optional clip
to the kept half-space (手前を切り取る) and the oblique CT slice composited in
depth order at the plane crossing, resampled per pixel from the 512 texture
with the app's window centre/width (wc/ww), opacity off/30/60/100 %. Headless
check: slice grey 0.5 at window 200/100 on HU 200, 50 % premultiplied, clip
keeps the far half.

## Build 345 — VR/AR menu redesign, grip/trigger section hold, screenshots

Owner: beginner-friendly UI, menu not fixed in space; section hold and menu
position both selectable; wants screenshots. Menu rebuilt (canvas widgets:
buttons, labels, sliders): header (title, close), tabs 表示 / 断面 / 画質 /
詳細, one status line (section held / fixed, flashes), name-left /
buttons-right rows. Menu position: follows lazily (moves back in front when
the head turns >≈35° or it is >0.45 m off; front-left, below eye level) or
fixed, chosen in 表示. A/X toggles the menu; when closed a メニュー tag on the
left controller opens it. Input: trigger = select (buttons, slider drag),
grip = grab; the trigger no longer grabs the volume. Section hold: grip
(grip near the frame holds, release fixes it; frame white when grippable,
yellow held, cyan fixed; appears fixed through the volume centre facing the
viewer) or trigger (old behaviour); B/Y still toggles. Slice opacity is a
0–100 % slider (5 % steps). 正面に戻す brings the volume and menu in front.
Screenshot: the left eye re-rendered at 1600 px wide into an offscreen target
(menu, tag and rays hidden, full-resolution volume), read back to PNG; kept
until the session ends, then a panel on the page offers each for saving
(AR: passthrough is not in the image, background transparent). Haptic pulse
on presses. Menu layouts rendered headless and checked (light segment
colours get dark text).

## Build 346 — section clip: one-side mode

Owner: besides clipping the near side, wants a mode that removes one side
only, so the 3D stays when looking from the other side. 切り取り is now
オフ / 手前 / 片側. 片側: the removed half is fixed to the frame (section.side
along its local X), chosen as the viewer's half when the section appears or
the mode is picked; 向きを反転 swaps it; an arrow on the frame points at the
removed half. 手前 unchanged (flips towards the eye every frame).

## Build 347 — section held only while pressed

Owner: hold the section like the volume, only while the trigger or grip is
pressed. Both hold modes now: press the chosen button near the frame (white)
to hold, release to leave it fixed in the volume. The section always appears
fixed through the volume centre facing the viewer. The old trigger toggle
(fix / pick up) is gone.

Owner: Linux Chrome check done (works). VR check of builds 345–347 pending.

## Build 348 — VR/AR show processed segments (edits)

Owner: CT adjustments (e.g. fat excluded next to air) not in VR/AR — raw
thresholds only (a known prototype limitation). Now shared with the WebGPU
volume: gpuVolumeEditDescriptors() (keep / exclude runs for Opening, Closing,
hole filling, min component, 空気との境界から除外, thin-part removal, and
kept/removed edits) mapped with the same gpuRunsForTexture (now exported;
exclude dilated by one on a reduced grid) and rasterised into one byte per
voxel on the current VR grid (bit s = allowed for segment s). The ray
shader tests it in segmentIndexAt, like editAllows in volumeShader. The mask
is rebuilt when the data size changes or the edit signature changes (checked
once a second), so edits made in the app while in VR appear too. Headless:
mask 0 hides, mask 1 shows.

## Build 349 — no periodic edit check

Owner, build 348: screen flickers, suspects the once-a-second update. The
periodic edit-signature check is removed (not verified on the device whether
it rebuilt; not kept either way). The processed-segment mask is built at VR
start and on a data-size change only; 加工を再読み込み (menu header) takes
edits made in the app during VR. Other periodic work left: auto resolution
(every 0.5 s) — if the flicker remains, fix the resolution (画質 → 50 %) to
check whether it is that.

## Build 350 — processed mask smooth, built once; flicker diagnostic

Owner, build 349: still flickers badly with a fixed resolution; edits cannot
be made in VR, so the reload button was waste (removed). Suspected cause
(not yet measured): the build 348 mask is nearest-sampled per voxel, so the
edited boundary steps between voxels as the head moves. Now RGBA (one channel
per segment), linear filtering, allowed where ≥ 0.5 (smooth boundary), on a
grid of at most 256 per side, built once at VR start. 詳細 → 加工マスク
(診断): なめらか / ボクセル / オフ, to confirm the cause on the device.

## Build 351 — VR/AR: skip bricks wholly inside the current segment

Owner: resolution too low; asked to optimise the volume rendering itself.
Proposal was (1) jump through bricks lying wholly inside the current tissue,
(2) a precomputed classification texture for traversal. Implemented (1)
only: exact, no image change. Brick texture is RGBA32F: HU min, max, and bits
of segments whose processing mask allows the whole brick (+1 voxel, on the
mask grid). uniformSegment(): the segment whose HU range covers the brick,
mask allows it, and no earlier visible segment's range touches it; when that
equals the segment the ray is already inside, the ray jumps to the brick
exit. Headless: images with and without the skip identical (max diff 1/255);
loop count on a 160³ phantom (sphere of 1200 inside a 600 shell, noise)
73.8 → 50.3 per pixel (−32 %); on a small 48³ phantom −4 %, so the gain
depends on how much uniform tissue the rays cross — to be measured on the
Quest (詳細 → 組織内スキップ オン/オフ). (2) not done: a thresholded,
filtered classification can miss thin structures (accuracy) and a
conservative version saves little over the brick test; revisit only if (1)
is not enough.

## Build 352 — practice data cached

Owner: do not download the practice DICOM every time. loadSampleDemo keeps
each slice in Cache Storage (virtual-rodent-sample-v1, like the public
demo's cache) and reads it from there on the next open; fetch on a miss,
cache errors fall back to the network. Local check: 512 slices 22 s first,
0.3 s second (footer: キャッシュから 512), same bytes.
Owner also: the slowdown is not the enlarging but showing two segments;
testing build 351 now.

## Build 353 — build 351 skip reverted

Owner, build 351: comfortable with one segment, heavy with two; the skip
did not help ("オンでも遅いまま", I first misread this as the skip making it
slower). Reverted anyway (vr-view.js back to build 350): no measured gain,
and it made the brick texel RGBA32F (16 bytes read at every step instead of
8) plus per-step branching.

## Build 354 — VR/AR segment opacity 100 % by default

Owner: in VR/AR the segments need not be see-through by default (the
section tool shows the inside); keep it settable. VR-only opacity per
segment starts at 100 % (the app's opacity is neither used nor changed), so
rays end at the first surface (acc > 0.985) instead of crossing
semi-transparent tissue — expected to relieve the two-segment load (to be
measured). 表示 tab: name with %, display mode, opacity slider (5–100 %).

## Build 355 — practice data load checked

Owner: practice data slow to load — network or code? Measured locally
(Chromium, local server, button to 'loaded'): first 9.2 s (fetch 3.8 s +
cache writes that each lane awaited), second 1.1 s from the cache. So a
repeat load is disk-bound and short; the first load moves 257 MB and is
network-bound on the device (e.g. ≈40 s at 50 Mbit/s). Two code fixes: the
cache write no longer blocks the next download (first load 9.2 → 7.3 s
locally), and the cache key no longer contains the page path, so main and
every PR preview (same origin) share one copy (before, each preview URL
downloaded again). Old v1-by-URL entries are left unused.

## Build 356 — VR/AR: precomputed classification ("compile" before viewing)

Owner, build 355: processing mask on = coarse and stuttering; asked to
compile before VR. Thresholds and edits cannot change in VR, so on the ≤256
grid (the default 256³ data) a classification texture is built once: per
active segment one byte f = 0.5 + (HU distance inside its range)/2048
(clamped), set to 0 where the processing mask excludes the voxel; 1, 2 or 4
channels (only active segments), so two segments read 2 bytes per step — the
same as the HU texture and without the mask fetch, decode and range test.
segmentIndexAt reads it when useCls; hit refinement uses it too; normals and
the slice still use HU. f is linear in HU, so its trilinear 0.5 crossing is
the HU threshold (8-bit steps = 8 HU). Headless vs the HU path (160³ phantom,
two segments): identical except grazing silhouette pixels (mean abs diff
0.23/255). 512³ data keeps the HU + mask path. 詳細 → 事前計算 (診断) on/off.

## Build 357 — VR/AR section cap and slice colouring

Owner: does the section cap properly? (No: the ray only started at the plane
and the cut face was shaded with the HU gradient, so it looked mottled.) And
the slice should carry the segment colouring. Now: キャップ (on by default)
paints the cut face where a visible segment is, flat, segment colour mixed
22 % with white and lit by the plane normal (as the app's section cap); the
ray then continues inside that segment. スライスの色付け slider (0 = off,
default 50 %) mixes the segment colour into the grey slice where
segmentIndexAt finds a visible segment (classification / mask included, so
it matches the 3D). Headless: cap lighter flat colour, slice grey matches
the window, tint 100 % gives the segment colour.

Owner, build 357: cap and slice colouring OK. Simple shapes fairly comfortable; complex shapes get heavy and the auto resolution drops.

## Build 358 — VR/AR data prepared before the session, reused

Owner: switching to VR/AR takes long; prepare after pressing the button,
skip when already prepared, otherwise show progress. The CPU-side data
(512 plan, 256³ average, processing mask, classification bytes) is built by
prepareVrData() and kept under a key of series, filter signature, segment
settings and edit identities/revisions; startVrView only makes textures from
it. Button press: prepared → the session starts at once; not prepared → a
page panel shows the phase, progress bar and per-phase times, then a
VRを開始 / ARを開始 button (requestSession needs a click). VR ↔ AR and
re-entry reuse it. Headless (practice data, no segment): read 18.7 s,
256³ 0.6 s, mask 0.0 s, classification 0.0 s — re-reading the DICOM slices
dominates; next candidate: copy the WebGPU volume texture instead.
Memory: the prepared data stays in the page (≈300 MB with the 512 plan).

## Build 359 — VR preparation copies the 3D view's WebGPU texture

Build 358 measured the DICOM re-read as the main cost (≈19 s headless).
New MedicalVolumeRenderer.readPackedTexture(): a small compute shader
textureLoads the resident rg8 texture and packs two voxels per u32 (the
texture has no COPY_SRC and its usage is left untouched), read back in
≤32 MB chunks — the exact bytes that were uploaded. buildVolumeData uses it
when the resident texture has the same series, filter signature (not a
partial rebuild) and plan dims as the VR plan (512 by default on both);
otherwise it reads the slices as before. Filtered data no longer re-runs
the filters for VR. Checked: 96×70×37 and 512×512×130 textures copied with
0 mismatched bytes (SwiftShader WebGPU, 68 MB in 1.5 s). The full app path
could not run headless (three.webgpu swizzle error with this Chromium);
needs the device. Panel shows 3D画面から写す when used.

## Build 360 — VR/AR: up to 4 section planes

Owner: more sections (4?); add with a long press. Shader: cutPlanes[4],
planeCount, planeCut bits. Clipping planes shrink the ray interval (kept =
intersection of every clipping plane's kept half); the cap is drawn on the
plane that set the entry; every plane's slice inside the kept interval is
composited in depth order (up to 4, sorted). JS: planes list, each with its
own frame colour (yellow, cyan, magenta, green; white while held or
grippable), clip on/off (the first clips, added ones start without), side
for one-side mode, remove. B/Y: short press shows / hides, long press
(0.6 s, ring on the controller, haptic) adds a plane in front of that hand;
at 4 a short message. Grip/trigger takes the nearest frame. Menu 断面 tab:
rows per plane (切る/切らない, 向きを反転, 消す), ＋追加. Headless shader
check with 0/1/2 planes, clip bits and slices; menu layout rendered.

## Build 361 — VR slice window: cause measured, opacity default, VR window tab

Owner (handoff item A): the VR slice did not look like the 2D view with the
same window. Measured before changing anything:
- The real VR fragment shader run headless (SwiftShader WebGL2, synthetic HU
  ramp, window 300/400) matches the 2D formula (mpr-render.js
  round((HU-low)*255/ww)) byte for byte at 100 % slice opacity: difference 0
  on every row. Window values (the same wc/ww sliders), the ramp formula and
  the rg8 decode were not the cause.
- At the VR default opacity 60 % the slice is blended over the dark dome:
  black lifts to 21–25, white caps at 174–178, mid greys −25…−64. Inside a
  visible segment the cap fills the rest (−1…−5 from the 2D tint), so bone
  looked right while soft tissue looked dark and flat — the "wrong window"
  impression.
- Colour space: three 0.186 makes the Quest projection layer with gl.RGBA8
  and adds no colour conversion to a ShaderMaterial. The WebXR core and Layers
  specs require the compositor to treat RGBA8 layer pixels as sRGB-encoded
  (no gamma conversion), so the raw 0.5 the shader writes shows like the 2D
  canvas byte 128; the menu (three built-in material, sRGB encode) relies on
  the same rule. Not confirmed on the device, spec + code only.
- Secondary, unchanged: the slice is drawn inside the reduced-resolution pass
  (auto 25–80 %) so it is softer than 2D; trilinear resampling.
Changes:
- DEFAULTS.sliceOpacity 0.6 → 1. Settings key vrl-vr-settings-3 → -4; the old
  key is migrated once with sliceOpacity forced to 1, other values kept.
- New menu tab CT値 / Window (index 2; 画質 → 3, 詳細 → 4, fps refresh on
  tab 4). VR-local window vrWindow {c,w}: starts from the app's wc/ww when the
  session starts, feeds the sliceWindow uniform every frame, never written
  back to the app and not persisted. Centre slider over the app slider range
  (wc.min..wc.max), width over 1..ww.max, 10 HU steps, −/＋ buttons of 10 HU,
  presets アプリの値 / 全範囲 / 骨 (500/2000) / 軟部 (40/400).
- tools/vr-slice-check.mjs (npm run vr-slice-check, PW_CHROMIUM needed): the
  headless shader-vs-2D table above, kept for regression checks.
Checks: lint, 397 unit tests, boot-check OK; vr-slice-check 100 % rows all 0;
menu tab rendered headless in JA and EN (no overlap, widest x 1004, bottom
y ≈ 650). Implementation by a Sonnet 5.5 subagent from a written brief;
reviewed and fixed here (slider text overlapped the −/＋ buttons, width could
round to 0, step constant out of the label table). Needs a Quest check: slice
grey vs the 2D view at 100 %, the new tab's sliders with the controller.

## Build 362 — slice opacity default 70 %

Owner, after build 361: keep some see-through, default about 70 %.
DEFAULTS.sliceOpacity 0.7; settings key -5, older keys (-4, -3) migrated
once with the slice opacity reset to the new default, other values kept.
Owner also asked for a flip button for the one-side clip; the 断面 tab
already has 向きを反転 per plane (shown when 切り取り = 片側 and the plane
clips) — asked whether a controller button is wanted instead.

## Build 363 — VR menu tidy-up for beginners (section / slice tabs)

Owner: could not find the flip button; wanted the slice opacity slider next
to the CT window; asked for a beginner-friendly tidy-up.
- Tab 3 renamed CT値 → スライス / Slice and now holds everything about the
  slice image: opacity, colouring, window centre / width (−/＋, presets).
- 断面 tab keeps the planes: on/off, ＋追加, one row per plane (切る / 向きを
  反転 / 消す), then 切り取り with a one-line explanation of the chosen mode
  (オフ / 手前 / 片側; 片側 says the arrow side is removed and 反転 swaps it),
  キャップ, 持ち方, hold help, B/Y help. 向きを反転 still appears only in
  片側 for a plane that clips (in 手前 the side follows the eye).
- 表示 tab unchanged.
All five tabs rendered headless (JA / EN, mocked state) and checked for
overlap and bounds. lint, unit tests, boot-check OK. Needs a Quest check.

## Build 364 — section selection, round 1 (handoff item B)

Design (Fable): ray pick, numbered handles, a selected plane, thumbstick
scrolling. Implementation by an Opus 5.5 subagent from a written brief,
reviewed here (help text split into two lines to fit the menu width).
- Ray pick: each frame has an invisible DoubleSide hit quad; the ray turns
  white and stops at the frame it points at (menu and menu tag first). The
  hold button (grip or trigger, as chosen) takes the near frame, else the
  pointed one, so a plane can be grabbed and moved from a distance
  (takePlane attaches it to the controller keeping its world transform).
- Handles: a 3.4 cm square with the plane's number (1–4, matching the menu
  rows) in the plane colour outside one corner; the corner cycles with the
  index and the numbers are redrawn after add / remove. Canvas texture,
  depthTest off, renderOrder 3.
- Selected plane (section.selected): set by add, take, or pressing the
  plane's name button in the 断面 tab (the name is now a button); shown as a
  double frame (inner loop, since WebGL line width is always 1 px). Removing
  the selected plane selects the last remaining one.
- Thumbstick Y (xr-standard axes[3], dead zone 0.15, squared response, both
  hands summed) moves the selected plane along its own normal at 5 cm/s in
  world units at full deflection, the same speed whether the plane is fixed
  in the scaled holder or held (parent world scale divides the step). dt is
  clamped to 50 ms.
Checks: lint, 397 unit tests, boot-check OK; vr-slice-check unchanged
(byte-identical output); headless geometry check of makePlane (ray hit at
0.3 m from both faces, miss outside the square, handle position, translateX)
by the subagent; 断面 tab rendered headless with a selected plane. Needs a
Quest check: pointing / far grab, handle legibility (the digit is mirrored
from the back face), scroll speed and dead zone, the double frame.

## Build 365 — section selection, round 2: snap to axis, left-hand panel (item C)

Design (Fable), implementation by an Opus 5.5 subagent from a brief, reviewed
here (one change: the 断面 tab also refreshes when the panel's state key
changes, so its snap buttons follow a hand-rotated plane).
- Snap: 軸位 / 冠状 / 矢状 buttons put the selected plane's normal on the
  volume z / y / x axis (holder space = object space), frame edges along the
  other two axes (up = volume y, coronal: z), normal sign kept (removed side
  unchanged), position unchanged. Works while held (converted into the
  controller's frame). Buttons light when the normal is within about 1° of
  the axis. Row in the 断面 tab under the plane rows; 持ち方 moved to the
  表示 tab above メニューの位置 to make room.
- Left-hand panel: makeMenu now takes (W, H, width in m); a 640×232 canvas
  0.17 m wide sits on the left controller at (0, 0.10, 0.03), tilted like the
  menu tag, visible while sections are on. Row 1: selected plane name (its
  colour), 軸位 / 冠状 / 矢状. Row 2: 向きを反転 (片側 only), 切る／切らない,
  消す, ＋追加. The other hand's ray presses it; ray priority is menu → tag →
  panel → frame. Redrawn when its state key changes, hidden in screenshots.
Checks: lint, 397 unit tests, boot-check OK; vr-slice-check output identical;
headless snap check (holder rotated and scaled, plane under holder and under
a rotated controller, 12 cases: normal·axis = ±1, edge·up = 1); tabs 0 / 1
and the panel rendered headless JA / EN, nothing outside the canvas. Needs a
Quest check: panel position on the hand (may need to move up / tilt), button
size for the ray, snap direction.

## Build 366 — start placement waits for the head pose; menu grab

Owner: at VR/AR start the volume and the menu appear too low (near the
floor). Cause from the code: bringVolumeFront() ran as soon as the data was
ready and placeMenuNow() on the first frame, both from the XR camera, which
sits at the origin (floor height, −Z) until the first viewer pose arrives.
Since build 358/359 the data is prepared before the session, so the volume
was placed before any pose (earlier the 20 s DICOM read hid this). Fix: both
placements wait, in the loop, for the first frame where
frame.getViewerPose(referenceSpace) is non-null (poseOk). Diagnostic: the
詳細 tab shows "初期配置: 姿勢取得 フレーム N / 配置 フレーム M / 頭の高さ
h m" so the device confirms it (h should be ≈ eye height with local-floor).
Menu grab (owner): grip while the ray points at the open menu attaches the
menu to that hand; on release it stays there facing the head, and
メニューの位置 switches to 固定 (follow would pull it back). The lazy follow
is off while held. Help line added under the A/X line in 表示.
Checks: lint, 397 unit tests, boot-check OK; 表示 / 詳細 tabs rendered
headless. Needs a Quest check: start height, the 詳細 line values, grabbing
the menu.

## Build 367 — help board (controls) front-right, grabbable

Owner: show the controls on the right side of the view; must be movable by
hand like the menu. A canvas board (820×560 px, 0.32 m wide, labels only,
makeMenu reused) placed front-right, mirrored from the menu, lazily
following the head like the menu (lazyFollow now shared by both). Contents
follow the state: without sections the basics (grip, two-hand scale, A/X,
B/Y, menu grab); with sections the section controls (point / approach +
hold button, thumbstick scroll, left-hand board, B/Y); with the menu open
the last line says trigger = menu buttons / sliders. Grip while the ray hits
the board moves it (ray priority menu → tag → panel → board → frame); on
release it stays facing the head and the setting becomes 固定. 表示 tab:
操作方法 = 非表示 / ついて来る / 固定 (settings.help, default follow);
正面に戻す also re-places the board; hidden in screenshots. This covers
handoff item E in its simplest form (no first-run steps).
Checks: lint, 397 unit tests, boot-check OK; board (JA/EN, both states) and
表示 tab rendered headless, every label width measured against its canvas.
Needs a Quest check: board position (front-right, 0.34 m right of centre),
text size, whether it gets in the way.

## Build 368 — overnight tasks: 3D speed (all platforms), tablet profile, practice project

Owner (evening, no mid-way checks possible): 1. speed up the 3D drawing on
VR / PC / iPad without losing quality; 2. Quest as comfortable as the iPad
for analysis and 3D editing; 3. a developer-supplied project file for the
practice data. Approach: measure the shader work headlessly (fetch counts,
exact images), change only what keeps the image, put a switch on the one
change that is not bit-identical.

### 1. Volume shaders (docs/medical-volume.js WGSL, docs/vr-view.js GLSL)
New tools: tools/volume-shader-check.mjs (SwiftShader WebGPU, real WGSL,
128³ phantom: soft ellipsoid 35 %, bone sphere, 2-voxel plate, hollow tube;
per-pixel counts of HU fetches / brick reads / edit lookups via injected
counters, image compare of two file versions, PNGs) and
tools/vr-volume-check.mjs (same phantom through three.js WebGL2, HU and
classification paths, counts + compare). SwiftShader time is not used (CPU
proxy, the log of build 330 already said so); counts are the measure.
Changes, all three shaders / paths:
- one HU fetch per sample (WGSL had two: raw index + edited index);
- brick min/max read once per brick (brickEnd = exit distance), not per
  sample; WGSL brickExitDistance now uses the texture grid like
  brickMayContain (it used the source grid: shorter skips on reduced
  textures);
- bricks carry one voxel of overlap (WGSL brick shader; VR already did), so
  every trilinear sample inside a brick lies within its min..max;
- uniform bricks: a brick whose min..max lies inside one enabled segment's
  range (no earlier segment overlapping, no edit / cut mask on it) is crossed
  without sampling by a ray already inside that segment (translucent soft
  tissue interiors); the last point inside the brick becomes the previous
  sample of the next surface search;
- surface search: 6 bisections → 2 secant guesses on the sampled value (HU,
  or the classification value in VR) + 1 bisection when the boundary is an
  iso-value (no mask on the segment, previous sample measured and outside);
  else 6 bisections as before. Setting 描画 › 表面の探索 高速 / 精密
  (app-settings refine, default fast; uniform mprVisible.w) and VR 詳細 ›
  表面の探索 (settings.refine, uniform refine).
Measured on the phantom (per pixel, whole 384² image, half background):
- WGSL: HU fetches 43.0 → 18.9, brick reads 28.5 → 12.7, edit lookups
  14.2 → 8.0. Exact mode + old bricks: image identical (0 differing
  channels). New bricks + uniform crossing, exact search: 0.5 % of channels
  differ (silhouette pixels, sub-voxel hit shifts), mean 6/255. Fast search:
  4.4 % of channels differ, mean 2.4/255 (shading at the hit point), max 88
  on isolated silhouette pixels.
- GLSL HU path: fetches 22.3 → 16.0, brick reads 19.6 → 5.0; cls path: cls
  fetches 19.9 → 13.6, brick reads 19.6 → 5.0; same difference pattern
  (0.45 % / mean 6 exact, 7 % / mean 2 fast).
Not done: precomputed normal textures (memory: 48 MB at 256³, 384 MB at
512³) — the gradient is 6 fetches per hit, about 4 % of the fetches here.
Real-device fps still to be measured by the owner (Mac status bar 3D ms,
iPad, Quest 詳細 tab).

### 2. Tablet profile (Quest browser)
No device here, so only what is safe: utils.isTabletRuntime() = iPad, or a
touch device that is neither desktop nor iPhone (Quest browser, Android
tablets). It now selects the iPad caps: GPU volume cache 1.5 GB, source
slice cache 192 MB, orthogonal cache 256 MB, volume read 1.5 GB, gpuSide
'full' removed from the quality control (512 fallback in state.js for any
touch device). Status label shows 'tablet 512' on such devices (iPad keeps
'iPad'). The shader work above is the main speed lever there too. Comfort
of analysis / editing with the controller pointer is not measurable here:
the owner should try lasso / cut on the Quest browser and report.

### 3. Practice data + bundled project (Opus 5.5 subagent, reviewed)
sampleDemoBtn: after loadSampleDemo, fetch demo/sample1/project.vrlab
(no-cache, not stored in the sample Cache Storage); if present it becomes
pendingProject and the existing selectSeries / applyPendingProject path
applies it (fingerprint checked). Missing file: silent; broken file:
console.warn. README in docs/demo/sample1 explains: save a project from the
practice data, rename to project.vrlab, put it next to index.json. No
project file added (the owner saves one). e2e tests/e2e/sample-project.spec.js
(stubbed index / slices / project; applied, and 404 case).

Checks: lint, 397 unit tests, boot-check, vr-slice-check (100 %: 0 diff),
both shader harnesses; e2e sample-project + folder-project + smoke: 11
passed (run with a local HTTPS mirror of the CDN modules, since the
container blocks cdn.jsdelivr.net / esm.sh for Chromium; the plain
`npx playwright test` needs network and a matching Chromium build).

## Build 369 — VR sphere tracing with a distance field; samples-per-pixel probe

Owner clarified the goal of task 1: not pixel-identical images but the VR
auto resolution (25–80 % today) staying at 100 % at the normal viewing size
(the enlarge-slowdown is a separate, mostly solved matter). 100 % is 4–16×
the pixels of the auto levels, so the per-pixel work must drop by that
much, or the resolution stays adaptive. No device tonight, so the work that
can be done headless was done, with a probe for the morning.
- docs/distance-field.js (unit-tested): per classification channel a byte
  per voxel, a lower bound of the distance (voxels) to the voxels around
  the segment's surface (seeds = voxels with a 26-neighbour of the other
  class; chamfer 3-4-5 × 0.9 / 3, floored). Built in prepareVrData after the
  classification (phase 距離場, ~1.1 s for 128³ × 2 channels headless; 256³
  is 8× the voxels, so several seconds on the page), uploaded as a nearest-
  sampled RGBA8 texture on the classification grid.
- Shader: with useDist the ray reads the distance first and jumps (d − 2)
  voxels whenever d ≥ 3 (no surface can lie in the jump), samples at the
  fine step only within ~2 voxels of a surface; bricks are not read at all
  in this mode. Requires the classification path (≤ 256 grid); 512 data
  keeps the old path. 詳細 › 距離場（診断）オン／オフ for A/B on the device.
- Probe: 詳細 shows サンプル数／画素 (loop-count diagnostic on a 48×48
  target from the left eye once a second, mean over covered pixels).
Measured (phantom, per pixel, whole image, cls path, old → new incl. build
368): soft 35 % + bone: cls fetches 19.9 → 11.0, brick reads 19.6 → 0,
distance fetches 13.5, HU (gradient) 2.3: total 41.8 → 26.8 (−36 %). Bone
only (opaque): 5.1 + 5.6 + 0.8 = 11.5 → 1.7 + 2.9 + 0.8 = 5.4 (−53 %).
Images: surfaces intact (thin plate, tube); differences only on silhouette /
facet pixels (1.7–2.6 % of channels, mean 5–8/255), from sub-voxel hit
shifts as the sample phase changes.
What remains per surface hit: ~3 fine approach samples, the search (3 or 6
fetches), the gradient (6 HU fetches) — precomputed normals would remove 5
per hit (48 MB at 256³). The bone-only cost is already ~5 fetches per pixel:
if the device still cannot hold 100 %, the limit is the pixel count itself
(Quest 3: ~9 MP per frame at 100 %) and not the per-ray work, so the auto
resolution stays the right tool and the next lever would be temporal reuse
(previous-frame hit depth), not the shader.
Morning measurements wanted (詳細 tab, normal size, bone only and bone +
soft): fps · ボリューム ms · 縮小描画 % (auto), the same with 画質 › 100 %,
and サンプル数／画素 with 距離場 on / off and 表面の探索 高速 / 精密.
Checks: lint, 404 unit tests, boot-check, vr-slice-check (0 diff), harness.

## Build 370 — VR auto resolution follows the GPU time, may reach 100 %

Why: the auto factor (build 340) followed the frame interval, which the
display quantises: a small overrun shows as a halved frame rate (27 ms
instead of 14), the controller then shrank by 0.7 per half second down to
25 %, and only grew by 6 % per half second while the interval was under
1.04 × budget — a bias towards low factors; AUTO_MAX was 0.8, so 100 % was
never reached in auto. Now, when EXT_disjoint_timer_query_webgl2 is
offered (the 詳細 line already showed GPU ms on the Quest), the factor
follows the measured GPU time: pixel cost ∝ f², target = 80 % of the frame
budget minus the main pass; at 100 % (direct path) the main pass holds the
volume and is compared with the budget as a whole. Damped ×0.7 … ×1.15 per
half second, an extra ×0.85 while frames are actually dropped (interval >
1.5 × budget). AUTO_MAX = 1. Without the timer the interval logic stays.
詳細 shows the controller line: 自動: GPU ボリューム x ms · 本描画 y ms /
予算 b ms → f %.
Distance field build: seeds by separable dilate / erode passes and chamfer
passes with precomputed offsets: 256³ one channel 3.8 s → 1.7 s (node);
128³ × 2 channels 593 ms headless.
Checks: lint, 404 unit tests, boot-check, 詳細 tab rendered headless (no
overflow, bottom 992), VR harness counts unchanged.
Morning: with 距離場 on, the 詳細 line should show where the factor settles
and the volume GPU ms; if it settles below 100 % with the GPU ms at 80 % of
the budget, the per-pixel work at the XR size is the limit (see build 369).

## Build 371 — review fixes for builds 368–370

A code review (high effort) of the three overnight commits found seven
points; all fixed:
- WGSL uniform-brick crossing `continue`d past the section cap and MPR
  plane compositing, so a cap or plane inside a uniform brick of a
  translucent segment was not drawn. Now the jump falls through: the cap /
  planes inside [t, nextT] are composited, no sample is taken, lastIndex is
  kept, and the previous sample for the next surface search is the last
  point inside the brick. Harness with an axial MPR plane at 60 % inside
  the soft tissue: 0.5 % of channels differ from the old shader (same as
  without the plane); the plane is drawn.
- isTabletRuntime(): mobile OS in the UA (iPad, Android, OculusBrowser /
  Quest) only; a touch-screen laptop stays a desktop for the caps.
- English prepare panel lacked the 距離場 phase name.
- Practice project: never replaces a project the user already loaded; a
  bundled project that did not apply to the sample is dropped (no repeated
  mismatch footer on later series).
- distance-field.js: scratch buffers allocated once for all channels,
  async with a yield and progress per channel (prepare panel shows n / C).
- The samples probe restores the clear colour (the direct 100 % path
  cleared the XR layer with alpha 0 after a probe).
- The VR low-resolution target grows with the factor in use instead of
  being allocated at the maximum (AUTO_MAX = 1 would have meant a full-size
  target that is never used at 100 %).
Checks: lint, 404 unit tests, boot-check, vr-slice-check (0 diff), both
shader harnesses (counts unchanged), e2e sample-project + folder-project +
smoke: 11 passed (local CDN mirror).

## Build 372 — analysis region colouring was speckled / striped (WebGPU volume)

Owner (iPad, build 371 screenshot): a selected analysis region (fat, cyan)
shows as cyan / orange stripes along the depth contours. Reproduced headless
with the harness (ANALYSIS=1: the bone sphere as a focused region): the OLD
shader shows the same speckle, so it was not caused by builds 368–371 but
made visible by this use. Cause: the region and cut-preview run tables are
looked up at the floor voxel of the surface hit; the hit lies on the
trilinear iso-surface between an outside and an inside voxel centre, so the
floor voxel is the outside one about half of the time and the region test
fails there. Fix: insideVoxelTc() looks up the first voxel whose own stored
value is inside the segment's range among: the hit voxel, half / one / one
and a half voxels inward (along the gradient, towards the range), half / one
voxel along the ray (grazing hits). Harness: the region sphere is now cyan
apart from a few pixels (before: half speckled); images without a region
unchanged (fetch counts 18.9 / 12.7 / 8.0 as in build 368).
Checks: lint, 404 unit tests, boot-check, harness.

## Build 373 — 3D drag fps on the iPad: run-table lookups by binary search, GPU-timed drag budget

Owner (iPad, build 372, fat segment + analysis region, zoomed in): low fps
while dragging, choppy when enlarged. Status bar in the screenshot: 3D 13 ms
at 541×332 (interaction tier 2 already), 間隔 33 ms (30 fps). 13 ms for
0.18 MP is ~70 ns per pixel: the per-pixel work, not the pixel count. When
zoomed in every pixel is a hit, and each hit ran analysisOverlayAt, a
linear scan over the row's run pairs (a fat region has hundreds per row);
previewContains / appliedCutContains scanned likewise.
- All three lookups now binary-search the row (sorted, disjoint intervals;
  editAllows already did). setAnalysisRuns sorts each row's pairs by x0
  (regions were appended in region order). Harness with a region: image
  identical to build 372 (0 differing channels).
- Adaptive drag budget: while dragging, the tier's pixel budget is scaled by
  the measured GPU time of the volume pass (steps 1 / 0.7 / 0.5 / 0.35, one
  step down over 10 ms, one step up under 5 ms, at most every 300 ms, kept
  between drags); the frame-time line shows ×0.7 etc. A 60 Hz frame with
  present needs the pass under ~8–10 ms; 13 ms fell to 30 fps.
Not done (follow-up if still slow): the per-sample editAllows binary search
for processed segments (fat RLE) could become a bit-mask texture (16 MB per
segment at 512³, one load instead of ~8 dependent storage reads).
Checks: lint, 404 unit tests, boot-check, harness (overlay 0 diff).

## Build 374 — analysis colouring made the 3D view heavy: region index texture

Owner (iPad, build 373): the volume view became heavy once a volume-analysis
region was coloured. Cause (from the build 373 shader): every surface hit
still ran analysisOverlayAt, a binary search over the row's run pairs (a
fat region has hundreds per row: ~8 dependent storage reads per hit), and
every hit also ran the inside-voxel search of build 372 whether or not a
region was shown.
- Region index texture: setAnalysisRuns also uploads an r32uint 3D texture,
  4 bits per texture voxel (8 voxels per word along x; k = region index +
  1, 15 = "search the row" for regions past the 14th), 67 MB at 512³, 8 MB
  at 256³ (the iPad's reduced texture). The shader reads one word per hit
  and takes the colour from a table appended after the run pairs
  (analysisOverlay[0] now points at the table instead of holding 1). The
  row search stays as the fallback (texture missing, k = 15).
- Allocation failure: WebGPU reports it through the error scope, not by
  throwing, so the texture is created under an out-of-memory scope and
  dropped (row search) when the scope reports.
- The inside-voxel search (build 372) now runs only when a region or a cut
  preview is shown; without either the hit uses the plain sample position
  as in build 371.
- Binding 11 (regionTex, a 1×1×1 dummy while no region is shown); uniform
  slot 19 w = 1 when the texture exists. rebuildBindGroup / destroy /
  clearAnalysisRuns handle it.
Checks: lint; 404 unit tests (overlay test updated to the new layout and the
texture words); boot-check; WebGPU harness against the build 373 shader with
a region: 0 differing channels with the texture, 0 with the row search
(REGIONTEX=0), 0 without a region; a negative run with an empty texture
differed (21657 channels), so the texture path is the one drawing the
colour. Overlapping regions (only possible at the one-texel dilation border
of adjacent regions on reduced textures) take the later region; the old
search took the pair with the larger x0. Speed is not measurable here
(SwiftShader); the iPad decides.
Not done (follow-up if still slow): editAllows for processed segments (fat
RLE) as a bit-mask texture, same scheme, one load per sample.

## Build 375 — coloured hits without HU fetches, drag controller hysteresis, per-second frame stats

Owner (iPad, build 374): comfortable without a coloured region; with one
the ×0.7 / ×0.5 size factor appeared and the view was choppy while the
status bar read about 60 fps; it smoothed out after dragging for a while.
Facts from the code: the 間隔 figure is one gap sample every 250 ms, so
dropped frames between samples are invisible; the drag controller decided
on a single GPU measurement (down over 10 ms, up under 5 ms, every 300 ms),
so a size flip every 300 ms is possible when the time does not scale with
the pixel count (build 279 saw that); with a region every hit still paid the
inside-voxel search (1–6 HU fetches) before the texture lookup.
- Shader: hits on segments without a shown region skip the region lookup
  entirely (a segment mask word at the colour table start,
  data[tableStart]; analysis-ops passes the region's segment indices,
  unknown → all). With the index texture the lookup is regionOverlayNear:
  the same six candidates as insideVoxelTc (hit voxel first), read from the
  region texture only — a coloured hit costs one texture load, no HU fetch;
  insideVoxelTc now runs only for a cut preview or the row-search fallback.
  Semantics: the first candidate with a region instead of the region at the
  first in-segment candidate: differs only at a region's border inside its
  own segment (harness: 21 of 442368 channels, 7 pixels, at the sphere's
  edge; whole volume coloured: 0 differing channels; no region: 0).
  Inlining six lookups into the hit block cost +16 % on the SwiftShader CPU
  proxy even when not executed; as one loop body with arithmetic offsets
  the proxy is +3 % (run-to-run noise about 3 %). Metal decides.
- Drag controller: down when two measurements in a row exceed 9 ms (300 ms
  hold), up only when the time predicted for the larger size (pixels scale
  with the step) stays under 7 ms for three measurements and the size was
  held 600 ms; history cleared on a change.
- Status bar while dragging: "[1秒: N 枚, 最大 xx ms, 落ち n]" — frames in
  the last second, longest gap, gaps over 20 ms. Reads a dropped-frame
  count directly instead of one gap sample.
- Harness: REGIONR (region radius, default 22; 200 = everything coloured),
  huVoxel fetches counted.
Checks: lint, 404 unit tests (segment mask), boot-check, harness as above.
Not done: if the iPad still drops frames with a coloured fat region, the
next candidates are the editAllows bit-mask texture (build 373 note) and
a dilated region texture (one load per hit, ±1 texel bleed).

## Build 376 — region texture uploaded by one aligned buffer copy; upload diagnostics

Owner (iPad, build 375): for a few seconds after colouring a region the
view was choppy with 待ち (GPU queue wait) about 120 ms, then about 3 ms;
and the striped colouring of build 371 was back. The analysis itself
finishes before the colour appears, so the queued GPU work must be the
region texture upload (queue.writeTexture, 67 MB at 512³, 128–256 bytes
per row): an implementation that copies it row by row or in chunks keeps
the queue busy for seconds, and rows not yet copied read as "no region" —
stripes — until it finishes. Unverified on the device; this build makes
the upload one copy and reports it.
- setAnalysisRuns fills the index words straight into a mapped staging
  buffer (mappedAtCreation, rows padded to the 256-byte pitch that
  copyBufferToTexture requires by spec) and copies with one
  copyBufferToTexture; the staging buffer is destroyed when the queue
  reports the copy done. Harness image with the padded copy is
  byte-identical to the writeTexture one (whole volume coloured).
- Status bar while a region is shown: "領域tex 64×512×512 67 MB 転送 xx ms"
  (size, and the time from the copy's submit to onSubmittedWorkDone), or
  "領域tex なし（reason）→ 行検索" when the allocation was refused.
- The 375 lookup (regionOverlayNear) is unchanged: it colours a superset of
  the 374 hits with the same texture, so it cannot by itself produce the
  stripes; if they persist with the copy above, the next step is the 374
  inside-voxel path behind a switch for an A/B on the device.
Checks: lint, 404 unit tests (fake device with staging buffer and copy),
boot-check, harness (padded copy vs writeTexture identical; vs 374: 0
differing channels whole volume coloured, 21 at a small region's border).

## Handoff (after build 376)

State: build 376 on claude/dicom-viewer-handoff-eaqyyu (VR/AR: WebGL2
volume, 256³ default, auto resolution, precomputed classification with
processing mask, up to 4 section planes with cap / slice colouring / clip
modes, beginner menu, screenshots, data prepared before the session and
copied from the WebGPU texture, practice data cached, スライス tab with
opacity / colouring / VR-local CT window, slice opacity default 70 %). main = build 360; PR #78 (preview
/pr-preview/pr-78/) awaits the owner's Quest check and merge instruction.

How the owner checks a build: open a PR from the work branch; the pages
workflow deploys docs/ to
https://naomitsu-ozawa.github.io/virtual-rodent-la/pr-preview/pr-<N>/ and the
owner opens that URL on the Quest / iPad / Mac. Always give that preview URL
(not only the PR link) when reporting a pushed build.

Owner rules (keep): reply in Japanese; no meshes in the GPU volume view;
never guess — measure first or ship a diagnostic build; run lint, unit tests
and boot-check before pushing (boot-check needs PW_CHROMIUM=/opt/pw-browsers/chromium);
merge only when the owner says so; answer questions without implementing;
swap is forbidden (disk cache OK); research-grade accuracy; no platform
branching except VR (share what can be shared); do not break what works on
Mac/iPad; no wasted features (e.g. nothing can be edited inside VR); when a
solution is not in sight, stop and prepare a handoff. Bump the build with
npm run bump-build for every pushed change and log it here.

Next work (owner-approved list; recommended model / effort):
A. Done in build 361 (cause: 60 % default opacity over the dome; VR window
   tab added). Open: Quest check of the slice at 100 % and of the new tab.
B. Done in build 364 (ray pick, numbered handles, selected plane, thumbstick
   scroll). Open: Quest check; scroll speed (5 cm/s) may need tuning.
C. Done in build 365 (snap row, left-hand panel, 持ち方 moved to 表示).
   Open: Quest check of the panel placement.
D. Goal (owner): VR auto resolution held at 100 % at the normal size.
   Builds 368–371: fewer fetches per sample / brick, uniform-brick crossing,
   fast surface search, distance-field sphere tracing (all switchable),
   samples-per-pixel probe, GPU-timed auto controller up to 100 %. Open:
   the device numbers decide whether per-ray work or the pixel count is the
   limit; then precomputed normals (memory!) or temporal reuse.
E. Help board done in build 367 (state-dependent controls, front-right).
   A first-run 3-step guide is still open if the owner wants it.
F. iPad (builds 372–376): region colouring speckle fixed, drag lookups by
   binary search + GPU-timed drag budget, region index texture (uploaded
   by one aligned buffer copy), coloured hits without HU fetches,
   controller hysteresis, per-second frame stats, upload diagnostics.
   Open: iPad check with a coloured fat region — read "領域tex … 転送 xx
   ms", "待ち" in the first seconds, and "[1秒: N 枚, 最大, 落ち]"; stripes
   still there → A/B switch to the 374 inside-voxel lookup; frames still
   dropping → editAllows bit-mask texture or a dilated region texture.
Order: device checks of builds 361–368 first; then whatever the owner
reports (tablet comfort on the Quest browser, fps). Headless tools used so far: see the build
entries above (shader tests via tools/boot-check.mjs with page.evaluate).
