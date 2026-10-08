// VR/AR section planes: the plane limit and the frame's depth state (build 506). Pure helpers: no three.js, no DOM.
//
// Limit (build 506: 4 -> 10). The same number is in the volume shader (#define SECTION_PLANES in vr-view.js: the cutPlanes[] uniform array, the per-ray cross / slice
// arrays and their loops); tests/unit/vr-section-frame.test.js compares the two. Only the planes in use are tested: the shader's per-ray loops skip every index >= planeCount
// (vr-view.js writes planeCount = the number of shown planes, never the limit).
export const MAX_SECTION_PLANES = 10;
// frame colours, one per plane index (the first four are the build 400 palette: soft gold, sky, rose, mint; the hands use vivid orange / indigo outside this set)
export const PLANE_COLORS = [0xf2d27a, 0x8ec5ff, 0xf5a3c7, 0x9be3b0, 0xc4a8ff, 0xffb980, 0x7fdcd2, 0xd6e885, 0xff9f94, 0xd2d9e0];
// the colour of the next plane: the first palette colour no plane uses (a palette of 10 for at most 10 planes: always one free)
export const nextPlaneColor = usedColors => { const used = new Set(usedColors); return PLANE_COLORS.find(c => !used.has(c)) ?? PLANE_COLORS[0]; };

// The frame (outline, arrow, number tag) is depth tested with the volume's written depth when the GPU occlusion is on (「実際に隠す」, vr-depth.js gpuOcclusionActive): the part of
// the frame behind tissue is not drawn (no ghost: the owner wants it gone). It stays on top (no depth test) while it is operable: lit = the laser is on its band / tag, or it is
// grabbed / being dragged (the glow is shown then). Without the GPU occlusion (「薄くする」, no standard depth) it is always drawn on top, as before build 506.
// The frame lies ON the cut plane and the volume writes the cut face depth pushed behind the plane (vr-depth.js depthBias), so the part of the frame on the cut face passes the test.
export const frameDepthTest = (occlusion, lit) => !!occlusion && !lit;

// the section number tag is picked before anything else (vr-point.js resolveTriggerTarget): when the tissue surface along the same ray is nearer than the tag by more than eps
// (world metres) and the frame is hidden by the tissue (occlusion on), the tag is not there for the laser. tagDistance / tissueDistance: world metres along the ray (null = none).
export const tagBehindTissue = (occlusion, tagDistance, tissueDistance, eps = 1e-4) =>
  !!occlusion && tagDistance != null && tissueDistance != null && tissueDistance < tagDistance - eps;

// the 断面 tab lists the planes 4 at a time (10 rows do not fit the menu): page p (0-based) of count planes. page is clamped; pages >= 1.
export const SECTION_ROWS_PER_PAGE = 4;
export function sectionPage(count, page = 0, per = SECTION_ROWS_PER_PAGE) {
  const pages = Math.max(1, Math.ceil(Math.max(0, count) / per)), p = Math.min(pages - 1, Math.max(0, page | 0));
  return { page: p, pages, from: p * per, to: Math.min(count, (p + 1) * per) };
}
// the page that holds plane index i
export const pageOfPlane = (i, per = SECTION_ROWS_PER_PAGE) => Math.max(0, Math.floor(i / per));
