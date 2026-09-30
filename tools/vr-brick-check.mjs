// Real GLSL regression + shader work counts, not a Quest FPS benchmark.
// PW_CHROMIUM=/usr/bin/chromium node tools/vr-brick-check.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Frozen from commit 3819d7938519922563ca096c77ba9df46582ee22. A shallow
// checkout can run this check without fetching history or using the network.
const base=readFileSync('tests/fixtures/vr-build360.frag.glsl','utf8');
const current=readFileSync('docs/vr-view.js','utf8');
const grab=(src,name)=>{const m=src.match(new RegExp('const '+name+'=`([\\s\\S]*?)`;'));if(!m)throw new Error('Missing '+name);return m[1]};
const count=src=>src.replace('out highp vec4 outColor;','out highp vec4 outColor;\nint nHu=0;int nLegacy=0;int nFlags=0;int nOther=0;')
 .replace('float huAt(vec3 tc0){','float huAt(vec3 tc0){nHu++;')
 .replace('bool brickMayContain(vec3 tc){','bool brickMayContain(vec3 tc){nLegacy++;')
 .replace('uint flags=texture(brickFlags,','nFlags++;uint flags=texture(brickFlags,')
 .replace('return texture(editTex,','nOther++;return texture(editTex,')
 .replace('vec4 q=texture(clsTex,','nOther++;vec4 q=texture(clsTex,')
 .replace('if(acc.a<0.004)discard;','')
 .replace('outColor=acc;','outColor=vec4(float(nHu),float(nLegacy),float(nFlags),float(nOther));');
const shaders={vs:grab(current,'vertexShader'),old:base,now:grab(current,'fragmentShader')};
shaders.oldCount=count(shaders.old);shaders.nowCount=count(shaders.now);
const root=path.resolve('docs'),nm=path.resolve('node_modules');
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html><body></body></html>');return}
 try{res.setHeader('content-type','text/javascript');res.end(readFileSync(path.join(root,req.url.split('?')[0])))}catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route(/^https:\/\//,async route=>{
  const url=route.request().url(),file=url.includes('three.module.js')?'three.module.js':url.includes('three.core.js')?'three.core.js':null;
  if(file)return route.fulfill({contentType:'text/javascript',body:readFileSync(path.join(nm,'three/build',file),'utf8')});
  return route.abort();
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 const result=await page.evaluate(async sh=>{
  const THREE=await import('https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js');
  const {buildVrBrickFlags}=await import('/vr-brick-flags.js');
  const W=144,H=144,renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(W,H,false);
  const compileErrors=[];renderer.debug.onShaderError=(_gl,_p,vs,fs)=>{compileErrors.push(_gl.getShaderInfoLog(vs),_gl.getShaderInfoLog(fs),_gl.getProgramInfoLog(_p))};
  const cases=[
   {name:'opaque two segments'},
   {name:'translucent two segments',alpha:0.35},
   {name:'processed mask',mask:true,alpha:0.35},
   {name:'nearest processed mask',mask:true,nearest:true,alpha:0.35},
   {name:'four processed segments',mask:true,four:true,alpha:0.35},
   {name:'hidden first segment',mask:true,hidden:true,alpha:0.35},
   {name:'mask diagnostic off',mask:true,maskOff:true,alpha:0.35},
   {name:'classified processed',mask:true,cls:true,alpha:0.35},
   {name:'four classified processed',mask:true,cls:true,four:true,alpha:0.35},
   {name:'four sections and cap',mask:true,sections:true,alpha:0.35},
   {name:'eye inside volume',mask:true,inside:true,alpha:0.35},
   {name:'noncubic uneven grids',mask:true,uneven:true,alpha:0.35}
  ];
  const reports=[];
  for(const c of cases){
   const dims=c.uneven?[65,53,47]:[64,64,64],[w,h,d]=dims,bd=dims.map(n=>Math.ceil(n/8));
   const data=new Uint8Array(w*h*d*2),hu=(x,y,z)=>{
    const a=(x+0.5)/w*2-1,b=(y+0.5)/h*2-1,e=(z+0.5)/d*2-1;let v=-1000;
    if(a*a/.72+b*b/.55+e*e/.8<1)v=40;
    if(a*a+b*b+e*e<.18)v=900;
    if(Math.abs(b-.3)<.03&&Math.abs(a)<.65&&Math.abs(e)<.65)v=900;
    if(Math.abs(a+.35)<.1&&Math.abs(e)<.6&&Math.abs(b)<.5)v=-150;
    if(a*a+(e-.3)**2<.055&&Math.abs(b)<.65)v=-600;
    return v;
   };
   for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=hu(x,y,z)+1024,o=((z*h+y)*w+x)*2;data[o]=q&255;data[o+1]=q>>8}
   const mm=new Float32Array(bd[0]*bd[1]*bd[2]*2);
   for(let z=0;z<bd[2];z++)for(let y=0;y<bd[1];y++)for(let x=0;x<bd[0];x++){
    let lo=1e9,hi=-1e9;
    for(let k=Math.max(0,z*8-1);k<Math.min(d,z*8+9);k++)for(let j=Math.max(0,y*8-1);j<Math.min(h,y*8+9);j++)for(let i=Math.max(0,x*8-1);i<Math.min(w,x*8+9);i++){const v=hu(i,j,k);lo=Math.min(lo,v);hi=Math.max(hi,v)}
    const o=((z*bd[1]+y)*bd[0]+x)*2;mm[o]=lo;mm[o+1]=hi;
   }
   const tex=(src,size,format,type,linear=true)=>{const t=new THREE.Data3DTexture(src,...size);t.format=format;t.type=type;t.minFilter=t.magFilter=linear?THREE.LinearFilter:THREE.NearestFilter;t.unpackAlignment=1;t.needsUpdate=true;return t};
   const vol=tex(data,dims,THREE.RGFormat,THREE.UnsignedByteType),bricks=tex(mm,bd,THREE.RGFormat,THREE.FloatType,false);
   const md=c.uneven?[29,21,17]:[32,32,32],maskData=new Uint8Array(md[0]*md[1]*md[2]*4);
   for(let z=0;z<md[2];z++)for(let y=0;y<md[1];y++)for(let x=0;x<md[0];x++)for(let s=0;s<4;s++){
    const keep=!c.mask||((x/md[0]>.48||z/md[2]>.58)&&!(x/md[0]>.6&&y/md[1]>.6));
    maskData[((z*md[1]+y)*md[0]+x)*4+s]=keep?255:0;
   }
   const edit={dims:md,data:maskData,active:c.mask?15:0};
   const mask=tex(maskData,md,THREE.RGBAFormat,THREE.UnsignedByteType,!c.nearest);
   const segs=[{min:300,max:3000},{min:-100,max:200},{min:-400,max:-101},{min:-900,max:-401}];
   const C=c.four?4:2,clsData=new Uint8Array(w*h*d*C);
   for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let s=0;s<C;s++){
    const value=hu(x,y,z),g=segs[s],dist=Math.min(value-g.min,g.max-value),idx=(z*h+y)*w+x;
    const mx=Math.min(md[0]-1,Math.floor((x+.5)/w*md[0])),my=Math.min(md[1]-1,Math.floor((y+.5)/h*md[1])),mz=Math.min(md[2]-1,Math.floor((z+.5)/d*md[2]));
    clsData[idx*C+s]=maskData[((mz*md[1]+my)*md[0]+mx)*4+s]<128?0:Math.max(0,Math.min(255,Math.round((.5+dist/2048)*255)));
   }
   const cls={data:clsData,C,chan:C===4?[0,1,2,3]:[0,1,-1,-1]},clsTex=tex(clsData,dims,C===4?THREE.RGBAFormat:THREE.RGFormat,THREE.UnsignedByteType);
   const flagData=buildVrBrickFlags({dims,brickDims:bd,bricks:mm},segs,edit,c.cls?cls:null),flags=tex(flagData,bd,THREE.RedIntegerFormat,THREE.UnsignedByteType,false);
   const num=c.four?4:2,u={vol:{value:vol},bricks:{value:bricks},brickFlags:{value:flags},brickAccel:{value:0},visibleBits:{value:((1<<num)-1)&(c.hidden?14:15)},processedBricks:{value:c.maskOff?0:1},
    halfExt:{value:new THREE.Vector3(1.65,1.65,1.65)},texDims:{value:new THREE.Vector3(...dims)},brickDims:{value:new THREE.Vector3(...bd)},stepSize:{value:3.3/Math.max(...dims)*.85},diag:{value:0},calib:{value:new THREE.Vector3(1,-1024,0)},
    segA:{value:segs.map((s,i)=>new THREE.Vector4(s.min,s.max,c.alpha??1,i<num&&!(c.hidden&&i===0)?1:0))},segC:{value:[[.91,.86,.72],[.85,.55,.42],[.9,.65,.2],[.2,.6,.9]].map(rgb=>new THREE.Vector4(...rgb,0))},
    editMask:{value:c.mask&&!c.maskOff?15:0},editTex:{value:mask},useCls:{value:c.cls?1:0},clsTex:{value:clsTex},clsChan:{value:new THREE.Vector4(...cls.chan)},
    cutPlanes:{value:[new THREE.Vector4(0,0,-1,0),new THREE.Vector4(-1,0,0,0),new THREE.Vector4(0,-1,0,-.3),new THREE.Vector4(1,0,0,-.4)]},planeCount:{value:c.sections?4:0},planeCut:{value:c.sections?1:0},capOn:{value:1},sliceTint:{value:.5},sliceOpacity:{value:c.sections?.6:0},sliceWindow:{value:new THREE.Vector2(40,400)},sliceVol:{value:vol}};
   const camera=new THREE.PerspectiveCamera(45,1,.01,50);camera.position.set(...(c.inside?[.05,.1,.2]:[3.2,2.1,4]));camera.lookAt(0,0,c.inside?-1:0);camera.updateMatrixWorld();
   const scene=new THREE.Scene(),geo=new THREE.BoxGeometry(2,2,2),rt=new THREE.WebGLRenderTarget(W,H,{depthBuffer:false}),rc=new THREE.WebGLRenderTarget(W,H,{depthBuffer:false,type:THREE.FloatType});
   const render=(fragment,fast,counting=false)=>{
    u.brickAccel.value=fast?1:0;
    const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:sh.vs,fragmentShader:fragment,uniforms:u,side:THREE.BackSide,blending:THREE.NoBlending,depthWrite:false,toneMapped:false});
    const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;scene.add(mesh);
    renderer.setRenderTarget(counting?rc:rt);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    const px=counting?new Float32Array(W*H*4):new Uint8Array(W*H*4);renderer.readRenderTargetPixels(counting?rc:rt,0,0,W,H,px);
    const err=renderer.getContext().getError();if(err)throw new Error(c.name+' GL error '+err);
    scene.remove(mesh);material.dispose();return px;
   };
   const old=render(sh.old,false),fallback=render(sh.now,false),fast=render(sh.now,true);
   const diff=(a,b)=>{let n=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d){n++;max=Math.max(max,d)}}return{channels:n,max}};
   const stats=(fragment,fast)=>{const px=render(fragment,fast,true),s=[0,0,0,0];for(let i=0;i<px.length;i++)s[i%4]+=px[i];return s.map(v=>+(v/(W*H)).toFixed(3))};
   reports.push({name:c.name,fallback:diff(old,fallback),fast:diff(old,fast),painted:old.filter((v,i)=>i%4===3&&v>0).length,originalReads:stats(sh.oldCount,false),fastReads:stats(sh.nowCount,true)});
   [vol,bricks,mask,clsTex,flags].forEach(t=>t.dispose());rt.dispose();rc.dispose();geo.dispose();
  }
  renderer.dispose();return{reports,compileErrors};
 },shaders);
 for(const r of result.reports)console.log(JSON.stringify(r));
 const failed=errors.length||result.compileErrors.some(Boolean)||result.reports.some(r=>r.fast.channels||r.fallback.channels||!r.painted);
 if(failed){console.error({errors,compileErrors:result.compileErrors});process.exitCode=1}
 else console.log('VR brick check OK: exact RGBA equality in all cases. Counts: HU / RG32F / R8 / mask-or-classification. Quest FPS unmeasured.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
