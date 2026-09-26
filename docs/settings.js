// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { surfaceSmoothEnabled, surfaceSmoothStrength } from './ui-shell.js?v=20260926-build212';
export function surfaceSmoothingActive(){
 return !!surfaceSmoothEnabled?.checked&&Number(surfaceSmoothStrength?.value)>0;
}
export function strongSurfaceSmoothingActive(){return surfaceSmoothingActive()&&Number(surfaceSmoothStrength?.value)>3;}
