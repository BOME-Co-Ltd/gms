// V38/V39 (contracts/README.md "Lượt 13", "Lượt 14"): mô hình Partner đã bỏ. Khoá cũ trong meta ảnh ⇒ build đỏ (ImageMeta
// `.strict()`), không lặng lẽ bỏ qua. Chạy: `vitest run --root src/content`
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSiteContent } from '../loader.ts';
import { validateImageMetaRaw } from './index.ts';

const META = { kind: 'anh-that', hasPeople: false, alt: { vi: 'a', en: 'b' }, source: 'GMS' };

describe('validateImageMetaRaw — khoá đã bỏ khỏi ImageMeta', () => {
  it('meta đúng ⇒ không lỗi', () => {
    expect(validateImageMetaRaw('x', META)).toEqual([]);
  });

  it('partnerAsset / techSourceAsset / keepTitleBlock ⇒ IMAGE_META_KEY_UNKNOWN nêu khoá', () => {
    for (const key of ['partnerAsset', 'techSourceAsset', 'keepTitleBlock']) {
      const errs = validateImageMetaRaw('x', { ...META, [key]: true });
      expect(errs.map((e) => e.code)).toEqual(['IMAGE_META_KEY_UNKNOWN']);
      expect(errs[0]?.message).toContain(`"${key}"`);
    }
  });
});

describe('loadSiteContent — không còn partners', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('ảnh mang partnerAsset ⇒ errors có IMAGE_META_KEY_UNKNOWN; kết quả không có trường partners', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gms-nopartner-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'denylist.yaml'), 'names:\n  - "Xanh Asian"\n');
    writeFileSync(join(dir, 'images', 'tl.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
    writeFileSync(
      join(dir, 'images', 'tl.yaml'),
      'kind: anh-that\nhasPeople: false\nsource: GMS\nalt: { vi: "a", en: "b" }\npartnerAsset: { partner: "P", type: "logo" }\n',
    );
    const loaded = loadSiteContent(dir);
    expect(loaded.errors.map((e) => e.code).filter((c) => c !== 'COMPANY_MISSING')).toEqual(['IMAGE_META_KEY_UNKNOWN']);
    expect('partners' in loaded).toBe(false);
  });
});
