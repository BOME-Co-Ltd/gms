import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyStaticImages, findBrokenImgRefs } from '../../../scripts/content/build-site.ts';
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

describe('logo chân trang', () => {
  it('dùng logo thật trong ô trắng bo góc, không còn ô chữ giữ chỗ', () => {
    const input = { locale: 'vi', legalName: 'Công ty', slogan: 's', year: 2026, explore: [], info: [] };
    const html = buildFooterHtml(input as unknown as Parameters<typeof buildFooterHtml>[0]);
    expect(html).toContain('<span class="ft-logo"><img src="/brand/logo-gms-mark.svg"');
    expect(html).not.toContain('>GMS</span>');
  });
});
