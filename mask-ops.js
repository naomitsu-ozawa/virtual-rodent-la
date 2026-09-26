// Extracted verbatim from app.js by tools/extract-module.mjs.
// Self-contained: depends only on the imports below (no module state).
import { frameYield } from './utils.js?v=20260926-build205';
export function valuesToSegmentBits(values,segments){
 const out=new Uint32Array(values.length);
 for(let i=0;i<values.length;i++){const v=values[i];let bits=0;for(let s=0;s<segments.length&&s<4;s++)if(v>=segments[s].seg.min&&v<=segments[s].seg.max)bits|=(1<<s);out[i]=bits}
 return out;
}
export function valuesToFaceFlags(values,w,h,d,target,segments,box,series){
 const out=new Uint32Array(target.width*target.height*target.depth);let q=0;
 const local=(x,y,z)=>values[z*w*h+y*w+x],inside=(v,s)=>v>=segments[s].seg.min&&v<=segments[s].seg.max;
 for(let tz=0;tz<target.depth;tz++)for(let ty=0;ty<target.height;ty++)for(let tx=0;tx<target.width;tx++){
  const x=target.x+tx,y=target.y+ty,z=target.z+tz,gx=box.x+x,gy=box.y+y,gz=box.z+z,center=local(x,y,z);let packed=0;
  for(let s=0;s<segments.length&&s<4;s++){
   if(!inside(center,s))continue;let faces=0;
   if(gx===0||!inside(local(x-1,y,z),s))faces|=1;
   if(gx+1>=series.columns||!inside(local(x+1,y,z),s))faces|=2;
   if(gy===0||!inside(local(x,y-1,z),s))faces|=4;
   if(gy+1>=series.rows||!inside(local(x,y+1,z),s))faces|=8;
   if(gz===0||!inside(local(x,y,z-1),s))faces|=16;
   if(gz+1>=series.slices.length||!inside(local(x,y,z+1),s))faces|=32;
   packed|=faces<<(s*6);
  }
  out[q++]=packed;
 }
 return out;
}
export function compactFaceFlags(flags){
 let count=0;for(let i=0;i<flags.length;i++)if(flags[i])count++;
 const items=new Uint32Array(count*2);let q=0;
 for(let i=0;i<flags.length;i++)if(flags[i]){items[q++]=i;items[q++]=flags[i]}
 return{compact:true,items};
}
export async function boxBlur3D(baseVolume,radius){
 const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data,r=Math.max(1,Math.round(radius));
 const out=new Float32Array(n);
 for(let z=0;z<d;z++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sum=0,count=0;
   for(let dz=-r;dz<=r;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;
    for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
     for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=src[zz*h*w+yy*w+xx];count++}
    }
   }
   out[z*h*w+y*w+x]=sum/Math.max(1,count);
  }
  if((z&7)===0)await frameYield();
 }
 return out;
}
export function buildThresholdMask(v,seg){
 const mask=new Uint8Array(v.data.length);for(let i=0;i<v.data.length;i++){const x=v.data[i];if(x>=seg.min&&x<=seg.max)mask[i]=1}return mask;
}
export function morphMask(mask,w,h,d,radius,dilate){
 let a=new Uint8Array(mask),b=new Uint8Array(mask.length),plane=w*h;
 for(let pass=0;pass<radius;pass++){
  b.fill(0);
  for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=z*plane+y*w+x;
   if(dilate){
    let on=a[i]===1;if(!on&&x>0)on=a[i-1]===1;if(!on&&x<w-1)on=a[i+1]===1;if(!on&&y>0)on=a[i-w]===1;if(!on&&y<h-1)on=a[i+w]===1;if(!on&&z>0)on=a[i-plane]===1;if(!on&&z<d-1)on=a[i+plane]===1;b[i]=on?1:0;
   }else{
    let on=a[i]===1;if(on&&(x===0||a[i-1]===0))on=false;if(on&&(x===w-1||a[i+1]===0))on=false;if(on&&(y===0||a[i-w]===0))on=false;if(on&&(y===h-1||a[i+w]===0))on=false;if(on&&(z===0||a[i-plane]===0))on=false;if(on&&(z===d-1||a[i+plane]===0))on=false;b[i]=on?1:0;
   }
  }
  const t=a;a=b;b=t;
 }
 return a;
}
export function fillMaskHoles(mask,w,h,d){
 const n=mask.length,plane=w*h,seen=new Uint8Array(n),stack=[];const push=i=>{if(i>=0&&i<n&&!mask[i]&&!seen[i]){seen[i]=1;stack.push(i)}};
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){push(z*plane+y*w);push(z*plane+y*w+w-1)}
 for(let z=0;z<d;z++)for(let x=0;x<w;x++){push(z*plane+x);push(z*plane+(h-1)*w+x)}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){push(y*w+x);push((d-1)*plane+y*w+x)}
 while(stack.length){const i=stack.pop(),z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);if(z>0)push(i-plane);if(z<d-1)push(i+plane)}
 const out=new Uint8Array(mask);for(let i=0;i<n;i++)if(!mask[i]&&!seen[i])out[i]=1;return out;
}
export function removeSmallMaskComponents(mask,w,h,d,minSize){
 if(minSize<=0)return mask;const out=new Uint8Array(mask),seen=new Uint8Array(mask.length),stack=[],plane=w*h;
 for(let seed=0;seed<out.length;seed++){if(!out[seed]||seen[seed])continue;const comp=[];stack.push(seed);seen[seed]=1;while(stack.length){const i=stack.pop();comp.push(i);const z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;const ns=[];if(x>0)ns.push(i-1);if(x<w-1)ns.push(i+1);if(y>0)ns.push(i-w);if(y<h-1)ns.push(i+w);if(z>0)ns.push(i-plane);if(z<d-1)ns.push(i+plane);for(const j of ns)if(out[j]&&!seen[j]){seen[j]=1;stack.push(j)}}if(comp.length<minSize)for(const i of comp)out[i]=0}
 return out;
}
export async function smoothMaskScalarField(mask,w,h,d,strength){
 const fw=w+2,fh=h+2,fd=d+2,plane=fw*fh,n=plane*fd;
 let a=new Float32Array(n),b=new Float32Array(n);
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){
  const src=z*w*h+y*w,dst=(z+1)*plane+(y+1)*fw+1;
  for(let x=0;x<w;x++)a[dst+x]=mask[src+x]?1:0;
 }
 const rounds=Math.max(1,Math.min(8,Math.round(.5+Math.max(0,strength)*1.15))),alpha=.48;
 for(let round=0;round<rounds;round++){
  b.fill(0);
  for(let z=1;z<fd-1;z++)for(let y=1;y<fh-1;y++){
   const row=z*plane+y*fw;
   for(let x=1;x<fw-1;x++){
    const i=row+x,avg=(a[i-1]+a[i+1]+a[i-fw]+a[i+fw]+a[i-plane]+a[i+plane])/6;
    b[i]=a[i]*(1-alpha)+avg*alpha;
   }
  }
  const t=a;a=b;b=t;if((round&1)===1)await frameYield();
 }
 return{data:a,fw,fh,fd};
}
export function thresholdSourceMask(data,seg){
 const mask=new Uint8Array(data.length);
 for(let i=0;i<data.length;i++)if(data[i]>=seg.min&&data[i]<=seg.max)mask[i]=1;
 return mask;
}
