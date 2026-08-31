import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const mainJs = readFileSync(path.join(ROOT, 'electron', 'main.js'), 'utf8');

// build.files 是白名单，漏一个文件不会报错——只会在运行时静默失效。
// usage-worker.mjs 就漏过一次：fork 失败 → 用量永远显示 0，而且没有任何报错。
describe('打包白名单', () => {
  it('主进程引用的 scripts/*.mjs 必须都在 build.files 里', () => {
    const referenced = [...mainJs.matchAll(/['"]scripts['"],\s*['"]([\w.-]+\.mjs)['"]/g)].map((m) => m[1]);
    const files = pkg.build.files;
    expect(referenced.length).toBeGreaterThan(0); // 保证正则还能匹配到东西
    for (const f of referenced) {
      const covered = files.some((p) => p === `scripts/${f}` || p === 'scripts/**' || p === 'scripts/*.mjs');
      expect(covered, `scripts/${f} 被主进程引用但没进 build.files，打包后会缺文件`).toBe(true);
    }
  });

  it('import 进来的 scripts 也要在白名单里', () => {
    const imported = [...mainJs.matchAll(/from\s+['"]\.\.\/scripts\/([\w.-]+\.mjs)['"]/g)].map((m) => m[1]);
    for (const f of imported) {
      expect(pkg.build.files, `scripts/${f} 被 import 但没进 build.files`).toContain(`scripts/${f}`);
    }
  });
});
