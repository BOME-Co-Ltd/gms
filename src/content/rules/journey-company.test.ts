// news-and-journey.feature dòng 22–26 (JOURNEY_STATUS_INVALID) và privacy-policy.feature dòng 72–78 (thiếu email V14 ⇒ build xanh).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSiteContent } from '../loader.ts';
import { validateCompanyRaw, validateJourneyStepsRaw } from './index.ts';

describe('validateJourneyStepsRaw', () => {
  it('trạng thái ngoài danh sách ⇒ JOURNEY_STATUS_INVALID nêu số bước và giá trị đúng chữ contract', () => {
    const errs = validateJourneyStepsRaw([{ order: 1 }, { order: 2 }, { order: 3, status: 'sắp xong' }]);
    expect(errs).toEqual([
      {
        code: 'JOURNEY_STATUS_INVALID',
        message: 'bước 3 có trạng thái "sắp xong" không thuộc "chưa tới", "đang làm", "đã xong"',
      },
    ]);
  });

  it('ba trạng thái hợp lệ và bước không có status ⇒ không lỗi; thiếu order ⇒ lấy vị trí', () => {
    expect(
      validateJourneyStepsRaw([{ status: 'chưa tới' }, { status: 'đang làm' }, { status: 'đã xong' }, {}]),
    ).toEqual([]);
    expect(validateJourneyStepsRaw([{ status: 'x' }])[0]?.message).toContain('bước 1 ');
  });

  it('khác hoa/thường hoặc có khoảng trắng thừa vẫn là ngoài danh sách (chuỗi tự do, so khớp đúng)', () => {
    expect(validateJourneyStepsRaw([{ order: 2, status: 'Đang làm' }])).toHaveLength(1);
    expect(validateJourneyStepsRaw([{ order: 2, status: 'đang làm ' }])).toHaveLength(1);
  });
});

describe('validateCompanyRaw — email nhận yêu cầu dữ liệu (V14)', () => {
  it('thiếu, null hoặc rỗng ⇒ không lỗi (build xanh, form tạm đóng ở formStatusOf)', () => {
    expect(validateCompanyRaw({})).toEqual([]);
    expect(validateCompanyRaw({ privacyRequestEmail: null })).toEqual([]);
    expect(validateCompanyRaw({ privacyRequestEmail: '  ' })).toEqual([]);
  });

  it('đã khai nhưng sai dạng ⇒ PRIVACY_EMAIL_INVALID', () => {
    expect(validateCompanyRaw({ privacyRequestEmail: 'khong-phai-email' }).map((e) => e.code)).toEqual([
      'PRIVACY_EMAIL_INVALID',
    ]);
    expect(validateCompanyRaw({ privacyRequestEmail: 123 }).map((e) => e.code)).toEqual(['PRIVACY_EMAIL_INVALID']);
  });

  it('đúng dạng ⇒ không lỗi', () => {
    expect(validateCompanyRaw({ privacyRequestEmail: 'dulieu@gmshungyen.vn' })).toEqual([]);
  });
});

describe('loadSiteContent — journey-steps.yaml và company.yaml', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const dirWith = (files: Record<string, string>): string => {
    const dir = mkdtempSync(join(tmpdir(), 'gms-journey-'));
    dirs.push(dir);
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    return dir;
  };
  const step = (order: number, status?: string) =>
    `- order: ${order}\n  name:\n    vi: "Bước ${order}"\n    en: "Step ${order}"\n${status ? `  status: "${status}"\n` : ''}`;

  it('status đến được tầng trang theo order; bước không status ⇒ null', () => {
    const dir = dirWith({ 'journey-steps.yaml': step(2, 'đang làm') + step(1, 'đã xong') + step(3) });
    const loaded = loadSiteContent(dir);
    expect(loaded.errors.filter((e) => e.code.startsWith('JOURNEY_'))).toEqual([]);
    expect(loaded.journeySteps).toEqual([
      { order: 1, name: { vi: 'Bước 1', en: 'Step 1' }, status: 'đã xong' },
      { order: 2, name: { vi: 'Bước 2', en: 'Step 2' }, status: 'đang làm' },
      { order: 3, name: { vi: 'Bước 3', en: 'Step 3' }, status: null },
    ]);
  });

  it('không có journey-steps.yaml ⇒ journeySteps = null', () => {
    expect(loadSiteContent(dirWith({})).journeySteps).toBeNull();
  });

  it('trạng thái sai ⇒ errors có JOURNEY_STATUS_INVALID (build đỏ ở build-site)', () => {
    const dir = dirWith({ 'journey-steps.yaml': step(1) + step(2) + step(3, 'sắp xong') });
    expect(loadSiteContent(dir).errors.map((e) => e.message)).toContain(
      'bước 3 có trạng thái "sắp xong" không thuộc "chưa tới", "đang làm", "đã xong"',
    );
  });

  it('company.yaml thiếu privacyRequestEmail ⇒ không có lỗi PRIVACY_EMAIL, privacyRequestEmail rỗng', () => {
    const loaded = loadSiteContent(dirWith({ 'company.yaml': 'legalName: "GMS"\ntaxId: "0900123456"\n' }));
    expect(loaded.errors.filter((e) => e.code.startsWith('PRIVACY_EMAIL'))).toEqual([]);
    expect(loaded.company.privacyRequestEmail).toBe('');
  });
});
