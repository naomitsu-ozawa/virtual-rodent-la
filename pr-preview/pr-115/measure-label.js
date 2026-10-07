// Where the distance label goes (build 480): by default NEAR its line (a small offset from the midpoint, perpendicular to the line), and wherever the user dragged it
// (measurements.js labelOffset: voxel units from the midpoint). Pure functions (no DOM, no three.js); screen coordinates in px (x right, y down).
const norm=(x,y)=>{const l=Math.hypot(x,y);return l>1e-9?{x:x/l,y:y/l}:null};

// keep a label (w x h, centre x,y) inside the rect (x0,y0,iw,ih): at DISPLAY time only (the stored offset is untouched), so a label moved far away can never be lost off-screen
export function clampLabelCenter(x,y,{w=60,h=16,x0=-1e9,y0=-1e9,iw=2e9,ih=2e9,pad=2}={}){
 const cx=Math.min(Math.max(x,x0+w/2+pad),Math.max(x0+w/2+pad,x0+iw-w/2-pad)),cy=Math.min(Math.max(y,y0+h/2+pad),Math.max(y0+h/2+pad,y0+ih-h/2-pad));
 return{x:cx,y:cy};
}
// The default label of the PC views (3D and 2D MPR): beside the line a-b, perpendicular to it (the upper side), just clear of the line, clamped into the rect (x0,y0,iw,ih) (the image / the view). -> {x,y} the label's centre, {mx,my} the midpoint.
export function planeLabelPlacement(a,b,{w=48,h=14,gap=4,x0=-1e9,y0=-1e9,iw=2e9,ih=2e9}={}){
 const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,u=norm(b.x-a.x,b.y-a.y)||{x:1,y:0};
 let n={x:-u.y,y:u.x};if(n.y>0||(n.y===0&&n.x<0))n={x:-n.x,y:-n.y};
 const d=gap+Math.abs(n.x)*w/2+Math.abs(n.y)*h/2; // the rectangle's half extent along n: its edge just clears the line
 const c=clampLabelCenter(mx+n.x*d,my+n.y*d,{w,h,x0,y0,iw,ih,pad:1});
 return{x:c.x,y:c.y,mx,my};
}

// ---- moving the label ----
// a voxel offset {i,j,k} -> a vector in the view's space, and back; step = the space's change per voxel along i / j / k, e.g. VR [2hx/cols, -2hy/rows, 2hz/slices]
export const stepDelta=(off,step)=>({x:off.i*step[0],y:off.j*step[1],z:off.k*step[2]});
export const offsetFromDelta=(d,step)=>({i:step[0]?d.x/step[0]:0,j:step[1]?d.y/step[1]:0,k:step[2]?d.z/step[2]:0});
// 2D MPR: a drag of (dfx,dfy) (fractions of the image width / height) -> the voxel offset it stands for. project(v) -> {fx,fy} is the plane's mapping
// (crosshair.js planePointFromVoxel); the two voxel axes lying in the plane are found by probing, the out-of-plane one gets 0.
export function planeVoxelDelta(project,dfx,dfy){
 const o=project({i:0,j:0,k:0}),cols=['i','j','k'].map(ax=>{const p=project({i:ax==='i'?1:0,j:ax==='j'?1:0,k:ax==='k'?1:0});return{ax,x:p.fx-o.fx,y:p.fy-o.fy}});
 const inPlane=cols.filter(c=>Math.abs(c.x)>1e-12||Math.abs(c.y)>1e-12);
 const out={i:0,j:0,k:0};
 if(inPlane.length<2)return out;
 const[A,B]=inPlane,det=A.x*B.y-B.x*A.y;if(Math.abs(det)<1e-18)return out;
 out[A.ax]=(dfx*B.y-B.x*dfy)/det;out[B.ax]=(A.x*dfy-dfx*A.y)/det;
 return out;
}
// VR: the default label position (world metres) beside the line a-b: perpendicular to the line AND to the view direction (so it sits beside the line as seen), on the upper side,
// offset from the midpoint by `dist` (m). head: the head's world position.
export function nearLabelWorld(a,b,head,dist){
 const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[head.x-mid.x,head.y-mid.y,head.z-mid.z];
 let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(n[0],n[1],n[2]);
 if(l<1e-9){n=[0,1,0];l=1}
 n=n.map(x=>x/l);if(n[1]<0||(n[1]===0&&n[0]<0))n=n.map(x=>-x);
 return{x:mid.x+n[0]*dist,y:mid.y+n[1]*dist,z:mid.z+n[2]*dist};
}
