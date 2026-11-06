import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { copyStaticImages, findBrokenImgRefs, optimizeStaticImages } from '../../../scripts/content/build-site.ts';
import { buildFooterHtml } from '../../../src/components/ui/static-footer.ts';

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'gms-img-'));
}

describe('ảnh trong out/', () => {
  it('chép ảnh tĩnh của public/img sang out/img, bỏ file đã có siêu dữ liệu (kể cả không được phép)', () => {
    const root = tmp();
    try {
      const pub = join(root, 'public-img');
      const out = join(root, 'out', 'img');
      mkdirSync(pub, { recursive: true });
      writeFileSync(join(pub, 'scada-control-room.jpg'), 'a');
      writeFileSync(join(pub, 'hero-plant.jpg'), 'b');
      const copied = copyStaticImages(pub, out, new Set(['images/hero-plant.jpg']));
      expect(copied).toEqual(['scada-control-room.jpg']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('bắt <img src="/img/..."> trỏ tới file không có trong out/', () => {
    const root = tmp();
    try {
      mkdirSync(join(root, 'giai-phap'), { recursive: true });
      mkdirSync(join(root, 'img'), { recursive: true });
      writeFileSync(join(root, 'img', 'ok.jpg'), 'x');
      writeFileSync(
        join(root, 'giai-phap', 'index.html'),
        '<img src="/img/ok.jpg" alt=""><img class="c" src="/img/missing.jpg" alt=""><img src="https://cdn.test/x.jpg" alt="">',
      );
      const broken = findBrokenImgRefs(root);
      expect(broken).toHaveLength(1);
      expect(broken[0]).toContain('/img/missing.jpg');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('PERF-01: nén ảnh tĩnh', () => {
  it('thu nhỏ ảnh rộng quá 1280px, nhỏ hơn bản gốc, bỏ Exif; ảnh nhỏ giữ nguyên', async () => {
    const root = tmp();
    try {
      const dir = join(root, 'img');
      mkdirSync(dir, { recursive: true });
      const noise = Buffer.alloc(2400 * 1350 * 3);
      for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919 + (i >> 3)) & 0xff;
      const big = await sharp(noise, { raw: { width: 2400, height: 1350, channels: 3 } })
        .jpeg({ quality: 95 })
        .withExif({ IFD0: { Copyright: 'SECRET-EXIF' } })
        .toBuffer();
      writeFileSync(join(dir, 'big.jpg'), big);
      writeFileSync(join(dir, 'tiny.jpg'), 'tiny');
      await optimizeStaticImages(dir, ['big.jpg', 'tiny.jpg', 'note.txt']);
      const after = readFileSync(join(dir, 'big.jpg'));
      const meta = await sharp(after).metadata();
      expect(meta.width).toBe(1280);
      expect(after.length).toBeLessThan(big.length);
      expect(meta.exif).toBeUndefined();
      expect(readFileSync(join(dir, 'tiny.jpg'), 'utf8')).toBe('tiny');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('logo chân trang', () => {
  it('dùng logo thật trong ô trắng bo góc, không còn ô chữ giữ chỗ', () => {
    const input = { locale: 'vi', legalName: 'Công ty', slogan: 's', year: 2026, explore: [], info: [] };
    const html = buildFooterHtml(input as unknown as Parameters<typeof buildFooterHtml>[0]);
    expect(html).toContain('<span class="ft-logo"><img src="/brand/logo-gms-mark.svg"');
    expect(html).not.toContain('>GMS</span>');
  });
});
