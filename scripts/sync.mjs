import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLocalUsage } from './usage.mjs';

// 给静态托管用：把本地实时用量写成 public/usage.json，构建后随站点发布。
// 开发时不需要跑这个（/api/usage 已经实时返回）。
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'usage.json');

const data = await computeLocalUsage();
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ total: data.total, syncedAt: Date.now() }, null, 2));
console.log(`已写入 ${out}  累计 ${data.total} token`);
