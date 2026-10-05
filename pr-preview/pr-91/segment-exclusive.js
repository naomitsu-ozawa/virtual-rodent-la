// Non-overlapping segments (build 438, owner: no voxel counted in two segments; priority = the order of the segment cards,
// top first). Pure kernel + small state; segments.js holds the segment state.
//
// Each segment keeps the range the user set (userMin / userMax, what the sliders show); the range every view, the
// runs, the analysis and the export use is seg.min / seg.max. With the mode 'priority' a segment's range is its user
// range minus the ranges held by the ACTIVE segments above it in the card order (hidden-by-checkbox segments still
// count, so hiding a card never moves another segment's voxels). 'off' = the user ranges as they are (overlaps allowed,
// the behaviour before 438; projects saved before 438 load with it).
//
// Ranges are inclusive ([min, max], as every reader compares v >= min && v <= max); a range cut at a higher segment's
// max b starts at the next float32 above b, so a filtered (non-integer) value can never fall into a gap between them.
// When a higher range lies strictly inside a lower one, two pieces remain; the app holds one range per segment, so the
// piece containing the middle of the user range is kept (else the larger) and the dropped piece is reported.
export const EXCLUSIVE_MODES=['off','priority'];
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
// next float32 above / below x (x finite)
export function nextUp(x){f32[0]=x;if(f32[0]<=x){if(f32[0]===0){u32[0]=1}else if(f32[0]>0)u32[0]+=1;else u32[0]-=1}return f32[0]}
export function nextDown(x){f32[0]=x;if(f32[0]>=x){if(f32[0]===0){u32[0]=0x80000001}else if(f32[0]>0)u32[0]-=1;else u32[0]+=1}return f32[0]}

// segs: {key: {userMin, userMax, active}}; order: keys top → bottom. Returns {key: {min, max, empty, dropped:[[a,b],…]}}
export function effectiveRanges(segs,order,mode){
 const out={},taken=[];
 for(const key of order){
  const s=segs[key];if(!s)continue;
  let pieces=[[+s.userMin,+s.userMax]];const dropped=[];
  if(mode==='priority'&&s.active)for(const [a,b] of taken){
   const next=[];
   for(const [lo,hi] of pieces){
    if(b<lo||a>hi){next.push([lo,hi]);continue}
    if(lo<a)next.push([lo,nextDown(a)]);
    if(hi>b)next.push([nextUp(b),hi]);
   }
   pieces=next;
  }
  let keep=null;
  if(pieces.length===1)keep=pieces[0];
  else if(pieces.length>1){
   const mid=(+s.userMin+ +s.userMax)/2;keep=pieces.find(([lo,hi])=>lo<=mid&&mid<=hi)||pieces.reduce((a,b)=>(b[1]-b[0]>a[1]-a[0]?b:a));
   for(const p of pieces)if(p!==keep)dropped.push(p);
  }
  out[key]=keep?{min:keep[0],max:keep[1],empty:false,dropped}:{min:+s.userMin,max:nextDown(+s.userMin),empty:true,dropped:[]};
  // what this segment really holds is taken from the ones below (a piece it dropped stays free for them)
  if(s.active&&keep)taken.push([keep[0],keep[1]]);
 }
 return out;
}
