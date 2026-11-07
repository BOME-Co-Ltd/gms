// Unit test cho contracts/build.ts (sản phẩm), kỳ vọng lấy từ chính contract + feature được trích dẫn trong đó — không từ mã.
import { describe, expect, it } from 'vitest';
import {
  BuildEnv,
  CONTENT_RULE_MESSAGES,
  FormStatus,
  formStatusOf,
  isProductionBuild,
  mayDeployProduction,
  PRODUCTION_BRANCH,
  productionEnvMismatch,
  REDIRECT_LINE,
  SLUG_LOCK_LINE,
} from '../../contracts/build.ts';

const SITE = 'https://gms.example.test';

describe('build.ts §1 — nhánh production và luật deploy (XQ-29(c), XQ-31.1)', () => {
  it.each([
    [
      'push vào nhánh production, SITE_ENV=production',
      { SITE_ENV: 'production', WORKERS_CI_BRANCH: PRODUCTION_BRANCH },
      true,
    ],
    [
      'Deploy Hook: không có nhánh, WORKERS_CI=1, SITE_ENV=production',
      { SITE_ENV: 'production', WORKERS_CI: '1' },
      true,
    ],
    ['Deploy Hook nhưng WORKERS_CI khác "1" ⇒ không deploy', { SITE_ENV: 'production', WORKERS_CI: '0' }, false],
    ['trên máy (không WORKERS_CI, không nhánh) ⇒ không deploy', { SITE_ENV: 'production' }, false],
    ['SITE_ENV=test, không nhánh ⇒ BRANCH_NOT_PRODUCTION', { SITE_ENV: 'test', WORKERS_CI: '1' }, false],
    [
      'nhánh production nhưng SITE_ENV=test ⇒ lệch môi trường, từ chối',
      { SITE_ENV: 'test', WORKERS_CI_BRANCH: PRODUCTION_BRANCH },
      false,
    ],
    [
      'nhánh khác production, SITE_ENV=production ⇒ lệch, từ chối',
      { SITE_ENV: 'production', WORKERS_CI_BRANCH: 'feature-x' },
      false,
    ],
    [
      'nhánh rỗng được coi là "không biết nhánh", vẫn đi đường Deploy Hook',
      { SITE_ENV: 'production', WORKERS_CI_BRANCH: '', WORKERS_CI: '1' },
      true,
    ],
  ])('mayDeployProduction: %s', (_ten, env, mong) => {
    expect(mayDeployProduction(env)).toBe(mong);
  });

  it('isProductionBuild đúng khi nhánh HOẶC SITE_ENV nói production; nhánh rỗng không phải nhánh khác', () => {
    expect(isProductionBuild({ WORKERS_CI_BRANCH: PRODUCTION_BRANCH })).toBe(true);
    expect(isProductionBuild({ SITE_ENV: 'production' })).toBe(true);
    expect(isProductionBuild({ SITE_ENV: 'staging', WORKERS_CI_BRANCH: 'main' })).toBe(false);
    expect(isProductionBuild({ WORKERS_CI_BRANCH: '' })).toBe(false);
  });

  it('productionEnvMismatch hai chiều (M36-b): chỉ một bên nói production ⇒ lệch; nhánh không biết thì SITE_ENV quyết', () => {
    expect(productionEnvMismatch({ SITE_ENV: 'test', WORKERS_CI_BRANCH: PRODUCTION_BRANCH })).toBe(true);
    expect(productionEnvMismatch({ SITE_ENV: 'production', WORKERS_CI_BRANCH: 'dev' })).toBe(true);
    expect(productionEnvMismatch({ SITE_ENV: 'production' })).toBe(false);
    expect(productionEnvMismatch({ SITE_ENV: 'production', WORKERS_CI_BRANCH: PRODUCTION_BRANCH })).toBe(false);
    expect(productionEnvMismatch({ SITE_ENV: 'test' })).toBe(false);
  });
});

describe('build.ts BuildEnv — luật M36 (build đỏ)', () => {
  const messages = (env: object) => {
    const r = BuildEnv.safeParse(env);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it('SITE_ENV=test có DATE_OVERRIDE và CONTENT_DIR khác "content" ⇒ hợp lệ (qa dùng bộ mẫu)', () => {
    expect(
      messages({
        SITE_URL: SITE,
        SITE_ENV: 'test',
        DATE_OVERRIDE: '2026-11-16',
        CONTENT_DIR: 'tests/fixtures/content-sample',
      }),
    ).toEqual([]);
  });
  it('staging có DATE_OVERRIDE ⇒ DATE_OVERRIDE_FORBIDDEN', () => {
    expect(messages({ SITE_URL: SITE, SITE_ENV: 'staging', DATE_OVERRIDE: '2026-11-16' })).toContain(
      'DATE_OVERRIDE_FORBIDDEN',
    );
  });
  it('nhánh production đặt nhầm SITE_ENV=test + CONTENT_DIR khác ⇒ PRODUCTION_ENV_MISMATCH và CONTENT_DIR_FORBIDDEN', () => {
    const m = messages({ SITE_URL: SITE, SITE_ENV: 'test', WORKERS_CI_BRANCH: PRODUCTION_BRANCH, CONTENT_DIR: 'khac' });
    expect(m).toContain('PRODUCTION_ENV_MISMATCH');
    expect(m).toContain('CONTENT_DIR_FORBIDDEN');
  });
  it('SITE_URL có "/" cuối hoặc DATE_OVERRIDE sai dạng ⇒ từ chối', () => {
    expect(BuildEnv.safeParse({ SITE_URL: `${SITE}/`, SITE_ENV: 'test' }).success).toBe(false);
    expect(BuildEnv.safeParse({ SITE_URL: SITE, SITE_ENV: 'test', DATE_OVERRIDE: '16/11/2026' }).success).toBe(false);
  });
  it('mặc định CONTENT_DIR = "content"', () => {
    const r = BuildEnv.parse({ SITE_URL: SITE, SITE_ENV: 'production', WORKERS_CI_BRANCH: PRODUCTION_BRANCH });
    expect(r.CONTENT_DIR).toBe('content');
  });
});

describe('build.ts §8 — thông báo luật nội dung trích nguyên văn tên/giá trị trong nháy kép', () => {
  const M = CONTENT_RULE_MESSAGES;
  it('contract lượt 13: không còn mã luật nguồn tư liệu bên ngoài (0k A)', () => {
    expect(Object.keys(M).filter((k) => k.startsWith('PARTNER_'))).toEqual([]);
  });
  it('ba luật bảng so sánh nêu đúng bảng và dòng, mỗi luật một nội dung khác nhau (dòng 130–135)', () => {
    const p = { table: 'Bảng 1', row: 'Dòng 2' };
    const a = M.COMPARISON_ROW_SOURCE_MISSING(p);
    const b = M.COMPARISON_NUMBER_NOT_FIGURE(p);
    const c = M.COMPARISON_SHAPE(p);
    for (const t of [a, b, c]) {
      expect(t).toContain('"Bảng 1"');
      expect(t).toContain('"Dòng 2"');
    }
    expect(a).toContain('thiếu nguồn');
    expect(b).toContain('chữ số');
    expect(c).toContain('số ô khác số cột');
    expect(new Set([a, b, c]).size).toBe(3);
  });
  it('JOURNEY_STATUS_INVALID nêu số bước, trạng thái sai và ba trạng thái hợp lệ (news-and-journey.feature 23–26)', () => {
    const t = M.JOURNEY_STATUS_INVALID({ step: 3, status: 'hoàn tất' });
    expect(t).toContain('bước 3');
    expect(t).toContain('"hoàn tất"');
    for (const ok of ['chưa tới', 'đang làm', 'đã xong']) expect(t).toContain(`"${ok}"`);
  });
  it('FANPAGE_SELECTION_BASIS_MISSING nêu nguồn bài và "GMS chọn đăng" (dòng 79–82)', () => {
    const t = M.FANPAGE_SELECTION_BASIS_MISSING({ origin: 'fb.com/bai-1' });
    expect(t).toContain('"fb.com/bai-1"');
    expect(t).toContain('GMS chọn đăng');
    expect(t).toContain('thiếu căn cứ');
  });
  it('PHONE_INVALID nêu trường "số điện thoại công khai" / "số Zalo" (contact-info.feature 54–57)', () => {
    expect(M.PHONE_INVALID({ field: 'số Zalo' })).toBe('"số Zalo" không phải số điện thoại Việt Nam hợp lệ');
    expect(M.PHONE_INVALID({ field: 'số điện thoại công khai' })).toContain('"số điện thoại công khai"');
  });
});

describe('build.ts §9 — trạng thái form lúc build', () => {
  it('đủ dữ liệu ⇒ form mở, không lý do', () => {
    expect(formStatusOf({ mailReady: true, privacyRequestEmail: 'ct@vi-du.test', taxId: '0900000000' })).toEqual({
      open: true,
      reasons: [],
    });
  });
  it.each([
    [{ mailReady: false, privacyRequestEmail: 'ct@vi-du.test', taxId: '1' }, ['mail-not-ready']],
    [{ mailReady: true, taxId: '1' }, ['no-privacy-email']],
    [{ mailReady: false }, ['mail-not-ready', 'no-privacy-email']],
  ])('thiếu dữ liệu ⇒ form tạm đóng với đúng lý do: %j', (input, reasons) => {
    expect(formStatusOf(input)).toEqual({ open: false, reasons });
  });
  it('email rỗng tính là thiếu; thiếu MST không đóng form (admin 07/11)', () => {
    expect(formStatusOf({ mailReady: true, privacyRequestEmail: '', taxId: '' }).reasons).toEqual(['no-privacy-email']);
    expect(formStatusOf({ mailReady: true, privacyRequestEmail: 'ct@vi-du.test' })).toEqual({
      open: true,
      reasons: [],
    });
  });
  it('FormStatus: open ⇔ không có lý do', () => {
    expect(FormStatus.safeParse({ open: true, reasons: [] }).success).toBe(true);
    expect(FormStatus.safeParse({ open: false, reasons: ['no-privacy-email'] }).success).toBe(true);
    expect(FormStatus.safeParse({ open: true, reasons: ['no-privacy-email'] }).success).toBe(false);
    expect(FormStatus.safeParse({ open: false, reasons: [] }).success).toBe(false);
    expect(FormStatus.safeParse({ open: false, reasons: ['ly-do-la'] }).success).toBe(false);
  });
});

describe('build.ts §4, §6 — dòng slugs.lock và _redirects', () => {
  it('SLUG_LOCK_LINE nhận kind/key/locale/slug hợp lệ, từ chối kind lạ hoặc slug có hoa/dấu', () => {
    expect(SLUG_LOCK_LINE.test('page\tgioi-thieu\tvi\tgioi-thieu')).toBe(true);
    expect(SLUG_LOCK_LINE.test('video\tgioi-thieu\tvi\tgioi-thieu')).toBe(false);
    expect(SLUG_LOCK_LINE.test('page\tgioi-thieu\tfr\tgioi-thieu')).toBe(false);
    expect(SLUG_LOCK_LINE.test('page\tgioi-thieu\tvi\tGiới-thiệu')).toBe(false);
  });
  it('REDIRECT_LINE chỉ nhận 301/308 và chặn đích ra ngoài miền (XQ-QA22)', () => {
    expect(REDIRECT_LINE.test('/cu /moi 301')).toBe(true);
    expect(REDIRECT_LINE.test('/cu /moi 308')).toBe(true);
    expect(REDIRECT_LINE.test('/cu /moi 302')).toBe(false);
    expect(REDIRECT_LINE.test('/cu //evil.test 301')).toBe(false);
    expect(REDIRECT_LINE.test('/cu https://evil.test/ 301')).toBe(false);
    expect(REDIRECT_LINE.test('//cu /moi 301')).toBe(false);
  });
});
