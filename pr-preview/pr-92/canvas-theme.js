// Canvas backgrounds follow the theme (build 450). Reads --ui-canvas-bg-3d from themes.css for the WebGL fallback clear
// colour (the WebGPU canvas is transparent and shows the CSS backdrop of the view card, the 2D slices sit on
// --ui-canvas-bg-2d in CSS). Only the BACKGROUND is read here: the image itself (grey levels, window / level, segment colours,
// transfer function) never depends on a theme.
export function cssTriplet(name,root=globalThis.document?.documentElement){
 try{const v=getComputedStyle(root).getPropertyValue(name).trim().split(/\s+/).map(Number);return v.length===3&&v.every(Number.isFinite)?v:null}catch{return null}
}
export const canvasBackground3d=()=>cssTriplet('--ui-canvas-bg-3d');
// theme.js dispatches 'vrl-themechange' on the document; the 3D view sets its clear colour and draws again
export function onCanvasThemeChange(cb,doc=globalThis.document){doc?.addEventListener?.('vrl-themechange',cb);return()=>doc?.removeEventListener?.('vrl-themechange',cb)}
