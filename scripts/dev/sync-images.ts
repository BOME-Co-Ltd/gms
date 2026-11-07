// Chỉ cho `next dev`/`mock`: chép ảnh content/images sang public/img để bản dev hiện ảnh bài viết.
// Bản build không dùng các bản chép này (build-site.ts dựng out/img từ content/images); git bỏ qua chúng.
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { execSync } from 'node:child_process';
const tracked = new Set(execSync('git ls-files public/img', { encoding: 'utf8' }).split('\n').map((p) => p.replace('public/img/', '')));
const src = join(process.cwd(), 'content/images');
const dst = join(process.cwd(), 'public/img');
let n = 0;
for (const f of readdirSync(src)) {
  if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
  if (tracked.has(f)) continue; // không ghi đè ảnh tĩnh đã theo dõi
  const to = join(dst, f);
  if (existsSync(to) && statSync(to).mtimeMs >= statSync(join(src, f)).mtimeMs) continue;
  copyFileSync(join(src, f), to);
  n++;
}
console.log(`sync-images: chép ${n} ảnh content/images → public/img (chỉ cho dev)`);
