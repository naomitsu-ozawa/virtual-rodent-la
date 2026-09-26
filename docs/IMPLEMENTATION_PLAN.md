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
- [ ] Split `docs/app.js` into modules (phase 1 done: pure helpers extracted; phase 2: GPU shaders/runtime, state, UI)
- [ ] Add compressed DICOM Transfer Syntax support

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
