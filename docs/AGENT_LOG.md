# Agent Log

This file is a running record of work done on this repository by AI coding
agents (Claude or others). It exists so that any agent picking up work later
has enough context to continue without re-deriving decisions from scratch.

## How to use this file

- **Before starting work**: read `docs/IMPLEMENTATION_PLAN.md` for the
  feature roadmap, then read the most recent entries here for context on
  what was just done and why.
- **One branch per task.** Name branches descriptively
  (`chore/...`, `refactor/...`, `feat/...`, `test/...`).
- **When finishing a session or task**, append a new entry below (newest on
  top) using the template. Do not edit or delete prior entries — this is an
  append-only log.
- Commit messages should explain *why*, not just *what*; this file is for
  the fuller context that doesn't fit in a commit message (alternatives
  considered, open questions, follow-up work).

## Entry template

```
## YYYY-MM-DD — <branch-name>

**Agent:** <name/model>
**Task:** <one-line summary>

### What changed
- ...

### Why
- ...

### Follow-up / open questions
- ...
```

---

## 2026-09-26 — feat/lasso-region-select

**Agent:** Claude (via claude.ai)
**Task:** Owner request: in 3D edit, select everything enclosed by a pen
loop, to delete small noise in bulk. (PR #21 — filter work — is on hold
while the owner tests other data.)

### Behavior (owner choice: only pieces COMPLETELY inside the loop)
- New tool button "囲んで選択 / Lasso select" next to "領域選択"
  (`#analysis-lasso-select`, tool state `analysisEditTool==='lasso'`).
- Drawing reuses the pen-cut stroke capture (`analysisCutScreen`,
  `appendCutScreenPoints`), drawn as a closed, lightly filled loop.
- On release, `selectRegionsInLasso`: for each target segment (the edit
  target, or all active+enabled segments in auto mode) take
  `getFinalSegmentRuns`, split with `componentsFromRunsAsync`, keep
  components whose voxels all project inside the loop, merge them into
  **one analysis region per segment** (`unionRunArrays`, `merged:true`),
  so the existing "Delete selected region" removes them together.
- Screen-space loop → selects through depth (hidden noise included).
  Pieces crossing the loop (main structure) are never selected.

### Geometry (`docs/lasso.js`, unit-tested)
- `makeVoxelProjector`: voxel → canvas px, using the same voxel placement
  as `makeVolume3DCoordinates` / `surfaceSegmentPointerVoxel`; test checks
  equality with three.js `Vector3.project`.
- `componentFullyInside`: tests run ends plus every 4th voxel along runs,
  stops at the first point outside/behind the camera (large bodies are
  rejected fast); polygon bbox pre-check; even-odd point-in-polygon.

### Notes
- Build 191 → 197 (192–196 are used by the unmerged PR #21 preview).
- Expect a merge conflict with PR #21 in app.js's ui-shell import line and
  i18n.js (both add names/keys); resolve by keeping both.
- WebGPU volume mode uses the same `sceneState.obj` transform as the region
  tool; verify on device in both surface and volume modes.

---

## 2026-09-26 — feat/slider-fast-interaction

**Agent:** Claude (via claude.ai)
**Task:** Keep sliders responsive while the 3D view uses GPU volume rendering.

### What changed (behavior change, small)
- `start3D`: `setFastInteraction(active, keepOverlays=false)` — new optional
  flag skips `setHeavyOverlayInteraction` (which hides the analysis mesh
  and the cut-result preview during camera moves). Exposed as
  `sceneState.setFastInteraction`.
- New `sliderFastInteraction` + `beginSliderFastInteraction()` /
  `endSliderFastInteraction(delay)` next to the global range handlers:
  - pointer drag: begins on the first real movement (not on tap), ends
    120 ms after release;
  - wheel on a slider: begins per tick, ends 220 ms after the last tick.
  - Only when `threeRenderMode==='volume'` and the GPU volume renderer is
    active; mesh mode unchanged. Applies to every range input (all of them
    can trigger 3D re-renders, e.g. MPR planes shown in 3D).
- Effect: same reduced pixel ratio / volume render resolution as camera
  rotation (touch: 0.75/0.60/0.48 by distance tier), full resolution
  restored after the slider is released. Overlays stay visible so live cut
  sliders still show the result.
- Build 190 → 191.

### Verification
- lint + 119 tests; CI demo E2E. CI cannot exercise WebGPU volume
  rendering → owner verifies on device: drag surface smoothing / cut
  sliders in volume mode (should be light, slightly blurrier while
  dragging, sharp after release; cut preview visible while dragging).

---

## 2026-09-26 — refactor/ui-shell (phase 2c + 2d part 1)

**Agent:** Claude (via claude.ai)
**Task:** UI shell module, first feature modules.

### What changed (all verbatim moves)
- `docs/ui-shell.js`: `app`, the `app.innerHTML=<template>` statement, `$`,
  all 141 DOM element consts and `planes`. It runs when imported, i.e.
  before app.js's body; the template was already app.js's first side
  effect, so ordering relative to other side effects is unchanged.
- `docs/gpu-compute.js` (28 decls): WebGPU device/adapter management,
  buffer pool, pipeline cache, `runGpuSourceFilters`, GPU status text.
- `docs/volume-io.js` (13 decls): pixel decode (native + compressed via
  the lazily imported codec), source slice cache, row/column reads, MPR
  cache preparation.
- `docs/settings.js`: surface-smoothing setting readers (were pulled in by
  the GPU cluster but are UI settings).
- Appended: `parseFiles` → `dicom.js`, `tr` → `i18n.js`.
- app.js 4949 → 4229 lines. `verify-split HEAD docs/app.js,docs/dicom.js,
  docs/i18n.js <all files>` → OK, 621 statements verbatim.
- Exact commands: `tools/split-history/phase2c-2d-part1.sh`.
- Build 189 → 190.

### Tool changes
- `extract-module.mjs`: `@line:N` moves a top-level expression statement
  verbatim (refuses if any side-effect statement precedes it);
  `--append` adds to an existing module, merging imports (no duplicates,
  no self-imports) and extending the existing import in the source.
  Generated header no longer claims "no module state".
- `verify-split.mjs`: originals may be a comma-separated list (needed when
  appending to modules that already existed at the base revision).
- `closure.mjs`: `--list` flag parsing fixed.
- Tests for all of the above in `tests/tools/`.

### Findings
- The top-level dependency graph is almost a DAG: 369 SCCs for 382
  declarations; largest cycle is 7 functions (MPR-in-3D plane overlay).
  So feature modules can be extracted bottom-up without import cycles.
- Mistake during this session: resetting only some files mid-way left
  app.js and modules inconsistent; resolved by resetting docs/ fully and
  re-running the recorded script. Lesson: reset the whole working set, and
  delete untracked outputs (extract-module refuses to overwrite them).

### Owner report during review: "some sliders are heavy" (surface smoothing, 3D edit)
- Cause found by the owner: the 3D view was in **GPU volume rendering**
  mode; every slider change re-renders the volume at full resolution.
  189 is also heavy in volume mode ("relatively lighter").
- Side-by-side measurements of main (189) vs this PR (190) in CI, with a
  temporary workflow (removed before merge): Chromium and WebKit (JSC, as
  on iPad), demo loaded, all visible sliders — synchronous handler cost
  < 1 ms in both, frame-bound input timing and drag steps equal within
  noise (x0.84–x1.05, one noisy x1.44 on 2.2→3.2 ms). No JS-side slowdown
  from the module split. GPU rendering cannot be measured in CI (no GPU);
  GPU code is identical, so the perceived difference is most likely
  device variance (thermal/GPU state/test order).
- Notes: GitHub caps annotations at 10 per step (later lines are lost);
  `performance.now()` in WebKit is coarse (sub-ms handlers read as 0).
  `scripts/serve-docs.mjs` now accepts a directory argument (kept).
- Follow-up PR: use the existing fast-interaction (reduced resolution)
  mode while range sliders are dragged in volume mode.

### Next (2d part 2)
- Remaining feature areas in app.js: MPR rendering/caches, 3D scene
  (`start3D` is a single 278-line function), segmentation UI + mesh
  building, filter pipeline UI, analysis/edit/cut tools, iPad workspace
  UI, event wiring (83 top-level side-effect statements stay in app.js).

---

## 2026-09-26 — refactor/state-module (phase 2b)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 2b — move shared mutable state out of app.js.

### What changed
- New `docs/state.js`: all 64 top-level `let`s of app.js as `export let x`,
  each with a setter `setX(v){return x=v}` and, where needed,
  `incX(prefix)` / `decX(prefix)` (`prefix?++x:x++`).
- app.js: reads unchanged (ES module live bindings); the **230 write
  sites** rewritten by `tools/state-codemod.mjs` (208 assignments, 22
  `++`/`--`). Rules: `x=e`→`setX(e)`, `x op= e`→`setX(x op (e))`,
  `x ||= e`→`(x||setX(e))`, `x++`→`incX(false)`, `++x`→`incX(true)`.
- `tools/verify-state-codemod.mjs origin/main docs/app.js docs/app.js
  docs/state.js` → `OK: 64 bindings moved; 230 write sites rewritten per
  rule; all other code identical`. It walks the old and new syntax trees
  in parallel (write sites located with eslint-scope, so shadowing locals
  are excluded) and checks state.js initialisers + helper bodies.
- Tests: `tests/tools/state-codemod.test.js` (sample with shadowing,
  nested/compound/logical/update writes; helper value semantics; verifier
  rejects 4 kinds of tampering). 106 passing.
- Build 188 → 189.

### Why this design
- Imported bindings are read-only, so feature code that writes state could
  not move out of app.js. Live bindings + setters keep ~1200 read sites
  untouched and make the change mechanical and provable, instead of
  rewriting every `volume` into `state.volume`.
- Initialisers are all literals / `[]` / `new Uint32Array(256)`, so
  evaluating them when state.js loads (before app.js's body) is safe.

### Rules going forward
- Write shared state **only via its setter**; ESLint `no-import-assign`
  (in `npm run lint` / CI) rejects direct assignment to imported state.
- New top-level mutable state belongs in `docs/state.js` with a setter.

### Next
- 2c: `docs/ui-shell.js` (template + `app.innerHTML` + DOM element consts).
- 2d: feature modules via `tools/closure.mjs` + `extract-module.mjs`
  (extract-module re-imports state bindings and setters automatically,
  since they are now imports of app.js).

---

## 2026-09-26 — refactor/split-app-js-phase2 (phase 2a)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 2a — GPU shader module, tool fixes, state plan.

### What changed
- `gpuFilterShader(kind)` → `gpuFilterShader(kind, workgroupSize)`: the 20
  `@workgroup_size(${gpuFilterRuntime.workgroupSize})` uses now take the
  parameter; the single caller (`gpuFilterPipeline`) passes
  `gpuFilterRuntime.workgroupSize` at the same moment → identical WGSL.
  This is the only intentional code change (separate commit, `acf8293`).
- Moved verbatim to `docs/gpu-shaders.js`: `gpuFilterShader`,
  `normalizeVrlWgsl`, `GPU_PREWARM_KINDS`. app.js 5439 → 4972 lines.
  verify-split vs `origin/main`: only the 2 functions above differ.
- `medical-volume.js`: `export` added to `volumeShader`, `brickShader`,
  `volumePickShader`, `mprPlaneShader` (test hooks, no behavior change).
- `tests/unit/wgsl-shaders.test.js`: parses all 20 compute shader kinds
  (19 prewarmed + `faceExtract`) and the 4 render shaders with
  `wgsl_reflect` in Node. Catches WGSL syntax/structure errors in CI
  (which has no GPU); does not replace device testing (no type checks).
- Build 187 → 188.

### Tool bug found and fixed (important)
- acorn-walk reports assignment targets / patterns as `VariablePattern`,
  not `Identifier`. `extract-module.mjs`'s false-positive filter and the new
  `closure.mjs` only visited `Identifier`, so code that **only writes** a
  top-level `let` could pass the dependency check. Fixed (visit both);
  regression tests in `tests/tools/extract-module.test.js` (run in CI).
- Impact on already-merged work: none. Phase-1 moved only pure code, and a
  missed write would be an undeclared assignment, which the `no-undef`
  lint (clean) would have reported.
- New `tools/closure.mjs <file> <seeds…> [--list]`: computes how far a
  cluster can move and which `let`s / DOM-element consts block it.

### Findings for phase 2b/2c
- 64 top-level `let`s, ~1459 references. Most are read far more than
  written: `sceneState` 301 refs / 1 assignment, `volume` 255 / 17,
  `sourceVolume` 108 / 2, `currentLanguage` 77 / 1.
- DOM element consts (`status`, `footer`, `viewport`, …) are declared in
  app.js lines ~236–242, right after `app.innerHTML = <template>` (line
  ~43). The template has no external interpolations.

### Plan (next PRs)
- **2b state module**: move all `let`s to `docs/state.js` as
  `export let x`, plus generated setters (`setX(v){return x=v}`, and
  inc/dec helpers preserving postfix/prefix values). Reads stay unchanged
  (ES module live bindings); only the ~250 write sites change, via an AST
  codemod (not by hand). Verify: lint, tests, demo E2E, device preview.
- **2c UI shell**: move `$`, the template + `app.innerHTML`, and the DOM
  element consts to `docs/ui-shell.js` (evaluated before app.js's body, so
  the DOM exists when other modules import the elements).
- **2d features**: with state + UI importable, use `closure.mjs` /
  `extract-module.mjs` to move feature areas (GPU compute runtime, MPR,
  3D scene, segmentation UI, filters, analysis/edit tools).

---

## 2026-09-26 — refactor/split-app-js-phase1 (redone on 184.10)

**Agent:** Claude (via claude.ai)
**Task:** Priority #3, phase 1 — split `docs/app.js` into modules, starting
with the parts that hold no application state.

The first attempt was based on the mistakenly promoted build 185 (see the
INCIDENT entry below). The branch was reset onto the restored 184.10 `main`
and the split re-run with the same tools; the 185-based attempt is kept on
local-only ref `old/phase1-on-185` (not needed).

### What changed
- New modules (code moved **verbatim**, only `export` added):
  `docs/utils.js`, `docs/i18n.js`, `docs/dicom.js`, `docs/mask-ops.js`,
  `docs/run-length.js`, `docs/mesh-geometry.js`. `docs/app.js`
  6216 → 5439 lines; 92 top-level declarations moved (incl.
  `componentsFromRunsAsync`, new in 184.x).
- `tools/verify-split.mjs origin/main docs/app.js <all modules>` →
  `OK: 768 top-level statements moved/kept verbatim` — i.e. everything
  from 184.1–184.10 is present unchanged.
- Build **184 (184.10) → 187**. 185 = abandoned preview, 186 = withdrawn
  first version of this PR's preview; skipped to avoid browser-cache mixups.
- Tooling (in `tools/`, dev-only, not deployed):
  - `analyze-toplevel.mjs` — lists top-level declarations, which are
    mutable and which are "pure". Heuristic; stateful consts such as
    `filterState`, `segmentState`, `mprPaintCache` can be mis-reported.
  - `extract-module.mjs` — moves named declarations to a new module and
    inserts the import. Aborts if moved code depends on anything that stays
    behind (no import cycles), if a name is `let`/`var`, or reassigned.
  - `verify-split.mjs` — proves a split only moved code (ignores the
    APP_VERSION/APP_BUILD values).
  - `bump-build.mjs` (`npm run bump-build [N]`) — updates APP_VERSION /
    APP_BUILD, version.json and every `?v=` tag (incl. free-form suffixes).
- Guardrails: `eslint.config.js` (`npm run lint`, `no-undef` etc.), clean
  on 184.10 before and after; in CI. Build-consistency test covers every
  relative import in every module.
- Tests: 62 passing (+1 todo). Unit tests for dicom (synthetic DICOM
  writer in `tests/helpers/synthetic-dicom.js`), mask-ops, run-length,
  mesh-geometry (binary STL), utils.
- CI: public Zenodo demo E2E runs on every PR; Playwright `github`
  reporter; actions bumped to v7.

### Findings
- `groupSeries` sorts slices by ImagePositionPatient z only and ignores
  ImageOrientationPatient → non-axial acquisitions may be ordered wrongly
  (`it.todo` in tests/unit/dicom.test.js; PLAN "slice ordering").
- CI has no GPU (WebGL + CPU fallback). WebGPU paths are only verified on
  the owner's device via the PR preview URL.
- Agents without `Actions: Read` can read failures through check-run
  annotations: `GET /repos/{repo}/check-runs/{job_id}/annotations`.

### Follow-up (phase 2 plan)
- `gpuFilterShader` (~465 lines of WGSL) depends on `gpuFilterRuntime`;
  pass needed values as parameters, then move to `docs/gpu-shaders.js`.
- Explicit state module for the ~63 reassigned `let`s (volume,
  sourceVolume, sceneState, …) as properties of an exported object, per
  feature area.
- Then split by feature: MPR, 3D scene/renderer, segmentation UI, filter
  pipeline, analysis/edit tools, UI construction.

---

## 2026-09-26 — fix/restore-build-184-10 (INCIDENT)

**Agent:** Claude (via claude.ai)
**Task:** Restore production to the owner's real latest build.

### What went wrong
- In `chore/cleanup-previews-promote-185` the agent promoted
  `docs/preview-185` to production because it had the **highest folder
  number**. The repo had been cloned with `--depth 1`, so history was not
  checked. In fact `preview-185` stopped at 15:47 (2026-09-25 JST), while
  the owner kept iterating `preview-184` as 184.1 … **184.10** until 17:02
  (commit `a776076` "Mark preview 184.10", the tip of `main` at the time).
- Result: production (and the PR #14 refactor, which was based on it) lost
  184.1–184.10: 3D region selection, enclosed-structure / containment-based
  region deletion fixes, GPU edit-mask alignment (texture space), analysis
  spinner, live cut sliders, grouped cut-confirmation UI, split-view resize
  fixes. 184.1 had already absorbed 185's "explicit volume result" work,
  so 184.10 is a superset of 185 in behavior.
- The owner noticed on the device preview.

### What changed
- `docs/{app.js,index.html,medical-volume.js,style.css,version.json}`
  restored byte-for-byte from `archive/previews:docs/preview-184/`
  (build 184, version `2026.09.25-184.10`), except `export` re-added to
  `volumeTexturePlan` in medical-volume.js (unit-test hook, no behavior
  change). 185-only CSS (`.analysis-result-*`) is gone; 184.10 does not
  use it.
- `tests/static/build-consistency.test.js` relaxed to the owner's real
  conventions: APP_VERSION may end in `-<build>.<iteration>`; cache tags
  are `?v=YYYYMMDD-build<build>` plus an optional free-form suffix
  (e.g. `-groupedcut1`), and may differ per file. The strict version would
  have rejected the owner's own verified build.

### Lessons (rules for agents)
- **Always `git fetch --unshallow` (or clone without `--depth`) before
  making decisions from history.**
- "Latest" = most recent commit / the tip of `main`'s `APP_VERSION`, never
  the highest folder or build number. Check `git log -- <path>` dates.
- When promoting or replacing deployed code, diff feature sets against the
  current tip and ask the owner if anything disappears.
- Tests encoding conventions must be derived from the owner's actual
  practice, not assumed.

---

## 2026-09-26 — ci/pages-previews

**Agent:** Claude (via claude.ai)
**Task:** Restore the owner's device-testing workflow without committing
preview folders to `main`.

### Context (important for all agents)
- The owner has **no local development environment**. The
  `docs/preview-NNN/` folders (archived in the first cleanup) were how each
  build was tested on a real device (iPad/Mac, WebGPU) through GitHub
  Pages. Removing them without a replacement removed the only way to test.
  Do not propose local checks (`npm run serve`) as the owner's
  verification step; use PR preview URLs.

### What changed
- `.github/workflows/pages.yml`:
  - push to `main` → `docs/` deployed to the root of the `gh-pages`
    branch (JamesIves/github-pages-deploy-action, `clean-exclude:
    pr-preview/`, `force: false`).
  - same-repo PRs → `docs/` deployed to `gh-pages:/pr-preview/pr-<N>/`
    (rossjrw/pr-preview-action), link posted as a sticky PR comment,
    preview removed when the PR is closed/merged.
- One-time owner action (agent PAT has no Pages permission): Settings →
  Pages → Source "Deploy from a branch", branch `gh-pages`, `/ (root)`.
  Previously `main` + `/docs`.
- The app only uses relative URLs (`./app.js`, `./version.json`, …), so it
  works unchanged under the preview subpath; `ensureLatestDeployedBuild`
  compares against the preview's own `version.json`.

### Follow-up / open questions
- Previews share the production origin, so browser storage/caches (e.g.
  the demo cache `virtual-rodent-demo-v2`) are shared with production.
  Harmless today; keep in mind if storage formats change.
- `gh-pages` history grows with each deploy; it can be reset as an orphan
  branch occasionally without affecting `main`.

---

## 2026-09-26 — test/setup-infra

**Agent:** Claude (via claude.ai)
**Task:** Priority #2 — set up test infrastructure and GitHub Actions CI.

### What changed
- Three test layers:
  1. **Static checks** (`tests/static/`, Vitest): `node --check` on every
     `docs/*.js`, and a build-marker consistency test (APP_BUILD /
     APP_VERSION in `docs/app.js`, `docs/version.json`, the `?v=...-buildNNN`
     cache-busting queries in `docs/index.html`, and the medical-volume.js
     import tag must all agree).
  2. **Unit tests** (`tests/unit/`, Vitest): `volumeTexturePlan` from
     `docs/medical-volume.js`. The only production-code change in this
     branch is adding `export` to that function (no behavior change).
  3. **Browser smoke tests** (`tests/e2e/`, Playwright/Chromium): app boots
     with no uncaught page errors, main controls render, version badge
     shows the build from version.json with no `?build=` reload, and the
     JA/EN toggle works. `demo.spec.js` downloads the Zenodo demo and only
     runs with `RUN_DEMO_E2E=1` (Actions: "Run workflow" → run_demo).
- `vitest.config.js` aliases the exact CDN import URLs to the same pinned
  npm packages (three 0.186.0, dicom-parser 1.8.21, fflate 0.8.2), so app
  modules can be imported in Node without network. Versions are pinned
  exactly in package.json; **if a CDN URL version changes, update the
  alias and package.json together.**
- `scripts/serve-docs.mjs`: zero-dependency static server for `docs/`
  (mimics GitHub Pages). Used by Playwright; also `npm run serve`.
- `.github/workflows/ci.yml`: runs on push to main, PRs, and manually.
  Job `unit` → job `e2e` (uploads Playwright report on failure).
- npm scripts: `test`, `test:watch`, `test:e2e`, `test:e2e:demo`, `serve`.

### Why
- The build-marker test targets a real failure mode of this repo:
  `ensureLatestDeployedBuild()` force-reloads when markers disagree, and
  markers were being hand-edited per preview build.
- `docs/app.js` has top-level DOM side effects, so it cannot be imported in
  Node yet. Real unit coverage of DICOM parsing, segmentation, filters etc.
  becomes possible after priority #3 (module split); extract pure logic
  into importable modules and add tests there as part of that work.
- E2E runs against the real CDN imports (as deployed), so CDN/module-graph
  breakage is caught.

### Notes for agents pushing from outside a local checkout
- A fine-grained PAT needs **Contents: RW**, **Pull requests: RW**, and
  **Workflows: RW** (pushes touching `.github/workflows/` are rejected
  without it). Reading Actions job logs via the API additionally needs
  **Actions: Read**; without it, `/actions/jobs/{id}/logs` returns 403, but
  run/job/step status is still readable.
- CI triggers on push to `main`, on PRs, and manually. Pushing a feature
  branch alone does not run CI — open a PR.
- First CI run on PR #13: both jobs green (smoke tests step ~7 s).

### Follow-up / open questions
- Headless CI has no GPU; WebGPU paths are not exercised, only boot and
  (with swiftshader) potentially WebGL. GPU correctness still needs manual
  testing on real devices.
- Candidate next tests after the split: DICOM header parsing / series
  grouping with synthetic DICOM files, RescaleSlope/Intercept calibration,
  slice ordering, STL export geometry, filter kernels on tiny volumes.

---

## 2026-09-26 — chore/cleanup-previews-promote-185

**Agent:** Claude (Sonnet, via claude.ai)
**Task:** Repository cleanup (priority #1 from planning discussion) — retire
committed preview snapshots and promote the newest preview to be the
canonical `docs/` build.

### What changed
- Created branch `archive/previews`, pointing at the pre-cleanup `main`
  commit (`a776076`), before any deletion. This branch is the permanent
  archive of `docs/preview-137` through `docs/preview-185` (49 snapshot
  directories, ~25 MB) and the previously-deployed build 172. Nothing was
  deleted from git history — `archive/previews` and `main`'s prior history
  both still contain the full previous state.
- Discovered that `docs/preview-185` was actually *ahead* of the live
  `docs/app.js` (build 172 on `main` vs. build 185 in the newest preview).
  Per instruction, promoted build 185 to be the canonical build:
  - `docs/preview-185/{app.js,style.css,medical-volume.js,index.html}` →
    copied over the corresponding `docs/` files.
  - `docs/version.json` updated to `{"build": "185", "version":
    "2026.09.25-185"}`.
- Removed all 49 `docs/preview-*` directories from the working tree
  (`git rm -r`), since they are preserved on `archive/previews`.
- Added this file (`docs/AGENT_LOG.md`) to establish the work-log
  convention going forward.

### Why
- The repo owner asked to "evacuate" (退避) rather than destroy the preview
  history — a branch preserves it without rewriting git history (no force
  push, no broken clones/forks) while getting the dead weight off `main`.
- Promoting build 185 rather than keeping build 172 was an explicit
  instruction after we found 185 was newer and internally self-consistent
  (its own `index.html`/`app.js` cache-busting query strings already matched
  each other at `build185`).

### Follow-up / open questions
- Root-level `index.html` (project root, used for local `vite` dev) points
  to `/docs/style.css` and `/docs/app.js` with **no cache-busting query
  string**, unlike `docs/index.html` which pins
  `?v=20260925-build185`. This was pre-existing and left as-is, but worth
  deciding whether local dev should also cache-bust.
- Did not diff build 172 → 185 line-by-line for behavior changes; worth a
  quick read-through before assuming build 185 is safe, since the repo
  owner may not have manually reviewed every incremental preview either.
- Next priorities per the ranking discussion: (1) this cleanup — done, then
  (2) test infrastructure, (3) splitting `docs/app.js` into modules,
  (4) feature work from `IMPLEMENTATION_PLAN.md`'s "Next priorities".
