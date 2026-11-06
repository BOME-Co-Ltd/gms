// test-plan.md 0k — schema hợp đồng (IMG-10/11, M40-01 hình dạng) và NỘI DUNG THẬT v1 (JRN-01, M40 trên content/**).
// Các ca đọc content/** thật đỏ cho tới khi backend tạo content/journey-steps.yaml và content/denylist.yaml; đó là đỏ có lý do.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { OUTPUT_SCAN_BINARY_EXTENSIONS } from '../../contracts/build.ts';
import {
  DENYLIST_PATH,
  ForbiddenNames,
  findForbiddenNames,
  ImageMeta,
  JOURNEY_STATUSES,
  JourneyStep,
} from '../../contracts/content-model.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = join(ROOT, 'content');
const NAME = 'Xanh Asian';

const imgMeta = (over: Record<string, unknown> = {}) => ({
  alt: { vi: 'Ảnh mẫu', en: 'Sample' },
  kind: 'anh-that',
  hasPeople: false,
  source: 'Nguồn mẫu',
  ...over,
});

describe('IMG-10/IMG-11 ImageMeta .strict(): khoá cũ làm schema ảnh đỏ', () => {
  it('ảnh hợp lệ tối thiểu qua', () => {
    expect(ImageMeta.safeParse(imgMeta()).success).toBe(true);
  });
  it.each([
    ['partnerAsset', { partner: 'X', type: 'logo' }],
    ['techSourceAsset', { partner: 'X', type: 'sơ đồ' }],
    ['keepTitleBlock', true],
  ])('khoá cũ "%s" bị từ chối', (key, val) => {
    const r = ImageMeta.safeParse(imgMeta({ [key]: val }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain(key);
  });
});

describe('M40-01 ForbiddenNames (hình dạng content/denylist.yaml)', () => {
  it('DENYLIST_PATH = denylist.yaml', () => {
    expect(DENYLIST_PATH).toBe('denylist.yaml');
  });
  it('danh sách hợp lệ qua; names rỗng, names là chuỗi, khoá lạ đều bị từ chối', () => {
    expect(ForbiddenNames.safeParse({ names: [NAME] }).success).toBe(true);
    expect(ForbiddenNames.safeParse({ names: [] }).success).toBe(false);
    expect(ForbiddenNames.safeParse({ names: NAME }).success).toBe(false);
    expect(ForbiddenNames.safeParse({ ten: [NAME] }).success).toBe(false);
    expect(ForbiddenNames.safeParse({ names: [NAME], ten: [NAME] }).success).toBe(false);
  });
});

describe('JourneyStep (hình dạng)', () => {
  it('ba trạng thái hợp lệ giữ nguyên thứ tự', () => {
    expect([...JOURNEY_STATUSES]).toEqual(['chưa tới', 'đang làm', 'đã xong']);
  });
  it('bước hợp lệ qua; order ngoài 1..5 và khoá lạ bị từ chối', () => {
    const ok = { order: 1, name: { vi: 'A', en: 'B' }, status: 'đã xong' };
    expect(JourneyStep.safeParse(ok).success).toBe(true);
    expect(JourneyStep.safeParse({ ...ok, order: 6 }).success).toBe(false);
    expect(JourneyStep.safeParse({ ...ok, order: 0 }).success).toBe(false);
    expect(JourneyStep.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
});

describe('JRN-01 (dữ liệu v1 thật) content/journey-steps.yaml — news-and-journey.feature:11–16, V40', () => {
  const steps = (): unknown[] => parse(readFileSync(join(CONTENT, 'journey-steps.yaml'), 'utf8'));
  it('đúng 5 bước, order 1..5, đúng thứ tự tên (vi), qua JourneyStep', () => {
    const s = steps();
    expect(Array.isArray(s)).toBe(true);
    expect(s).toHaveLength(5);
    const parsed = s.map((x) => JourneyStep.parse(x));
    expect(parsed.map((p) => p.order)).toEqual([1, 2, 3, 4, 5]);
    const nfc = (v: string) => v.normalize('NFC').toLowerCase();
    expect(parsed.map((p) => nfc(p.name.vi))).toEqual(
      [
        'Đánh giá hiện trạng',
        'Tổ chức mặt bằng',
        'Cải tạo hạ tầng',
        'Triển khai công nghệ',
        'Hoàn thiện hệ thống vận hành',
      ].map(nfc),
    );
  });
  it('cả 5 bước status "đã xong", không "đang làm"/"chưa tới"', () => {
    const parsed = steps().map((x) => JourneyStep.parse(x));
    expect(parsed.map((p) => p.status)).toEqual(Array(5).fill('đã xong'));
  });
  it('mỗi bước có tên en khác rỗng', () => {
    for (const p of steps().map((x) => JourneyStep.parse(x))) expect(p.name.en.trim().length).toBeGreaterThan(0);
  });
});

describe('M40 trên content/** thật — denylist có mặt và nội dung không nêu tên', () => {
  it('content/denylist.yaml qua ForbiddenNames và chứa "Xanh Asian" (figures-and-claims.feature:127–144)', () => {
    const d = ForbiddenNames.parse(parse(readFileSync(join(CONTENT, DENYLIST_PATH), 'utf8')));
    expect(d.names).toContain(NAME);
  });

  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  it('mọi tệp content/** (trừ denylist.yaml, approvals/**) không nêu tên — cả nội dung văn bản lẫn đường dẫn (luật 6(a))', () => {
    const bin = new Set<string>(OUTPUT_SCAN_BINARY_EXTENSIONS);
    const hits: string[] = [];
    for (const f of walk(CONTENT)) {
      const rel = f.slice(CONTENT.length + 1);
      if (rel === DENYLIST_PATH || rel.startsWith('approvals/')) continue;
      if (findForbiddenNames(rel, [NAME]).length > 0) hits.push(`${rel} (đường dẫn)`);
      const ext = rel.split('.').pop()?.toLowerCase() ?? '';
      if (bin.has(ext)) continue;
      if (findForbiddenNames(readFileSync(f, 'utf8'), [NAME]).length > 0) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
