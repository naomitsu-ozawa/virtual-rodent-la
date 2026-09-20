# DICOM Viewer Specification

## Goal

Virtual Rodent Lab is a browser-based DICOM CT viewer for mouse and other small-animal imaging.

The application is local-first. Users can open a DICOM directory directly in the browser, inspect detected Series, decode a CT Series locally, and work with multiplanar views plus an interactive 3D representation.

The canonical deployed implementation is `docs/app.js`.

## Core workflow

1. Select a local DICOM directory, or start the optional public mouse PET/CT demo.
2. Parse DICOM metadata in the browser.
3. Group images by Series.
4. Select one CT Series.
5. Decode pixel data.
6. Apply RescaleSlope / RescaleIntercept.
7. Preserve the calibrated source volume.
8. Display Axial / Coronal / Sagittal MPR.
9. Display interactive 3D segment surfaces.
10. Apply optional segmentation and non-destructive image processing.

## Current viewer

### DICOM

- Local directory input
- Browser-side metadata parsing
- Series grouping
- Series metadata display
- Estimated volume memory display
- Uncompressed 8-bit / 16-bit pixel decoding
- CT-value calibration

Compressed Transfer Syntax support remains future work.

### MPR

- Axial
- Coronal
- Sagittal

Plane labels remain in standard English terminology in both UI languages.
- Slice sliders
- Left/right swipe to move through slices on touch devices
- Mouse wheel to move through slices on desktop
- Window Center / Window Width
- Segmentation overlays

Synchronized crosshair navigation is planned.

### 3D

The viewer prefers WebGPU and falls back to WebGL when needed.

Current interaction:

- one pointer / one finger: rotate
- two fingers: zoom and pan
- mouse wheel: zoom

Segmentation ranges are converted into surface meshes for interactive 3D display.

### Segmentation

Initial segments:

- Bone
- Soft tissue
- Fat
- Lung

Each supports visibility, color, opacity, minimum/maximum CT value, MPR overlay, and 3D surface display.

Surface smoothing is available as an optional post-process.

## Processing model

The calibrated source volume is preserved separately from the active processed volume.

Implemented filters:

- Gaussian 3D
- Spike / Hole correction
- Fast NLM 3D
- Anisotropic Diffusion

Each filter has a strength control. Active filters are rebuilt from the preserved source volume, and Reset restores the original calibrated CT data.

## Thin-bone direction

Thin-bone quality remains a primary development target.

Planned improvements:

1. edge-preserving denoise
2. dual-threshold / hysteresis-style bone candidate extraction
3. 3D connectivity
4. size-limited hole filling
5. small-object cleanup
6. optional Spike / Hole correction
7. improved surface generation

## Data locality

Local DICOM files remain in the browser. No mandatory server-side DICOM upload is part of the base application.

The public demo is downloaded only when the user explicitly selects it.

## Public demo dataset

- Zenodo record: https://zenodo.org/records/12761093
- Archive: `PET-CT.zip`
- Approximate size: 20.8 MB
- Scanner: Siemens Inveon micro-PET/CT

The archive is expanded in browser memory and passed through the same DICOM parsing, CT calibration, MPR, segmentation, and 3D pipeline used for local data.

## Repository policy

This repository is for the DICOM viewer.

Legacy Digimouse atlas experiments, MouseMapper inference workflows, generated atlas meshes, and unrelated segmentation assets are intentionally excluded from the current tree.
