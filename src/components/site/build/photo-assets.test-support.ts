// Ảnh nền/ảnh minh hoạ gắn cứng trong giao diện (PHOTOS ở parts.tsx) phải có trong out/img, nếu không
// build/verify.ts báo IMG_NOT_IN_OUT. Test build bằng nội dung mẫu (tests/fixtures/site-root) chép các ảnh đó
// từ repo thật vào bản làm việc: ảnh có siêu dữ liệu ở content/images (kèm .yaml) ⇒ content/images,
// còn lại lấy ở public/img. Bản 512w/640w/960w do build sinh, không chép.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PHOTOS } from '../parts.tsx';

export function photoFiles(): string[] {
  const files = new Set<string>();
  for (const p of Object.values(PHOTOS) as Array<{ src: string; srcSet?: string }>) {
    const urls = [p.src, ...(p.srcSet ?? '').split(',').map((s) => s.trim().split(/\s+/)[0])];
    for (const u of urls) if (u?.startsWith('/img/')) files.add(u.slice('/img/'.length));
  }
  return [...files].sort();
}

/** Chép ảnh PHOTOS từ `repoRoot` vào `work`; trả về tên file đã chép. */
export function copyPhotoAssets(repoRoot: string, work: string): string[] {
  const copied: string[] = [];
  for (const f of photoFiles()) {
    const base = f.replace(/\.[a-z0-9]+$/i, '');
    const contentImg = join(repoRoot, 'content', 'images', f);
    const contentMeta = join(repoRoot, 'content', 'images', `${base}.yaml`);
    const publicImg = join(repoRoot, 'public', 'img', f);
    if (existsSync(contentImg) && existsSync(contentMeta)) {
      const dir = join(work, 'content', 'images');
      mkdirSync(dir, { recursive: true });
      copyFileSync(contentImg, join(dir, f));
      copyFileSync(contentMeta, join(dir, `${base}.yaml`));
      copied.push(f);
    } else if (existsSync(publicImg)) {
      const dir = join(work, 'public', 'img');
      mkdirSync(dir, { recursive: true });
      copyFileSync(publicImg, join(dir, f));
      copied.push(f);
    }
  }
  return copied;
}
