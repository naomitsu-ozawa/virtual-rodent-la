# Virtual Rodent Lab

Browser-based DICOM CT viewer for mouse and other small-animal imaging.

The repository is focused on one application: a local-first DICOM viewer that runs in the browser. The deployed application in `docs/` is the canonical implementation.

## Current capabilities

- Local DICOM directory loading
- Browser-side DICOM parsing and Series grouping
- CT calibration with RescaleSlope / RescaleIntercept
- Axial / Coronal / Sagittal MPR
- Interactive 3D rendering with WebGPU and WebGL fallback
- Bone / soft-tissue / fat threshold segmentation
- Segment visibility, color, opacity, and CT-range controls
- Segmentation overlays in MPR
- 3D segment surface meshes
- Surface smoothing
- Non-destructive image-processing stack
  - Gaussian 3D
  - Spike / Hole correction
  - Fast NLM 3D
  - Anisotropic Diffusion
- Filter strength controls and reset to the original calibrated CT volume
- Touch interaction for mobile devices
- Public mouse PET/CT demo loaded on demand from Zenodo

## Repository layout

- `docs/index.html` — GitHub Pages entry point
- `docs/app.js` — canonical viewer implementation
- `docs/style.css` — viewer styling
- `docs/DICOM_WEBGPU_SPEC.md` — current architecture and behavior
- `docs/IMPLEMENTATION_PLAN.md` — current implementation status and remaining work
- `docs/THIRD_PARTY_NOTICES.md` — third-party sources and licenses
- `index.html` — local-development entry point that loads the same canonical app

Legacy Digimouse / MouseMapper experiments and their generated assets are intentionally excluded from the current application tree.

## Public demo

The `公開マウスCTデモ` button retrieves `PET-CT.zip` from Zenodo record 12761093 on demand.

- Archive size: about 20.8 MB
- Animal: mouse
- Scanner: Siemens Inveon micro-PET/CT
- DICOM data is not stored in this repository

## Local development

Requirements:

- Node.js
- A modern browser; WebGPU is recommended

```bash
npm install
npm run dev
```

The root development page loads the same viewer files used by GitHub Pages.

## Project status

Active research / feasibility prototype.
