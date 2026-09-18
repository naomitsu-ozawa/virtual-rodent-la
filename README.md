# Virtual Rodent Lab

An early WebGPU prototype for virtual mouse and rat anatomy / dissection training.

## Current demo

The first milestone is intentionally small. It verifies that a Three.js WebGPU scene can run in Safari and provides a procedural placeholder rodent that can be rotated and zoomed. No anatomical dataset is included yet.

### Controls

- Drag: rotate the placeholder rodent
- Mouse wheel: zoom

The page displays the renderer backend. `WEBGPU ACTIVE` indicates that Three.js initialized a WebGPU backend.

## Local development

Requirements:

- Node.js (current LTS recommended)
- A WebGPU-capable browser such as Safari 26+

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build

```bash
npm run build
```

The static site is generated in `dist/`.

## GitHub Pages

A deployment workflow is included for GitHub Pages. The repository owner may need to enable **Settings → Pages → Build and deployment → GitHub Actions** once before the first deployment.

## Project status

This is a research / feasibility prototype. The procedural rodent is only a placeholder for interaction testing and must not be interpreted as anatomical reference data.

## Third-party material

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

No license is currently granted for the project's original source code. Third-party components and future third-party anatomical assets remain subject to their respective licenses.
