// Ô ảnh cố định (V39, V41 (b)), tên không được nêu (V38, V41 (c)(d), M40) và lộ trình v1 (V40).
// Chạy: `vitest run --root src/content`
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { loadJourneySteps, loadSiteContent } from '../loader.ts';
import { loadDenylist, scanContentForForbiddenNames, scanOutputForForbiddenNames } from './names.ts';

const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const metaYaml = (kind: string, extra = ''): string =>
  `kind: ${kind}\nhasPeople: false\nsource: GMS\nalt: { vi: "a", en: "b" }\n${extra}`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function site(files: Record<string, string | Buffer>, denylist: string | null = 'names:\n  - "Xanh Asian"\n'): string {
  const dir = mkdtempSync(join(tmpdir(), 'gms-slots-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'images'));
  if (denylist !== null) writeFileSync(join(dir, 'denylist.yaml'), denylist);
  for (const [name, body] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}
// Thư mục tạm không có company.yaml: lỗi COMPANY_MISSING không thuộc ca đang thử.
const errsOf = (dir: string) => loadSiteContent(dir).errors.filter((e) => e.code !== 'COMPANY_MISSING');
const codes = (dir: string): string[] => errsOf(dir).map((e) => e.code);

describe('ô ảnh cố định', () => {
  it('không có tệp ⇒ không lỗi, mọi ô null', () => {
    const dir = site({});
    const loaded = loadSiteContent(dir);
    expect(errsOf(dir)).toEqual([]);
    expect(loaded.imageSlots).toEqual({ 'gms-sorting-line': null, 'gms-before': null, 'gms-after': null });
  });

  it('hai tệp cùng basename khác đuôi ⇒ IMAGE_SLOT_DUPLICATE nêu các tệp, ô null', () => {
    const dir = site({
      'images/gms-sorting-line.jpg': JPG,
      'images/gms-sorting-line.png': PNG,
      'images/gms-sorting-line.yaml': metaYaml('anh-dung-ai'),
    });
    const loaded = loadSiteContent(dir);
    expect(errsOf(dir).map((e) => e.message)).toEqual([
      'ô ảnh "gms-sorting-line" có nhiều tệp: "images/gms-sorting-line.jpg", "images/gms-sorting-line.png" — giữ đúng một tệp',
    ]);
    expect(loaded.imageSlots['gms-sorting-line']).toBeNull();
  });

  it('ô trang chủ kind ≠ anh-that ⇒ IMAGE_SLOT_KIND_INVALID đúng chữ contract; ô M4 nhận anh-dung-ai', () => {
    const dir = site({
      'images/gms-after.jpg': JPG,
      'images/gms-after.yaml': metaYaml('anh-dung-ai'),
      'images/gms-sorting-line.jpg': JPG,
      'images/gms-sorting-line.yaml': metaYaml('anh-dung-ai'),
    });
    const loaded = loadSiteContent(dir);
    expect(errsOf(dir)).toEqual([
      {
        code: 'IMAGE_SLOT_KIND_INVALID',
        message:
          'ô ảnh "gms-after" (tệp "images/gms-after.jpg") chỉ nhận ảnh chụp thật ("anh-that"), tệp khai loại "anh-dung-ai"',
      },
    ]);
    expect(loaded.imageSlots['gms-after']).toBeNull();
    expect(loaded.imageSlots['gms-sorting-line']?.name).toBe('gms-sorting-line');
  });

  it('cặp Trước/Sau hợp lệ ⇒ cả hai ô có ảnh; ảnh có người thiếu consentDate ⇒ ô null (không lỗi)', () => {
    const dir = site({
      'images/gms-before.jpg': JPG,
      'images/gms-before.yaml': metaYaml('anh-that'),
      'images/gms-after.jpg': JPG,
      'images/gms-after.yaml': metaYaml('anh-that').replace('hasPeople: false', 'hasPeople: true'),
    });
    const loaded = loadSiteContent(dir);
    expect(errsOf(dir)).toEqual([]);
    expect(loaded.imageSlots['gms-before']?.name).toBe('gms-before');
    expect(loaded.imageSlots['gms-after']).toBeNull();
  });
});

describe('denylist', () => {
  it('thiếu tệp, sai schema, names rỗng ⇒ DENYLIST_MISSING (một lỗi)', () => {
    for (const bad of [null, 'names: []\n', 'ten: ["Xanh Asian"]\n', 'names: ["Xanh Asian"]\nkhac: 1\n', ': : :']) {
      expect(codes(site({}, bad))).toEqual(['DENYLIST_MISSING']);
    }
  });

  it('loadDenylist đọc đúng danh sách', () => {
    expect(loadDenylist(site({}))).toEqual({ names: ['Xanh Asian'] });
  });

  it('tên trong giá trị YAML/thân md/tên tệp ⇒ FORBIDDEN_NAME_IN_CONTENT nêu tệp, locale, trường', () => {
    const dir = site({
      'images/so-do.jpg': JPG,
      'images/so-do.yaml': metaYaml('anh-that').replace('en: "b"', 'en: "Source: Xanh Asian"'),
      'news/a.vi.md': '---\ntitle: "Tin"\n---\nTư liệu của XanhAsian.\n',
      'images/xanh-asian-logo.png': PNG,
    });
    const msgs = scanContentForForbiddenNames(dir, ['Xanh Asian']).map((e) => e.message);
    expect(msgs).toContain('tệp "images/so-do.yaml", locale "en", trường "alt.en" nêu tên không được nêu "Xanh Asian"');
    expect(msgs).toContain('tệp "news/a.vi.md", locale "vi", trường "thân bài" nêu tên không được nêu "Xanh Asian"');
    expect(msgs).toContain('tệp "images/xanh-asian-logo.png", trường "tên tệp" nêu tên không được nêu "Xanh Asian"');
  });

  it('denylist.yaml và approvals/** không bị quét; loadSiteContent gom lỗi', () => {
    const dir = site({
      'approvals/x.yaml': 'evidence: "Xanh Asian"\n',
      'faq.en.yaml': '- key: a\n  answer: "xanh%20asian"\n',
    });
    const errs = errsOf(dir);
    expect(errs.map((e) => e.code)).toEqual(['FORBIDDEN_NAME_IN_CONTENT']);
    expect(errs[0]?.message).toContain('"faq.en.yaml"');
  });

  it('output-check: nội dung, đường dẫn, denylist.yaml trong out/; đuôi nhị phân chỉ so đường dẫn', () => {
    const out = site(
      {
        'en/technology.html': '<p>Xanh&amp;nbsp;Asian</p>',
        'a/denylist.yaml': 'x',
        'img/ok.png': Buffer.from('Xanh Asian'),
      },
      null,
    );
    const errs = scanOutputForForbiddenNames(out, ['Xanh Asian']);
    expect(errs.map((e) => e.code).sort()).toEqual(['DENYLIST_IN_OUTPUT', 'FORBIDDEN_NAME_IN_OUTPUT']);
  });
});

describe('journey-steps.yaml v1 (repo thật)', () => {
  it('5 bước, cả 5 "đã xong", không lỗi', () => {
    const res = loadJourneySteps(fileURLToPath(new URL('../../../content', import.meta.url)));
    expect(res.errors).toEqual([]);
    expect(res.steps?.map((s) => [s.order, s.status])).toEqual([1, 2, 3, 4, 5].map((n) => [n, 'đã xong']));
  });
});
