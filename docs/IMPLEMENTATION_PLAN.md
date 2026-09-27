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
- [x] Thin-region suppression for segments (builds 242-244; see
      "Thin-region suppression" below; check on a device)
- [ ] Move heavy processing off the main UI thread where needed
- [ ] Split `docs/app.js` into modules (done: pure helpers, GPU shaders, state module, UI shell, GPU compute, volume I/O; next: feature modules — see "Refactoring backlog")
- [x] Compressed DICOM Transfer Syntax support (implemented but untested on real
      data: JPEG baseline/lossless, JPEG-LS, JPEG 2000, RLE decode through the lazily
      loaded cornerstone dicom-image-loader in `volume-io.js`; the fast raw-RLE
      analysis and native-slice paths apply to uncompressed data only). Verify with
      a real compressed dataset if one is ever needed; the owner's micro-CT data is
      uncompressed.

## Refactoring backlog

Status as of build 240: `docs/app.js` is 822 lines (5439 before the split
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
- [x] Break up `start3D` (291 → 112 lines, `scene-view.js`, build 240) into scene
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

## Thin-region suppression

Problem: fat (and other soft-tissue) segments often pick up a thin
membrane over the whole body surface. Cause: partial volume at the
skin/air boundary, where a voxel mixing air (about -1000 HU) and soft tissue
(about +50 HU) averages into the fat range (about -100 HU).

Two non-destructive per-segment settings, each one slider:

- [x] **A. Exclude near body surface (mm)**: build a body mask
      (non-air), compute each voxel's distance inward from the body
      surface, and drop segment voxels closer than the set distance
      (e.g. 0.3 mm). This targets the cause, keeps internal thin fat such as
      mesentery, and only trims subcutaneous fat by the same small depth.
      Default on for the fat preset.
- [x] **B. Minimum thickness (mm)**: distance transform inside the
      segment; remove parts where a ball of the given radius does not fit
      (opening by a ball in mm, which does not round corners the way repeated
      voxel Opening does). Removes thin structures anywhere, including
      real thin tissue. Available on every segment.

Design decisions:

- The UI value is in mm; the kernels work in voxels. Reasons: the
  "iPad GPU 512" reduced texture makes one display voxel equal about two source
  voxels, so a voxel setting would differ between the volume view and the
  full-resolution STL export; voxels are often anisotropic (slice spacing
  is not pixel spacing), so one voxel is a different thickness per axis;
  mm values carry across datasets, projects and presets.
- Show the voxel equivalent next to the slider (for example "≈ 2 voxels").
  The slider step is one source voxel.
- Volume-only, following the owner workflow: GPU distance computation,
  applied to the volume view and to volume analysis without meshes. Cache
  the distance field per segment signature so moving the slider does
  not recompute it. STL export uses the same setting.
- Relation to the existing Opening: B is the mm-based, shape-preserving
  version of it.

As built (build 242, `thin-suppress.js`, unit-tested):

- Both sliders exist on every segment and can be combined. Order: threshold,
  A, B, then Opening/Closing, Hole Filling and Min Component.
- Air = voxels below -500 HU (`BODY_MIN_HU`). Since build 244, A uses all air.
  Builds 242-243 used only air outside the body. The owner's data showed the same
  1-voxel rim around gut gas, so enclosed air now counts too (fat right next
  to the lungs is trimmed by the same depth). UI label: "空気との境界から除外".
  Non-HU data: A has no effect.
- CPU, block-wise (z blocks and 256² xy tiles, halo from the radii). Build
  243 replaced the distance transforms with exact ball stamping around
  boundary voxels, about 4× faster; the EDT is kept as the test reference.
  A stale computation stops when the settings change (build 242 kept running
  every earlier pass after each slider release; the likely cause of the
  first on-device crash). Thickness is capped at 8 voxels. Not on the GPU yet;
  about 50 ms per 1024² slice for A on a desktop CPU (noisy synthetic data). Source-backed volumes run it on the segment runs. The body runs
  are an extra pass, memoized and stored in the run cache.
- Default is off, including for fat. On large in-memory volumes the processed
  mask is a synchronous whole-volume pass (same as the existing Opening), so
  it runs only when asked for.
- A ball opening rounds convex edges to the ball radius, so the plan's "does
  not round corners" was wrong. It is still isotropic in mm, unlike
  the voxel Opening.
- GPU volume view: segments that need post-processing (these settings, and
  also Opening/Closing/Hole Filling/Min Component, which it did not show
  before) are sent to the raycast shader as keep masks
  (`gpuVolumeEditDescriptors`), computed in the background on entering
  volume mode, adding a segment or changing a setting.
- Each segment card shows its own status line: phase n/N (threshold, air
  mask, thin-region removal), percent and seconds, then done, stopped or error
  (build 244; the global progress bar sits on the data tab and was not visible).
- Sliders recompute on release; the step is one in-plane source voxel, the
  output shows mm and the voxel equivalent. Saved in projects and part of
  the run-cache key.

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
- The module graph must stay acyclic (tests/static/no-import-cycles.test.js).
  After moving exported functions between modules, run
  `tools/retarget-imports.mjs` to update importers.
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
