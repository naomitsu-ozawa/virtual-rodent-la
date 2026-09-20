let source=null;
let meta=null;
let scratchA=null;
let scratchB=null;
let scratchC=null;
let cachedStages=[];
let cachedBytes=0;
let cacheLimit=128*1024*1024;
let pendingRun=null;
let processing=false;
const tick=()=>new Promise(r=>setTimeout(r,0));

function ensureScratch(n,needThird=false){
  if(!scratchA||scratchA.length!==n){scratchA=new Float32Array(n);scratchB=new Float32Array(n);scratchC=null}
  if(needThird&&(!scratchC||scratchC.length!==n))scratchC=new Float32Array(n);
}
function singleOut(input){
  ensureScratch(input.length);
  return input===scratchA?scratchB:scratchA;
}
function progress(id,done,total,label){postMessage({type:'progress',id,done,total,label})}
function isSuperseded(id){return pendingRun&&pendingRun.id!==id}
function cloneFloat(src){const out=new Float32Array(src.length);out.set(src);return out}

async function gaussian(input,p,id){
  const {w,h,d}=meta,n=w*h*d;ensureScratch(n);scratchA.set(input);
  let a=scratchA,b=scratchB;
  const strength=p.strength,rounds=Math.max(1,Math.round(p.passes)),axes=[[1,0,0],[0,1,0],[0,0,1]];
  for(let round=0;round<rounds;round++)for(let pass=0;pass<3;pass++){
    const [dx,dy,dz]=axes[pass];
    for(let z=0;z<d;z++){
      for(let y=0;y<h;y++){const row=z*h*w+y*w;
        for(let x=0;x<w;x++){const i=row+x,x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx),y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy),z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz),i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1,blurred=(a[i0]+2*a[i]+a[i1])*.25;b[i]=a[i]*(1-strength)+blurred*strength}
      }
      if((z&15)===0){progress(id,(round*3+pass)*d+z+1,rounds*3*d,'Gaussian 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}
    }
    const t=a;a=b;b=t;
  }
  return a;
}
async function median(input,p,id){
  const {w,h,d}=meta,n=w*h*d;ensureScratch(n);scratchA.set(input);
  let a=scratchA,b=scratchB;const strength=p.strength,rounds=Math.max(1,Math.round(p.passes)),vals=new Float32Array(7);
  for(let round=0;round<rounds;round++){
    b.set(a);
    for(let z=1;z<d-1;z++){
      for(let y=1;y<h-1;y++){const row=z*h*w+y*w;
        for(let x=1;x<w-1;x++){const i=row+x;vals[0]=a[i];vals[1]=a[i-1];vals[2]=a[i+1];vals[3]=a[i-w];vals[4]=a[i+w];vals[5]=a[i-w*h];vals[6]=a[i+w*h];for(let q=1;q<7;q++){const v=vals[q];let j=q-1;while(j>=0&&vals[j]>v){vals[j+1]=vals[j];j--}vals[j+1]=v}const m=vals[3];b[i]=a[i]*(1-strength)+m*strength}
      }
      if((z&7)===0){progress(id,round*d+z+1,rounds*d,'Median 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}
    }
    const t=a;a=b;b=t;
  }
  return a;
}
async function spikeHole(input,p,id){
  const {w,h,d,min,max}=meta,n=w*h*d;const out=singleOut(input);out.set(input);
  const strength=p.strength,range=Math.max(1,max-min),thresholdRatio=p.threshold,threshold=range*thresholdRatio,edgeGuard=threshold*(.55+.35*strength),correctionBlend=.20+.75*strength;
  for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){const row=z*h*w+y*w;
      for(let x=1;x<w-1;x++){const i=row+x,c=input[i],a=input[i-1],b=input[i+1],c0=input[i-w],d0=input[i+w],e=input[i-w*h],f=input[i+w*h],sum=a+b+c0+d0+e+f,lo=Math.min(a,b,c0,d0,e,f),hi=Math.max(a,b,c0,d0,e,f),mean=sum/6,spread=hi-lo,diff=c-mean;if(spread<=edgeGuard&&Math.abs(diff)>threshold){const target=mean+Math.sign(diff)*threshold*.08;out[i]=c*(1-correctionBlend)+target*correctionBlend}}
    }
    if((z&7)===0){progress(id,z,d,'Spike / Hole');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}
  }
  return out;
}
async function nlm(input,p,id){
  const {w,h,d,min,max}=meta,n=w*h*d;const out=singleOut(input);
  const strength=p.strength,range=Math.max(1,max-min),hParam=range*(.018+.11*strength),h2=hParam*hParam,searchRadius=Math.max(1,Math.round(p.searchRadius)),patchRadius=Math.max(0,Math.round(p.patchRadius)),offsets=[];
  for(let dz=-searchRadius;dz<=searchRadius;dz++)for(let dy=-searchRadius;dy<=searchRadius;dy++)for(let dx=-searchRadius;dx<=searchRadius;dx++)if(dx||dy||dz)offsets.push([dx,dy,dz]);
  const patch=[[0,0,0]];for(let r=1;r<=patchRadius;r++)patch.push([r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),sample=(x,y,z)=>input[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];
  for(let z=0;z<d;z++){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const center=input[z*h*w+y*w+x];let weighted=center,weightSum=1;for(const [dx,dy,dz] of offsets){const nx=x+dx,ny=y+dy,nz=z+dz;if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;let dist2=0;for(const [px,py,pz] of patch){const a=sample(x+px,y+py,z+pz),b=sample(nx+px,ny+py,nz+pz),dv=a-b;dist2+=dv*dv}dist2/=patch.length;const weight=Math.exp(-dist2/Math.max(h2,1e-6));weighted+=weight*input[nz*h*w+ny*w+nx];weightSum+=weight}out[z*h*w+y*w+x]=weighted/weightSum}
    if((z&3)===0){progress(id,z+1,d,'Fast NLM 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}
  }
  return out;
}
async function anisotropic(input,p,id){
  const {w,h,d,min,max}=meta,n=w*h*d;ensureScratch(n);scratchA.set(input);let a=scratchA,b=scratchB;
  const strength=p.strength,range=Math.max(1,max-min),kappa=range*(.025+.09*strength),kappa2=kappa*kappa,lambda=.06+.14*strength,iterations=Math.max(1,Math.round(p.iterations));
  for(let iter=0;iter<iterations;iter++){b.set(a);for(let z=1;z<d-1;z++){for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;const n0=a[i-1],n1=a[i+1],n2=a[i-w],n3=a[i+w],n4=a[i-w*h],n5=a[i+w*h];for(const nv of [n0,n1,n2,n3,n4,n5]){const diff=nv-c,conduct=Math.exp(-(diff*diff)/Math.max(kappa2,1e-6));flux+=conduct*diff}b[i]=c+lambda*flux}}if((z&7)===0){progress(id,iter*d+z+1,iterations*d,'Anisotropic Diffusion');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}}const t=a;a=b;b=t}
  return a;
}
async function bilateral(input,p,id){
  const {w,h,d,min,max}=meta,n=w*h*d;ensureScratch(n);scratchA.set(input);let a=scratchA,b=scratchB;
  const range=Math.max(1,max-min),strength=p.strength,spatialSigma=p.spatialSigma,intensitySigma=Math.max(1e-6,p.intensitySigma*range),passes=Math.max(1,Math.round(p.passes)),radius=Math.max(1,Math.min(3,Math.ceil(spatialSigma*1.5))),sp2=2*spatialSigma*spatialSigma,int2=2*intensitySigma*intensitySigma;
  for(let pass=0;pass<passes;pass++){for(let z=0;z<d;z++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=z*h*w+y*w+x,center=a[i];let sum=0,wsum=0;for(let dz=-radius;dz<=radius;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;for(let dy=-radius;dy<=radius;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-radius;dx<=radius;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const j=zz*h*w+yy*w+xx,dv=a[j]-center,sw=Math.exp(-(dx*dx+dy*dy+dz*dz)/sp2),iw=Math.exp(-(dv*dv)/int2),ww=sw*iw;sum+=a[j]*ww;wsum+=ww}}}const filtered=wsum?sum/wsum:center;b[i]=center*(1-strength)+filtered*strength}if((z&3)===0){progress(id,pass*d+z+1,passes*d,'Bilateral 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}}const t=a;a=b;b=t}
  return a;
}
async function tv(input,p,id){
  const {w,h,d,min,max}=meta,n=w*h*d;ensureScratch(n);scratchA.set(input);let a=scratchA,b=scratchB;
  const range=Math.max(1,max-min),weight=p.weight,iterations=Math.max(1,Math.round(p.iterations)),lambda=Math.min(.18,.02+weight*.45),eps=range*1e-4;
  for(let iter=0;iter<iterations;iter++){b.set(a);for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){const row=z*h*w+y*w;for(let x=1;x<w-1;x++){const i=row+x,c=a[i];let flux=0;for(const nv of [a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]]){const diff=nv-c;flux+=diff/Math.sqrt(diff*diff+eps*eps)}b[i]=c+lambda*flux}if((z&7)===0){progress(id,iter*d+z+1,iterations*d,'TV Denoising 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}}const t=a;a=b;b=t}
  return a;
}
async function boxBlur(input,r,id){
  const {w,h,d}=meta,n=w*h*d;const out=singleOut(input),radius=Math.max(1,Math.round(r));
  for(let z=0;z<d;z++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sum=0,count=0;for(let dz=-radius;dz<=radius;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;for(let dy=-radius;dy<=radius;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-radius;dx<=radius;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=input[zz*h*w+yy*w+xx];count++}}}out[z*h*w+y*w+x]=sum/Math.max(1,count)}if((z&7)===0){progress(id,z+1,d,'Unsharp Mask 3D');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}}
  return out;
}
async function unsharp(input,p,id){
  const {min,max}=meta,n=input.length;const blurred=await boxBlur(input,p.radius,id);ensureScratch(n,true);
  const out=(input!==scratchA&&blurred!==scratchA)?scratchA:(input!==scratchB&&blurred!==scratchB)?scratchB:scratchC;
  const range=Math.max(1,max-min),amount=p.amount,threshold=p.threshold*range;
  for(let i=0;i<n;i++){const detail=input[i]-blurred[i];out[i]=Math.abs(detail)>=threshold?input[i]+amount*detail:input[i]}
  return out;
}
async function sigmoid(input,p,id){
  const {min,max}=meta,n=input.length;const out=singleOut(input),range=Math.max(1,max-min),gain=2+p.strength*10,centerValue=Math.max(min,Math.min(max,p.center)),center=(centerValue-min)/range,lo=1/(1+Math.exp(gain*center)),hi=1/(1+Math.exp(-gain*(1-center))),norm=Math.max(1e-6,hi-lo);
  for(let i=0;i<n;i++){const x=Math.max(0,Math.min(1,(input[i]-min)/range)),y=(1/(1+Math.exp(-gain*(x-center)))-lo)/norm;out[i]=min+Math.max(0,Math.min(1,y))*range;if((i&0x3ffff)===0){progress(id,i+1,n,'Sigmoid');await tick();if(isSuperseded(id))throw new Error('__SUPERSEDED__')}}
  return out;
}
async function applyFilter(input,stage,id){
  switch(stage.key){
    case 'spikeHole':return spikeHole(input,stage.params,id);
    case 'nlm':return nlm(input,stage.params,id);
    case 'anisotropic':return anisotropic(input,stage.params,id);
    case 'gaussian':return stage.params.mode==='median'?median(input,stage.params,id):gaussian(input,stage.params,id);
    case 'sigmoid':return sigmoid(input,stage.params,id);
    case 'bilateral':return bilateral(input,stage.params,id);
    case 'tv':return tv(input,stage.params,id);
    case 'unsharp':return unsharp(input,stage.params,id);
    default:return input;
  }
}
function trimCache(){
  while(cachedBytes>cacheLimit&&cachedStages.length){const removed=cachedStages.pop();cachedBytes-=removed.data.byteLength}
}
async function executeRun(msg){
  const stages=msg.stages;
  let prefix=0,current=source;
  while(prefix<stages.length&&prefix<cachedStages.length&&cachedStages[prefix].signature===stages[prefix].signature){
    current=cachedStages[prefix].data;prefix++;
  }
  if(prefix<cachedStages.length){for(let i=prefix;i<cachedStages.length;i++)cachedBytes-=cachedStages[i].data.byteLength;cachedStages.length=prefix}
  for(let i=prefix;i<stages.length;i++){
    const result=await applyFilter(current,stages[i],msg.id);
    if(isSuperseded(msg.id))throw new Error('__SUPERSEDED__');
    let next=result;
    if(cachedBytes+result.byteLength<=cacheLimit){
      const copy=cloneFloat(result);cachedStages.push({signature:stages[i].signature,data:copy});cachedBytes+=copy.byteLength;next=copy;
    }
    current=next;
  }
  if(stages.length<cachedStages.length){for(let i=stages.length;i<cachedStages.length;i++)cachedBytes-=cachedStages[i].data.byteLength;cachedStages.length=stages.length}
  const output=cloneFloat(current);
  postMessage({type:'result',id:msg.id,buffer:output.buffer,cacheStages:cachedStages.length,cacheBytes:cachedBytes},[output.buffer]);
}
async function pump(){
  if(processing)return;processing=true;
  try{
    while(pendingRun){
      const msg=pendingRun;pendingRun=null;
      try{await executeRun(msg)}catch(e){if(String(e.message||e)!=='__SUPERSEDED__')postMessage({type:'error',id:msg.id,message:String(e.message||e)})}
    }
  }finally{processing=false}
}
onmessage=e=>{
  const msg=e.data;
  if(msg.type==='init'){
    meta=msg.meta;source=msg.data;cacheLimit=Math.max(0,msg.cacheLimit||128*1024*1024);cachedStages=[];cachedBytes=0;ensureScratch(source.length);
    postMessage({type:'ready'});
    return;
  }
  if(msg.type==='run'){pendingRun=msg;void pump();return}
  if(msg.type==='reset'){cachedStages=[];cachedBytes=0;pendingRun=null}
};
