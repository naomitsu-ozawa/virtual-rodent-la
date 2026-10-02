# Remote XR for Virtual Rodent Lab — Concept & Feasibility Notes

Status: discussion / feasibility study  
Date: 2026-10-03  
Target repo: `naomitsu-ozawa/virtual-rodent-la`

## 1. Goal

Virtual Rodent Lab (VRL) currently runs WebXR directly on Meta Quest.

The new idea is to move the heavy XR rendering and DICOM/volume processing to a Mac, while using Meta Quest 3 mainly as:

- the physical XR headset,
- the WebXR runtime,
- head/controller tracking input,
- a low-latency stereo video decoder/display.

Target user experience:

1. Open VRL on the Mac.
2. Connect Quest 3.
3. Open a small Remote XR viewer in Meta Quest Browser.
4. Enter immersive WebXR.
5. Move head/controllers on Quest.
6. The Mac renders the two eye views.
7. The rendered stereo image is returned to Quest and shown as VR.

The intended result is effectively:

```text
Quest 3 = HMD + tracking + decode + display
Mac     = VRL + DICOM + volume rendering + stereo rendering
```

This is not intended to become a Unity/Unreal application.

---

## 2. Why this idea exists

VRL already performs substantial work in-browser:

- DICOM loading
- 3D volume rendering
- ray marching
- section planes
- segmentation-related rendering
- analysis
- WebXR controller interaction

Quest can execute this directly, but the Mac has more compute and memory headroom.

The objective is therefore not simple desktop mirroring. The requirement is:

> Run the XR scene/rendering logic on the Mac and use Quest as a real stereoscopic tracked HMD.

A normal 2D desktop streaming solution such as Virtual Desktop or Immersed does not satisfy this requirement.

---

## 3. Existing VRL code is favorable for this approach

The existing `docs/vr-view.js` already uses standard WebXR/Three.js interfaces rather than Quest-specific native APIs.

Examples already present in VRL include:

- `navigator.xr.requestSession(...)`
- `renderer.xr.enabled = true`
- `renderer.xr.getCamera()`
- `renderer.xr.getController(i)`
- controller `connected` / `disconnected`
- `selectstart` / `selectend`
- `squeezestart` / `squeezeend`
- `XRInputSource.gamepad`
- per-eye rendering through the XR camera array

VRL also already renders individual XR sub-cameras into offscreen targets for some operations.

This means a remote solution may be able to preserve much of the existing interaction logic instead of creating a second VR implementation.

---

## 4. Main architecture

The working concept is:

```text
              tracking / buttons
      Quest ----------------------> Mac
        ^                           |
        |                           |
        |       stereo video        |
        +---------------------------+
```

More specifically:

```text
Meta Quest Browser
├─ real immersive WebXR session
├─ XRViewerPose
├─ left/right controller pose
├─ trigger / squeeze / buttons / thumbstick
└─ stereo video presentation
            ⇅
      low-latency transport
            ⇅
Mac
├─ Virtual Rodent Lab
├─ DICOM/volume processing
├─ Three.js renderer
├─ IWER-emulated Quest WebXR runtime
├─ left/right eye rendering
└─ video encoding
```

---

## 5. Important distinction: this is not "one web page only"

### Quest side

The Quest side can remain browser-only:

- Meta Quest Browser
- HTML/JavaScript/WebXR
- no APK
- no Unity
- no Unreal
- no App Lab installation

### Mac side

The Mac side needs more than a static GitHub Pages page.

At minimum it needs:

- browser-hosted VRL,
- a local transport/signaling service,
- and, for the USB-C approach, Android Platform Tools / `adb`.

Therefore the complete system is still web-centric, but the USB-C version is not "static web pages only".

---

## 6. Component to add: Mac Remote XR Host

Possible VRL UI:

```text
VR
AR
Remote XR
```

Remote XR Host responsibilities:

1. Run current VRL scene and volume renderer.
2. Provide an emulated WebXR device on Mac.
3. Receive Quest head/controller state.
4. Feed that state into the emulated XR device.
5. Render left and right eye images.
6. Encode/stream the stereo output.
7. Show diagnostics:
   - connection state,
   - render FPS,
   - encode FPS,
   - bitrate,
   - network/USB latency,
   - dropped frames,
   - pose-to-display estimate.

Candidate modules:

```text
docs/remote-xr/
├─ host.js
├─ quest.html
├─ quest.js
├─ protocol.js
└─ transport.js
```

A small local server/helper may live outside `docs/`.

---

## 7. Component to add: Quest Remote XR Viewer

Quest page responsibilities:

1. Start `immersive-vr`.
2. Acquire `XRViewerPose`.
3. Acquire left/right input sources.
4. Send head/controller transforms and input state to Mac.
5. Receive the stereo stream.
6. Display left image to left eye and right image to right eye.

Conceptual tracking payload:

```text
head
  position
  quaternion

left controller
  position
  quaternion
  trigger
  squeeze
  X
  Y
  thumbstick

right controller
  position
  quaternion
  trigger
  squeeze
  A
  B
  thumbstick
```

For the first prototype, JSON is acceptable.

If latency or bandwidth becomes relevant, switch tracking to a fixed binary `Float32Array` structure.

Tracking transport should prefer latest-state semantics. Old poses are not useful.

---

## 8. Why Meta IWER is interesting

Repository:

https://github.com/meta-quest/immersive-web-emulation-runtime

IWER can emulate a Meta Quest WebXR device in a desktop browser.

Relevant capabilities found in the current codebase:

- `XRDevice(metaQuest3)`
- `stereoEnabled`
- headset position/quaternion control
- controller position/quaternion control
- gamepad button/axis control
- standard WebXR session behavior
- remote control interface

Especially interesting:

```js
device.remote.connectTransport(port)
```

The remote interface accepts messages such as:

- `set_transform`
- `set_gamepad_state`
- `set_input_mode`
- `set_connected`

This may let the Quest tracking stream drive IWER with only a thin transport adapter.

That is important because current VRL code can continue reading standard WebXR state.

---

## 9. IWER stereo behavior is useful

IWER has explicit stereo rendering support.

With stereo enabled, its XR viewport logic places the left and right eye views in different halves of the rendering canvas.

Conceptually:

```text
Mac render canvas

┌───────────────────────┬───────────────────────┐
│       LEFT EYE        │       RIGHT EYE       │
└───────────────────────┴───────────────────────┘
```

This is well suited to a single side-by-side (SBS) encoded stream.

VRL already has per-eye XR camera handling, so if IWER's normal path becomes limiting, a VRL-specific offscreen stereo renderer is also possible.

---

## 10. Network option A: Wi-Fi / normal WebRTC

Possible architecture:

```text
Mac VRL
  |
  | WebRTC stereo video
  v
Quest Browser

Quest Browser
  |
  | RTCDataChannel pose/input
  v
Mac VRL
```

A signaling service is needed to establish the WebRTC session.

After connection, media/data can normally flow directly between Mac and Quest.

Advantages:

- standard browser media transport,
- congestion control,
- hardware codec path may be available,
- easy to test over existing LAN.

Disadvantages:

- depends on Wi-Fi quality,
- requires signaling,
- jitter can vary,
- remote-rendered XR is sensitive to motion-to-photon latency.

Best physical LAN topology if Wi-Fi is used:

```text
Mac -- Ethernet -- Wi-Fi 6/6E AP -- Quest 3
```

Internet access is not inherently required.

---

## 11. Network option B: USB-C direct connection

This became the more interesting path.

Meta Quest supports USB debugging/ADB, and Quest Browser development can use `adb reverse` to reach services running on the host computer.

Concept:

```text
Mac
  |
  | USB-C
  |
Quest 3
```

Example local port forwarding:

```bash
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8765 tcp:8765
adb reverse tcp:8766 tcp:8766
```

Quest Browser can then access a Mac local service through a localhost URL.

This means USB mode can potentially avoid:

- Wi-Fi router/AP,
- Internet,
- public signaling service.

Requirements:

- USB data cable,
- Quest Developer Mode,
- USB debugging permission,
- Android Platform Tools / `adb` on Mac.

---

## 12. USB-C caveat: standard WebRTC media is not automatically tunneled

`adb reverse` is fundamentally a TCP forwarding mechanism.

Normal WebRTC media transport often uses ICE/UDP and cannot be assumed to pass transparently through a simple ADB TCP reverse mapping.

Therefore two USB designs should be evaluated separately.

### USB design 1 — WebSocket/TCP transport

```text
Quest tracking
   ↓ WebSocket
ADB reverse
   ↓
Mac

Mac stereo frames
   ↓ encoded video over TCP/WebSocket
ADB reverse
   ↓
Quest Browser
```

Advantages:

- architecture maps naturally onto ADB reverse,
- no external signaling,
- all traffic can stay on the cable.

Main uncertainty:

- browser-side low-latency video ingest/decode path.

Candidate decoder API:

- WebCodecs `VideoDecoder`

Codec candidate for first test:

- H.264

### USB design 2 — local network interface / alternate USB transport

Investigate whether a more direct USB networking path can expose IP connectivity between macOS and Quest without relying entirely on ADB TCP reverse.

This remains an open research item.

---

## 13. Existing precedent for wired Quest streaming

ALVR is relevant because it demonstrates that high-rate XR streaming over a wired Quest/ADB-style connection is a real engineering pattern rather than a purely theoretical idea.

Repository:

https://github.com/alvr-org/ALVR

CloudXR is relevant because it demonstrates the remote-rendering architecture:

```text
headset tracking
→ render server
→ stereo encoded frames
→ headset
```

CloudXR JavaScript samples:

https://github.com/NVIDIA/cloudxr-js-samples

CloudXR itself is not directly suitable as the Mac server solution because its server-side stack is tied to supported NVIDIA/Windows/Linux environments.

Its client architecture, prediction, reprojection, and metrics are still useful references.

---

## 14. Video path under consideration

### Mac

```text
VRL scene
↓
left + right render
↓
SBS frame
↓
H.264 encode
↓
transport
```

### Quest

```text
transport
↓
H.264 decode
↓
video texture / VideoFrame
↓
WebXR render loop
↓
left half → left eye
right half → right eye
```

The first prototype does not need perfect final resolution.

Start at a moderate SBS resolution and prove:

- stable decoding,
- stereo correctness,
- frame cadence,
- acceptable latency.

Then increase resolution.

---

## 15. Biggest technical problem: latency, not rendering

The architecture appears technically possible at the data-flow level.

The main risk is motion-to-photon latency:

```text
Quest pose
→ transport
→ Mac render
→ encode
→ transport
→ Quest decode
→ WebXR presentation
```

A stale pose produces a stereo frame for an old viewpoint.

This is much more noticeable in XR than in ordinary remote desktop video.

CloudXR contains concepts such as:

- pose prediction,
- pose smoothing,
- reprojection,
- pose-to-render timing,
- depth-based reprojection.

These should be treated as references for later optimization.

The first prototype should not implement full reprojection.

Measure first.

---

## 16. Important Mac/IWER frame-rate issue

IWER's emulated `updateTargetFrameRate()` does not necessarily make the physical Mac display/browser animation loop run at that XR rate.

A Mac browser may therefore render at a different cadence than Quest's 72/80/90/120 Hz display.

Possible situation:

```text
Mac render:   60 fps
Quest WebXR:  90 Hz
```

Quest can reuse the newest received frame, but head motion may reveal latency.

This must be measured on the actual Mac.

---

## 17. Proposed implementation sequence

### PoC 0 — USB/browser connectivity

Goal: prove Quest Browser ↔ Mac communication through one USB-C cable.

Test:

- Quest connected by USB-C.
- `adb devices` works.
- `adb reverse` works.
- Quest Browser opens Mac localhost page.
- no Wi-Fi dependency.

Pass condition:

- stable browser connection over USB.

### PoC 1 — Quest tracking → Mac

Do not send video yet.

Quest:

- immersive WebXR
- head pose
- left/right controller pose
- buttons/axes

Mac:

- receive pose/input,
- inject into IWER,
- run current VRL VR scene.

Expected visible result on Mac:

- turn Quest head → Mac VRL camera turns,
- move controller → VRL controller/ray moves,
- trigger/grip/buttons operate existing VRL interaction.

This is the most important low-cost proof because it tests whether current `vr-view.js` can be preserved.

### PoC 2 — synthetic stereo image Mac → Quest

Do not use full DICOM yet.

Mac renders a simple stereo test scene/SBS image.

Quest receives it and presents correct image to each eye.

Measure:

- decoded FPS,
- dropped frames,
- end-to-end latency,
- stability.

### PoC 3 — VRL stereo video

Replace synthetic scene with actual VRL output.

Measure:

- VRL render FPS,
- encode time,
- transport time,
- decode time,
- perceived head-motion latency.

### PoC 4 — decide whether reprojection is necessary

Only after measurements.

Possible later approaches:

- pose prediction,
- local rotational reprojection,
- depth-assisted reprojection,
- hybrid rendering.

---

## 18. A possible hybrid architecture

If full remote-frame XR latency is too high, another architecture may be better:

```text
Mac
├─ heavy DICOM processing
├─ segmentation
├─ filtering
└─ preprocessing

        ↓ processed volume / mesh / bricks

Quest
└─ final WebXR rendering locally
```

This reduces motion-to-photon latency because the final view is rendered from the latest Quest pose.

However, it changes the original goal.

Therefore this should be treated as a fallback comparison, not substituted for the remote-rendering experiment before it is measured.

---

## 19. What should remain unchanged initially

Avoid rewriting these parts until the feasibility test requires it:

- current DICOM pipeline,
- current volume shader,
- current section-plane logic,
- current menu/UI interaction,
- current controller semantics,
- current VR analysis logic.

The first goal is to insert a remote transport boundary around existing WebXR behavior.

---

## 20. What likely needs new code

Expected new pieces:

1. Remote XR mode selector in VRL.
2. IWER initialization on the Mac host.
3. Mac transport adapter.
4. Quest WebXR viewer page.
5. Quest tracking serializer.
6. Mac tracking → IWER adapter.
7. Stereo output capture/encode path.
8. Quest video decode/upload path.
9. USB helper/startup instructions or script.
10. Diagnostics/latency measurement.

For Wi-Fi mode only:

11. WebRTC signaling service.

For USB mode:

11. ADB setup/port forwarding helper.

---

## 21. Browser-only vs helper software summary

| Part | Browser only? |
|---|---|
| Quest XR viewer | Yes |
| Quest tracking | Yes |
| Quest stereo display | Yes, if required decode API is supported |
| Mac VRL renderer | Yes |
| Mac IWER | Yes |
| Wi-Fi WebRTC transport | Mostly browser + signaling server |
| USB-C transport | No — requires `adb` outside browser |
| USB local server | Small local process likely required |
| Unity/Unreal | No |
| Native Quest APK | Not planned |

---

## 22. Main open questions for another AI/reviewer

Please challenge these points rather than assuming the current proposal is correct:

1. Can the latest Meta Quest Browser reliably use WebCodecs `VideoDecoder` for the required H.264 profile/resolution/frame rate?
2. What is the cleanest way to deliver an H.264 elementary/fragmented stream over an ADB-reversed TCP connection into WebCodecs?
3. Is there a better browser-compatible transport than WebSocket for the USB path?
4. Can WebRTC be forced through a localhost/ADB-reversed TCP path in a useful way, or is custom media transport preferable?
5. Does IWER preserve enough Three.js WebXR behavior for the current `vr-view.js` without major modification?
6. Does IWER's SBS output remain practical at the desired render resolution?
7. Can Chrome on the target Apple Silicon Mac hardware-encode H.264 from the VRL canvas at an adequate frame rate?
8. Would a small native macOS VideoToolbox helper materially reduce latency compared with browser encoding?
9. Can Quest-side WebXR presentation locally reproject the received stereo texture enough to reduce rotational latency?
10. Is a depth-assisted reprojection approach realistic inside Quest Browser?
11. What actual USB throughput/latency should be expected with Quest 3 and a USB 3.x Type-C cable?
12. Is ADB reverse stable enough for sustained high-bitrate stereo video, or should USB networking be investigated instead?
13. Is a single SBS stream preferable to two synchronized eye streams?
14. What is the minimum useful test resolution/fps for the first human-perception test?
15. Is there an existing open-source remote WebXR runtime that already solves more of this stack?

---

## 23. Suggested decision criteria

Do not decide based only on whether a frame appears in the headset.

A successful Remote XR direction should demonstrate:

- correct stereoscopic view,
- correct head tracking,
- correct controller interaction,
- no major changes to existing VRL interaction code,
- sustained frame delivery,
- acceptable visual quality,
- no disruptive frame drops,
- acceptable head-motion latency,
- simple user startup procedure.

If USB-C achieves this, it is preferable because it removes Wi-Fi/AP quality as a variable.

If USB-C is technically stable but motion latency remains unacceptable, investigate local reprojection before abandoning remote rendering.

If final-frame remote rendering remains uncomfortable even after reasonable optimization, compare with the hybrid architecture.

---

## 24. Current working hypothesis

The most promising first route is:

```text
Mac
Virtual Rodent Lab
+ IWER
+ local Remote XR host
+ H.264 encoder
        ⇅
USB-C / ADB reverse
        ⇅
Quest Browser
+ native WebXR tracking
+ controller input
+ H.264/WebCodecs decode
+ stereo presentation
```

This avoids:

- Windows requirement,
- NVIDIA requirement,
- Unity/Unreal,
- native Quest APK,
- Wi-Fi router requirement,
- public cloud rendering.

The architecture is not yet proven.

The strongest next experiment is PoC 1: use physical Quest tracking over USB to drive the current VRL WebXR scene running on the Mac through IWER, before adding video streaming.

---

## 25. Relevant projects

- Virtual Rodent Lab  
  https://github.com/naomitsu-ozawa/virtual-rodent-la

- Meta Immersive Web Emulation Runtime (IWER)  
  https://github.com/meta-quest/immersive-web-emulation-runtime

- NVIDIA CloudXR JavaScript samples  
  https://github.com/NVIDIA/cloudxr-js-samples

- ALVR  
  https://github.com/alvr-org/ALVR

These are references only. The proposed Remote XR design is not currently implemented in VRL.
