// Move a self-contained set of top-level declarations from one ES module into
// a new module, verbatim, and replace them with an import.
//
//   node tools/extract-module.mjs <src.js> <new-module.js> <name> [name...]
//
// Safety rules (the tool aborts instead of guessing):
// - Every top-level name referenced by a moved declaration must itself be
//   moved, or be an import binding (re-imported from the same source).
//   This guarantees the new module never imports back from <src>, so there
//   are no import cycles and no evaluation-order changes.
// - `let` / `var` declarations are never moved (shared mutable state).
// - Moved names must not be reassigned anywhere in <src>.
// - Consts with non-primitive initialisers are listed for human review.
//
// Code is moved byte-for-byte (only `export ` is prepended), so behavior is
// unchanged. Written for the docs/app.js split; see docs/AGENT_LOG.md.
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const [srcPath, outPath, ...names] = process.argv.slice(2);
if (!srcPath || !outPath || !names.length) {
  console.error('usage: extract-module.mjs <src.js> <new-module.js> <name> [name...]');
  process.exit(2);
}
if (existsSync(outPath)) { console.error(`refusing to overwrite ${outPath}`); process.exit(2); }

const src = readFileSync(srcPath, 'utf8');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const want = new Set(names);

const imports = new Map(); // local binding -> ImportDeclaration node
const top = new Map();     // name -> { kind, stmt, decl? }
for (const n of ast.body) {
  if (n.type === 'ImportDeclaration') for (const s of n.specifiers) imports.set(s.local.name, n);
  else if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') top.set(n.id.name, { kind: n.type, stmt: n });
  else if (n.type === 'VariableDeclaration') for (const d of n.declarations) {
    if (d.id.type !== 'Identifier') continue; // destructuring never moved
    top.set(d.id.name, { kind: n.kind, stmt: n, decl: d });
  } else if (n.type.startsWith('Export')) { console.error('source already has exports; not supported'); process.exit(2); }
}

const fail = msg => { console.error('ABORT: ' + msg); process.exit(1); };
for (const n of want) {
  if (!top.has(n)) fail(`${n} is not a movable top-level declaration`);
  if (top.get(n).kind === 'let' || top.get(n).kind === 'var') fail(`${n} is ${top.get(n).kind} (mutable state)`);
}

// reassignment check
const reassigned = new Set();
walk.full(ast, node => {
  if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier') reassigned.add(node.left.name);
  if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier') reassigned.add(node.argument.name);
});
for (const n of want) if (reassigned.has(n)) fail(`${n} is reassigned in ${srcPath}`);

// dependency closure check
const neededImports = new Map(); // source -> Set(specifier text)
const missing = new Map();
for (const n of want) {
  const { decl, stmt } = top.get(n);
  walk.full(decl || stmt, node => {
    if (node.type !== 'Identifier' || node.name === n) return;
    if (top.has(node.name) && !want.has(node.name)) {
      (missing.get(node.name) || missing.set(node.name, new Set()).get(node.name)).add(n);
    } else if (imports.has(node.name) && !top.has(node.name)) {
      const imp = imports.get(node.name);
      const spec = imp.specifiers.find(s => s.local.name === node.name);
      const text = spec.type === 'ImportDefaultSpecifier' ? `default as ${node.name}`
        : spec.type === 'ImportNamespaceSpecifier' ? `* as ${node.name}`
        : (spec.imported.name === node.name ? node.name : `${spec.imported.name} as ${node.name}`);
      const key = imp.source.value;
      (neededImports.get(key) || neededImports.set(key, new Set()).get(key)).add(text);
    }
  });
}
// Identifier walk also sees property keys / member names that merely share a
// name with a top-level decl (e.g. obj.fmt). Filter those false positives.
if (missing.size) {
  const real = new Map();
  for (const n of want) {
    const { decl, stmt } = top.get(n);
    // NB: acorn-walk reports assignment targets / patterns as 'VariablePattern',
    // not 'Identifier' — both must be checked or writes to state are missed.
    const visit = (node, _st, anc) => {
        if (node.type !== 'Identifier' || !missing.has(node.name)) return;
        const parent = anc[anc.length - 2];
        if (parent?.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
        if (parent?.type === 'Property' && parent.key === node && !parent.computed && !parent.shorthand) return;
        if (parent?.type === 'MethodDefinition' && parent.key === node) return;
        if (parent?.type === 'PropertyDefinition' && parent.key === node) return;
        (real.get(node.name) || real.set(node.name, new Set()).get(node.name)).add(n);
    };
    walk.ancestor(decl || stmt, { Identifier: visit, VariablePattern: visit });
  }
  if (real.size) fail('moved code depends on declarations that would stay behind:\n' +
    [...real].map(([dep, users]) => `  ${dep}  <- used by ${[...users].join(', ')}  (${top.get(dep).kind})`).join('\n'));
}

// review list: consts whose initialiser is not a primitive/function
const review = [];
for (const n of want) {
  const { kind, decl } = top.get(n);
  if (kind !== 'const') continue;
  const t = decl.init?.type;
  if (!['Literal', 'ArrowFunctionExpression', 'FunctionExpression', 'TemplateLiteral', 'BinaryExpression', 'UnaryExpression'].includes(t)) review.push(`${n} (${t})`);
}

// build edits
const edits = []; // {start,end,text}
const moved = [];
const byStmt = new Map();
for (const n of want) { const e = top.get(n); (byStmt.get(e.stmt) || byStmt.set(e.stmt, []).get(e.stmt)).push(e); }
for (const [stmt, entries] of [...byStmt].sort((a, b) => a[0].start - b[0].start)) {
  if (stmt.type !== 'VariableDeclaration' || entries.length === stmt.declarations.length) {
    moved.push({ pos: stmt.start, text: 'export ' + src.slice(stmt.start, stmt.end) });
    edits.push({ start: stmt.start, end: stmt.end, text: '' });
  } else {
    const movedDecls = new Set(entries.map(e => e.decl));
    for (const d of stmt.declarations) if (movedDecls.has(d)) moved.push({ pos: d.start, text: `export ${stmt.kind} ${src.slice(d.start, d.end)};` });
    const keep = stmt.declarations.filter(d => !movedDecls.has(d)).map(d => src.slice(d.start, d.end));
    const tail = src.slice(stmt.declarations.at(-1).end, stmt.end); // usually ';' or ''
    edits.push({ start: stmt.start, end: stmt.end, text: `${stmt.kind} ${keep.join(',')}${tail}` });
  }
}
moved.sort((a, b) => a.pos - b.pos);

// import line in source, placed after the last import
const lastImport = ast.body.filter(n => n.type === 'ImportDeclaration').at(-1);
const tag = src.match(/\?v=([0-9]+-build[0-9.]+)/)?.[1];
const spec = './' + basename(outPath) + (tag ? `?v=${tag}` : '');
const importLine = `\nimport { ${[...want].sort().join(', ')} } from '${spec}';`;
const at = lastImport ? lastImport.end : 0;
edits.push({ start: at, end: at, text: lastImport ? importLine : importLine.trimStart() + '\n' });

let out = src;
for (const e of edits.sort((a, b) => b.start - a.start)) {
  let { start, end } = e;
  // swallow the line break when a removal leaves an empty line
  if (e.text === '') {
    const before = out.lastIndexOf('\n', start - 1);
    const lineHead = out.slice(before + 1, start);
    if (/^\s*$/.test(lineHead) && out[end] === '\n') end += 1;
  }
  out = out.slice(0, start) + e.text + out.slice(end);
}

const header = [
  `// Extracted verbatim from ${basename(srcPath)} by tools/extract-module.mjs.`,
  `// Self-contained: depends only on the imports below (no module state).`,
  ...[...neededImports].map(([source, specs]) => {
    const list = [...specs];
    const def = list.find(s => s.startsWith('default as '));
    const ns = list.find(s => s.startsWith('* as '));
    const named = list.filter(s => s !== def && s !== ns);
    const parts = [def && def.slice(11), ns, named.length && `{ ${named.join(', ')} }`].filter(Boolean);
    return `import ${parts.join(', ')} from '${source}';`;
  }),
  '',
].join('\n');

writeFileSync(outPath, header + moved.map(m => m.text).join('\n') + '\n');
writeFileSync(srcPath, out);
console.log(`moved ${want.size} declarations -> ${outPath}`);
if (neededImports.size) console.log('re-imported:', [...neededImports].map(([s, v]) => `${s} {${[...v].join(', ')}}`).join('; '));
if (review.length) console.log('REVIEW (non-primitive consts, check they are never mutated):', review.join(', '));
