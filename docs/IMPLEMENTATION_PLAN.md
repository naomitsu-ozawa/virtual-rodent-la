# Implementation Plan

## Milestone 1 — DICOM volume foundation

- [x] Local directory picker
- [x] DICOM metadata parsing in the browser
- [x] Group files by SeriesInstanceUID
- [x] Show modality, slice count, matrix, spacing, calibration and estimated volume memory before full decode
- [x] Decode selected series to calibrated scalar volume
- [ ] Validate slice ordering/orientation

## Milestone 2 — Viewer layout

- [x] Axial viewport
- [x] Coronal viewport
- [x] Sagittal viewport
- [x] WebGPU 3D viewport
- [ ] Synchronized crosshair
- [x] Zoom / pan / rotate

## Milestone 3 — Basic segmentation

- [ ] Bone
- [ ] Soft tissue
- [ ] Fat
- [ ] Threshold/range controls
- [ ] Color / opacity / visibility
- [ ] Slice overlays
- [ ] 3D rendering

## Milestone 4 — General image-processing toolbox

- [x] Gaussian
- [ ] 3D Median
- [ ] Bilateral
- [ ] Non-Local Means
- [x] Anisotropic Diffusion
- [ ] Total Variation
- [x] Window / Level
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

- [x] 3D neighborhood analysis
- [x] Local median
- [x] Local variance / edge guard
- [x] Spike correction
- [x] Hole correction
- [x] Maximum correction cap
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


## Processing UI behavior

- [x] Filters use checkboxes for enable/disable.
- [x] Strength sliders are active only while the corresponding filter is enabled.
- [x] Processing always rebuilds from the immutable calibrated source CT volume.
- [x] Reset returns directly to the original CT volume.
- [x] Processing order is deterministic: Gaussian -> Spike/Hole -> Anisotropic.
- [ ] Move CPU filters to a Web Worker so large CT volumes do not block the UI.
- [ ] Implement NLM with a worker or WebGPU compute path.
