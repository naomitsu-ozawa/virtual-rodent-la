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
- [x] Mobile MPR slice navigation

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

- [x] Gaussian 3D
- [x] Spike / Hole correction
- [x] Fast NLM 3D
- [x] Anisotropic Diffusion
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
- [ ] Add compressed DICOM Transfer Syntax support

## Architecture rules

- `docs/app.js` is the canonical deployed implementation.
- Browser-first and local-data-first.
- No mandatory DICOM upload.
- Original calibrated CT values remain immutable.
- Processing filters operate on derived working volumes.
- WebGPU is preferred; WebGL is the rendering fallback.
- Avoid duplicate full-volume buffers where practical.
- Do not reintroduce unrelated atlas or MouseMapper assets into the viewer repository.
