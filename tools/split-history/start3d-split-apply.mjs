// Record of the start3D split (build 240): wraps statement ranges of start3D in
// factories in docs/scene-view.js, verbatim. Ran once on the build-239 app.js.
import {parse} from 'acorn';import fs from 'fs';
const src=fs.readFileSync('docs/app.js','utf8');const ast=parse(src,{ecmaVersion:'latest',sourceType:'module'});
const fn=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='start3D');const B=fn.body.body;
const text=(a,b)=>src.slice(B[a].start,B[b].end);
const groups=[
 {a:9,b:15,name:'makeAxisWidget',params:'camera',ret:['axisWidget','updateAxisWidget'],call:'const {axisWidget,updateAxisWidget}=makeAxisWidget(camera);',doc:'Orientation axes widget attached to the camera (bottom-left XYZ).'},
 {a:16,b:18,name:'create3DRenderer',params:'',async:true,ret:['renderer','backend'],call:'let {renderer,backend}=await create3DRenderer();',doc:'WebGPU renderer on the shared VRL device when available, WebGL otherwise.'},
 {a:35,b:67,name:'makeViewOverlays',params:'renderer',ret:['pivotIndicator','makeViewButton','showViewPivot','hideViewPivot'],call:'const {pivotIndicator,makeViewButton,showViewPivot,hideViewPivot}=makeViewOverlays(renderer);',doc:'3D view overlays: rotation pivot indicator, view buttons container and the help button/panel.'},
 {a:75,b:78,name:'makeViewRotation',params:'camera',ret:['viewCenterPivot','rotateAroundViewCenter','applyQuaternionAroundViewCenter','rollAroundViewCenter'],call:'const {viewCenterPivot,rotateAroundViewCenter,applyQuaternionAroundViewCenter,rollAroundViewCenter}=makeViewRotation(camera);',doc:'Rotations of the scene object around the view-centre pivot.'},
 {a:91,b:98,name:'makeCutTools',params:'renderer,camera',ret:['cutSamplesToSurfaceStroke','sectionDragHit','sectionScreenStep','dragSectionPlane','drawEditStroke','appendCutScreenPoints','resampleCutScreenCurve','collectCutSurfaceSamples'],call:'const {cutSamplesToSurfaceStroke,sectionDragHit,sectionScreenStep,dragSectionPlane,drawEditStroke,appendCutScreenPoints,resampleCutScreenCurve,collectCutSurfaceSamples}=makeCutTools(renderer,camera);',doc:'Cut stroke (pen/line/lasso) screen handling and surface projection, and section-plane dragging.'},
];
let mod='';
for(const g of groups){mod+=`// ${g.doc}\nexport ${g.async?'async ':''}function ${g.name}(${g.params}){\n ${text(g.a,g.b)}\n return{${g.ret.join(',')}};\n}\n`}
// imports: every app.js import binding the module text uses
const imports=ast.body.filter(n=>n.type==='ImportDeclaration');let head='// start3D pieces that use no start3D-local mutable state (camera distance,\n// pointer maps, fast-interaction flags stay in start3D). Statement bodies are\n// verbatim from app.js; each factory takes the locals they used as parameters.\n';
for(const d of imports){const used=d.specifiers.filter(sp=>new RegExp('(^|[^\\w$.])'+sp.local.name.replace('$','\\$')+'(?![\\w$])').test(mod));if(!used.length)continue;
 const src0=src.slice(d.source.start,d.source.end);
 if(used.some(sp=>sp.type==='ImportNamespaceSpecifier'))head+=`import * as ${used[0].local.name} from ${src0};\n`;
 else if(used.some(sp=>sp.type==='ImportDefaultSpecifier'))head+=`import ${used[0].local.name} from ${src0};\n`;
 else head+=`import { ${used.map(sp=>sp.imported.name===sp.local.name?sp.local.name:sp.imported.name+' as '+sp.local.name).join(', ')} } from ${src0};\n`}
fs.writeFileSync('docs/scene-view.js',head+mod);
// replace in app.js (from the end so offsets stay valid)
let out=src;for(const g of [...groups].reverse())out=out.slice(0,B[g.a].start)+g.call+out.slice(B[g.b].end);
const tag=src.match(/\?v=[0-9]+-build[0-9]+/)[0];
out=out.replace(/(import \{ request3DRender \} from '\.\/scene3d\.js[^']*';\n)/,`$1import { makeAxisWidget, create3DRenderer, makeViewOverlays, makeViewRotation, makeCutTools } from './scene-view.js${tag}';\n`);
fs.writeFileSync('docs/app.js',out);
