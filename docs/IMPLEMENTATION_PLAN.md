# Implementation Plan

## Milestone 1 — DICOM volume foundation

- [x] Local directory picker
- [x] DICOM metadata parsing in the browser
- [x] Group files by SeriesInstanceUID
- [x] Show modality, slice count, matrix, spacing, calibration and estimated volume memory before full decode
- [ ] Decode selected series to calibrated scalar volume
- [ ] Validate slice ordering/orientation

## Milestone 2 — Viewer layout

- [ ] Axial viewport
- [ ] Coronal viewport
- [ ] Sagittal viewport
- [ ] WebGPU 3D viewport
- [ ] Synchronized crosshair
- [ ] Zoom / pan / rotate

## Milestone 3 — Basic segmentation

- [ ] Bone
- [ ] Soft tissue
- [ ] Fat
- [ ] Threshold/range controls
- [ ] Color / opacity / visibility
- [ ] Slice overlays
- [ ] 3D rendering

## Milestone 4 — General image-processing toolbox

- [ ] Gaussian
- [ ] 3D Median
- [ ] Bilateral
- [ ] Non-Local Means
- [ ] Anisotropic Diffusion
- [ ] Total Variation
- [ ] Window / Level
- [ ] Gamma
- [ ] Sigmoid
- [ ] Tanh
- [ ] CLAHE
- [ ] Histogram Equalization
- [ ] Clamp / rescale

## Milestone 5 — Thin-bone quality pipeline

- [ ] Dual threshold / hysteresis
- [ ] 3D connectivity
- [ ] Closing by reconstruction
- [ ] Size-limited hole fill
- [ ] Remove small objects
- [ ] Compare thin-bone continuity, tip preservation, spikes and false bridges

## Milestone 6 — Spike / Hole Corrector

- [ ] 3D neighborhood analysis
- [ ] Local median
- [ ] Local variance / edge guard
- [ ] Spike correction
- [ ] Hole correction
- [ ] Maximum correction cap
- [ ] Correction overlay
- [ ] Before/after preview

## Milestone 7 — Manual correction

- [ ] Brush
- [ ] Eraser
- [ ] Segment paint
- [ ] Undo / redo

## Architecture rules

- WebGPU is the primary 3D rendering backend.
- Browser-first and local-data-first.
- Original calibrated CT values remain immutable.
- Heavy work moves off the main UI thread.
- Dataset scale is shown before full-volume allocation or processing.
- Avoid duplicate full-volume buffers where possible.
