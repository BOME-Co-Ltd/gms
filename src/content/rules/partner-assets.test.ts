// S33 (contracts/build.ts §8): tư liệu đối tác của ảnh. Chạy: `vitest run --root src/content`
// (vitest.config.ts của repo chỉ gom tests/unit/**).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSiteContent } from '../loader.ts';
import { readPartnerAsset, validatePartnerAssetRefs } from './index.ts';

const PARTNERS = [
  { name: 'Xanh Asian', permissionBasis: 'raw 02/11 N22', allowedAssets: ['sơ đồ quy trình', 'bảng so sánh', 'bản vẽ 3D'] },
];

describe('validatePartnerAssetRefs', () => {
  it('loại không thuộc allowedAssets ⇒ PARTNER_ASSET_NOT_ALLOWED đúng chữ contract', () => {
    const errs = validatePartnerAssetRefs([{ image: 'logo-xanhasian', partner: 'Xanh Asian', type: 'logo' }], PARTNERS);
    expect(errs).toEqual([
      {
        code: 'PARTNER_ASSET_NOT_ALLOWED',
        message: '"logo-xanhasian" loại "logo" không thuộc tư liệu được phép của "Xanh Asian"',
      },
    ]);
  });

  it('đối tác không có trong partners.yaml (kể cả không có file) ⇒ PARTNER_UNKNOWN', () => {
    const ref = { image: 'so-do', partner: 'Không Có', type: 'sơ đồ quy trình' };
    for (const list of [PARTNERS, []]) {
      const errs = validatePartnerAssetRefs([ref], list);
      expect(errs).toHaveLength(1);
      expect(errs[0].code).toBe('PARTNER_UNKNOWN');
      expect(errs[0].message).toContain('"Không Có"');
      expect(errs[0].message).toContain('không có Đối tác này trong partners.yaml');
    }
  });

  it('loại hợp lệ ⇒ không lỗi; đối tác không khai allowedAssets ⇒ mọi loại bị từ chối', () => {
    expect(validatePartnerAssetRefs([{ image: 'a', partner: 'Xanh Asian', type: 'bản vẽ 3D' }], PARTNERS)).toEqual([]);
    const errs = validatePartnerAssetRefs([{ image: 'a', partner: 'X', type: 'bản vẽ 3D' }], [{ name: 'X' }]);
    expect(errs.map((e) => e.code)).toEqual(['PARTNER_ASSET_NOT_ALLOWED']);
  });

  it('loại rỗng ⇒ PARTNER_ASSET_NOT_ALLOWED (contract: bắt type rỗng)', () => {
    const errs = validatePartnerAssetRefs([{ image: 'a', partner: 'Xanh Asian', type: '' }], PARTNERS);
    expect(errs.map((e) => e.code)).toEqual(['PARTNER_ASSET_NOT_ALLOWED']);
  });
});

describe('readPartnerAsset', () => {
  it('không khai ⇒ null; khai đúng ⇒ trả partner + type; sai dạng ⇒ chuỗi rỗng để luật bắt', () => {
    expect(readPartnerAsset(null)).toBeNull();
    expect(readPartnerAsset({ kind: 'anh-that' })).toBeNull();
    expect(readPartnerAsset({ partnerAsset: { partner: 'Xanh Asian', type: 'logo' } })).toEqual({
      partner: 'Xanh Asian',
      type: 'logo',
    });
    expect(readPartnerAsset({ partnerAsset: 'Xanh Asian' })).toEqual({ partner: '', type: '' });
  });
});

describe('loadSiteContent + partnerAsset', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  function content(partnerAsset: Record<string, string>, withPartners: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), 'gms-content-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'tl.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
    writeFileSync(
      join(dir, 'images', 'tl.yaml'),
      [
        'kind: anh-that',
        'hasPeople: false',
        'alt: { vi: "tư liệu", en: "asset" }',
        `partnerAsset: { partner: "${partnerAsset.partner}", type: "${partnerAsset.type}" }`,
        '',
      ].join('\n'),
    );
    if (withPartners) {
      writeFileSync(
        join(dir, 'partners.yaml'),
        '- name: Xanh Asian\n  permissionBasis: raw 02/11 N22\n  allowedAssets: ["sơ đồ quy trình"]\n',
      );
    }
    return dir;
  }

  const messages = (dir: string) => loadSiteContent(dir).errors.map((e) => `${e.code}: ${e.message}`);

  it('loại ngoài allowedAssets ⇒ lỗi S33; loại đúng ⇒ không lỗi S33 và ảnh mang partnerAsset', () => {
    const bad = messages(content({ partner: 'Xanh Asian', type: 'logo' }, true));
    expect(bad).toContain(
      'PARTNER_ASSET_NOT_ALLOWED: "tl" loại "logo" không thuộc tư liệu được phép của "Xanh Asian"',
    );
    const dir = content({ partner: 'Xanh Asian', type: 'sơ đồ quy trình' }, true);
    const ok = loadSiteContent(dir);
    expect(ok.errors.filter((e) => e.code.startsWith('PARTNER_'))).toEqual([]);
    expect(ok.images.get('images/tl.jpg')?.partnerAsset).toEqual({ partner: 'Xanh Asian', type: 'sơ đồ quy trình' });
  });

  it('đối tác không có trong partners.yaml hoặc không có file ⇒ PARTNER_UNKNOWN', () => {
    for (const withPartners of [true, false]) {
      const msgs = messages(content({ partner: 'Không Có', type: 'sơ đồ quy trình' }, withPartners));
      expect(msgs.some((m) => m.startsWith('PARTNER_UNKNOWN:') && m.includes('không có Đối tác này trong partners.yaml'))).toBe(true);
    }
  });
});
