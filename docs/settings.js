// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
<<<<<<< HEAD
import { surfaceSmoothEnabled, surfaceSmoothStrength } from './ui-shell.js?v=20260929-build334';
=======
import { surfaceSmoothEnabled, surfaceSmoothStrength } from './ui-shell.js?v=20260929-build334';
>>>>>>> 8669256 (GPU volume texture: add RENDER_ATTACHMENT so the zero-fill runs on the GPU (Windows Full failed))
export function surfaceSmoothingActive(){
 return !!surfaceSmoothEnabled?.checked&&Number(surfaceSmoothStrength?.value)>0;
}
export function strongSurfaceSmoothingActive(){return surfaceSmoothingActive()&&Number(surfaceSmoothStrength?.value)>3;}
