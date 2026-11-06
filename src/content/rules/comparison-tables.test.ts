// content-model.ts ComparisonTable + build.ts §8 COMPARISON_*; content/comparison-tables.yaml tuỳ chọn (V39: v1 không tệp).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSiteContent } from '../loader.ts';
import { validateComparisonTablesRaw } from './index.ts';

const bi = (s: string) => ({ vi: s, en: s });
const FIGS = new Map<string, Record<string, unknown>>([
  ['a', { key: 'a', source: 'Tài liệu GMS' }],
  ['no-src', { key: 'no-src', source: '  ' }],
]);
const table = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  key: 't1',
  title: bi('So sánh'),
  columns: [bi('Chỉ tiêu'), bi('GMS')],
  rows,
  ...extra,
});
const okRow = { label: bi('đốt'), cells: [{ text: bi('Có') }, { figure: 'a' }] };

describe('validateComparisonTablesRaw', () => {
  it('bảng đúng / tệp rỗng ⇒ không lỗi', () => {
    expect(validateComparisonTablesRaw([table([okRow])], FIGS)).toEqual([]);
    expect(validateComparisonTablesRaw(null, FIGS)).toEqual([]);
    expect(validateComparisonTablesRaw([], FIGS)).toEqual([]);
  });

  it('số ô ≠ số cột ⇒ COMPARISON_SHAPE đúng thông báo contract', () => {
    const errs = validateComparisonTablesRaw([table([{ label: bi('đốt'), cells: [{ text: bi('Có') }] }])], FIGS);
    expect(errs).toEqual([
      { code: 'COMPARISON_SHAPE', message: 'bảng so sánh "So sánh", dòng "đốt" có số ô khác số cột' },
    ]);
  });

  it('chữ số trong ô chữ (vi hoặc en) ⇒ COMPARISON_NUMBER_NOT_FIGURE', () => {
    const row = { label: bi('đốt'), cells: [{ text: { vi: 'Có', en: 'Up to 90' } }, { figure: 'a' }] };
    expect(validateComparisonTablesRaw([table([row])], FIGS).map((e) => e.code)).toEqual([
      'COMPARISON_NUMBER_NOT_FIGURE',
    ]);
  });

  it('ô figure trỏ khoá không tồn tại hoặc source rỗng ⇒ COMPARISON_ROW_SOURCE_MISSING, một lỗi mỗi dòng', () => {
    const rows = [
      { label: bi('đốt'), cells: [{ figure: 'khong-co' }, { figure: 'no-src' }] },
      { label: bi('chôn lấp'), cells: [{ text: bi('x') }, { figure: 'no-src' }] },
    ];
    const errs = validateComparisonTablesRaw([table(rows)], FIGS);
    expect(errs.map((e) => e.code)).toEqual(['COMPARISON_ROW_SOURCE_MISSING', 'COMPARISON_ROW_SOURCE_MISSING']);
    expect(errs[0]?.message).toBe('bảng so sánh "So sánh", dòng "đốt" thiếu nguồn');
  });

  it('gom nhiều lỗi, không dừng ở lỗi đầu', () => {
    const rows = [
      { label: bi('đốt'), cells: [{ figure: 'no-src' }] },
      { label: bi('ủ'), cells: [{ text: bi('1') }, { figure: 'a' }] },
    ];
    expect(
      validateComparisonTablesRaw([table(rows)], FIGS)
        .map((e) => e.code)
        .sort(),
    ).toEqual(['COMPARISON_NUMBER_NOT_FIGURE', 'COMPARISON_ROW_SOURCE_MISSING', 'COMPARISON_SHAPE']);
  });

  it('khoá cũ partner/techSource (.strict()) và gốc không phải mảng ⇒ lỗi, không bỏ qua', () => {
    for (const k of ['partner', 'techSource']) {
      const errs = validateComparisonTablesRaw([table([okRow], { [k]: 'X' })], FIGS);
      expect(errs.map((e) => e.code)).toEqual(['COMPARISON_SCHEMA_INVALID']);
      expect(errs[0]?.message).toContain(k);
      expect(errs[0]?.message).toContain('sai schema');
    }
    const root = validateComparisonTablesRaw({ key: 't' }, FIGS);
    expect(root.map((e) => e.code)).toEqual(['COMPARISON_SCHEMA_INVALID']);
    expect(root[0]?.message).toBe('bảng so sánh "(gốc tệp)", dòng "-" sai schema: phải là danh sách bảng');
  });

  it('ô sai dạng, thiếu rows, key trùng ⇒ lỗi', () => {
    const bad = { label: bi('đốt'), cells: [{ figure: 'a', text: bi('x') }, { foo: 1 }] };
    const badErrs = validateComparisonTablesRaw([table([bad])], FIGS);
    expect(badErrs.length).toBeGreaterThan(0);
    expect(badErrs.filter((e) => e.code === 'COMPARISON_SCHEMA_INVALID').length).toBeGreaterThan(0);
    const empty = validateComparisonTablesRaw([table([])], FIGS);
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((e) => e.code === 'COMPARISON_SCHEMA_INVALID')).toBe(true);
    const dup = validateComparisonTablesRaw([table([okRow]), table([okRow])], FIGS);
    expect(dup.map((e) => e.code)).toEqual(['COMPARISON_SCHEMA_INVALID']);
    expect(dup[0]?.message).toContain('trùng');
    expect(dup[0]?.message).toContain('dòng "-"');
  });
});

describe('loadSiteContent — comparison-tables.yaml', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const make = (yaml: string | null) => {
    const dir = mkdtempSync(join(tmpdir(), 'gms-cmp-'));
    dirs.push(dir);
    writeFileSync(join(dir, 'denylist.yaml'), 'names:\n  - "Xanh Asian"\n');
    writeFileSync(
      join(dir, 'figures.yaml'),
      '- key: a\n  value: "1"\n  label: { vi: "a", en: "a" }\n  source: "GMS"\n  confirmedBy: "x"\n  confirmedAt: "2026-01-01"\n  public: true\n',
    );
    if (yaml !== null) writeFileSync(join(dir, 'comparison-tables.yaml'), yaml);
    return dir;
  };
  const codes = (dir: string) =>
    loadSiteContent(dir)
      .errors.map((e) => e.code)
      .filter((c) => c !== 'COMPANY_MISSING');

  it('không có tệp ⇒ xanh (tuỳ chọn)', () => {
    expect(codes(make(null))).toEqual([]);
  });

  it('có tệp sai ⇒ lỗi COMPARISON_* vào errors', () => {
    const y =
      '- key: t1\n  title: { vi: "T", en: "T" }\n  columns:\n    - { vi: "c", en: "c" }\n  rows:\n    - label: { vi: "đốt", en: "d" }\n      cells:\n        - { figure: zzz }\n';
    expect(codes(make(y))).toEqual(['COMPARISON_ROW_SOURCE_MISSING']);
  });
});
