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

## Build 377 — regressions since build 360: tiles left after a delete, drag resolution ratchet; texture kept across focus changes

Owner (iPad, build 376): after a lasso select + delete, garbage stays
behind (a problem seen before); the view is still choppy for a while after
colouring; the drag resolution drops step by step during rotation. 改悪厳禁.
- Garbage after a delete — measured: the harness got an exclusion edit
  (EDIT=1: a box removed from the bone segment) and build 360 (main) was
  compared with every build since. 368 and later differed by 6771 channels
  (mean 37) with the edit, 2059 without; 361–367 are VR-only. Crops showed
  the sub-voxel shell that an exclusion leaves (interpolated HU still in
  range one sample past the excluded voxel) rendered as solid brick-sized
  tiles with seams, where build 360 dithers it to a faint hatch. Cause: the
  uniform-brick jump of build 368 resumed at brickEnd + 0.05 step, re-phasing
  every ray at the brick exit, so the shell was hit coherently per brick.
  Fix: resume on the ray's own sample grid (first grid point past the brick).
  Harness vs build 360, exact mode: 33 channels with the edit, 36 (all diff
  1) without — the current shader now matches build 360 apart from that.
  Fast search (default) vs 360 with the edit: 10456 channels, mean 1.46.
- Drag resolution ratchet — the adaptive drag budget (builds 373 / 375)
  removed; the fixed tier budgets of build 372 are back. The ×0.7 label is
  gone from the status bar.
- Choppy after colouring — the overlay CPU build measured in node: 174–219
  ms at 512³ (fat-like region, 24 M voxels), 49–92 ms at 256³: one hitch,
  not seconds. Every focus or colour change re-ran the whole build and
  re-allocated / re-uploaded the 67 MB texture; now setAnalysisRuns takes a
  texture signature (ids and voxel counts) and keeps the texture when only
  colours or focus change (unit test). The first upload remains; its time
  is the 転送 figure of build 376. Still open on the device.
- Harness: EDIT=1 exclusion edit on segment 0 (editAllows layout).
Checks: lint, 405 unit tests, boot-check, harness (texture path vs row
search byte-identical with everything coloured; 360 comparisons above).

## Build 378 — harness: scattered specks and an edit that deletes exactly them (no app change)

Owner (iPad, build 377, screenshot): after lasso select + delete, dust
stays around the spine. Measured: tools/volume-shader-check.mjs got
SPECKS=1 (400 single-voxel 500 HU bone specks in the soft tissue, seeded)
and EDIT=2 (exclusion of exactly those voxels). Build 360 vs 377, exact
mode: 9 differing channels without the edit, 4 with it (all diff 1); the
deleted specks leave nothing — no ghost shell. The lasso / edit modules
(lasso, edit-tools, analysis-ops, run-length, segment-runs, mask-ops,
segment-ui, scene-view) are identical to build 360 apart from the version
query. So the dust is not drawn after being deleted; it was not selected
(the lasso keeps components touching the loop, build 197). Asked the owner
to check with メッシュで確認 and whether the dust lay inside the loop, and
for the 領域tex 転送 / 待ち figures right after colouring. Only the version
changed in docs/.

## Build 379 — lasso and edit-mask diagnostics (dust after lasso delete still reported)

Owner (build 377/378): "治ってない" to the dust left after lasso select +
delete. Nothing in the lasso / edit path differs from build 360 and the
deletion rendering matches it headlessly (build 378), so this build makes
the app report what happened on the device:
- After a lasso: footer "囲んで選択（輪の中に完全に入った部品 / 全部品）:
  bone: 12/340, …" per target segment; "— 選択なし" when nothing qualified.
  A small first number with a large second one means the components were
  judged as touching or outside the loop (projection / loop geometry); a
  large first number with dust still drawn means the GPU mask is wrong.
- Status bar: "編集 0:exclude 1234区間 2:keep 98765区間" — the segment index,
  mode and interval count of the edit mask the volume shader is using,
  cleared with the edits.
Checks: lint, 405 unit tests, boot-check.

## Build 380 — deleted voxels no longer leak into neighbouring samples (ghost cloud after a delete)

Owner (iPad, build 379, screenshot): after lasso select + delete of a
noisy blob, a sparse boxy cloud stays where the blob was; status bar
"編集 0:exclude 15449区間" (the exclusion reached the GPU). Reproduced
headlessly: SPECKS=2 adds a blob of random HU 100..700 and EDIT=2 excludes
exactly its voxels >= 300. Build 360 shows the same cloud after the
exclusion (so it was not introduced on this branch; the owner remembers it
fixed — whatever fixed it then was not in main's shader). Cause: the edit
mask is tested at the sample's own voxel, but the trilinear HU of a sample
in an allowed cell next to an excluded high-HU voxel is still in range, so
each excluded voxel leaves face-aligned slivers (the boxy look).
- Fix (shader, exclude-mode masks only, i.e. lasso / region deletes and
  cuts; keep-mode processed segments unchanged): a sample that passes the
  raw range and its own voxel's mask is re-evaluated with the excluded
  corner voxels of its interpolation cell replaced by air (editInsidePair:
  one binary search per corner row for x and x+1, so 4 searches; the 8
  nearest-voxel HU loads only when a corner is excluded).
- Harness vs build 360: noisy blob excluded — the bone ghost is gone (the
  blob's sub-threshold voxels still show as soft tissue, which is right);
  box exclusion — the hatched shell on the plate is gone, cut face clean;
  no edit — 36 channels (diff 1); specks — 68 channels. HU fetches with
  the blob edit 25.9 per pixel (20.1 without an edit).
Checks: lint, 405 unit tests, boot-check, harness as above, region
colouring texture vs row search byte-identical.

## Build 381 — VR: distance field read only when a jump is possible (same image)

Quest numbers (owner, build 380, normal size): auto resolution settles at
30–40 % with the interval controller (no GPU timer on the Quest browser);
100 % fixed: bone only about 60 fps, bone + fat about 20 fps; JS 0.6–0.8
ms; samples per pixel 3–8 (bone), 20–25 (bone + fat); distance field off
adds about 6; exact search slightly slower. Cost model that fits: reads per
pixel ≈ iterations × 2 (field + classification) + about 9 per hit (3
search + 6 gradient); bone 19 reads → 60 fps, bone + fat 53 → 20 fps.
Target for 72 fps at 100 %: about 16 reads per pixel. Plan agreed with the
owner: 1 field-read elision (exact), 2 precomputed normals (exact), 3 a
half-resolution first-hit pre-pass (not exact; harness numbers first, the
owner decides). VR only; the WebGPU view is untouched.
- VR harness (tools/vr-volume-check.mjs): FAT=1 fat sheets, FAT=2
  scattered fat specks (the visceral-fat case: field below 3 nearly
  everywhere, few early hits), SEGS=bonefat, EDIT=1 (bone box excluded,
  folded into the classification and as an editTex for the HU path),
  classification with 4 channels. Specks + soft: 18.8 iterations per pixel.
- Shader: the field is read only when its value could reach 3. One step
  moves the sampled voxel by at most one per axis (chamfer 5 → +1.5 field
  units, floor: +2), so after a read of 0 the next read is skipped; the
  bound grows by ceil(1.5 × ceil(step / voxel)) per skipped step and is
  reset after a jump. Reads: specks + soft 18.8 → 12.6 per pixel, specks +
  bone 8.4 → 5.9, no fat 13.5 → 11.0; every configuration (HU and cls
  paths, bone only, fat sheets, edit box, exact search) pixel-identical to
  build 380. A looser rule (skip after a read of 1) saved 1.3 more reads but
  changed 54 channels (a lost 1-voxel jump moved a hit): rejected.
Checks: lint, 405 unit tests, boot-check, VR harness as above.

## Build 382 — VR harness on the practice data; fat opacity and the one-fetch field measured (no app change)

Owner (Quest, build 381): bone + fat 16–30 fps at 100 %; soft hidden; fat
opacity about 90 %; normal size. Owner's suggestion: measure on the
practice data (docs/demo/sample1) instead of phantoms.
- tools/vr-volume-check.mjs: VOL=<raw u16 file> DIMS=256 loads a real
  volume (HU = raw − 4000, the practice data's calibration), BONE / SOFT /
  FATR ranges and BONEOP / SOFTOP / FATOP opacities from the environment,
  DISTCLS=1 writes the combined distance field (min over the shown
  segments) into the classification alpha, the cls counter now wraps every
  classification fetch. The 256³ volume is built by a scratch script
  (2×2×2 mean of the 512 slices, as halveVolume does; histogram: soft peak
  100–200 HU, fat about −200..−20, bone a plateau above 300).
- Practice data, bone (300..3000) + fat (−200..−20), soft hidden, reads per
  pixel: fat 100 %: cls 13.5 + dist 14.4 + HU 2.1 ≈ 30; fat 90 %: 26.0 +
  25.0 + 3.6 ≈ 55 (matches the Quest's 20–25 iterations). At 90 % the ray
  runs on to a second fat hit (0.9 < the 0.985 cut-off).
- One-fetch variant (field in the cls alpha, scratch vr-dc2.js): 30 → 20
  reads at 100 %, 55 → 37 at 90 %; the separate field texture goes away
  (−67 MB at 256³). Jump rule for the trilinear field: surface ≥ dd − 1.74
  (corner values are bounds, 1-Lipschitz), jump dd − 1.8 when dd ≥ 2.7.
  Not pixel-identical: 15 % of channels differ by 18 on average, speckle on
  the fat surface only (sample phase), no structure lost. Awaiting the
  owner's decision and the fps at fat 100 %.
- Rejected after measuring: a half-resolution first-hit pre-pass (no
  read reduction: the cost is after the first hit, inside the near-fat
  zone; 15697–35972 channels changed). Deferred: precomputed normals (HU
  reads are 2.1 per pixel here, little to gain).
Only the version changed in docs/.

## Build 383 — VR default size 16.5 cm (was 30 cm)

Owner (Quest, build 382): correction — fat opacity was 100 % all along
(the 55-read case in build 382's log is therefore not the owner's; their
20–25 iterations at 100 % mean denser fat than the practice data's
−200..−20 range gives here, 14). New finding: shrinking the volume with
both hands to the smallest size made it much lighter; owner suggests that
as the default. The cost follows the pixels the volume covers (apparent
size squared; per-ray work does not change with size), so the smallest
size (16.5 cm longest side at 0.55 m: about 1/3 of the pixels of 30 cm)
is about 3× cheaper. At that size 256 voxels span about 340 Quest pixels,
still above one pixel per voxel at 100 %, so no detail is lost on the
panel.
- baseScale 0.3/3.3 → 0.165/3.3 (bringVolumeFront: start and 持ち方 →
  手前に戻す); two-hand scale minimum 0.05 → 0.025 so it can still be made
  smaller than the default.
- The one-fetch field (build 382 log) is still pending the owner's
  decision.
Checks: lint, 405 unit tests, boot-check.

## Build 384 — VR: classification and combined distance field in one texture (one fetch per step)

Owner: wants to try it; and confirms bone + fat at 100 % is 20–30 fps on
build 381 at the old default size (fat opacity was 100 % all along).
- distance-field.js: combineClassificationDistance(cls, dist, mask, out):
  RGBA bytes with the classification channels as stored and alpha = the
  smallest distance over the enabled segments (255 when none); null when
  four segments are stored (no free channel). Unit-tested.
- vr-view.js: when the classification and the field exist on the ≤256
  grid, at most three segments are stored and the field diagnostic is off,
  the shader samples one RGBA texture (distInCls = 1): the alpha drives the
  jump, the same fetch classifies the sample. The alpha is rebuilt and
  re-uploaded when the set of shown segments changes (segment mode menu;
  about 0.2 s at 256³). Separate-field path (build 381) unchanged and used
  as the fallback.
- Jump rule for the trilinear alpha: every corner value is a lower bound
  of the distance to the seeds and the distance is 1-Lipschitz, so the
  surface is at least dd − 1.74 voxels away; jump dd − 1.8 when dd ≥ 2.7.
- Harness, practice data (bone 300..3000 + fat −200..−20, 100 %, soft
  hidden): reads per pixel 30.0 (381: cls 13.5 + field 14.4 + HU 2.1) →
  20.8 (cls 18.1 + field 0.6 + HU 2.1), −31 %. Image: 15 % of channels
  differ, mean 18, speckle on the fat surface (sample phase after jumps of
  a different length), no structure lost. Fallback path pixel-identical
  to build 381. Phantom (specks + soft + edit box) numbers above.
Checks: lint, 406 unit tests, boot-check, harness.

## Build 385 — in-VR benchmark (one screenshot instead of reading numbers one by one)

Owner (Quest, build 384): no graininess; bone + fat about 20 fps at the
default and at the large size; bone only also about 20 fps when enlarged.
Owner: relaying VR numbers by hand is a burden — benchmark here with the
practice data and the software GPU instead. Reply: the harness here
counts reads per pixel exactly and now times the pass (SwiftShader, CPU
proxy), but it cannot reproduce the Quest's texture cache and bandwidth,
so fps still needs the device. Hence this build: a benchmark in VR that
produces one result block.
- 画質 tab: ベンチ（約 30 秒）. 12 phases: 16.5 / 30 / 50 cm × shown
  segments / bone only × 100 % / 50 %, each 0.8 s settle + 2 s count.
  State (size, pose, segment modes, resolution) is restored afterwards.
  Result lines in the 画質 tab, the console, localStorage vrl-vr-bench, and a
  panel with a copy button on the page after leaving VR.
- Harness timing: the pixels are read back inside the timed region
  (SwiftShader does the fragment work on readback; the old figure was 0
  ms). Practice data, bone + fat, build 384: 627 ms for 256².
Checks: lint, 406 unit tests, boot-check.

## Build 386 — VR: tight ray loop for the combined-field path (pixel-identical, 609 → 177 ms on SwiftShader)

Owner: optimise on the environment here with the practice data to the
fastest state, then test on the device. Bench loop: practice 256³ volume
(scratch sample-volume.mjs), classification and distance bytes cached
(prep-cls.mjs → CLS= / DISTF= in the harness, MODES=cls), bone 300..3000 +
fat −200..−20 at 100 %, soft hidden, 256² image; a run takes 10 s.
Ablations on build 385 (SwiftShader ms, min of 5; reads per pixel 18.1 cls
+ 2.1 HU): no gradient normal 595 (image changes); simple shading (no
search, no normal) 376; tight inner loop 330 (identical); + segment work
on the fetched vector 268 (identical); + search without the surface search
105 (image changes); + search testing the fetched classification directly
177 (identical). SwiftShader's cost is dominated by per-step bookkeeping
and divergent loops, not by fetch counts; whether the Quest behaves alike
is what the in-VR benchmark (build 385) will tell.
- Shader: when the combined field is in use and no slice or cap is active,
  a tight loop runs: one fetch, jump or sample; segment index, own value and
  the largest enabled value from that vector; the surface search tests the
  fetched classification (first enabled segment holding the sample must be
  the hit segment, as segmentIndexAt did). The general loop is unchanged and
  still serves slices, caps, the separate-field path and the HU path.
- Harness vs build 385: practice data 0 differing channels; phantom specks
  + soft + edit box, bone only, fat sheets, separate field, no fat (HU and
  cls paths): all 0.
Checks: lint, 406 unit tests, boot-check, harness as above.

## Build 387 — VR: the ray-ending hit is searched after the march; vectorised segment test (identical, 177 → 145 ms)

Same bench as build 386 (practice data, bone + fat 100 %, SwiftShader ms).
- A hit on an opaque segment (the contribution would end the ray) records
  the bracket and breaks out of the march; the surface search and shading
  run once after the loop, outside the divergent march. Semi-transparent
  hits stay inline. Same arithmetic and order: 179 → 157 ms, 0 differing
  channels.
- Segment test on the fetched vector with an enabled-channel mask (max over
  channels in one expression, first enabled segment by a short loop):
  155 → 145 ms, 0 differing channels. An incremental texture coordinate
  (origin + step × t) saved 6 % more but differed by rounding (379
  channels): not taken.
- Since build 385: 609 → 145 ms (−76 %), every configuration
  pixel-identical (practice data; phantom specks + soft + edit box, bone
  only, separate field, exact search).
Checks: lint, 406 unit tests, boot-check, harness as above. Ready for the
in-VR benchmark on the Quest.

## Build 388 — Quest benchmark of build 387 (log only)

Owner's in-VR benchmark (build 387, 72 Hz, shown = bone + soft + fat):
- 16.5 cm (default): shown 100 % 72 fps / 50 % 72 · bone 100 % 72 / 50 % 72
- 30 cm: shown 100 % 57 / 50 % 72 · bone 100 % 72 / 50 % 72
- 50 cm: shown 100 % 39 / 50 % 69 · bone 100 % 70 / 50 % 72
Goal D (100 % at the normal size) is met at the default size, with soft
tissue shown as well; build 381 was 16–30 fps for bone + fat at 100 %.
The SwiftShader ablations (build 386/387) transferred to the Quest: the
per-step bookkeeping and the divergent search were the cost, not the
fetch count. Remaining: 30 cm at 100 % is 57 fps and 50 cm 39 fps; the
next steps there are non-exact (step 1.0 voxel, two search iterations) or
resolution, to be quantified on the harness before any device test.
Seen in the same screenshot: the Quest browser's 2D page shows the
WebGPU volume at 2 fps with "編集 2:keep 187049区間" (processed fat, keep
mode) — the Quest-browser comfort item (overnight task 2), not yet
addressed; the editAllows binary search per sample on a 187k-interval
mask is the likely cost (build 373 note: bit-mask texture).

## Build 389 — VR: the tight loop also serves rays with a section (slice, cut face); benchmark with section phases

Owner: the benchmark is doubtful — real use is section work, and fps is
lower there than the plain-display numbers. Correct: the tight loop of
builds 386–387 was used only for rays without a slice or cut face, so a
section sent every ray through the old general loop.
- Harness: SECTION=1 puts one section plane through the centre (cut face
  and CT slice at 70 % with tint). Practice data, bone + fat 100 %: with
  the section 505 ms on build 388 vs 153 without.
- Shader: a second copy of the tight march with the slice and cut-face
  events (same order as the general loop: slices up to t + step, then the
  cap, then the sample), chosen per ray; rays without events keep the
  first loop. One loop with a per-ray guard around the event code made
  SwiftShader's compiled loop twice as slow for every ray (352 ms without
  a section), so the two copies stay separate. Section 505 → 258 ms, no
  section 153 → 162 (noise); pixel-identical in every configuration
  (practice data with and without section; phantom specks + soft + edit
  box, exact search, separate field, each with the section).
- In-VR benchmark: 16 phases = 16.5 / 30 cm × section off / on × shown /
  bone only × 100 / 50 %; a temporary plane through the centre is added
  when none exists and removed afterwards; "断面なし / 断面あり" lines.
Checks: lint, 406 unit tests, boot-check, harness as above.

## Build 390 — Quest benchmark of build 389 with section phases (log only)

Owner's in-VR benchmark (build 389, 72 Hz, shown = bone + soft + fat):
- 16.5 cm 断面なし: shown 100 % 64 / 50 % 72 · bone 72 / 72
- 16.5 cm 断面あり: shown 100 % 72 / 50 % 72 · bone 72 / 72
- 30 cm 断面なし: shown 100 % 38 / 50 % 61 · bone 72 / 72
- 30 cm 断面あり: shown 100 % 65 / 50 % 71 · bone 72 / 72
Reading: with a section the march for rays with slice / cut-face events
is now as fast as without, and a section clips half the volume away, so
"断面あり" comes out above "断面なし". The "断面なし" figures are below the
build 387 run (64 vs 72 at 16.5 cm, 38 vs 57 at 30 cm, 61 vs 72 at 50 %):
the device was slower in this run as a whole (thermal state after long
use is the likely reason), so compare rows within one run only.
Still visible in the screenshot: the Quest browser's 2D page renders the
WebGPU volume at 2 fps ("編集 2:keep 187049区間").

## Build 391 — in-VR benchmark emulates real use (sweeping section, turning volume, bone + fat set)

Owner (build 389/390 bench): diverges from reality; bone + fat was
missing; the bench should operate the volume, not show it still.
- Every phase now runs with a section plane sweeping ±0.5 of the volume
  along its normal at 0.4 Hz and the volume turning at 0.5 rad/s (a
  temporary plane is added when fewer than four exist, else the first
  plane is moved and put back). Segment sets: as shown, bone + fat (soft
  and lung hidden; skipped when fat is not an active segment), bone only.
  12 phases, 16.5 / 30 cm × 100 / 50 %, about 35 s. Result lines
  "16.5 cm 断面を動かしながら: 表示中 … · 骨+脂肪 … · 骨 …".
Checks: lint, 406 unit tests, boot-check.

## Build 392 — Quest benchmark of build 391 (log only)

Owner's in-VR benchmark (build 391, sweeping section + turning volume):
every one of the 12 conditions at 72 fps (16.5 / 30 cm × shown, bone +
fat, bone × 100 / 50 %); bone + fat comfortable in use. Also: VR mode is
noticeably more comfortable than AR (passthrough), which the owner had
been using for the tests so far — the passthrough compositing takes part
of the frame budget on the Quest. Goal D closed for the owner's use
(section work at the default size and at 30 cm).

## Build 393 — VR: shader variants without the unused loops; GPU prepared before the session

Owner: adopt the Codex branch's pre-session compilation; shader
specialisation only if it measures. Measured first (practice data, bone +
fat 100 %, SwiftShader ms, pixel-identical): without the general loop
159 → 146 (no section), 269 → 254 (section); without the general loop and
the event loop 165 → 141 (no section). Modest but exact, so both go in.
- fragmentShader: preprocessor guards VRL_NO_GENERAL (drops the general
  loop and makes the combined path unconditional) and VRL_NO_EVENTS (drops
  the slice / cut-face copy of the march). The raw source is the full
  shader (the harness compiles it; DEFINES=VRL_NO_GENERAL,VRL_NO_EVENTS
  tests a variant). Session: three materials sharing one uniforms object
  (full, combined, noEvents) and their no-blending copies for the
  offscreen pass; chosen per frame: combined field in use and no diagnostic
  → noEvents when planeCount is 0, else combined; otherwise full.
- prepareVrGpu(P, mode): on the page, after prepareVrData and before the
  start button: a renderer with an XR-compatible context, the textures of
  both grids, the combined classification + field texture for the shown
  segments, the edit mask, every program (seven materials) compiled with
  compileAsync, then a GPU fence waited for. The session reuses the
  renderer and textures (gpuPrepared, keyed by data key and mode); the
  prepared combo texture is taken when its mask matches, so nothing is
  rebuilt or uploaded on the first frames. Falls back to the old path when
  preparation fails. Prep panel shows "GPU: x.x s". 詳細 tab: "初回描画 xx
  ms" = session start → first volume draw.
- segMode moved to module scope (shownMask); it now persists across
  sessions on the page.
- tools/vr-gpu-prepare-check.mjs (npm run vr-gpu-prepare-check): offline
  app + prepareVrGpu with a 32³ synthetic volume on SwiftShader: textures,
  combo, seven materials / four programs, no GL error.
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check, harness
(raw shader and the variants pixel-identical to build 392 on the practice
data with and without a section and on the phantom with specks + edit).

## Build 394 — Quest result of build 393 (log only)

Owner (Quest, build 393): 初回描画 897 ms after session start; comfortable.
No pre-393 figure exists for the same metric (it was added in 393); the
897 ms includes the XR session setup and the wait for the first head pose
before placement, not only GPU work.

## Build 395 — VR: no separate field texture when the combined one serves; auto resolution starts at 100 %

Owner: merge #82 and go on with the small items.
- useData: the separate distance-field texture (67 MB at 256³) is created
  and uploaded only when the combined classification + field texture
  cannot be used (four segments stored); otherwise the combined texture
  alone drives the sphere tracing. The field diagnostic toggle still turns
  the field off. Memory on the Quest drops by that texture.
- Auto resolution (interval mode, the Quest's case): starts at 100 %
  instead of 50 % (72 fps at the default size since build 387) and ramps
  up ×1.15 per half second instead of ×1.06 (50 % → 100 % in about 2.5 s
  instead of 6); the down step is unchanged.
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check. Shader
unchanged.

## Build 396 — VR: two sections held at once (one per hand)

Owner: section work used one plane at a time; wants to move two planes
with both hands at the same time.
- vr-view.js: the held plane is per controller (c.userData.heldPlane)
  instead of one section.held / heldPlane. Each hand takes a plane with the
  chosen button (grip or trigger, 持ち方) near it or by its ray and fixes it
  on release, independently of the other hand. A plane held by one hand is
  excluded from the other hand's near / ray pick (no stealing; the other
  hand's ray passes through it), so a grip then falls through to the volume
  grab as before. fixAll() for sections off, the 持ち方 change and the bench
  start; removing a plane (left-hand panel) clears the hand that holds it;
  a disconnected controller drops its plane into the volume.
- Unchanged: volume grab / two-hand scale (only hands gripping empty space),
  thumbstick scroll moves the selected plane (the one taken last), shader
  and image (planes are read from world matrices every frame).
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check.

## Build 397 — VR sections: one target per hand shown, hand label on the handle

Owner (Quest, build 396): two planes held at once works. But the UI does
not show which frame a press will take, so with several planes the wrong
one is picked; and it should show which hand (right / left) holds or held
each plane. Cause of the wrong picks: the highlight lit every frame that
was near any hand or under any ray, while the press took near first
(frame centre within 20 cm) else the ray — at the 16.5 cm default size a
ray on plane B grabbed a near plane A, with nothing showing that A wins.
- Per hand per frame c.userData.target = the one frame its button would
  take (near first, else the ray; none while the ray is on the menu, tag,
  section panel or help board, or while the hand holds a plane).
  squeezestart / selectstart take that target, so the white frame is
  exactly the one grabbed. Only targets and held planes turn white.
- A thin white line from the hand to its target's handle when the target
  is picked by nearness (a ray pick already shows the ray).
- Handle: number plus 右 / 左 (R / L) of the hand that holds or last held
  the plane (WebXR handedness, not the controller index); redrawn only
  when the hand changes.
- Help texts (断面 tab) updated. Near/ray rule unchanged (offered to the
  owner: ray first, or distance to the frame instead of its centre).
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check. Shader
and image unchanged.

## Build 398 — VR: laser pointers in two colours, pointed frame glows in the hand's colour

Owner (build 397): wants it visually clear — laser-pointer style with a
different colour per hand, the pointed frame lighting up in that colour.
- Hand colours: right 0xff4433 (red), left 0x3388ff (blue), by WebXR
  handedness (grey when unknown); distinct from the plane colours
  (yellow, cyan, pink, green), which the frames keep.
- Ray: always the hand colour; to the hit (menu, tag, panel, help board,
  frame) at full opacity with a 6 mm dot at the hit point, else a 0.6 m
  beam at 35 % opacity (was an 8 cm light-blue stub, white on a hit).
- Frame glow: an 8 mm band over the frame (ShapeGeometry ring, depthWrite
  off) shown in the colour of the hand that holds the plane or whose
  button would take it (the build 397 target: near first, else the ray).
  Replaces the white frame; the frame lines keep the plane's colour.
- Near-pick guide line in the hand colour; the 右 / 左 on the handle sits in
  a disc of the hand colour.
- Help texts updated. Shader and image of the volume unchanged.
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check. The XR
frame loop has no headless test: a use-before-define in the new loop code
was found by reading and fixed before the push.

## Build 399 — VR sections: the frame the laser points at wins over the near frame

With the laser pointers (398) the near-first rule (397) would let the dot
sit on frame B while frame A (centre within 20 cm of the hand, common at
the 16.5 cm default) glows and is taken. Now a frame hit by the ray is the
target; the nearest frame (guide line) only when the ray hits no frame.
Trade-off: with the hand at A and the ray across B, the hand takes B.
Help text updated. Per-controller loop re-read for use-before-define and
shadowing (none). Checks: lint, 406 unit tests, boot-check,
vr-gpu-prepare-check.

## Build 400 — VR sections: single frame, thinner glow, calmer palette

Owner (build 399): the double frame has lost its meaning — one frame for
all; the glow on the selected / pointed frame should be thinner; a
smarter colour scheme including the lasers.
- Inner loop (selected = thumbstick target) removed; the selected plane is
  still shown by its coloured name button in the 断面 tab and on the
  left-hand panel. Help text updated.
- Glow band 8 mm → 3 mm (±1.5 mm around the frame line), opacity 0.95.
- Palette: planes soft gold 0xf2d27a, sky 0x8ec5ff, rose 0xf5a3c7, mint
  0x9be3b0 (one pastel family, dark text on the handles and buttons);
  hands vivid orange 0xff7a3d (right) and indigo 0x7c6cff (left), outside
  the plane hues so a glow never reads as a plane colour. Ray end dot
  6 → 4 mm. Idle beam unchanged (0.6 m, 35 %).
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check. Shader
and volume image unchanged.

## Build 401 — VR: every added section plane clips by default

Owner (build 400): looks good. Planes are added in order to cut, so a new
plane should default to 切る. addPlane(c, cut = true): the B/Y long press,
the ＋追加 buttons (断面 tab, left-hand panel) and the first plane all
create clipping planes (before: only the first one clipped). The global
clip mode (切る: 手前 by default) still decides how. The in-VR benchmark
keeps its old rule (its temporary plane clips only when it is the first)
so its numbers stay comparable.
Checks: lint, 406 unit tests, boot-check, vr-gpu-prepare-check.

## Build 402 — VR: the laser also hits the volume (shown segments, clipped side removed)

Owner (build 401): OK. The pointer should also hit the 3D object.
- docs/vr-pick.js marchClassificationHit: the ray in the volume's object
  space (box ±halfExt, the shader's texCoord mapping: y index runs down) is
  marched in half-voxel steps over the classification bytes (nearest
  voxel, the ≤256 grid they were built on) to the first voxel of a shown
  segment (value ≥ 128, as the shader's 0.5); the start / end of the march
  are cut by the clipping planes exactly as the shader does (kept where
  n·p − w ≥ 0, this frame's cutPlanes / planeCut uniforms), so the laser
  stops on the cut face where tissue is, not on the removed half. Edit
  exclusions are already zero in the bytes. Unit-tested (index mapping in
  x / y / z, clip planes with and without their bit, misses, scaled
  direction).
- vr-view.js: ray priority menu, tag, panel, help board, frame, then the
  volume; a volume hit only shortens the laser and puts the dot there (it
  does not select anything; the grip still grabs the volume anywhere).
  No hit without classification bytes (no shown segment). Not tested:
  the CT slice image drawn on a section is not a hit surface.
- Cost: at most about 900 nearest-voxel reads per hand per frame on the
  CPU, only when the ray crosses the box.
Checks: lint, unit tests (5 new), boot-check, vr-gpu-prepare-check. Shader
and image unchanged.

## Build 403 — VR: black of the slice transparent at any opacity; left-hand panel moved aside

Owner (after merging #84, main = build 402): A — the black part of the
slice should be transparent, at any slice opacity. C — the left-hand
panel should sit further to the side of the volume.
- Shader: sliceColor returns alpha = smoothstep(0, 0.05, gray): at or
  below the VR window's lower end the slice adds nothing, ramping to the
  set opacity over the first 5 % of the window; tinted pixels keep the set
  opacity. The three slice composites use contribution × alpha.
- Harness (phantom, SECTION=1, BG=90,110,130 — new option: composite over
  a background with clear alpha 0 so an alpha-only change is counted):
  204384 of 442368 channels differ, all in the slice's air area (it was a
  dark slab at 70 %, now the background shows); the body, cut face and
  tinted slice are unchanged. Images sent to the owner.
- Left-hand panel: offset (0, 0.10, 0.03) → (−0.10, 0.10, 0.03) on the
  left controller.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check (all programs
compile).
Next (owner-approved): one central progress modal for every long
operation (2D, 3D, VR preparation): shown only after a short delay,
blocks input while shown, with a cancel button against freezes.

## Build 404 — VR: the nearest board along the ray takes the press

Owner (build 403): the left-hand section panel cannot be focused when the
main menu is behind it. Cause: the ray tested the boards in a fixed order
(menu, menu tag, panel, help board), so a menu anywhere behind the panel
won. boardHits(c) now takes the nearest of the four hits; the frame loop
(hover, laser length, dot), the trigger (menu buttons / sliders, tag,
panel) and the grip (moving the menu or the help board) all use it.
Frames and the volume still come after the boards.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.

## Build 405 — one central progress modal for every long operation

Owner: the progress of filters, 3D rebuild, CT value settings and so on is
shown in different places; show it in one modal in the middle of the
screen, 2D or 3D alike, for every operation now and later. Decisions:
short operations are not shown; input is blocked while it is shown (the
work is heavy); a stop button against freezes; VR preparation included.
- docs/progress-modal.js: createJobTracker (slots, unit-tested) + the
  modal. setBusySlot(name, on, {label, cancel, counted}) and
  reportBusyProgress(name|null, done, total, detail), setBusyLabel(name,
  text). Shown after 400 ms (SHOW_DELAY), the slot started last on top;
  title, detail line, bar (or an indeterminate bar), elapsed seconds.
  While shown: a full-screen layer takes the pointer, keys / wheel outside
  the modal are swallowed. Button: 中断 when the job has a cancel path;
  閉じる（処理は続行） after 10 s when it has none, or 3 s after a 中断
  that did not end it — the modal can never lock the page.
- Adapters (so the existing call sites feed it without rewrites):
  setProcessingBusy → slot 'processing' (counted; CPU filters, filter
  application / preview, editable segment preparation = the CT value
  settings path, GPU readback for STL / analysis); set3DBusy → 'three'
  (last call wins; 中断 presses the existing 3D cancel button, i.e.
  cancel3DRebuild); set3DBusyLabel for the analysis phase counts that wrote
  #three-busy-label directly; data-load busy() → 'load' (counted; folder,
  demo, practice data, series decode, MPR cache); progress() /
  byteProgress() → the bar of the job on top; segment phase progress →
  'processing' detail. New slots: 'edit' (cut apply), 'export' (STL), 'vr'
  (VR / AR preparation: the page panel is hidden while preparing and
  appears with the timings and the start button when ready or failed; the
  start stays a click, as WebXR requires).
- The old indicators are no longer shown (CSS): #processing-overlay,
  #three-busy (its cancel button is still used through the modal),
  #scan-progress. Result texts stay where they were (segment card
  done / error, footer, 3D filter badge, ready badge).
- Labels: CPU filters "<name> を適用中…", filters "フィルターを適用中…" /
  "フィルターのプレビューを作成中…" (were English).
- Not in the modal (background, nobody waits on them): the quiet
  segment prewarm (analysis-ops), MPR warmup, GPU prewarm, cache writes.
  Not covered: project save (the save dialog / share sheet waits on the
  user; the packing itself is synchronous).
- tools/progress-modal-check.mjs (npm run progress-modal-check): headless
  practice-data load — modal seen (データを読み込み中…, 13/512 …),
  blocks input, gone with no slot active at the end (about 35 s);
  set3DBusy shows 中断 and pressing it presses the 3D cancel button; VR
  preparation shows 'VRの準備' and then the panel with an enabled start
  button (8 s); a 150 ms job is never shown. No WebGPU headless, so a real
  3D rebuild is not exercised there. Screenshots desktop / iPad width.
Checks: lint, unit tests (9 new), boot-check, vr-gpu-prepare-check,
progress-modal-check.

## Build 406 — progress modal: review fixes

- Input blocking: the wheel is stopped by the modal's own non-passive
  listener (a window-level non-passive wheel listener made every scroll on
  Mac / iPad wait on the main thread, modal or not); key releases are no
  longer swallowed (a key held when the modal appears would stay held).
- 3D 中断 only while a 3D rebuild runs (threeDApplying): cancel3DRebuild
  stops nothing else, so other 3D jobs (analysis, GPU volume preparation)
  get the close fallback instead of a 中断 that does nothing; the handler
  is called directly (a click on the disabled hidden button was ignored).
- Load phases in the modal title (データを読み込み中 · 練習データを取得中 /
  DICOMを確認中 / スライスを展開中 / GPUボリュームを準備中 / MPRキャッシュを作成中 /
  3D断面キャッシュを作成中): these were only in the side panel, now behind
  the modal.
- progress-modal-check: real processing paths on the practice data —
  adding Fast NLM 3D shows 'フィルターを適用中…' and ends with no job left
  (7 s); adding the bone segment ran without a visible job (short);
  set3DBusy without a rebuild shows no 中断 and ends cleanly; iPad-width
  screenshot on a page laid out at 820 × 1180 (synthetic job).
Untested headless (no WebGPU): a real 3D rebuild and its 中断.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check,
progress-modal-check.

## Build 407 — segments start at 100 % opacity; VR slice transparent at or below a CT threshold

Owner (after 406): 1 — every segment's initial opacity 100 % (translucent
segments are heavy and feel bad); 3 — the VR slice should be transparent
at or below the value treated as air, so that fat can be hidden too by
raising it.
- segments.js / ui-shell.js: bone .85, soft .28, fat .35, lung .35 → 1 (the
  sliders' initial values too). Saved projects keep their own values (no
  sample project file exists).
- VR: new setting sliceAir (DEFAULTS −500 HU, スライス tab: 透明にするCT値,
  slider −1000..+500 HU in 10 HU steps with −/＋). The slice is transparent
  at or below it and reaches the set opacity 10 HU above; the test comes
  before the segment tint (tinted fat can be hidden). Replaces the 403
  window-lower-end rule: values between the threshold and the window's
  lower end show as black again. The cap is unchanged.
- Harness (phantom, SECTION=1, BG=90,110,130; new option AIR=<HU>) vs 406:
  AIR=−500 1320 of 442368 channels differ (edge of the air ramp); FAT=1
  (fat sheets) AIR=−50: 7130 differ (the fat on the slice is gone).
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.
Next (owner-approved): analysis results kept as an edit (saved in the
project, 14 colours, deletion linked — already so via
rebuildEditedAnalysisForSegment), carried to VR / AR (colour on the
volume and the slices, a read-only list with volumes).

## Build 408 — analysis results kept like an edit: saved in the project, trimmed by edits, 14 colours

Owner: keep the analysis results (colouring within a segment) as an edit,
carry them to VR / AR (with the volume if possible), up to 14 colours,
deletion linked.
- Found: in the GPU volume view every edit (keep / delete selected, cut,
  undo, redo, reset) called clearAnalysisHighlight — all results vanished;
  only the surface view rebuilt them. Leaving the analysis mode also
  cleared them, and nothing was saved.
- trimAnalysisRegionsAfterEdit(key, refs) (analysis-ops.js): in the volume
  view the edited segment's single-segment regions become the pre-edit
  references cut to the edit state (∩ keep, − exclude), colour / flags
  kept, voxels and mm³ recomputed, empty ones dropped (undo / redo use the
  snapshot's analysisRefs). The surface view keeps
  rebuildEditedAnalysisForSegment.
- Leaving the analysis mode keeps the results (クリア clears them).
- Project: project.analysis.regions [{key, segmentKeys, color, visible,
  merged, groupId, runs: 'analysis/region-N.bin'}] (encodeRuns); applied
  after the segments and edits (after the clearAnalysisHighlight there),
  volumes recomputed from the runs. Older projects have no entry.
- Palette: 8 → 14 colours (the first 8 unchanged).
- downloadBlob moved to utils.js (data-load.js re-exports it) so that
  data-load.js can import analysis-ops.js without an import cycle.
- tools/analysis-project-check.mjs (npm run analysis-project-check):
  practice data, bone segment, two synthetic box regions (2000 / 125
  voxels, one hidden) → save → clear → apply: both back with colour,
  visibility and voxels; excluding half of the first box and trimming
  gives 1000 / 125. A real 3D analysis click is not exercised (no WebGPU).
Unchanged: any segment setting change (CT range, filters of the segment)
still clears all results (they no longer match the segment).
Checks: lint, unit tests, boot-check, analysis-project-check.

## Build 409 — VR / AR: analysis result colours on the volume and the slices; read-only list with volumes

- prepareVrData: region index (buildRegionIndex) on the edit-mask grid —
  one byte per voxel, 0 none, 1..14 = the distinct colours of the visible
  regions in list order (at most 14, a later region wins on overlap),
  rasterised with gpuRunsForTexture like the edit mask; P.region =
  {dims, data, colors, list}. vrDataKey includes the visible regions
  (id, colour, voxels), so changed results are prepared again.
- Shader: regionColor(p, base) replaces the segment colour where a colour
  is chosen — surface hits (general loop, both tight loops, the post-march
  hit; sampled 0.75 voxel inside the surface), the cut face, the slice
  tint — never per step. Compiled only with VRL_REGIONS (set when the data
  has results; all variants inherit the base defines): the uniform-branch
  version cost about 14 % on SwiftShader even without results.
- Textures: R8 nearest; prepared in prepareVrGpu (initTexture, compiled
  with the define) and reused by the session; disposed with the edits.
- Menu: sixth tab 解析 (tabs share the width): colour swatch, segment,
  mm³ per region, 10 per page with ◀ ▶, total. Read only.
- Harness REGION=1 (synthetic index: half the volume, cyan, VRL_REGIONS):
  no results → pixel-identical to 408 in every variant (general, combined,
  noEvents, with a section), same fetch counts and time; with the region
  35790 of 442368 channels differ (the coloured half), SwiftShader
  710 → 823 ms (+16 %, only while results are shown in VR).
- analysis-project-check also prepares VR after restoring: region index
  built (1 colour, 1 entry, 100 voxels on the 256 grid), GPU preparation
  with VRL_REGIONS compiles (7 materials).
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check,
analysis-project-check, progress-modal-check.

## Build 410 — WebGPU section cap shows the analysis result colours

Owner (screenshot of the WebGPU view with a section): the colours should
show on the cut face too, not only on the surfaces (and in VR / AR).
- medical-volume.js cap: for a segment with results, analysisOverlayAt at
  the cap point (region index texture, else the row search) replaces the
  segment colour (same 22 % lift as the cap colour); the hatch still
  applies. One lookup per cap pixel, none when there are no results.
- tools/volume-shader-check.mjs: SECTION=1 (axial section at SECTION_Z,
  SECTION_SIGN picks the kept side, cap 85 %).
- Harness (phantom, ANALYSIS=1: bone sphere = one cyan region): no
  section → 0 differing channels; SECTION_Z=0 kept side −1 → 15402 of
  442368 channels differ (the sphere's cap turns cyan), +1 → 285.
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check.

## Build 411 — section cap: no uncoloured line along the analysis result boundary

Owner (Mac, build 410 screenshot): the colour on the cut face is slightly
off — a thin uncoloured (segment-coloured) line remains along the result
boundaries. Cause: the cap's segment comes from interpolated HU, the
result from whole voxels (nearest), so a cap point on the segment edge can
lie in the voxel just outside the result. Fix: when the cap point has no
result, the six neighbouring voxels are tried (as regionOverlayNear does
for surface hits); only on cap pixels of a segment with results.
Harness (phantom, ANALYSIS=1, SECTION=1 at z 0): 1353 channels differ vs
410, all on the cap's rim — the pale bone-coloured fringe around the cyan
cut face is gone (crops sent); without a section 0 differ.
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check.

## Build 412 — section cap: the result is searched where the cap found its segment

Owner (Mac, build 411): close, a few thin uncoloured lines remain.
Cause found in the code: capSegmentIndex takes the segment from up to 2
voxels along the section normal when the cap point itself has none, while
411 searched the result only ±1 voxel per axis. Now: the cap point, then
±1 and ±2 voxels along the normal (as capSegmentIndex), then the 8
in-plane neighbours (diagonals included); first hit wins. Trade-off: on
the cap the colour can reach 1–2 voxels past the result (display only;
volumes are counted from the runs).
Harness (phantom, ANALYSIS=1, SECTION=1 z 0, kept side −1) vs 411:
REGIONR=22 486 channels differ (cap rim), REGIONR=21 501; without a
section 0. Not reproducible on the owner's data here.
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check.

## Practice-data check after build 412 (tool only, no app change)

Owner: why not check on the practice data — filters may matter. Right:
the phantom could not show it. The app's WebGPU view does not start in
the headless Chromium here (three.js WebGPU: texture view 'swizzle'
error), so tools/analysis-fringe-check.mjs uses the app's CPU path on
docs/demo/sample1: fat segment (−250..−50), final runs, their largest
connected component (= the analysis region), then segment voxels outside
it by contact with it.
- No filter: 5418876 fat voxels, 57413 components, largest 3788129;
  outside it, face contact 0 (6-connectivity, as expected), edge / corner
  contact only 18450.
- Spatial Filter 3D (gaussian): 5682902 voxels, 13593 components, largest
  5313034; face 0, edge / corner only 8256.
Reading: the analysis labels components with 6-connectivity (face
neighbours). Voxels touching the region only along an edge or a corner
are separate components, so they stay in the segment colour — the thin
lines along the result boundary, with and without the filter. The 411 /
412 neighbour search on the cap hides part of them (display only).
Owner decision needed: 26-connectivity for the analysis (those voxels
join the region; volumes change, e.g. +18450 voxels here, and depots
touching at a corner merge) or keep 6 and show the boundary as is.

## Build 413 — section cap back to the exact voxel lookup (411–412 neighbour search removed)

Owner (Mac, build 412): voxels that are not annotated get the result
colour — not acceptable for research use. The neighbour search of 411 /
412 is removed; the cap takes the result of exactly the voxel at the cap
point (build 410's code; WGSL identical to 410 apart from comments).
Harness vs 410 with SECTION=1, ANALYSIS=1: 0 differing channels. The thin
lines along the boundary are voxels that touch the result only at an edge
or corner (separate components under 6-connectivity, see the practice-data
check above); they correctly keep the segment colour.
Still approximate (pre-existing, reported to the owner): WebGPU surface
hits use regionOverlayNear (build 375, tries points up to 1.5 voxels
inward and along the ray), VR surface hits sample 0.75 voxel inside
(build 409).
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check.

## Build 414 — 2D drew deleted voxels after volume-view edits and air-exclusion changes

Owner (Mac): while editing, 2D and 3D stopped agreeing; it happened with
the "exclude next to air" operation.
- tools/edit-consistency-check.mjs (npm run edit-consistency-check):
  practice data, fat segment with air exclusion 0.3 mm, an exclusion
  edit (box) applied as the volume-view edits do, then the air exclusion
  changed to 0.6 mm; compares the runs 2D draws (activeMprSegments) with
  the 3D edit mask (gpuVolumeEditDescriptors). Before the fix: after the
  edit 749553 voxels only in 2D (deleted voxels still drawn), after the
  air change 636528. After: 0 / 0 / 0.
- Cause: the volume-view edits reset finalRuns and push the 3D mask, but
  nothing rebuilt finalRuns, so 2D fell back to the base runs (or the
  plain threshold) without the edits; a segment setting change (air
  exclusion) also left finalRuns empty after the new base runs.
- Fix: syncGpuVolumeEdits fires 'vrl-gpu-edits-synced'; app.js rebuilds
  the final runs of edited segments that have none and repaints 2D (one
  pass per burst). prepareSourceSegmentPostprocess rebuilds the final
  runs from the new base runs when the segment has edits.
Second report (cut-face colour shape vs 3D at the periphery): asked for a
screenshot. Known difference: WebGPU surface hits take the result colour
from regionOverlayNear (any result voxel up to 1.5 voxels inward / along
the ray, build 375, for speed), while the cap now uses the exact voxel.
Checks: lint, unit tests, boot-check, edit-consistency-check,
analysis-project-check.

## Build 415 — CT range change handled like the other segment settings

Owner: changing CT values breaks many things ("it used to work").
- edit-consistency-check now also moves the fat segment's CT range
  (−250..−50 → −200..−80, input + change as the sliders) after the edit
  and the air exclusion. Before the fix (414, and the same on main =
  build 402, run from a worktree of origin/main): after the CT change
  neither the processed runs nor the final runs existed — 3D fell back to
  the plain threshold (air exclusion lost) and 2D to the threshold without
  the edits. main also showed the 414 edit mismatch (749553 / 636528
  voxels), so both are older than this session's changes.
- Cause: min / max onchange only repainted (renderAll); the input handler
  had already dropped the base / final runs, and nothing recomputed them,
  pushed them to 3D or cleared the analysis results (which no longer match
  the segment).
- Fix: min / max onchange → invalidateSegment(true) (results cleared,
  post-processing recomputed and pushed to 3D, 2D repainted);
  invalidateSegment(true) also rebuilds the final runs of an edited plain
  segment.
- Check: SURFACE=0.3 (processed) and SURFACE=0 (plain): 0 mismatched
  voxels after the edit, the air change and the CT change; the modal
  showed 編集領域を準備中 on release; no job left running.
Checks: lint, unit tests, boot-check, edit-consistency-check (both),
analysis-project-check, vr-gpu-prepare-check.

## Build 416 — WebGPU section cap = the 2D slice, voxel for voxel

Owner: everything must be synchronised, no contradictions (research use);
the cut face's colouring did not match the 3D shape at the periphery.
- volume-shader-check IDCAP=1: a pass per file returns, for every pixel
  whose ray reaches the cap, the voxel at the cap point, the segment the
  cap shows and whether it takes the result colour; compared with the
  phantom's voxel truth (that voxel's HU in the range, the edit applied,
  inside the region).
- Before (415): axial cap at slice 64, region radius 21 in the bone
  sphere (22): 691 of 60385 cap pixels wrong (99 shown where the voxel is
  not in the segment, 288 missing, the rest the wrong segment); slice 80
  with the exclusion box: 1252 of 64629 wrong (1017 shown, 195 missing).
- Cause: capSegmentIndex used interpolated HU and, where that found
  nothing, took a segment from up to 2 voxels along the normal; the ray
  march's interpolated exclusion test also applied.
- Fix: the cap classifies the voxel at the cap point by its own stored
  value (huVoxel) and that voxel's edit / processing mask entry
  (editAllows); no neighbours, no interpolation. The result colour already
  used that voxel (413).
- After: 0 wrong at slice 64, at slice 80 with EDIT=1 and with EDIT=2
  (specks excluded); without a section 0 differing channels.
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check IDCAP.

## Build 417 — WebGPU surface hits: the result colour of the voxel that forms the surface

- volume-shader-check IDHIT=1: for every bone surface hit (the segment
  with the result) the voxel the surface is attributed to (insideVoxelTc),
  the segment and whether it is coloured, against the voxel truth.
- Before (416, regionOverlayNear from build 375 with the index texture):
  region radius 21 inside the bone sphere (22): 58 coloured hits, 43 of
  them on a voxel outside the result; radius 22: 4 of 7232.
- Fix: the colour comes from analysisOverlayAt of insideVoxelTc's voxel
  (the first candidate voxel that is in the segment, now with its own edit
  / processing mask entry) in both the index-texture and the row path.
- After: 0 coloured hits outside the result (15 / 7228 coloured); without
  results 0 differing channels; with results 12 channels differ; SwiftShader
  pass 3005 → 3089 ms (noise level).
- Inherent, reported to the owner: 273 of 19394 bone hits lie where no
  candidate voxel is a bone voxel (the interpolated iso-surface runs
  outside the voxel set); they stay uncoloured.
Checks: lint, unit tests (WGSL), boot-check, volume-shader-check IDHIT /
IDCAP.

## Build 418 — filter change: segmentation recomputed, stale analysis results cleared

- edit-consistency-check, new last step: an analysis result is added,
  then Spatial Filter 3D. Before: ~10 s later the fat segment's base runs
  were still those of the old filter (signature stale) and the result was
  still there — 2D, 3D and the result showed the pre-filter segmentation.
- Fix: scheduleFilterRebuild fires 'vrl-filters-changed' after the
  rebuild; app.js clears the analysis results and recomputes every
  processed or edited active segment (prepareSourceSegmentPostprocess, or
  the final runs + 3D sync), then repaints 2D.
- After: base current, 2D runs = 3D mask = final runs computed for the new
  filter (0 voxels apart), results 1 → 0. Both SURFACE=0.3 and SURFACE=0
  pass (the plain-segment run first failed on a check bug — the 3D side of
  a plain segment is base − exclusion, not a keep mask; fixed in the tool).
Checks: lint, unit tests, boot-check, edit-consistency-check (both).

## Build 419 — analysis result colours in the 2D views, voxel for voxel

Owner: the colouring should show on the 2D side too.
- Before: 2D drew the results as a faint overlay (18 %, 40 % focused) on
  top of the segment colour, and only in the analysis mode.
- mpr-render.js: a voxel of a visible result is painted in the result's
  colour instead of its segment's, at the segment's opacity, in every mode
  (as in 3D); exact membership from the result's runs (plane masks on
  full-resolution planes, else run lookup); both the source-backed and the
  in-memory plane painters. The analysis mode keeps the 2 px outline of
  the focused result; the faint fill is gone (it would double the colour).
- tools/result-2d-check.mjs (npm run result-2d-check): practice data, fat
  segment, its largest component as the result; the pixels that change
  when the result is added equal its voxels on the plane exactly — axial
  15157 / 15157, coronal 17874 / 17874, sagittal 9281 / 9281, 0 extra,
  0 missing.
Checks: lint, unit tests, boot-check, result-2d-check,
analysis-project-check.

## Build 420 — one selected plane shared by the section analysis, 3D plane buttons, main view and 2D tabs

Owner: when choosing a section direction (section analysis etc.) every
place has to be set separately; choose once, everything follows.
- app.js selectPlane(p, source): an open section switches to p, the 3D
  view shows p's plane and hides the other two (the XYZ axes untouched),
  a 2D main view switches to p, the workspace 2D tab selects p
  ('vrl-plane-selected'; workspace-ui sends 'vrl-plane-chosen').
  Sources: section analysis buttons, a 3D plane button turned on, a 2D
  plane brought to the main view (button or drag), the workspace 2D tab.
  Re-entrancy guard; start-up and view-mode changes do not broadcast. VR
  keeps its own planes.
- tools/plane-sync-check.mjs (npm run plane-sync-check): practice data;
  section analysis → coronal, workspace tab → sagittal, 3D button → axial,
  main view → coronal: after each, section, 3D plane, tab (and the main
  view when it is a 2D plane) all show the chosen plane.
Checks: lint, unit tests, boot-check, plane-sync-check, result-2d-check.

## Build 421 — the 3D view follows the selected plane; section analysis reversed by default

Owner: the 3D view should follow the plane choice too; the section
analysis should cut the reversed side by default.
- selectPlane also turns the 3D view to face the plane with the existing
  view-button function (setAxisView, exposed on sceneState): axial → Z,
  coronal → Y, sagittal → X.
- sectionViewReverse starts true and is reset to true when the section
  closes (was false).
- plane-sync-check also asserts reverse = true and, when a 3D object
  exists, the view axis; headless here has no 3D object (WebGL fallback
  without a build), so the view turn is not exercised (it is the Z / Y / X
  button's own code).
Checks: lint, unit tests, boot-check, plane-sync-check.

## Build 422 — opening the section analysis selects the plane in use

Owner: when the section analysis starts, the plane currently set should
already be selected (it opened with no plane).
- app.js currentPlane(): the last plane chosen (selectPlane), else a 2D
  main view, else the workspace 2D tab, else axial. The section toggle
  opens with setSectionView(currentPlane()) and syncs as a section choice
  (reversed side, 3D plane, tab, 3D view).
- plane-sync-check: 2D tab → sagittal with the section closed, then open
  the section analysis → it opens on sagittal (reversed); the other steps
  unchanged.
Checks: lint, unit tests, boot-check, plane-sync-check.

## Build 423 — VR / AR: result labels at the laser point (faint while pointing, pinned with the trigger)

Owner: while the 解析 tab is open, or when no section is shown, the trigger
should show the analysis result of the region the laser points at, as an
annotation in 3D. Decisions: (1) one label per result, the trigger pins /
unpins it; (2) a faint label while just pointing; (3) no result → the
segment name with 解析結果なし.
- vr-pick.js marchClassificationHitInfo: the volume march also returns the
  hit voxel and the matching channel (unit test added).
- buildRegionIndex also stores the result's list position per voxel
  (ids, up to 255 results) on the same grid as the classification.
- vr-view.js: label mode = (menu open on the 解析 tab) or no section shown.
  Faint label (55 %) per hand for the current volume hit: colour disc,
  number as in the 解析 tab, segment, mm³; or the segment name and
  解析結果なし. Trigger on a result (no frame targeted) pins / unpins its
  label at that point; pinned labels follow the volume (anchored in the
  volume's object space, re-placed each frame), face the viewer, with a
  thin line to the point; no depth test so they stay readable. Section
  trigger handling is unchanged when a section is shown.
- analysis-project-check: the region ids match the region's voxels (100 on
  the 256 grid). The XR frame loop has no headless run: Quest check needed.
Checks: lint, unit tests (6 vr-pick), boot-check, vr-gpu-prepare-check,
analysis-project-check.

## Build 424 — diagnostic: VR analysis cost bench (no behaviour change)

Owner (Quest, 423): VR mode with analysis is very heavy; the volume labels
could not be checked. Not guessed: a bench in the 画質 tab, 解析の重さ
(about 12 s), four phases at the current size / resolution / view, 0.8 s
settle + 2 s count each: as is / without the result colours (the shader
variants without VRL_REGIONS, built on first use, sharing the uniforms) /
without the laser's volume march and labels / neither. While labels are
on, both hands' rays are replaced by a ray from the head to the volume
centre, so a label is drawn and placed every frame. One result line (also
the page's bench panel after exit): fps per phase, number of results and
whether VRL_REGIONS is compiled, pins, size, resolution.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check,
analysis-project-check.

## Build 425 — VR: the pointing label made small and unobtrusive

Owner (Quest): with the 3D-edit region selection the results could be
viewed in VR / AR at a practical speed (the heavy case did not come back;
the 424 bench stays available). The faint label while nothing is selected
is in the way: smaller, unobtrusive, or gone.
- The pointing (hover) label is half size (6 × 1.8 cm), 40 % opacity, no
  connecting line, 1.6 cm above the dot (was full size, 55 %, line, 4.5 cm
  above). Pinned labels unchanged.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.

## Build 426 — VR: label size setting

Owner: the labels a bit smaller still, and the size settable. Also asked
(question, not implemented): should the faint pointing label sit at the hand
instead of at the pointer — answered with a proposal, waiting for the owner.
- 解析 tab: ラベルの大きさ 小 / 中 / 大 = 50 / 70 / 100 % of the 12 × 3.6 cm
  label (大 = the 425 size); default 中. Pinned labels use it, the pointing
  label is half of it (中: 4.2 × 1.3 cm). Stored in the VR settings
  (labelSize), applied every frame so a change reaches labels already shown.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.

## Build 427 — VR: pointing label at the hand, labels small by default

Owner (Quest, 426): 小 was just right as the default; agreed to the proposal
of showing the pointing label at the hand instead of at the pointer.
- labelSize default 小 (50 %: 6 × 1.8 cm).
- The pointing label is a chip above its own controller (target-ray space,
  left (0.03, 0.095, 0.02) — clear of the menu badge and the section panel —
  right (0, 0.095, 0.02)), facing the head, framed in that hand's laser
  colour, 85 % opacity, no line, same size as pinned labels (not halved: it is
  always at reading distance). The laser dot still marks the point; pinned
  labels stay at their point in the volume with the line.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.

## Build 428 — analysis results lost after loading a project with filters

Owner: results saved in the project did not come back; while loading, the
colours appeared and then vanished.
- Cause (measured, practice data): applyProject replays the project's
  filters; the filter rebuild that this starts ends after the results are
  restored and dispatches 'vrl-filters-changed', whose build 418 handler
  cleared every result. analysis-project-check passed because its project
  had no filter.
- Fix: state.analysisFilterSignature = filter signature of the data the
  results belong to (set by restoreAnalysisRegions after the replay, and at
  every 'vrl-filters-changed'); the handler clears only when the signature
  differs. A real filter change still clears (research rule unchanged).
- analysis-project-check FILTER=1: Gaussian filter + bone opening 1, results
  = boxes ∩ the final runs, save → clear → apply, wait for the load's work →
  both results back (201 / 15 voxels); then a Gaussian strength change → 0
  results. Without the fix the same run loses the visible result (FAILED).
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check,
analysis-project-check (plain and FILTER=1), edit-consistency-check.

## Build 429 — VR: pointing label at the root of the laser

Owner (Quest): 428 works (results come back from the project). The pointing
label above the hand keeps covering the 3D object: put it at the root of the
laser.
- HAND_CHIP: both hands (0, −0.03, −0.03) in target-ray space = 3 cm in front
  of the ray origin and 3 cm under the ray (was 9.5 cm above the controller);
  still facing the head, framed in the hand colour.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check.

## Build 430 — 2D colour strength in the settings

Owner: the 2D overlay strength (65 %) settable. Also asked how other tools
choose 6 / 26 connectivity (researched, answered; no change) and what the
1.4 % interpolated-surface hits are (explained; no change).
- Settings > 描画 > 2Dの色の濃さ: 30 / 50 / 65 (標準) / 80 / 100 % (app
  setting mpr2dAlpha, per device). segments.js mprSegmentAlpha(seg) =
  min(max(0.75, k), opacity × k), used by both 2D painters (simple and
  per-voxel path); at 65 % it is the pre-430 min(0.75, opacity × 0.65)
  exactly. A change repaints the 2D views ('vrl-settings').
- tools/mpr-alpha-check.mjs (npm run mpr-alpha-check): practice data, fat
  segment; formula equal for the opacity steps, 30 % / 100 % change 54283
  pixels, back to 65 % restores the image (0 pixels apart).
- Connectivity survey (sources read in code): 6 — ITK default, scipy,
  MorphoLibJ default, 3D Slicer Islands (hard-coded); 26 — scikit-image,
  Fiji 3D Objects Counter, BoneJ (26 foreground / 6 background), Avizo
  labeling per the BoneJ paper; Dragonfly offers both; CTAn unverified.
Checks: lint, unit tests, boot-check, mpr-alpha-check, result-2d-check.

Owner decision (after 430): the interpolated-surface hits without a
segment voxel (~1.4 %) stay uncoloured — the analysis numbers must be right,
the 3D look is a visual check only.
Sigmoid (owner: "not the expected behaviour"), measured on the practice data
(data −1361…3102 HU, centre default 198 = window centre, strength 0.5): the
mapping is over the whole data range and the centre is not a fixed point —
198 → 290 / 700 / 838 HU at strength 0 / 0.5 / 1; strength 0 is not the
identity (0 → 72, 40 → 116); soft tissue 40 → 398 HU at 0.5, so the segment
CT ranges no longer mean HU. Same formula in CPU, worker and WGSL. Fixed in 431.

## Build 431 — Sigmoid redone: contrast around a centre in HU

Owner: Sigmoid is there to adjust contrast, e.g. to sharpen the blurred fat /
soft-tissue border (measurements of the old filter: entry above).
- New mapping (CPU cpuSigmoid, source worker, WGSL; one formula): within
  centre ± width/2, y = c + hw·tanh(g·t)/tanh(g), t = (x − c)/hw,
  g = 6·strength; outside the window and at the centre the HU stay; the
  curve meets the identity at both ends; strength 0 = no change; monotonic.
- New control 幅（HU） 20–1000, default 200 (project param width; projects
  without it keep the slider's value). Strength and centre as before.
- tools/sigmoid-check.mjs (npm run sigmoid-check), practice data, axial mid
  plane, centre −31 (slider step), width 200, strength 0.5: filtered = formula
  of the unfiltered values (max error 7e-6), 0 values outside the window
  changed; voxels in −80…20 HU 13346 → 4502, fat (−130…−80) 7832 → 10017,
  soft tissue (20…70) 9435 → 13502. The WebGPU kernel (same formula) is
  covered by the WGSL unit test only (no WebGPU headless).
- Image change on purpose (owner's request); projects saved with the old
  Sigmoid look different now.
Checks: lint, unit tests (new sigmoid test), boot-check, sigmoid-check.

After 431 — owner: 431 turns 2D white on their device (not reproduced on the
CPU path here) and is not what was meant; the actual goal is the skin /
subcutaneous fat border (soft-tissue range takes fat, fat range takes skin;
a human sees the line). A point-wise curve cannot move a threshold border,
so 431 is to be reverted. Plan proposed: seeded growing between a confident
fat range and a confident soft range (ambiguous band assigned at the
strongest edge) + filter defaults for fat / soft separation.
Measured (practice data, axial planes at 30/45/60/75 % of z, body pixels
within 1.0 mm of the outside, values −300…300 HU; band = −80…20 HU,
fat < −100, soft > 100), CPU path:
- none: band 12.0 %, fat 14.1 %, soft 52.0 %.
- bilateral intensity 0.02 (≈ 90 HU of the 4463 HU range), strength 0.8,
  2 passes: band 9.6 %, fat 12.8, soft 52.2 (best); 0.02 / 0.45 / 1 pass:
  11.1 %. The current default (intensity 0.08, 0.45, 1 pass): 12.2 %;
  0.08 / 0.8 / 2: 14.5 %, soft 42.6 (smooths across the border).
- NLM 0.45 r1: 12.2 %; stronger is worse (1.0 r2: 14.9 %).
- anisotropic 0.45 × 4: 13.0 %; 0.8 × 8: 16.7 % (soft 35.7).
- TV 0.05 / 0.12 × 8: 11.8 %. Gaussian 0.4 × 2: 12.4 %.

## Build 432 — 431 reverted; bilateral defaults for fat / soft separation

Owner: 431 turned the 2D views white on their device and is not what was
meant (the goal is the skin / subcutaneous fat border; measurements above).
- 431 reverted (git revert): Sigmoid is the pre-431 filter again. The white
  2D root cause was NOT found — it did not reproduce on the CPU worker path
  here (screenshot of the practice data with Sigmoid: normal), so it was on
  the owner's GPU path; the revert removes the code that caused it. Owner to
  confirm on their device.
- Bilateral defaults (owner: defaults for fat / soft separation): strength
  0.45 → 0.80, intensity sigma 0.08 → 0.02, passes 1 → 2 (spatial 1.2
  unchanged). Measured above: subcutaneous band 12.0 → 9.6 % (default before:
  12.2 %), fat-confident 14.1 → 12.8 % (smoothing cannot restore thin
  layers). The other filters' defaults stay (stronger settings made the
  border worse, TV changed nothing). Saved projects keep their own values.
- Next (owner: 進めて): seeded growing between a confident fat range and a
  confident soft range.
Checks: lint, unit tests, boot-check.

## Build 433 — processed segments ignored the filters (pre-existing, found while planning the seed growing)

- Measured (practice data, fat −250…−50): base voxels plain 5418876 →
  Gaussian 5682902, but with Opening 1: 4086436 without and WITH the
  Gaussian. Cause: sourceRunsForSegment (and the surface-view builder) took
  a segment that needs a global mask (Opening, Closing, hole fill, min
  component, thin-region removal) from the in-memory MPR copy (v.mprData),
  which holds the unfiltered CT, whatever the filters. 2D painted those runs
  too, so 2D / 3D agreed with each other but not with the filters — against
  the build 418 rule (segments are defined on the filtered data).
- Fix: segments.js sourceMemoryUsable(v) = mprData and no active filter;
  sourceMprMemoryView returns null otherwise; sourceRunsForSegment then
  takes the filtered source path; the surface view builds such a segment
  from its final runs. After: Opening 1 + Gaussian 4718414.
- tools/processed-filter-check.mjs (npm run processed-filter-check).
Checks: lint, unit tests, boot-check, processed-filter-check,
edit-consistency-check, result-2d-check, analysis-project-check FILTER=1.

Seed growing, gate result (after 433, not shipped; kernel kept out of the
repo): phantom = layers along x (air | skin 1–4 vox | fat 2–10 vox | muscle,
+120 / −110 / +140 HU), Gaussian blur σ 0.8–1.3 vox, noise 0–40 HU, five
layouts in one volume; errors = body voxels not given their true class.
- The best single threshold (searched, −100…100) already gets everything
  but the air / skin rim column at noise 0 (σ 1: 192 errors = the rim).
- Growing between confident fat and soft ranges (sum |ΔHU| path cost,
  radius 4): no better (σ 1, noise 25: 236–277 vs 237). Local midpoint
  threshold: no better either.
- With air as a third competitor (fat-range voxels touching air become
  band): better at σ 0.8 (noise 15: 163 → 40–90) and σ 1 (noise 25: 237 →
  179), not at σ 1.3. Depends strongly on the confident ranges.
- Practice data (z 0.3–0.75, fat −250…−50, axial): 8.3 % of the fat-range
  voxels touch a value below −250 directly (4-neighbour), 2.1 % at 2 steps;
  crops of the body outline show the fat range as a one-voxel shell along
  the whole skin surface (air + skin partial volume), little real
  subcutaneous fat at those places. Reported to the owner with the crops;
  asked for a view of their data where it goes wrong before building more.

Owner (after the rim report): the air rim already has its own filter; the
targets are visceral fat vs the peritoneum, and the subcutaneous fat between
skin and peritoneum. Phantom: fat | membrane 1–2 vox (+100 HU) | fat, blur σ
0.8–1.3, noise 0–25, 512 lines; sep = lines where some voxel between the two
fat layers is soft.
- A 1-voxel membrane blurs to a peak of −5 / −26 / −46 HU (σ 0.8 / 1 / 1.3),
  i.e. inside the fat range; 2 voxels: +43 / +25 / +2.
- Single threshold: T −60 keeps sep 92–100 % but takes 2.4–7 % of the fat as
  soft; T −20 keeps the fat (≤ 1 %) but sep falls to 27–82 % (1 voxel,
  noise). A ridge (local-maximum) test is worse than the threshold (more
  fat taken for the same sep).
- Conclusion offered to the owner: one threshold has to serve two goals —
  "how much fat" (volume) and "which compartment" (the membrane as divider).
  Proposal: a sensitive divider threshold used only for connectivity, fat
  volume still from the fat range, divider voxels in the fat range given to
  the adjacent compartment. Waiting for the owner.

Owner: no 1-voxel membranes — the layers are several voxels thick; check
the data. Measured on the practice data (raw, axial):
- Layers (rows from the body edge inward, z 281–409): skin complex 13–20
  vox, subcutaneous fat 4 / 12 / 26 vox (p10 / median / p90), abdominal wall
  4 / 16 / 24 vox (0.148 mm voxels). Mean profile at the left flank, z 332:
  skin +150…170 (3–4) → thin layer +17…+75 (1–2) → panniculus +105…168 (3–4)
  → subcutaneous fat −60…−126 (10–15) → wall +110…+170.
- Interiors (σ 2 smoothed class cores): fat −116 ± 46 HU, soft +158 ± 44;
  5.8 % of the fat-core voxels lie above −50 (the fat preset's upper bound).
  The difficulty is voxel noise, not partial volume.
- Trade-off (4 slices z 0.6–0.75; fat ROI = smoothed < −40 and ≥ 3 px from
  smoothed > 40; outer ROI = skin complex within 10 px of air): fat missed /
  outer taken as fat by the fat upper bound T. None: T −50 22.9 / 1.7,
  T 0 9.0 / 4.9. Bilateral (432 default): T −30 10.2 / 1.4, T −20 9.4 / 1.8.
  NLM / anisotropic defaults similar to bilateral (T −20: 8.5 / 2.2,
  8.3 / 2.1); Gaussian close; TV no help. (~7 % of the fat ROI is never fat:
  septa, vessels — the ROI is not pure.)
- Crops (z 332, left flank): bilateral + fat −250…−30 fills the
  subcutaneous fat band and leaves skin, panniculus and wall out.
Recommendation to the owner: no new segmentation feature; denoise
(bilateral default) and raise the fat upper bound to about −30 HU.

Owner: the volume shifts with filters and other factors, right? Measured
(practice data, 8 axial planes z 32…480 step 64, voxels in −250…T, no air-
rim exclusion, so the rim is in every number):
- none: T −60 78641, −50 86766, −40 94864, −30 102358, −20 109320
  (≈ +8.5…9.4 % per 10 HU).
- bilateral (432 default): 78040 / 86045 / 93243 / 99870 / 106107
  (−0.8 % at −50, −2.4 % at −30 vs none).
- anisotropic: +0.6 % at −50, −0.9 % at −30; Gaussian: +2.4 % / +0.9 %.
- The threshold dominates; the filter moves the volume by 1–2.5 % at a fixed
  threshold. none −50 → bilateral −30 = +15 % (the −50 result misses the
  speckled fat, 22.9 % of the fat ROI above).

Owner (end of week, back Monday): the overview image (raw z 409, window
−300…300) looks right; remove the grain and it is perfect (vessels visible,
good separation). Measured (planes z 332 + 409, CPU worker = same formula as
the WGSL kernel; ROIs from the raw smoothed: fat / soft cores, fat–soft
border band, small bright spots in fat = vessels; edge = mean gradient of the
σ≈1-smoothed image on the border band vs raw, vessel = contrast vs fat mean
vs raw):
  config               fat SD  soft SD  CNR   edge  vessel
  raw                   54.9    49.1    4.91  100 %  100 %
  bilateral (432)       39.1    30.3    7.22   82 %   95 %
  bil spatial 1.6       38.1    28.3    7.48   77 %   94 %
  bil 2.0 × 3 passes    37.8    26.3    7.59   69 %   90 %
  bil int 0.03 × 3      35.5    26.0    7.89   63 %   86 %
  NLM 0.7 r2            31.9    28.4    8.41   76 %   86 %
  NLM 1.0 r2            30.8    28.4    8.61   76 %   82 %
  aniso 0.45 × 8        32.1    28.7    8.35   76 %   83 %
  aniso 0.8 × 6         30.9    28.5    8.59   76 %   77 %
  bilateral + NLM       28.7    26.0    9.02   60 %   78 %
(the fat-core SD keeps ~30 HU of real texture: septa, vessels.) Visual
(z 409 crops): bilateral keeps edges and vessels with a fine grain left;
NLM 1.0 r2 / anisotropic smoother, a little softer; bilateral + NLM blurs.
The bilateral intensity sigma is relative to the data range (0.02 × 4463 HU
≈ 89 HU here): on data with another range the same slider acts differently.
Monday checklist for the owner (device): 2D no longer white (432); bilateral
default vs NLM 1.0 r2 on their data, window about −300…300; fat upper bound
about −30 HU; volumes depend mostly on the threshold (≈ 9 % per 10 HU).

Owner (Monday-prep answers): fat with the bilateral is good; fat −30 good.
Sigmoid (the pre-431 filter, back in 432) still turns 2D white and is not
what is wanted. Cause found, not a GPU bug: the current Sigmoid maps the
whole data range (−1361…3102 here) through an S-curve whose normalisation
moves every value up — at the default (centre 198, strength 0.5): −110 → 119,
−60 → 211, 0 → 323, 40 → 398, 150 → 608 HU — so in a −300…300 window the
body is white (reproduced offline on the practice data, z 409). The owner's
purpose: after denoising, raise the contrast per region, an S-curve around a
region's representative value (e.g. fat) that widens the HU differences.
Mock-ups sent (bilateral z 409, window −300…300, local S-curve
c + hw·tanh(g·t)/tanh(g), HU kept outside c ± hw): A fat −100 ± 100,
B fat/soft midpoint +20 ± 150, C fat −100 ± 80 and soft +150 ± 80; waiting
for the owner's choice. Also reported: a 2D orientation inconsistency
(their example image did not arrive).

## Build 434 — 3D plane views drawn as the 2D views (coronal was upside down, sagittal turned)

Owner (screenshot, section analysis, coronal 309): the 3D section and the 2D
coronal view are upside down against each other.
- Cause (code): 2D coronal / sagittal draw slice d−1−z on row y (higher
  slices at the top); app.js setAxisView turned the object +90° about X for
  coronal (higher slices down) and −90° about Y for sagittal (slices across,
  rows up — 90° off the 2D sagittal).
- Fix: setAxisView builds each orientation from the 2D drawing: coronal =
  column right, slice up; sagittal = row right, slice up; axial unchanged.
  The X / Y / Z view buttons (same function) now read "Sagittal / Coronal /
  Axial 正面（2D と同じ向き）".
- tools/plane-orientation-check.mjs (npm run plane-orientation-check):
  object-local directions in camera space after setAxisView. Before:
  coronal up (0, −1), sagittal right (0, −1) / up (−1, 0) → FAILED; after:
  all (1, 0) right / (0, 1) up.
Checks: lint, unit tests, boot-check, plane-sync-check,
plane-orientation-check.
Sigmoid (owner): B is close; centre and S strength by sliders; asked to weigh
"edit the 2D image" vs "per-segment application range". Answered: a
point-wise curve cannot change any threshold result, so the S-curve belongs
in the 2D display mapping (data untouched); asked what "per segment" means
(display only inside a segment, or segment ranges). Waiting.

## Build 435 — default section cut keeps the half behind the plane in the new plane views

- With 434 the camera faces coronal / sagittal from the other side than
  before; the default (reversed) cut kept local −y / −x — after 434 that
  half sits between the camera and the plane, hiding the cut face.
- Fix: section-view.js sectionLocalNormal base normals coronal (0, −1, 0),
  sagittal (−1, 0, 0) (axial unchanged); the WebGPU volume shader's side
  sign (medical-volume.js uniform 19) flipped the same way for modes 2 / 3
  (shader rule: kept = sign·(axis − coord) ≥ 0, = three.js keeping the
  plane's positive side for the mesh path).
- So with the default 反転 the 3D shows the cut face upright as in 2D for
  every plane; for coronal and sagittal the kept half is the other half
  than before 434 (a physical cut face upright as in 2D can only be seen
  from one side). 反転 off keeps the camera-side half (outer surface seen).
- plane-orientation-check also asserts the default kept half is behind the
  plane (camera-space z of the kept normal −1 for all three).
Checks: lint, unit tests, boot-check, plane-sync-check,
plane-orientation-check, volume-shader-check SECTION=1 (axial, unchanged).

## Build 436 — Sigmoid: an S-curve that turns the border slopes into steps

Owner (drawing): HU along x / y / z — soft tissue, a gentle slope down into
fat, a strand peak inside the fat, fat, a slope up to soft tissue; wanted:
the slopes steep (steps). Mock-up B (centre between fat and soft, S-curve)
was close; centre and S strength by sliders. Purpose: after denoising, the
human sees and edits the regions; the volume is the human-checked region.
- The 431 formula back (one formula in cpuSigmoid, the source worker and the
  WGSL kernel): within centre ± width/2, y = c + hw·tanh(g·t)/tanh(g),
  t = (x − c)/hw, g = 6·strength; centre and values outside kept; strength 0
  = no change; monotonic. WGSL writes tanh as 1 − 2/(exp(2a)+1).
- Defaults: centre 0 HU (between fat and soft tissue; was the window centre),
  width 300 HU (new slider 幅（HU）20–1000), strength 0.5.
- The 2D white of the pre-436 filter (whole-range curve, −110 → +119 HU) is
  gone: sigmoid-check asserts with the defaults no value moves more than
  width/2 (measured 66 HU) and the share of body pixels above 300 HU is
  unchanged (2.11 % → 2.11 %). The 431 white on the owner's device was not
  reproduced here; the WebGPU kernel is covered only by the unit/WGSL tests.
- App output (CPU worker, bilateral → Sigmoid, z 409, window −300…300)
  matches mock-up B; at strength 0.8 the borders are steps.
- tools/sigmoid-check.mjs (npm run sigmoid-check) and the unit test back.
- Saved projects with the pre-436 Sigmoid: same parameters, new curve
  (width from the slider); they look different (owner's request).
Checks: lint, unit tests, boot-check, sigmoid-check.
Open, proposed and accepted for later ("それも検討したい"): exclusive
(non-overlapping) segments (design open, see below); strands in fat dropped.

## Build 437 — VR: a result colour only on its own segment's surfaces; checks skip the bundled practice project

Owner (Quest, practice project with two fat results): fat hidden, the soft
tissue borders still coloured.
- Cause: VR regionColor read the result index 0.75 voxel inside the hit on
  the 256³ grid and used any result's colour, whatever segment was hit; next
  to a fat result a soft-tissue surface took the fat result's colour.
- Fix: per colour slot a segment bit mask (buildRegionIndex segs, uniform
  regionSeg[14]); regionColor(p, base, s) colours only when bit s is set
  (surface hits, cut faces, slice tint).
- tools/vr-volume-check.mjs REGION=fat (result on the fat voxels of the
  x < N/2 half), REGZERO=1 (no result voxels), SEGS=nofat. FAT=1 phantom,
  fat hidden, fat result vs none: before 69 (HU) / 94 (cls) pixels differ,
  after 0 / 0. Fat shown: 7 / 2 pixels take the result colour (still shown).
  REGION=1 (result on all segments) A/B old vs new: 0 differing channels.
- Practice project (owner): docs/demo/sample1/project.vrlab replaced twice
  by the owner's files (bilateral → Sigmoid −8 / 410 / 0.85; bone 354…,
  soft −93…248, fat −250…81 with air exclusion 0.74 mm; two fat results).
  It is applied whenever the practice data is opened, which made the
  headless checks start from that state and run the filters over the whole
  volume on the CPU (tens of minutes). The check tools' servers now answer
  404 for project.vrlab unless SAMPLE_PROJECT=1, so they start from the bare
  data as they were written.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check, vr-volume-check
(above); with the bare practice data: progress-modal, analysis-project
(plain and FILTER=1), edit-consistency, result-2d, plane-sync, mpr-alpha,
processed-filter, plane-orientation, sigmoid — all OK.

Exclusive (non-overlapping) segments — design open (owner: wants it, still
thinking). Practice project overlap: fat −250…81 and soft −93…248 share
−93…81 HU (double-counted today). Options shown: A one shared boundary per
neighbour pair (linked sliders, no gaps), B priority order (higher segment
takes the overlap; show the effective range on the lower one; reorder with
↑↓; proposed default bone → fat → soft → lung), C split at the overlap's
middle. Owner finds B more intuitive, wants to refine before building.
Either way: closing / hole fill can add voxels across a neighbour, so the
final runs need a subtraction of higher-priority segments as well.

Strands in fat as their own segment — tried offline on the practice data
(bilateral planes z 332 / 409, fat < 0 HU, soft pixels with fat on both sides
along a direction within 2–3 px): the hits are mostly fat-border jaggies,
small blobs and gut-gas rims; no clear strands at these slices (likely
thinner than a 0.148 mm voxel). Owner: not realistic — dropped for now.

## Build 438 — non-overlapping segments by card priority; project ranges load exactly

Owner: no overlap, decided by priority = the order of the segment cards
(top first); the shared-boundary variant (A) selectable in a setting later;
as intuitive and convenient as possible.
- docs/segment-exclusive.js (pure, tests/unit/segment-exclusive.test.js):
  effectiveRanges(user ranges, card order, mode). 'priority': a segment's
  range = its user range minus the ranges held by the ACTIVE segments above
  it (a card hidden by its checkbox still counts, so hiding never moves
  voxels); a cut at b starts at the next float32 above b (filtered values
  never fall into a gap); a range strictly inside a lower one leaves two
  pieces — the piece with the user range's middle is kept, the other
  reported on the card; a fully covered range is empty. 'off' = as before.
- segments.js: seg.userMin / userMax (sliders) and seg.min / max (in use, read
  by every view, the runs, analysis, export unchanged); segmentExclusive
  {order, mode}; applyExclusiveRanges / commitExclusiveRanges (invalidates
  every segment whose range in use changed, via app.js segmentInvalidators).
- UI: segmentation panel 「重なり」: 重複なし（上のカードが優先） / 重複を許す
  （従来）; cards stand in priority order (default bone → fat → soft → lung);
  each card shows 「使う範囲 a 〜 b」 when trimmed (and the dropped piece).
  Reordering the cards (↑↓) and the shared-boundary mode: next build.
- Project: segmentOptions {exclusive, order}; segment min / max are the user
  ranges. Projects saved before 438 load with 'off' (results unchanged; the
  practice project too); new data starts with 'priority'.
- Found and fixed on the way (on main as well): applyProject set the
  segment ranges through the sliders, which snap to a step grid that moves
  with the slider range — each save → load moved a range by one step
  (measured: fat −249…82 → −245…86 → −241…90). The saved values are now
  stored exactly (the slider only shows them).
- tools/exclusive-segments-check.mjs (npm run exclusive-segments-check),
  bare practice data, fat −250…81 / soft −93…248 (slider-snapped −249…82 /
  −97…244): 'off' 10,819,055 voxels in both fat and soft; 'priority' 0,
  fat + soft = union (36,537,973); fat card hidden: soft unchanged; soft
  −300…300: in use 82…296, dropped −295…−249 shown on the card; project
  round trip exact.
- Known limit (measured, not fixed in 438): Closing and hole fill add
  voxels after the ranges are split; fat with Closing 1 next to soft:
  1,419,597 voxels in both final runs. The owner's practice project uses
  neither (fat: air exclusion only, which removes voxels). A fix has to
  subtract the higher cards' final runs in every path (2D, runs, WebGPU
  processing masks, VR) — separate build if wanted.
Checks: lint, unit tests, boot-check, vr-gpu-prepare-check,
exclusive-segments-check, progress-modal, analysis-project (plain and
FILTER=1), edit-consistency, result-2d, plane-sync, mpr-alpha,
processed-filter, plane-orientation, sigmoid.

## Build 439 — drag the segment cards to set the priority

Owner: change the card order by dragging.
- Each segment card has a ⋮⋮ handle (segment-ui.js installSegmentReorder):
  pointer events (mouse and touch alike), the card moves live under the
  pointer; on release the card order becomes segmentExclusive.order and
  every segment whose range in use changed is recomputed (commit). Move /
  up are followed on the window: moving the card in the DOM drops the
  handle's pointer capture (first version lost the release — kept on the
  wip/segment-card-drag branch meanwhile, now merged here).
- exclusive-segments-check: a real mouse drag of soft's handle above fat →
  cards bone, soft, fat; soft keeps −93…248, fat in use −249…−93 (card note).
Checks: lint, unit tests, boot-check, exclusive-segments-check,
progress-modal, edit-consistency, plane-sync.

## Build 440 — GPU threshold at the range ends; WebGPU compatibility adapters (Linux)

- Found with a GPU in the headless checks (Chromium --enable-unsafe-webgpu
  --use-webgpu-adapter=swiftshader gives a WebGPU adapter here): the GPU
  raw-DICOM threshold counted 5,386,541 fat voxels (−250…−50) where the CPU
  and the decoded volume count 5,418,876; 386 slices differed, every
  differing voxel had exactly −50 HU. Cause: the WGSL decoded the 16-bit
  value from rg8 as channel × 255.0, not exactly an integer, so −50 became
  about −49.9998 and failed ≤ −50. Fix: round() in every exact (textureLoad)
  decode of medical-volume.js (6 places: analysis RLE, cap / surface voxel
  lookups); the interpolated sampling path is unchanged. After: 5,418,876
  on the GPU, 0 slices apart.
- Owner (Linux, Chrome 154, NVIDIA RTX 4070 Ti, Chrome started with
  --ozone-platform=x11, Vulkan disabled): chrome://gpu shows only "OpenGLES
  backend … (Compatibility Mode)"; the app asked for core adapters only, so
  compute ran on the CPU and the 3D view on WebGL. gpu-compute.js now falls
  back to featureLevel 'compatibility' and, on such a device, requests every
  limit the adapter offers. ?gpucompat (or localStorage vrl.gpucompat = 1)
  forces a compatibility device for checks. Measured with it (SwiftShader):
  compute and render devices COMPAT; fat counts plain / Opening 1 /
  Gaussian / Gaussian + Opening 5,418,876 / 4,086,436 / 5,682,902 /
  4,718,414 — equal to the CPU path. (three.js on this headless Chromium
  logs 'createView … swizzle' page errors in core and compat mode alike.)
  Likely reason the owner's NVIDIA was used before: Chrome's NVIDIA WebGPU
  needs Wayland (Chrome 147+); the browser is now started with X11.
- Open: the owner's report (pr-87, Mac): fat colour speckles inside the
  analysis-result colours, 3D and 2D. Under measurement (practice project:
  are the result voxels inside today's fat runs, CPU and GPU).
Checks: lint, unit tests (WGSL 63), boot-check, the GPU / compat
comparisons above.

## Build 441 — take results out of the selection (click toggle, lasso unselect, unselect all)

Owner: after a project load, redo the 3D-edit selection — take regions out
of the selection again. Option A of the proposal (no image change):
- 領域選択: a click on a result already there toggles its tick
  (analysis-ops.js toggleAnalysisRegionSelection); unticking also drops the
  focus, else 選択領域を削除 would still fall back to it (editTargetRegions).
  Before, a click only focused it (and did not tick an unticked one).
- 囲んで外す (tool 'unlasso', same loop as 囲んで選択): the pieces of the
  ticked results that lie completely inside the loop leave the selection. A
  result all inside is unticked; one partly inside is split into the pieces
  inside (new unticked result, same colour) and the rest (ticked): no voxel
  leaves the results, the colours stay.
- 選択を外す buttons (edit toolbar and results panel): untick all, no focus.
- The status line says how many are selected (the 3D view shows no tick).
- The tick is saved in the project (analysis region meta 'selected');
  projects saved before 441 load with every result unticked, as before.
- tools/region-deselect-check.mjs (synthetic boxes on the practice data):
  toggle off / on, lasso split 216 + 216 / 216 with colours kept and 648
  voxels before and after, lasso whole result unticked, ticks after save →
  load [true, false, false], unselect all → 0 edit targets.
- Result-colour speckles (owner, 438 report), measured on the practice
  project (SwiftShader WebGPU): builds 438 and 440 load identical results —
  fat 7,344,376 (−250…81, surface 0.74 mm); of the two saved results 1,411 +
  21,449 voxels are no longer fat and 102,324 + 230,365 fat voxels touch a
  result without being in it (a fresh analysis gives 0 for both). So 440 is
  not the cause. At build 436 the same project loads surface 0.592 mm (the
  pre-438 slider snap), fat 7,128,598, and no results at all (not looked
  into). Saved results are fixed voxel sets (restoreAnalysisRegions); they
  do not follow a changed segment. Redoing the analysis fixes it (owner saw
  that). Open: re-derive saved results against the loaded segment on load,
  owner decision.
Checks: lint, unit tests, boot-check, region-deselect-check,
analysis-project-check, edit-consistency-check; button rows checked at 1400
and 820 px wide.

## Build 442 — slider wheel by one step, typed values, CT sliders by 1 HU

Owner: the wheel should move a slider by its smallest unit; values should
be typable.
- Wheel (app.js, range-entry.js rangeWheelSteps): one notch (line / page
  event, or ≥ 50 px) = one step, Shift = ten; trackpad pixels add up, one
  step per 42 px. Before: about span / 110 per notch (two ticks of
  span / 220), e.g. 40 HU on a CT range slider, 4 slices, 2 on opening 0–3.
- Typing (range-entry.js installRangeEntry, every slider whose label holds
  an <output>): click / tap the value → number field; Enter or leaving it
  sets the slider (input + change, as a drag), Escape cancels. CT values
  outside the slider's window widen it up to the data's range
  (ctSliderFullBounds), beyond that they are clamped. "n / N" values are
  typed 1-based; data-range-entry-invert marks the 3D slice sliders (they
  run opposite to the slice they show). Values marked by a dotted underline
  (style.css, label:has(range) output).
- CT sliders (WC, WW, segment CT range, Sigmoid centre) step by the data's
  unit: 1 on integer data, else a tenth of the old step (old: span / 700
  rounded, 10 HU here; it stays the WW minimum). Slider ends sit on the
  step grid (setCtSliderRange), so the slider stops on whole values.
- Measured (practice data, fresh / bundled project), 441 → 442: fresh WC /
  WW 198 / 2640 → 197 / 2639 (= the DICOM window); slider values of the
  ranges −249…−49 → −250…−50 (the ranges in use were already exact since
  438). Bundled project: WC 149 → 139 and Sigmoid centre 2 → −8 — 441 and
  earlier loaded the saved −8 / 139 snapped to the 10 HU grid, so the
  Sigmoid ran with another centre than the one saved. The saved results
  still do not match the loaded fat at 442 (fat 7,072,477; outside
  9,558 + 57,815, enclosed 0, touching-not-in 55,333 + 96,559; at 440:
  7,344,376, 1,411 + 21,449, 20, 102,324 + 230,365): the snap is one
  difference, not the whole one. Redoing the analysis stays the fix.
- tools/slider-entry-check.mjs; tests/unit/range-entry.test.js.
Checks: lint, unit tests, boot-check, slider-entry, exclusive-segments,
sigmoid, region-deselect, analysis-project.

## Handoff (after build 442)

State: build 442 on claude/dicom-viewer-handoff-eaqyyu (main = build 437, PR #86 merged 2026-10-05, builds 430–437; 438: non-overlapping segments; 439: drag the cards; 440: GPU range ends exact, compatibility adapters; 441: unselect results — click toggle, lasso unselect, unselect all, ticks saved; 442: wheel one step a notch, typed slider values, CT sliders by 1 HU (fixes the Sigmoid centre / WC snap on project load); PR #87) (earlier: PR #85 merged 2026-10-02, builds 403–429; 430: 2D colour strength setting; 431: Sigmoid redone, reverted in 432; 432: bilateral defaults; 433: processed segments follow the filters; 434: 3D plane views as 2D; 435: default cut keeps the far half; 436: Sigmoid as border-steepening S-curve; 437: VR result colour per segment, checks skip the bundled project). Open (Monday): owner checks on the device — see the Monday checklist above; owner check that 2D is no longer white. (VR/AR: WebGL2
volume, 256³ default, auto resolution, precomputed classification with
processing mask, up to 4 section planes with cap / slice colouring / clip
modes, beginner menu, screenshots, data prepared before the session and
copied from the WebGPU texture, practice data cached, スライス tab with
opacity / colouring / VR-local CT window, slice opacity default 70 %). earlier: main = build 402 (PR #84 merged 2026-10-01: two planes at once, two-colour lasers, laser hits the volume); builds 403–407 in PR #85 (405–406: the central progress modal; 407: opacity 100 %, VR slice threshold; 408: analysis results kept / saved; 409: results in VR / AR; 410: results on the WebGPU section cap, 411–412 reverted in 413; 414–415: 2D / 3D edit consistency, CT range change; 416: cap = 2D slice voxel-exact; 417: surface colour from the surface voxel; 418: filter change recomputes; 419: result colours in 2D; 420–421: shared plane selection incl. the 3D view; section reversed by default; 422: section opens on the plane in use; 423: VR result labels; 424: analysis cost bench; 425: small pointing label; 426: label size setting; 427: pointing label at the hand, 小 default; 428: results kept when a project with filters is loaded (owner: OK); 429: pointing label at the laser root). Open: Quest check of 429. Open: owner check; Quest fps with results shown (VR bench). Open: owner check of 403–406 on Quest / Mac / iPad; a real 3D rebuild with 中断 in the modal (WebGPU, not testable headless).

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
Synchronised, no contradictions (owner, after build 415; research use):
every view (2D, WebGPU 3D, VR / AR) shows one per-voxel truth — the final
runs (2D settings + 3D edits; 3D edits are part of it) and the analysis
results as subsets of them. Never colour or show a voxel the data does not
contain (the 411–412 lesson); a view that cannot match exactly (resampled
grid, interpolated surface) is the owner's decision, measured first.
VR / AR (owner, after build 422): a visual check; comfort over exact voxel
agreement. 256³ stays the default (512³ selectable in the 画質 tab); the
owner found the current VR colouring fine, so the VR approximations (hit
colour 0.75 voxel inside, interpolated cap / slice tint) stay as they are.
Source of truth (owner, after build 415): the segmentation adjusted in 2D
(segment settings: CT range, air exclusion, opening, … and the 2D views)
is the master; 3D (WebGPU volume, VR / AR) is for checking it. 3D must
always follow what 2D holds, never the other way round; a 2D / 3D
difference is a 3D bug unless 2D itself is stale. Measure with
npm run edit-consistency-check.
Progress (owner, build 405): every long operation shows its progress only
through docs/progress-modal.js — setBusySlot(name, on, {label, cancel,
counted}) / reportBusyProgress / setBusyLabel, or the adapters
set3DBusy, setProcessingBusy, busy, progress, byteProgress. No new
progress bars, overlays or status lines elsewhere; give a cancel path when
the work can stop; background work nobody waits on stays out of it.

Next work (owner-approved list; recommended model / effort):
A. Done in build 361 (cause: 60 % default opacity over the dome; VR window
   tab added). Open: Quest check of the slice at 100 % and of the new tab.
B. Done in build 364 (ray pick, numbered handles, selected plane, thumbstick
   scroll). Open: Quest check; scroll speed (5 cm/s) may need tuning.
C. Done in build 365 (snap row, left-hand panel, 持ち方 moved to 表示).
   Open: Quest check of the panel placement.
D. Goal (owner): VR auto resolution held at 100 % at the normal size —
   met: build 391 bench (section sweeping, volume turning, bone + fat /
   shown / bone, 16.5 and 30 cm, 100 and 50 %) all at 72 fps; AR
   (passthrough) is slower than VR mode. Builds 368–387: fewer
   fetches, distance field (now in the classification alpha, one fetch per
   step), tight ray loop, search after the march. Open: larger sizes at
   100 % (non-exact options: step 1.0 voxel, two search iterations;
   quantify on the harness first).
E. Help board done in build 367 (state-dependent controls, front-right).
   A first-run 3-step guide is still open if the owner wants it.
F. iPad (builds 372–377): region colouring speckle fixed, drag lookups by
   binary search, region index texture (one aligned buffer copy, kept
   across focus / colour changes), coloured hits without HU fetches,
   per-second frame stats, upload diagnostics; the adaptive drag budget
   was removed again (resolution ratchet); the uniform-brick jump resumes
   on the ray's sample grid (tiles after a delete). Open: iPad check —
   garbage after delete gone?; "領域tex … 転送 xx ms" and "待ち" right after
   colouring; "[1秒: N 枚, 最大, 落ち]" while dragging; stripes. Compare
   against build 360 with the harness (EDIT=1 / ANALYSIS=1) before any
   further shader change.
Order: device checks of builds 361–368 first; then whatever the owner
reports (tablet comfort on the Quest browser, fps). Headless tools used so far: see the build
entries above (shader tests via tools/boot-check.mjs with page.evaluate).
