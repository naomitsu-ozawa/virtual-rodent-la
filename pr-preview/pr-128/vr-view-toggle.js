// AR session: in-session switch between passthrough (AR) and a "VR view" (opaque background, drawn instead of the transparent clear).
// Pure logic only (no three.js, no DOM); vr-view.js applies the state to the scene and the clear colour.
export const VIEW_TOGGLE_ID='view-toggle'; // ring item id; not in WHEEL_ITEMS (never saved in the ring settings): added to the ring only in an AR session
export const VIEW_TOGGLE_BUTTON=3;         // xr-standard thumbstick click: unused in vr-view.js (A/X = 4, B/Y = 5, trigger = 0, grip = 1)
export const VIEW_TOGGLE_DOUBLE_MS=350;    // the second press must come within this time of the first

// Per-session state. Only an AR session can switch; a VR session (isAr false) is never in "VR view" mode (it is VR already).
// vrView = true: opaque background drawn. New session = new state = passthrough again.
export function createViewToggle(isAr){
 let vrView=false;
 return{
  get vrView(){return vrView},
  get passthrough(){return !!isAr&&!vrView}, // true = transparent clear (alpha 0) + the real world shows through
  canToggle:!!isAr,
  toggle(){if(isAr)vrView=!vrView;return vrView},
  reset(){vrView=false},
 };
}

// The ring ids of a session: ids (saved slots, null = empty) plus the toggle, AR only. The toggle takes the first empty slot, else a new last slot (the saved layout is never changed).
export function ringIdsFor(ids,isAr){
 const a=Array.isArray(ids)?[...ids]:[];
 if(!isAr||a.includes(VIEW_TOGGLE_ID))return a;
 const e=a.indexOf(null);
 if(e>=0)a[e]=VIEW_TOGGLE_ID;else a.push(VIEW_TOGGLE_ID);
 return a;
}

// Double press of a button: update(pressed, now) -> true once, on the rising edge of the second press that comes within windowMs of the first press's rising edge.
// After a double press the next press starts a new pair (a third quick press is not another double).
export function createDoublePress({windowMs=VIEW_TOGGLE_DOUBLE_MS}={}){
 let down=false,last=null;
 return{
  update(pressed,now){
   const p=!!pressed;
   if(p&&!down){
    down=true;
    if(last!==null&&now-last<=windowMs){last=null;return true}
    last=now;return false;
   }
   if(!p)down=false;
   return false;
  },
  reset(){down=false;last=null},
 };
}
