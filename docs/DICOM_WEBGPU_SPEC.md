# DICOM WebGPU Viewer Specification

## Goal

Virtual Rodent Lab will become a browser-based DICOM viewer focused on small-animal CT data, especially mouse CT.

The application is WebGPU-first and runs locally in the browser. A user selects a DICOM directory and inspects the same volume through synchronized multiplanar slices and an interactive 3D view.

## Core interaction

- Select a DICOM directory as the input unit.
- Detect and group DICOM series from the selected directory.
- Show dataset metadata before heavy processing:
  - modality
  - slice count
  - matrix size
  - voxel spacing
  - estimated in-memory volume size
- Load one series into a 3D volume.
- Display synchronized:
  - axial
  - coronal
  - sagittal
  - interactive 3D viewport
- 3D controls:
  - rotate
  - zoom
  - pan
  - reset camera

## Segmentation

Initial segmentation targets:

- Bone
- Soft tissue
- Fat

Each segment must support:

- visibility on/off
- color change
- opacity change
- threshold/range adjustment
- 3D display
- overlay in the three slice views
- manual correction with brush/eraser in a later milestone

The segmentation pipeline operates on the original calibrated CT-value volume. Display-only contrast processing must not destroy the original quantitative values.

## CT value handling

DICOM pixel values are converted using DICOM calibration metadata when present:

- RescaleSlope
- RescaleIntercept

The application keeps two logical data paths:

1. Quantitative volume
   - original calibrated CT values
   - segmentation source
   - measurement source

2. Display volume
   - window/level
   - denoise
   - contrast adjustment
   - preview processing
   - 3D rendering preparation

## Image-processing toolbox

### General denoise

- Gaussian
- 3D Median
- Bilateral
- Non-Local Means
- Anisotropic Diffusion
- Total Variation
- Wavelet denoise candidate

### Intensity / contrast

- Window / Level
- Clamp
- Linear rescale
- Gamma
- Sigmoid
- Tanh
- Histogram equalization
- CLAHE

### Local CT-value correction

A dedicated Spike / Hole Corrector is required.

Purpose:

- remove isolated high-value spikes on surfaces and tips
- repair isolated low-value holes inside thin bone
- preserve genuine edges and thin anatomical structures

Candidate logic:

- inspect a 3D neighborhood such as 3 x 3 x 3
- calculate local median and local variance
- classify the center voxel as a spike or hole only when it is a strong local outlier
- replace or partially pull the voxel toward the local median
- cap the maximum correction magnitude
- visualize corrected voxels as an optional overlay

Controls:

- spike threshold
- hole threshold
- neighborhood size
- replacement mode
- correction strength
- maximum correction
- edge-preservation sensitivity

### Morphology / segmentation cleanup

- Erode
- Dilate
- Opening
- Closing
- Opening by reconstruction
- Closing by reconstruction
- Fill holes
- Remove small holes
- Remove small objects
- Voting hole filling

## Bone extraction strategy

Thin bone holes and surface spikes are treated as a segmentation-pipeline problem, not only a smoothing problem.

Preferred pipeline:

1. CT calibration
2. Edge-preserving denoise
3. Dual threshold / hysteresis-style bone candidate extraction
4. 3D connectivity
5. Closing by reconstruction
6. Size-limited hole filling
7. Small-object / spike cleanup
8. Optional local Spike / Hole correction
9. 3D surface generation

Dual-threshold concept:

- high threshold: strong, reliable bone
- low threshold: weak bone candidate
- retain weak candidates when they are connected to strong bone

This is intended to reduce the trade-off between preserving thin bone and suppressing isolated spikes.

## Rendering architecture

### Primary platform

- Browser application
- TypeScript
- Vite
- WebGPU-first rendering
- Three.js WebGPU remains the existing rendering foundation

### 3D

The main 3D viewport uses WebGPU for:

- volume/surface rendering
- segment visualization
- per-segment color and opacity
- interactive camera manipulation

### MPR

The three orthogonal slice views share the same volume coordinates and crosshair position.

Required synchronization:

- clicking or scrolling in one view updates the other views
- crosshair position is shared
- segmentation overlays remain spatially aligned
- 3D camera and slice position may be linked where useful

### Local-only data flow

DICOM files are selected from the user's local machine and processed in the browser.

No DICOM upload is required for the base application.

Preferred folder-input strategy:

- File System Access API where available
- directory input fallback for browsers that support folder selection

## Performance principles

Before decoding a full series, show its scale and expected resource cost.

The application must avoid blind full-volume work. Heavy processing should use:

- Web Workers
- transferable buffers
- chunked processing
- WebGPU compute where it is genuinely useful and supported
- WASM/CPU fallback for filters that are easier or safer there

Large intermediate copies should be avoided.

## Initial UI layout

- Large central/left 3D viewport
- Three MPR views grouped on the right
- Dataset / series header
- Segmentation panel
- Image-processing panel
- Per-segment color and opacity controls
- Processing history / reset controls

## Non-destructive processing

Image-processing operations should be represented as a processing stack where practical.

Example:

- Original
- NLM
- Spike/Hole correction
- Window/Level

Each stage should be toggleable or resettable without destroying the original DICOM-derived volume.

## Initial development priority

1. DICOM directory loading and series inspection
2. CT-value calibration
3. Three synchronized MPR views
4. WebGPU 3D volume/surface display
5. Basic bone/soft-tissue/fat threshold segmentation
6. Per-segment color, opacity and visibility
7. General filter panel
8. Thin-bone pipeline
9. Spike/Hole Corrector
10. Manual segmentation correction


## Public demo dataset

The browser demo uses a small public mouse PET/CT archive hosted outside GitHub.

- Dataset: Bidirectional Regulation of Motor Circuits Using Magnetogenetic Gene Therapy
- Provider: Zenodo
- Record: https://zenodo.org/records/12761093
- Demo archive: PET-CT.zip
- Archive size: 20.8 MB
- Animal: mouse
- Scanner: Siemens Inveon micro-PET/CT
- Analysis format reported by the associated publication: DICOM

The application downloads the archive only when the user chooses the public demo. The archive is expanded in browser memory and passed through the same DICOM parser, CT calibration and viewer pipeline used for local data.

### Demo data policy

- DICOM pixel data is not committed to Git.
- The public archive remains hosted by Zenodo.
- Download size is shown before and during transfer.
- Local-directory loading remains the primary workflow.
- Demo data and local data share the same viewer code path.
- The original calibrated CT-value volume remains immutable.
