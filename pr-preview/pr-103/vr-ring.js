// VR ring menu, stage 1 (build 468): pure functions only (item catalog, settings, stick selection, button press); no three.js, no DOM.
// The drawing (createRingMenu) comes in a later stage. Angles: 0 = up, clockwise, in degrees.
export const WHEEL_SLOTS=6;
// id is saved in the settings: never change one. when: when the item is usable (checked by vr-view.js)
export const WHEEL_ITEMS=[
 {id:'mode-section',ja:'断面モード',en:'Section mode',when:'always'},
 {id:'mode-surface',ja:'表面モード',en:'Surface mode',when:'always'},
 {id:'undo',ja:'元に戻す',en:'Undo',when:'undo'},
 {id:'section-toggle',ja:'断面の表示／非表示',en:'Show/hide sections',when:'always'},
 {id:'section-add',ja:'断面を追加',en:'Add section',when:'planes<4'},
 {id:'point-delete',ja:'選んだ点を削除',en:'Delete selected point',when:'point-selected'},
 {id:'section-next',ja:'次の断面を選ぶ',en:'Next section',when:'planes>=2'},
 {id:'snap-axial',ja:'断面を軸位に',en:'Axial',when:'section-selected'},
 {id:'snap-coronal',ja:'断面を冠状に',en:'Coronal',when:'section-selected'},
 {id:'snap-sagittal',ja:'断面を矢状に',en:'Sagittal',when:'section-selected'},
 {id:'section-clip',ja:'断面で切る／切らない',en:'Clip on/off',when:'section-selected'},
 {id:'home',ja:'正面に戻す',en:'Bring to front',when:'always'},
 {id:'screenshot',ja:'スクリーンショット',en:'Screenshot',when:'always'},
 {id:'menu',ja:'全体メニュー',en:'Full menu',when:'always'},
];
export const WHEEL_IDS=WHEEL_ITEMS.map(i=>i.id);
export const DEFAULT_WHEEL=Object.freeze(['mode-section','mode-surface','undo','section-toggle','section-add',null]);
export const WHEEL_SETTINGS_KEY='wheel';

// anything -> a new array of WHEEL_SLOTS ids / nulls (unknown ids and later duplicates become null; nothing usable = the default)
export function normalizeWheelItems(raw){
 if(!Array.isArray(raw))return[...DEFAULT_WHEEL];
 const out=[],seen=new Set();
 for(let k=0;k<WHEEL_SLOTS;k++){
  const id=raw[k];
  if(typeof id==='string'&&WHEEL_IDS.includes(id)&&!seen.has(id)){seen.add(id);out.push(id)}else out.push(null);
 }
 return out.some(Boolean)?out:[...DEFAULT_WHEEL];
}
// JSON text of the slots / back; any failure gives the default (settings are untrusted: storage can hold anything)
export function serializeWheelItems(items){
 try{return JSON.stringify(normalizeWheelItems(items))}catch{return JSON.stringify([...DEFAULT_WHEEL])}
}
export function parseWheelItems(text){
 try{return normalizeWheelItems(typeof text==='string'?JSON.parse(text):text)}catch{return[...DEFAULT_WHEEL]}
}
// put id in a slot; when it is in another slot the two swap (never twice in the ring). Unknown id / slot: a copy, unchanged.
export function setWheelItem(items,slot,id){
 const a=normalizeWheelItems(items);
 if(!Number.isInteger(slot)||slot<0||slot>=WHEEL_SLOTS)return a;
 if(id===null||id===undefined)return clearWheelItem(a,slot);
 if(!WHEEL_IDS.includes(id))return a;
 const at=a.indexOf(id);
 if(at===slot)return a;
 if(at>=0)a[at]=a[slot];
 a[slot]=id;return a;
}
// swap the slot with its neighbour (dir +1 / -1), wrapping round at the ends
export function moveWheelItem(items,from,dir){
 const a=normalizeWheelItems(items);
 if(!Number.isInteger(from)||from<0||from>=WHEEL_SLOTS)return a;
 const to=((from+(dir<0?-1:1))%WHEEL_SLOTS+WHEEL_SLOTS)%WHEEL_SLOTS;
 [a[from],a[to]]=[a[to],a[from]];return a;
}
export function clearWheelItem(items,slot){
 const a=normalizeWheelItems(items);
 if(Number.isInteger(slot)&&slot>=0&&slot<WHEEL_SLOTS)a[slot]=null;
 return a;
}

// ---- geometry ----
// centre angle of each item: 6 -> 0,60,..; 2 -> 270 (move, left), 90 (delete, right); 3 -> 0,120,240
export function wheelAngles(n){
 if(n===2)return[270,90];
 return Array.from({length:n},(_,k)=>k*360/n);
}
const angDiff=(a,b)=>{const d=Math.abs(a-b)%360;return d>180?360-d:d};
// angle (0..360, up = 0, clockwise) -> slot, or null (nearest item farther than 180/n, a disabled one, or an empty one).
// prev: the lit slot; it is kept until the angle is more than 180/n + hysDeg away from it.
export function wheelSlotFromAngle(theta,n,enabled,prev=null,{hysDeg=10}={}){
 const ang=wheelAngles(n),half=180/n;
 if(prev!==null&&prev!==undefined&&prev>=0&&prev<n&&enabled?.[prev]&&angDiff(theta,ang[prev])<=half+hysDeg)return prev;
 let k=-1,best=Infinity;
 for(let i=0;i<n;i++){const d=angDiff(theta,ang[i]);if(d<best){best=d;k=i}}
 return k>=0&&best<=half&&enabled?.[k]?k:null;
}
const toTheta=(x,y)=>{const t=Math.atan2(x,y)*180/Math.PI;return t<0?t+360:t};
// position on the board (x right, y up, metres from its centre) -> slot, only on the ring of items (0.55 R .. 1.5 R), else null
export function wheelSlotFromLocal(x,y,n,R){
 const r=Math.hypot(x,y);
 if(!(r>=0.55*R&&r<=1.5*R))return null;
 const th=toTheta(x,y),ang=wheelAngles(n);
 let k=0,best=Infinity;
 for(let i=0;i<n;i++){const d=angDiff(th,ang[i]);if(d<best){best=d;k=i}}
 return k;
}

// ---- thumbstick selection (spec 5.2) ----
// update(ax, ay, enabled[]) with the xr-standard axes[2], axes[3] -> {highlight, changed, confirm}
//  - after opening nothing happens until the stick has once been below `release`
//  - lights an item when the stick is beyond `enter`; leaving it dark when the sector is empty / disabled
//  - between release and enter the lit item is kept; back below `release` with an item lit = confirm (once), and the highlight clears
//  - changed: the lit item became another (non-null) item (a light pulse)
export function createWheelStick({enter=0.5,release=0.25,hysDeg=10}={}){
 let armed=false,hl=null;
 return{
  update(ax,ay,enabled){
   const n=enabled?.length||0,x=+ax||0,y=-(+ay||0),m=Math.hypot(x,y);
   if(!armed){if(m<release)armed=true;return{highlight:null,changed:false,confirm:null}}
   let changed=false,confirm=null;
   if(m>=enter&&n>0){
    const k=wheelSlotFromAngle(toTheta(x,y),n,enabled,hl,{hysDeg});
    if(k!==hl){hl=k;changed=k!==null}
   }else if(m<release&&hl!==null){confirm=hl;hl=null}
   return{highlight:hl,changed,confirm};
  },
  reset(){armed=false;hl=null},
  get armed(){return armed},
 };
}

// ---- A/X button (spec 5.5) ----
// update(pressed, now) -> 'long' once when held for longMs | 'short' when released before it | null
export function createButtonPress({longMs=500}={}){
 let t0=null,fired=false;
 return{
  update(pressed,now){
   if(pressed){
    if(t0===null){t0=now;fired=false;return null}
    if(!fired&&now-t0>=longMs){fired=true;return'long'}
    return null;
   }
   if(t0===null)return null;
   const short=!fired&&now-t0<longMs;t0=null;fired=false;
   return short?'short':null;
  },
  reset(){t0=null;fired=false},
 };
}

// ---- drawing (three.js): a square board with the items on a ring, facing the head ----
// THREE is passed in (no import, no DOM at module level). size: board side in metres (0.16). Canvas 512 x 512; item centres at 0.055/0.16 of the side.
export const WHEEL_BOARD_M=0.16,WHEEL_RADIUS_M=0.055;
export function createRingMenu(THREE,{size=WHEEL_BOARD_M}={}){
 const N=512,Rpx=WHEEL_RADIUS_M/WHEEL_BOARD_M*N,canvas=document.createElement('canvas');canvas.width=N;canvas.height=N;
 const ctx=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
 mesh.renderOrder=7;mesh.frustumCulled=false;mesh.visible=false;
 let labels=[],enabled=[],on=[],hl=null;
 const draw=()=>{
  ctx.clearRect(0,0,N,N);
  const n=labels.length,ang=wheelAngles(n);
  ctx.fillStyle='rgba(14,20,27,.55)';ctx.beginPath();ctx.arc(N/2,N/2,Rpx+110,0,Math.PI*2);ctx.fill();
  ctx.textAlign='center';ctx.textBaseline='middle';
  labels.forEach((t,k)=>{
   const a=ang[k]*Math.PI/180,cx=N/2+Math.sin(a)*Rpx,cy=N/2-Math.cos(a)*Rpx,w=160,h=72,x=cx-w/2,y=cy-h/2;
   ctx.beginPath();ctx.roundRect(x,y,w,h,16);
   if(t===null||t===undefined){ctx.setLineDash([8,8]);ctx.strokeStyle='rgba(159,179,195,.6)';ctx.lineWidth=3;ctx.stroke();ctx.setLineDash([]);return}
   const ok=!!enabled[k];ctx.fillStyle=k===hl?'#ffd23d':!ok?'#1a2129':on[k]?'#2d6cdf':'#26313b';ctx.fill();
   ctx.strokeStyle=k===hl?'#fff':'rgba(255,255,255,.35)';ctx.lineWidth=k===hl?5:2;ctx.stroke();
   ctx.fillStyle=k===hl?'#111':!ok?'#6b7885':'#fff';ctx.font='bold 28px system-ui,sans-serif';
   // two lines when the name is long (split at the middle)
   if(t.length>6){const m=Math.ceil(t.length/2);ctx.font='bold 25px system-ui,sans-serif';ctx.fillText(t.slice(0,m),cx,cy-14);ctx.fillText(t.slice(m),cx,cy+14)}else ctx.fillText(t,cx,cy+1);
  });
  tex.needsUpdate=true;
 };
 return{
  mesh,n:()=>labels.length,
  // labels: names (null = empty slot), enabled: usable, on: shown as "on" (e.g. the current mode)
  setItems(l,e,o){labels=l;enabled=e;on=o||[];draw()},
  setHighlight(k){if(k!==hl){hl=k;draw()}},
  // the slot under a uv of the board (the raycaster's), or null
  // only inside the label rect of a filled, usable item (160 x 72 px of the 512 px canvas); empty / disabled slots and the gaps are null
  slotFromUv(uv){
   const px=uv.x*N,py=(1-uv.y)*N,ang=wheelAngles(labels.length);
   for(let k=0;k<labels.length;k++){
    if(labels[k]===null||labels[k]===undefined||!enabled[k])continue;
    const a=ang[k]*Math.PI/180,cx=N/2+Math.sin(a)*Rpx,cy=N/2-Math.cos(a)*Rpx;
    if(Math.abs(px-cx)<=80&&Math.abs(py-cy)<=36)return k;
   }
   return null;
  },
  placeAt(center,head){mesh.position.set(center.x,center.y,center.z);if(head)mesh.lookAt(head.x,head.y,head.z)},
  dispose(){tex.dispose();mesh.geometry.dispose();mesh.material.dispose()},
 };
}
