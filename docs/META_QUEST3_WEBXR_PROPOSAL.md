# Meta Quest 3 / WebXR extension proposal

Date: 2026-09-26  
Status: proposal only  
Scope: no production code changes in this branch

## 1. Idea

Extend Virtual Rodent Lab so that the same browser-based DICOM/3D viewer can be opened on Meta Quest 3 and viewed stereoscopically in an immersive XR session.

The intended experience is:

- Open the existing web app in Quest Browser.
- Load a DICOM study or the public demo as usual.
- Enter an XR mode from the existing 3D view.
- View the reconstructed mouse anatomy with true binocular stereopsis and 6DoF head tracking.
- Manipulate the model with Quest controllers.
- Reuse the existing segmentation, cutting, slice-plane and analysis concepts where practical.

The XR mode should remain an optional extension of the existing viewer. Desktop, iPad and mobile behavior must not be degraded.

## 2. Why this is worth investigating

The current application already has the difficult domain-specific pieces:

- DICOM loading and CT calibration
- axial/coronal/sagittal MPR
- 3D volume/surface rendering
- segmentation
- 3D editing
- cutting
- region selection
- volume analysis

XR can add a new interaction layer over those capabilities rather than creating a separate application.

Potential research/education value:

- intuitive spatial understanding of small-animal anatomy
- inspection of bone and segmented structures from arbitrary viewpoints
- direct manipulation of cutting planes
- spatial placement of MPR slices
- immersive teaching and demonstration
- possible future use for anatomy training / virtual necropsy workflows

## 3. Target UX

### Entry

Add an XR entry action only when the browser/device reports the required WebXR capability.

Example flow:

1. Open the normal 3D view.
2. Load/reconstruct the dataset.
3. Press "View in XR".
4. Start an immersive WebXR session.
5. Place the model in front of the user at a comfortable scale.

If XR is unavailable, the existing viewer must continue unchanged.

### Basic XR controls

Initial interaction target:

- head movement: natural viewpoint change
- one-controller drag: rotate/reposition model
- two-controller gesture: scale model
- trigger/ray: select UI or anatomy
- reset action: restore default position/orientation/scale

The default model should appear at a tabletop/anatomical teaching scale, with an easy reset to 1:1 physical scale if DICOM spacing allows this to be defined reliably.

### Later interactions

Once basic stereoscopic viewing is stable:

- grab and move an MPR plane
- show/hide axial/coronal/sagittal planes in 3D
- grab/rotate a cutting plane
- select segmented structures
- isolate selected structures
- perform region selection in 3D
- show volume-analysis results in XR
- optionally export screenshots or return the current XR camera/model transform to the normal 3D view

## 4. Technical architecture

### 4.1 Keep XR as an adapter layer

Do not fork the application into a separate Quest-specific viewer.

Prefer this conceptual split:

- existing data/model state
  - DICOM volume
  - calibrated voxel data
  - segmentation state
  - filters
  - analysis state
- existing rendering representation
  - volume representation
  - mesh/surface representation
  - slice planes
- XR adapter
  - WebXR session lifecycle
  - stereo cameras / XR views
  - controller input
  - XR-specific UI
  - XR frame loop

This reduces duplicated medical/imaging logic.

### 4.2 Renderer strategy

This must be verified against the actual Quest Browser version at implementation time.

Candidate strategy:

1. Attempt to reuse the current rendering backend if WebXR support is compatible with it.
2. If WebGPU + immersive WebXR is not sufficiently supported/stable on Quest Browser, use a WebGL/WebGL2 XR rendering path while keeping the same application state and geometry/volume data.
3. Avoid replacing the desktop renderer solely to support XR.

The first proof-of-concept should therefore answer one question early:

> Can the current 3D representation be rendered stereoscopically on Quest 3 with acceptable frame rate and visual quality?

### 4.3 Data flow

XR should consume existing reconstructed data rather than trigger an unrelated reconstruction pipeline.

Preferred flow:

DICOM load
→ existing preprocessing / filters
→ existing volume or mesh representation
→ XR scene binding
→ stereo render

Changes to segmentation or editing state should remain part of the same application state so XR and normal 3D do not diverge.

## 5. Performance requirements

Quest 3 has a mobile-class GPU and a much stricter sustained rendering budget than a desktop GPU.

The XR path should therefore be designed around:

- stable frame pacing
- avoiding unnecessary CPU↔GPU transfers
- reusing GPU-resident data when possible
- no volume reconstruction every frame
- no full-resolution analysis triggered by simple head/controller movement
- adaptive rendering quality only when it does not alter scientific data or analysis results
- separate "visual quality" controls from data/analysis accuracy

Possible visual optimizations to investigate:

- dynamic render resolution
- foveation if exposed by the browser/runtime
- reduced ray-march samples during active interaction with full quality when stationary
- mesh LOD for display only
- GPU texture reuse
- occlusion/frustum optimizations
- controller-driven updates limited to affected transforms

Scientific calculations must continue to use the original intended data resolution unless explicitly designed otherwise.

## 6. Implementation phases

### Phase 0 — compatibility check

No production integration yet.

Verify on a real Meta Quest 3:

- Quest Browser WebXR immersive-vr availability
- renderer compatibility
- WebGPU availability
- WebGPU + WebXR interoperability
- WebGL2 fallback availability
- controller input APIs
- GitHub Pages HTTPS behavior
- DICOM/demo loading behavior in Quest Browser
- memory limits with representative datasets

Deliverable:

- short compatibility report
- chosen XR rendering path
- measured baseline frame rate on representative content

### Phase 1 — stereoscopic viewer proof of concept

Implement the smallest isolated XR path:

- XR capability detection
- "View in XR" entry
- immersive session creation
- stereo rendering of an already-built 3D representation
- head tracking
- exit XR
- no editing

Acceptance criteria:

- current desktop/mobile behavior unchanged
- model visible correctly in both eyes
- correct left/right orientation
- stable head tracking
- no unintended mirroring
- clean exit back to normal viewer

### Phase 2 — model manipulation

Add:

- controller ray/pointer
- model grab
- rotation
- translation
- two-hand scaling
- reset pose
- sensible physical scale

Acceptance criteria:

- controls remain consistent regardless of viewing direction
- no left/right inversion
- transformations are deterministic
- interaction does not rebuild the volume

### Phase 3 — slice planes and segmentation

Add:

- toggle segment visibility
- select/isolate segment
- display MPR planes in XR
- move slice position
- optional grab/rotate of an analysis plane

Important:

The XR plane representation should reuse the same slice index/world-coordinate mapping as the existing viewer.

### Phase 4 — XR editing

Investigate the most natural XR equivalent of the current 3D editing tools.

Priority candidate:

- controller-manipulated cutting plane

Possible workflow:

1. enter cutting mode
2. grab a visible cutting plane
3. position and rotate it directly in 3D
4. preview affected side/region
5. apply
6. return to normal manipulation mode

This may be substantially easier to understand than drawing a 2D projected cut line for some use cases.

Do not replace the existing desktop cutting workflow; XR is an additional interaction mode.

### Phase 5 — analysis and teaching UI

Potential additions:

- select anatomical region
- run volume analysis
- show measurement result panel in XR
- labels/annotations
- preset viewpoints
- teaching mode
- saved XR scene state

## 7. State and safety constraints

XR integration must not introduce an independent copy of core application state.

Requirements:

- single source of truth for current dataset
- single source of truth for segmentation
- single source of truth for editing results
- XR session start/stop must not silently reset data
- XR transforms must be separated from voxel/world transforms
- left/right anatomical orientation must be explicitly tested
- exiting XR must restore a valid normal 3D interaction state
- no automatic destructive edit from controller movement
- destructive operations require the same explicit confirmation principle as desktop editing

## 8. Testing plan

### Functional

- enter/exit XR repeatedly
- load demo before entering XR
- load local DICOM before entering XR
- segmentation visibility
- controller connect/disconnect
- recenter
- browser session interruption
- return to normal UI

### Spatial correctness

Critical tests:

- anatomical left/right correctness
- anterior/posterior correctness
- superior/inferior correctness
- physical aspect ratio
- voxel spacing
- model transform after rotation/scaling
- cutting plane coordinate conversion
- MPR plane alignment with the 3D volume

Use a dataset with an unmistakable asymmetric landmark when validating orientation.

### Performance

Measure on Quest 3:

- frame time
- FPS/frame pacing
- GPU/CPU bottleneck where measurable
- memory use
- load time
- XR session startup
- controller interaction latency
- performance during volume vs mesh rendering

Test at least:

- lightweight demo
- typical study
- larger study known to stress the current viewer

## 9. Open technical questions for the next AI/review

These should be verified against current browser/runtime documentation and, preferably, on actual Quest 3 hardware before implementation:

1. What WebXR features are currently exposed by Quest Browser?
2. Is the current WebGPU renderer usable directly in immersive WebXR on Quest 3?
3. If not, what is the least invasive WebGL2 XR fallback architecture?
4. Can the current volume renderer sustain an acceptable XR frame rate?
5. Should the first XR version use the surface mesh instead of direct volume ray marching?
6. What controller APIs and hand-tracking APIs are stable enough for production use?
7. What memory ceiling is practical for representative DICOM volumes?
8. Can the same rendering abstraction support desktop WebGPU and Quest XR without duplicating scene state?
9. Is a Three.js/WebXR integration layer useful, or would it introduce too much migration risk into the current renderer?
10. What XR UI pattern is best for segmentation, window/level and analysis controls?
11. How should world units be mapped to real-world meters so that 1:1 anatomical scale is reliable?
12. Which operations should stay on a 2D panel even while the user is in XR?

## 10. Recommended initial decision gate

Before committing to full XR integration, build only a narrow proof of concept:

- real Quest 3
- same GitHub Pages deployment model
- one representative existing 3D model
- stereo rendering
- correct orientation
- head tracking
- simple controller transform
- performance measurement

Proceed to editing/analysis integration only if that test demonstrates acceptable visual quality, stable orientation and usable performance.

## 11. Non-goals for the first implementation

Do not initially:

- create a native Quest APK
- rewrite the whole viewer around an XR framework
- replace the normal desktop/mobile UI
- redesign the DICOM pipeline
- duplicate segmentation logic
- add hand tracking before controllers work reliably
- implement collaborative/multi-user XR
- optimize by reducing scientific analysis accuracy

## 12. Expected end state

A single web application remains the product:

- desktop / Mac: full conventional viewer
- iPad/mobile: touch-oriented viewer
- Meta Quest 3: optional immersive stereoscopic 3D mode

All modes share the same DICOM-derived data and analysis state, while each input environment gets interaction appropriate to its hardware.
