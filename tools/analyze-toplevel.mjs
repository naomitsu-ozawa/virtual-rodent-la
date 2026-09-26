import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { readFileSync } from 'node:fs';
const src = readFileSync(process.argv[2], 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const top = new Map(); // name -> {kind, start, end, line, node}
const lineOf = pos => src.slice(0, pos).split('\n').length;
for (const n of ast.body) {
  if (n.type === 'FunctionDeclaration') top.set(n.id.name, { kind: 'fn', node: n });
  else if (n.type === 'ClassDeclaration') top.set(n.id.name, { kind: 'class', node: n });
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
    const names = []; const collect = p => { if (!p) return; if (p.type === 'Identifier') names.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(q => collect(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(collect); };
    collect(d.id);
    for (const nm of names) top.set(nm, { kind: n.kind, node: n, decl: d });
  }
}
// free references to top-level names, per top-level declaration
const refs = new Map(); const assigned = new Set();
for (const [name, info] of top) {
  const target = info.decl || info.node; const set = new Set();
  walk.full(target, node => { if (node.type === 'Identifier' && top.has(node.name) && node.name !== name) set.add(node.name); });
  refs.set(name, set);
}
// which top-level lets are reassigned anywhere
walk.full(ast, node => {
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') assigned.add(node.left.name);
  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') assigned.add(node.argument.name);
});
// "pure" = transitively references only fns/consts that are themselves pure (no let/var, no mutable state)
const pure = new Map();
const isPure = (n, stack = new Set()) => {
  if (pure.has(n)) return pure.get(n);
  if (stack.has(n)) return true; stack.add(n);
  const info = top.get(n);
  if (info.kind === 'let' || info.kind === 'var') { pure.set(n, false); return false; }
  // consts initialised by DOM lookups etc. are not pure
  if (info.kind === 'const' && info.decl?.init && /document|querySelector|\$\(|getElementById|window|new (Map|Set|WeakMap)|\[\]|\{\}/.test(src.slice(info.decl.init.start, info.decl.init.end).slice(0, 200)) && !/^\s*(\(|function|async)/.test(src.slice(info.decl.init.start, info.decl.init.start+20))) { pure.set(n, false); return false; }
  const ok = [...refs.get(n)].every(r => isPure(r, stack));
  pure.set(n, ok); return ok;
};
const rows = [];
for (const [n, info] of top) {
  const node = info.decl || info.node;
  rows.push({ n, kind: info.kind, line: lineOf(node.start), len: lineOf(node.end) - lineOf(node.start) + 1, pure: isPure(n), mutated: assigned.has(n) });
}
const mode = process.argv[3] || 'summary';
if (mode === 'summary') {
  console.log('top-level decls:', rows.length, '| let/var:', rows.filter(r => r.kind !== 'fn' && r.kind !== 'const' && r.kind !== 'class').length, '| reassigned:', rows.filter(r => r.mutated).length);
  const p = rows.filter(r => r.pure);
  console.log('pure decls:', p.length, 'lines:', p.reduce((a, r) => a + r.len, 0));
  console.log(p.sort((a, b) => b.len - a.len).slice(0, 45).map(r => `${r.line}\t${r.len}\t${r.kind}\t${r.n}`).join('\n'));
} else if (mode === 'json') console.log(JSON.stringify(rows));
