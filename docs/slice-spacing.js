// Slice-spacing check (pure, no DOM). Volumes are voxel count x the three spacings, so a wrong Z spacing
// (missing / duplicated slices, uneven spacing) silently skews every volume. This module measures every
// consecutive gap along the slice normal, classifies what is wrong and picks the spacing to use.
//
// Thresholds (documented in the PR; exported so tests and the UI agree):
//  - duplicate:    gap <= max(1e-3 mm, 5% of the median gap)
//  - missing:      gap > 1.5 x median gap; missing slices = round(gap / median) - 1 (at least 1)
//  - non-uniform:  (max - min) of the regular gaps (neither duplicate nor missing) > 1% of the median
//  - tag mismatch: |median - SpacingBetweenSlices| > 2% of the median (SliceThickness is only recorded:
//                  thickness legitimately differs from spacing for overlapping / gapped reconstructions)
export const SPACING_THRESHOLDS={dupAbsMm:1e-3,dupRel:0.05,missingRel:1.5,uniformRel:0.01,tagRel:0.02};

const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function sliceNormal(orientation){
 if(!orientation||orientation.length<6)return null;
 const r=orientation.slice(0,3),c=orientation.slice(3,6),n=[r[1]*c[2]-r[2]*c[1],r[2]*c[0]-r[0]*c[2],r[0]*c[1]-r[1]*c[0]],len=Math.hypot(...n);
 return len>1e-6&&n.every(Number.isFinite)?n.map(v=>v/len):null;
}
// Position of a slice along the series normal (ImageOrientationPatient present) or Z (fallback = previous behaviour).
export function slicePosition(meta,normal){
 if(!meta?.pos)return null;
 return normal?dot(meta.pos,normal):meta.pos[2];
}
export function seriesNormal(slices){
 const o=slices.find(s=>s.orientation)?.orientation;
 return sliceNormal(o);
}
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};

// slices: slice metas ALREADY sorted by slicePosition. Returns the check result (JSON-able).
export function analyzeSliceSpacing(slices,fallbackMm=1){
 const T=SPACING_THRESHOLDS,f=slices[0]||{},tagBetween=f.spacingBetween>0?f.spacingBetween:null,tagThickness=f.thickness>0?f.thickness:null;
 const tagZ=tagBetween||tagThickness||fallbackMm;
 const normal=seriesNormal(slices),method=normal?'normal':'z';
 const base={method,slices:slices.length,gaps:0,used:tagZ,basis:'tag',medianGap:null,minGap:null,maxGap:null,spreadPct:0,duplicates:0,missing:0,missingGaps:[],nonUniform:false,tagSpacingBetween:tagBetween,tagThickness,spacingBetweenMismatch:false,thicknessDiffers:false,warn:false};
 if(slices.length<2)return base;
 const pos=slices.map(s=>slicePosition(s,normal));
 if(pos.some(p=>p==null||!Number.isFinite(p)))return{...base,method:'none'};
 const gaps=[];for(let i=1;i<pos.length;i++)gaps.push(Math.abs(pos[i]-pos[i-1]));
 // reference gap: median of the non-duplicate gaps (a majority of duplicates must not drag it to 0)
 const pos0=gaps.filter(g=>g>T.dupAbsMm),ref=median(pos0.length?pos0:gaps);
 if(!(ref>T.dupAbsMm))return{...base,gaps:gaps.length,duplicates:gaps.length,warn:true,medianGap:ref,used:tagZ,basis:'tag'};
 let duplicates=0,missing=0;const missingGaps=[],regular=[];
 gaps.forEach((g,i)=>{
  if(g<=Math.max(T.dupAbsMm,T.dupRel*ref))duplicates++;
  else if(g>T.missingRel*ref){const n=Math.max(1,Math.round(g/ref)-1);missing+=n;missingGaps.push({index:i,gap:g,missing:n})}
  else regular.push(g);
 });
 const med=median(regular.length?regular:pos0),spread=regular.length?(Math.max(...regular)-Math.min(...regular))/med:0;
 const nonUniform=spread>T.uniformRel;
 const spacingBetweenMismatch=tagBetween!=null&&Math.abs(med-tagBetween)>T.tagRel*med;
 const thicknessDiffers=tagThickness!=null&&Math.abs(med-tagThickness)>T.tagRel*med;
 const clean=!duplicates&&!missing&&!nonUniform;
 // uniform data keeps the previous behaviour (first gap); anything irregular uses the median
 const first=gaps[0],used=clean&&first>T.dupAbsMm?first:med;
 return{method,slices:slices.length,gaps:gaps.length,used,basis:clean?'first-gap':'median',medianGap:med,minGap:Math.min(...gaps),maxGap:Math.max(...gaps),spreadPct:spread*100,duplicates,missing,missingGaps,nonUniform,tagSpacingBetween:tagBetween,tagThickness,spacingBetweenMismatch,thicknessDiffers,warn:!clean||spacingBetweenMismatch};
}

const r2=n=>(Math.round(n*100)/100).toString(),r3=n=>(Math.round(n*1000)/1000).toString();
// One-line warning (null when nothing to report). Bilingual: {ja,en}.
export function spacingWarningText(check){
 if(!check?.warn)return null;
 const ja=[],en=[];
 if(check.missing){ja.push('抜け '+check.missing+' 枚');en.push(check.missing+' missing')}
 if(check.duplicates){ja.push('重複 '+check.duplicates+' 枚');en.push(check.duplicates+' duplicate')}
 if(check.nonUniform){ja.push('間隔のばらつき '+r2(check.spreadPct)+'%');en.push('spacing spread '+r2(check.spreadPct)+'%')}
 if(check.spacingBetweenMismatch){ja.push('SpacingBetweenSlices（'+r3(check.tagSpacingBetween)+' mm）と不一致');en.push('differs from SpacingBetweenSlices ('+r3(check.tagSpacingBetween)+' mm)')}
 const u=r3(check.used),how=check.basis==='median';
 return{
  ja:'スライス間隔に不整合があります：'+ja.join('、')+'。体積は'+(how?'中央値 ':'')+u+' mm で計算しています',
  en:'Slice spacing is inconsistent: '+en.join(', ')+'. Volumes are computed with '+(how?'the median ':'')+u+' mm',
 };
}
// Compact record saved in the .vrlab project (optional field `spacingCheck`; informational, never applied on load).
export function spacingCheckForProject(check){
 if(!check)return null;
 const{missingGaps,...rest}=check;
 return{...rest,missingGaps:(missingGaps||[]).slice(0,50)};
}
