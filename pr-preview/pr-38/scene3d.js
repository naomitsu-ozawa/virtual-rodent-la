// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { sceneState } from './state.js?v=20260927-build226';
export function request3DRender(){
 if(sceneState)sceneState.needsRender=true;
}
