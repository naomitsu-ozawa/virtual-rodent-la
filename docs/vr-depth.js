// VR depth occlusion (build 497). The volume's fragment shader (vr-view.js) writes the clip-space depth of the first thing a ray shows (a tissue surface, or the cut
// face of a section) to gl_FragDepth; the distance lines / leaders / labels (vr-measure.js) are then drawn with a real depth test (hidden parts clipped at the surface
// outline) plus a faint "ghost" pass (depthFunc GreaterDepth) so a hidden part stays findable. Pure helpers: no three.js, no DOM.

// setting 「ラベルの隠れ方」 (VR settings): 1 = 実際に隠す (GPU depth, default), 0 = 薄くする (build 493-494: CPU probes, drawn faint)
export const LABEL_HIDE_REAL = 1, LABEL_HIDE_FADE = 0, LABEL_HIDE_DEFAULT = LABEL_HIDE_REAL;
// only an explicit 0 / '0' / false selects the fade; a missing or odd saved value falls back to the default
export const normalizeLabelHide = v => (v === 0 || v === '0' || v === false) ? LABEL_HIDE_FADE : LABEL_HIDE_DEFAULT;
// GPU occlusion needs the standard depth mapping of the shader (z/w * 0.5 + 0.5): a logarithmic or reversed depth buffer would need another formula, so those fall back to the fade
export const gpuOcclusionActive = (setting, caps) => normalizeLabelHide(setting) === LABEL_HIDE_REAL && !!caps && !caps.logarithmicDepthBuffer && !caps.reversedDepthBuffer;

// the ghost pass: opacity factor of a part that is behind the tissue (the normal pass keeps the part in front)
export const GHOST_ALPHA = 0.3;
// how far behind the surface (voxels of the classification grid, voxelMin) the volume's written depth lies. Points / lines are recorded ON a surface voxel or a cut face
// (about half a voxel inside, up to 1.7 voxels along a grazing ray), so they must stay in front of it. Must equal DEPTH_BIAS in the fragment shader (tests/unit/vr-depth.test.js).
export const DEPTH_BIAS_VOXELS = 2;
// the same maths as the fragment shader: the object-space ray parameter t (along the unit direction) is pushed back by the bias, the point goes through the model-view and
// projection matrices (column-major 16 arrays, as three.js stores them) and the window depth is z/w * 0.5 + 0.5, clamped to 0..1. null = behind the camera plane (the shader keeps the box face depth).
export function biasedT(t, voxelMin, biasVoxels = DEPTH_BIAS_VOXELS) { return t + biasVoxels * voxelMin; }
export function clipDepth(modelView, projection, p) {
  const m = modelView, q = projection;
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], w0 = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  const cz = q[2] * x + q[6] * y + q[10] * z + q[14] * w0, cw = q[3] * x + q[7] * y + q[11] * z + q[15] * w0;
  if (!(cw > 1e-6)) return null;
  return Math.min(1, Math.max(0, cz / cw * 0.5 + 0.5));
}
// the window depth of a point at eye-space depth zEye (negative in front of the camera) for a standard perspective camera (near / far)
export function perspectiveDepth(zEye, near, far) {
  const a = -(far + near) / (far - near), b = -2 * far * near / (far - near);
  return Math.min(1, Math.max(0, (a * zEye + b) / -zEye * 0.5 + 0.5));
}
