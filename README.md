# Virtual Rodent Lab

An early WebGPU prototype for virtual mouse and rat anatomy / dissection training.

## Current demo

The first milestone is intentionally small. It verifies that a Three.js WebGPU scene can run in Safari and provides a procedural placeholder rodent that can be rotated and zoomed.

No anatomical dataset is included yet.

### Controls

- Drag: rotate the placeholder rodent
- Mouse wheel: zoom

The page displays the renderer backend. `WEBGPU ACTIVE` indicates that Three.js initialized a WebGPU backend.

## GitHub Pages demo

The public demo is a no-build static site in `docs/`.

It intentionally does **not** use GitHub Actions.

GitHub Pages should be configured once as:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/docs**

After that, updates to files under `docs/` are served directly by GitHub Pages without consuming GitHub Actions minutes.

The demo loads Three.js WebGPU from jsDelivr at runtime.

## Local development

A Vite + TypeScript development setup is also kept in the repository for future development.

Requirements:

- Node.js
- A WebGPU-capable browser such as Safari 26+

```bash
npm install
npm run dev
```

## Project status

This is a research / feasibility prototype. The procedural rodent is only a placeholder for interaction testing and must not be interpreted as anatomical reference data.

## Third-party material

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

No license is currently granted for the project's original source code. Third-party components and future third-party anatomical assets remain subject to their respective licenses.
