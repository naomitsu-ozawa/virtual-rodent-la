import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The refactoring tools are the safety net for splitting docs/app.js, so they
// get their own tests.
const run = (src, names) => {
  const dir = mkdtempSync(join(tmpdir(), 'vrl-extract-'));
  const file = join(dir, 'app.js'), out = join(dir, 'mod.js');
  writeFileSync(file, src);
  let code = 0, stderr = '';
  try { execFileSync(process.execPath, ['tools/extract-module.mjs', file, out, ...names], { stdio: 'pipe' }); }
  catch (e) { code = e.status; stderr = String(e.stderr); }
  return { code, stderr, app: readFileSync(file, 'utf8'), mod: existsSync(out) ? readFileSync(out, 'utf8') : null };
};

describe('tools/extract-module.mjs', () => {
  it('moves a self-contained function and imports it back', () => {
    const r = run("import x from 'https://cdn/x.js';\nfunction pure(a){return x(a)*2}\npure(1);\n", ['pure']);
    expect(r.code).toBe(0);
    expect(r.mod).toContain('export function pure(a){return x(a)*2}');
    expect(r.mod).toContain("import x from 'https://cdn/x.js';");
    expect(r.app).toContain("import { pure } from './mod.js';");
    expect(r.app).not.toContain('function pure');
  });

  it('works when the source has no imports', () => {
    const r = run('function pure(a){return a*2}\npure(1);\n', ['pure']);
    expect(r.code).toBe(0);
    expect(r.app.startsWith("import { pure } from './mod.js';")).toBe(true);
  });

  it('aborts when moved code READS a let that stays behind', () => {
    const r = run('let n=0;\nfunction get(){return n}\n', ['get']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/n\s+<- used by get/);
  });

  // Regression: acorn-walk reports assignment targets as VariablePattern, which
  // the filtering pass once ignored, letting write-only state slip through.
  it('aborts when moved code only WRITES a let that stays behind', () => {
    const r = run('let counter=0;\nfunction bump(){counter=counter+1}\nfunction reset(){counter=0}\n', ['reset']);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/counter\s+<- used by reset/);
    expect(r.mod).toBeNull();
  });

  it('refuses to move let declarations and reassigned names', () => {
    expect(run('let s=1;\n', ['s']).code).toBe(1);
  });

  it('ignores property names that merely match a top-level name', () => {
    const r = run('let size=0;\nfunction area(o){return o.size*2}\nsize++;\n', ['area']);
    expect(r.code).toBe(0);
  });
});
