// Verifies the start3D split against git HEAD (build 239): moved statements are
// verbatim in scene-view.js, the rest verbatim in app.js.
import {parse} from 'acorn';import fs from 'fs';import {execSync} from 'child_process';
const src=execSync('git show HEAD:docs/app.js').toString();const ast=parse(src,{ecmaVersion:'latest',sourceType:'module'});
const B=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='start3D').body.body;
const mod=fs.readFileSync('docs/scene-view.js','utf8'),app=fs.readFileSync('docs/app.js','utf8');
const moved=[[9,15],[16,18],[35,67],[75,78],[91,98]];let ok=0,bad=0;
for(const[a,b]of moved)for(let i=a;i<=b;i++){const t=src.slice(B[i].start,B[i].end);if(mod.includes(t))ok++;else{bad++;console.log('MISSING',i,t.slice(0,80))}}
// every other start3D statement must still be in app.js verbatim
let kept=0;for(let i=0;i<B.length;i++){if(moved.some(([a,b])=>i>=a&&i<=b))continue;const t=src.slice(B[i].start,B[i].end);if(app.includes(t))kept++;else{bad++;console.log('CHANGED',i,t.slice(0,80))}}
console.log({moved:ok,kept,bad});process.exit(bad?1:0);
