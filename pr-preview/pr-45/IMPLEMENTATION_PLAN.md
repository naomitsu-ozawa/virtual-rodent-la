# Implementation Plan

This file reflects the current deployed DICOM viewer in `docs/app.js`.

## Implemented

### DICOM foundation

- [x] Local directory selection
- [x] Browser-side DICOM metadata parsing
- [x] Series grouping
- [x] Series metadata and estimated memory display
- [x] Selected-Series pixel decoding
- [x] RescaleSlope / RescaleIntercept calibration
- [x] Original calibrated CT volume retained as the processing source
- [x] Public mouse PET/CT demo from Zenodo

### Viewer

- [x] Axial MPR
- [x] Coronal MPR
- [x] Sagittal MPR
- [x] Window / Level
- [x] Interactive 3D viewport
- [x] WebGPU rendering
- [x] WebGL fallback
- [x] Mouse / touch 3D interaction
- [x] Mobile MPR slice navigation by left/right swipe
- [x] Desktop MPR slice navigation by mouse wheel

### Segmentation

- [x] Bone threshold segmentation
- [x] Soft-tissue threshold segmentation
- [x] Fat threshold segmentation
- [x] Lung threshold segmentation
- [x] Per-segment visibility
- [x] Per-segment color
- [x] Per-segment opacity
- [x] Per-segment CT range
- [x] MPR overlays
- [x] 3D segment surface meshes
- [x] Surface smoothing

### Image processing

- [x] Spike / Hole correction
- [x] Fast NLM 3D
- [x] Anisotropic Diffusion
- [x] Gaussian 3D
- [x] Sigmoid
- [x] Per-filter strength control
- [x] Non-destructive reset to the original calibrated CT volume

## Next priorities

- [ ] Improve slice ordering/orientation handling for broader DICOM datasets
- [ ] Add synchronized crosshair navigation across MPR views
- [ ] Improve segmentation surface quality for thin bone
- [ ] Add dual-threshold / hysteresis-style bone extraction
- [ ] Add 3D connectivity cleanup
- [ ] Add size-limited hole filling and small-object removal
- [ ] Add morphology tools where they materially improve bone continuity
- [ ] Add manual brush / eraser correction
- [ ] Move heavy processing off the main UI thread where needed
- [ ] Split `docs/app.js` into modules (done: pure helpers, GPU shaders, state module, UI shell, GPU compute, volume I/O; next: feature modules — see "Refactoring backlog")
- [ ] Add compressed DICOM Transfer Syntax support

## Refactoring backlog

Status as of build 235: `docs/app.js` is 1017 lines (5439 before the split
began) with 378 top-level declarations and 90 top-level side-effect
statements. Every move so far was mechanical and proven with
`tools/verify-split.mjs`; keep that approach (`tools/closure.mjs` to size a
cluster, `tools/extract-module.mjs` to move it, one script per PR under
`tools/split-history/`).

- [ ] Phase 2d part 2 — feature modules, extracted bottom-up (the
      dependency graph is almost a DAG; the largest cycle is the 7-function
      MPR-in-3D plane overlay):
  - [x] MPR rendering and caches (`source-filters.js`, `mpr-orthogonal.js`,
        `mpr-render.js`; helpers in `segments.js`, `section-view.js`; build 222)
  - [x] MPR-in-3D overlay and 3D slice panel (`mpr3d-overlay.js`, build 217)
  - [x] Filter pipeline UI (`filter-pipeline.js`, build 233; CPU kernels
        `cpu-filters.js`, build 230)
  - [x] Segmentation UI and mesh building (done: `segment-runs.js`,
        `surface-mesh.js`, `edit-tools.js`, `busy.js`, build 231; `surface-build.js`,
        build 232; next `rebuildCurrent3D`,
        `smoothIsosurfaceGeometry`)
  - [x] Analysis / edit / cut tools (`edit-tools.js`, `analysis-ops.js`, build 235; `updateCutPreview`,
        `cutRunsFromVoxelStroke`, `updateThreeEditUi`,
        `renderAnalysisResults`)
  - [x] Project load/save glue (`applyProject`) and demo loading (`data-load.js`, build 234)
        (`loadDemo`)
  - [x] iPad / Mac workspace UI (`workspace-ui.js`, build 235)
- [ ] Break up `start3D` (290 lines, the largest function) into scene
      setup, renderer selection (WebGPU/WebGL) and render loop. This is a
      real refactor, not a verbatim move: do it after its feature module is
      extracted, in its own PR, and check it on a device via the PR preview.
- [ ] Keep event wiring (the top-level side-effect statements) in `app.js`
      as the composition root; only move a statement together with the
      feature it wires up.
- [ ] Add unit tests for each newly importable module (candidates from
      `test/setup-infra`: DICOM series grouping, RescaleSlope/Intercept,
      slice ordering, STL export geometry, filter kernels on tiny volumes).
- [ ] Decide whether the root `index.html` (local dev) should use the same
      build cache tags as `docs/index.html` (it currently has none).
- [ ] Look into `state.js` grouping: the 64 flat `let`s + setters work, but
      could later be grouped per feature once the feature modules exist
      (optional, low priority).

## Architecture rules

- See `docs/AGENT_LOG.md` for a running record of AI-agent work sessions;
  read it before starting new work and append to it when finishing.
- Do not commit per-build preview snapshot directories (`docs/preview-*`)
  to `main` (they grew to ~25 MB across 49 copies; preserved on the
  `archive/previews` branch). They existed because there is no local test
  environment: every change is checked on a real device via GitHub Pages.
  That need is now met by `.github/workflows/pages.yml`: every same-repo
  pull request is published to
  `https://naomitsu-ozawa.github.io/virtual-rodent-la/pr-preview/pr-<N>/`
  (link posted on the PR, removed on close), and `main` is published to
  the site root from the `gh-pages` branch. Check GPU/WebGPU behavior on
  the preview URL before merging, since CI has no GPU.
- `docs/app.js` is the canonical deployed entry point; it imports the other
  `docs/*.js` modules. Extracted modules must not import from `app.js`
  (no cycles) and must not hold UI/application state.
- Shared mutable state lives in `docs/state.js` (`export let x` + setter
  `setX`). Read it directly; write it only through the setter.
- Build markers (`APP_VERSION`/`APP_BUILD`) live in `docs/version.js`.
- Every relative import carries a cache tag of the current build
  (`?v=YYYYMMDD-buildN`, optional suffix). `npm run bump-build [N]` updates
  all markers at once; the build-consistency test enforces agreement.
- Browser-first and local-data-first.
- No mandatory DICOM upload.
- Original calibrated CT values remain immutable.
- Processing filters operate on derived working volumes.
- WebGPU is preferred; WebGL is the rendering fallback.
- Avoid duplicate full-volume buffers where practical.
- Do not reintroduce unrelated atlas or MouseMapper assets into the viewer repository.
