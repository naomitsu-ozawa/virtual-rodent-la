# Virtual Rodent Lab

WebGPU-first browser application for small-animal DICOM CT visualization, segmentation, and image processing.

## Current development branch

The active DICOM viewer work is on:

`feature/dicom-webgpu-viewer`

Current milestone:

- Local DICOM directory selection
- Browser-side metadata parsing
- Series grouping
- Dataset size / voxel metadata inspection before full-volume work
- WebGPU viewer shell with 3D + Axial / Coronal / Sagittal layout

The next step is decoding the selected series into an immutable calibrated CT-value volume.

## Target workflow

1. Select a DICOM directory.
2. Inspect detected Series and expected memory cost.
3. Select one Series.
4. Build a calibrated 3D CT volume locally in the browser.
5. View synchronized axial, coronal, sagittal, and interactive WebGPU 3D views.
6. Segment bone, soft tissue, and fat.
7. Adjust segment color, opacity, visibility, and thresholds.
8. Apply non-destructive image-processing filters.

## Planned image-processing tools

- Gaussian
- 3D Median
- Bilateral
- Non-Local Means
- Anisotropic Diffusion
- Total Variation
- Window / Level
- Gamma
- Sigmoid
- Tanh
- CLAHE
- Histogram Equalization
- Opening / Closing
- Opening / Closing by reconstruction
- Hole filling
- Small-hole removal
- Small-object removal
- Voting hole filling

A dedicated local Spike / Hole Corrector is planned for thin-bone CT. It will use local 3D statistics to repair isolated high and low CT-value outliers while preserving genuine edges.

See:

- [DICOM WebGPU viewer specification](docs/DICOM_WEBGPU_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)

## Technical direction

- Browser-first
- TypeScript
- Vite
- Three.js WebGPU
- Local DICOM directory input
- Web Workers for heavy CPU work
- WebGPU compute where it provides a clear benefit
- WASM/CPU fallback where appropriate
- No mandatory server-side DICOM upload

## Local development

Requirements:

- Node.js
- A WebGPU-capable browser

```bash
npm install
npm run dev
```

## Project status

Research / feasibility prototype under active development.

## Third-party material

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).


## Public mouse CT demo

The development branch includes a `公開マウスCTデモ` button.

It retrieves `PET-CT.zip` (20.8 MB) from Zenodo record 12761093 on demand. The associated study used a Siemens Inveon micro-PET/CT scanner in mice and reports DICOM-based image analysis.

The DICOM archive is not stored in this Git repository.

Current demo path:

1. Download the small public archive.
2. Expand it in browser memory.
3. Detect DICOM Series.
4. Select the CT Series.
5. Decode pixels and apply RescaleSlope / RescaleIntercept.
6. Show Axial / Coronal / Sagittal views.
7. Show a WebGPU 3D high-density CT preview.

The 3D preview is intentionally lightweight. Full volume rendering and segmentation surfaces are the next rendering milestone.
