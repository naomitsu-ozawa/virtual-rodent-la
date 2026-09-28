// Global app settings (build 280): stored per device in localStorage and
// shown in the settings dialog. Pure module, no imports, so any module
// (including medical-volume.js, which the unit tests load alone) can read it
// through globalThis.__vrlSettings.
const KEY='vrl.settings.v1';
export const SETTINGS_DEFAULTS={
 gpuSide:512,          // 3D volume texture in-plane size: 512 / 768 / 0 (full, desktop only)
 dragQuality:'standard', // pixel budget while dragging
 restQuality:'standard', // pixel budget at rest
 stepQuality:'standard', // ray-march step
 interp:'linear',      // 3D sampling: none / linear / smooth / smoother
 showPerf:true,        // frame time / fps in the status bar
 debug:false           // same as ?debug
};
// pixel budgets (MP) per interaction tier / at rest; 'max' = no budget
export const DRAG_BUDGETS={low:[0.12e6,0.09e6,0.06e6],standard:[0.25e6,0.18e6,0.12e6],high:[0.45e6,0.32e6,0.22e6],max:[Infinity,Infinity,Infinity]};
export const REST_BUDGETS={low:0.5e6,standard:1.0e6,high:1.8e6,max:Infinity};
export const STEP_SCALES={coarse:1.4,standard:1,fine:0.7};
let values={...SETTINGS_DEFAULTS};
try{const raw=globalThis.localStorage?.getItem(KEY);if(raw)values={...values,...JSON.parse(raw)}}catch{}
const api={
 get:k=>values[k],
 all:()=>({...values}),
 set(k,v){values[k]=v;try{globalThis.localStorage?.setItem(KEY,JSON.stringify(values))}catch{}try{globalThis.dispatchEvent?.(new CustomEvent('vrl-settings',{detail:{key:k,value:v}}))}catch{}},
 dragBudget:tier=>(DRAG_BUDGETS[values.dragQuality]||DRAG_BUDGETS.standard)[tier]??DRAG_BUDGETS.standard[0],
 restBudget:()=>REST_BUDGETS[values.restQuality]??REST_BUDGETS.standard,
 stepScale:()=>STEP_SCALES[values.stepQuality]??1,
 interpLevel:()=>({none:0,linear:1,smooth:2,smoother:3})[values.interp]??1,
 debugOn:()=>debugEnabled()
};
globalThis.__vrlSettings=api;
export const settings=api;
export function debugEnabled(){
 if(values.debug)return true;
 return typeof location!=='undefined'&&/[?&]debug(\b|=|&|$)/.test(location.search);
}
