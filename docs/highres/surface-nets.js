// Adapted from Mikola Lysenko's isosurface/surface nets implementation (MIT License).
const E=new Int32Array(24),T=new Int32Array(256);let B=new Array(4096).fill(0);
(()=>{let k=0;for(let i=0;i<8;i++)for(let j=1;j<=4;j<<=1){const p=i^j;if(i<=p){E[k++]=i;E[k++]=p}}for(let i=0;i<256;i++){let e=0;for(let j=0;j<24;j+=2)e|=(!!(i&(1<<E[j]))!==!!(i&(1<<E[j+1])))?(1<<(j>>1)):0;T[i]=e}})();
export function surfaceNets(d,p){const V=[],F=[],x=[0,0,0],R=[1,d[0]+1,(d[0]+1)*(d[1]+1)],g=new Float32Array(8);let bn=1;if(R[2]*2>B.length){const o=B.length;B.length=R[2]*2;for(let i=o;i<B.length;i++)B[i]=0}
 for(x[2]=0;x[2]<d[2]-1;x[2]++,bn^=1,R[2]=-R[2]){let m=1+(d[0]+1)*(1+bn*(d[1]+1));for(x[1]=0;x[1]<d[1]-1;x[1]++,m+=2)for(x[0]=0;x[0]<d[0]-1;x[0]++,m++){
  let mask=0,q=0;for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let xx=0;xx<2;xx++,q++){const a=p(x[0]+xx,x[1]+y,x[2]+z);g[q]=a;if(a<0)mask|=1<<q}if(mask===0||mask===255)continue;
  const em=T[mask],v=[0,0,0];let ec=0;for(let i=0;i<12;i++){if(!(em&(1<<i)))continue;ec++;const e0=E[i<<1],e1=E[(i<<1)+1],g0=g[e0],g1=g[e1];let t=g0-g1;if(Math.abs(t)>1e-6)t=g0/t;else continue;for(let j=0,k=1;j<3;j++,k<<=1){const a=e0&k,b=e1&k;if(a!==b)v[j]+=a?1-t:t;else v[j]+=a?1:0}}
  const s=1/ec;for(let i=0;i<3;i++)v[i]=x[i]+s*v[i];B[m]=V.length;V.push(v);
  for(let i=0;i<3;i++){if(!(em&(1<<i)))continue;const u=(i+1)%3,w=(i+2)%3;if(x[u]===0||x[w]===0)continue;const du=R[u],dv=R[w];if(mask&1){F.push([B[m],B[m-du],B[m-dv]]);F.push([B[m-dv],B[m-du],B[m-du-dv]])}else{F.push([B[m],B[m-dv],B[m-du]]);F.push([B[m-du],B[m-dv],B[m-du-dv]])}}
 }}return{positions:V,cells:F}}
