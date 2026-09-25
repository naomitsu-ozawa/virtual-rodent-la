import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// docs/app.js compares its APP_BUILD with docs/version.json on startup and
// force-reloads the page when they differ (ensureLatestDeployedBuild). If the
// markers drift apart, users get stale assets or reload loops, so every build
// marker in the deployed files must agree.
const read = p => readFileSync(p, 'utf8');
const appJs = read('docs/app.js');
const indexHtml = read('docs/index.html');
const versionJson = JSON.parse(read('docs/version.json'));

const build = appJs.match(/const APP_BUILD='([^']+)'/)?.[1];
const version = appJs.match(/const APP_VERSION='([^']+)'/)?.[1];

describe('build markers', () => {
  it('app.js declares APP_BUILD and APP_VERSION', () => {
    expect(build).toBeTruthy();
    expect(version).toBeTruthy();
  });

  it('version.json matches app.js', () => {
    expect(String(versionJson.build)).toBe(build);
    expect(String(versionJson.version)).toBe(version);
  });

  it('APP_VERSION ends with the build number', () => {
    expect(version.endsWith(`-${build}`)).toBe(true);
  });

  it('index.html cache-busting queries point at this build', () => {
    const tags = [...indexHtml.matchAll(/\?v=[0-9]+-build([0-9.]+)/g)].map(m => m[1]);
    expect(tags.length).toBeGreaterThanOrEqual(2); // style.css + app.js
    for (const t of tags) expect(t).toBe(build);
  });

  it('app.js imports medical-volume.js with the same build tag', () => {
    const tag = appJs.match(/medical-volume\.js\?v=[0-9]+-build([0-9.]+)/)?.[1];
    expect(tag).toBe(build);
  });
});
