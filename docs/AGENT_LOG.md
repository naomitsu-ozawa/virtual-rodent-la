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
