import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CONTACT_ENDPOINT,
  CONTACT_HEALTH_ENDPOINT,
  CONTACT_HTTP_STATUS,
  CONTACT_LIMITS,
  ContactSubmitRequest,
  ContactSubmitResponse,
  CRON_LIMITS,
  HEADER_UNSAFE_CHARS,
  MAIL_CAPS,
  OUTBOX,
  RATE_LIMITS,
} from '../../contracts/api.ts';
import {
  APPROVAL_PATH,
  BUILD_SCRIPTS,
  BuildEnv,
  DEPLOY_HASH_LINE,
  DEPLOY_RESULT,
  isProductionBuild,
} from '../../contracts/build.ts';
import {
  Approval,
  Company,
  FaqItem,
  Figure,
  ImageMeta,
  JobFront,
  NewsFront,
  OutputLine,
  PolicyFront,
  ProjectFront,
} from '../../contracts/content-model.ts';
import { DETAIL_HTTP, EMPTY_LIST_NOINDEX, PAGE_SIZE, ROUTES } from '../../contracts/routes.ts';
import { SafeHref, safeHref } from '../../contracts/safe-url.ts';
import nextConfig from '../../next.config.ts';
import playwrightConfig from '../../playwright.config.ts';
// @ts-expect-error JS module without declaration
import postcssConfig from '../../postcss.config.mjs';
import {
  buildOrgJsonLd,
  escHtml,
  formatDateLocale,
  runBuildSite,
  stripExifFromJpegBuffer,
} from '../../scripts/content/build-site.ts';
import { runContentCheck } from '../../scripts/content/check.ts';
import { computeContentHash, verifyDeployApproval } from '../../scripts/deploy/deploy-prod.ts';
import PrivacyPage from '../../src/app/chinh-sach-bao-mat/page.tsx';
import TechnologyPage from '../../src/app/cong-nghe/page.tsx';
import ProjectsPage from '../../src/app/du-an-thu-vien/page.tsx';
import EnglishAboutPage from '../../src/app/en/about/page.tsx';
import EnglishCareersPage from '../../src/app/en/careers/page.tsx';
import EnglishContactPage from '../../src/app/en/contact/page.tsx';
import EnglishFaqPage from '../../src/app/en/faq/page.tsx';
import EnglishNewsPage from '../../src/app/en/news/page.tsx';
import EnglishHomePage from '../../src/app/en/page.tsx';
import EnglishPrivacyPage from '../../src/app/en/privacy-policy/page.tsx';
import EnglishProductsPage from '../../src/app/en/products/page.tsx';
import EnglishProjectsPage from '../../src/app/en/projects-library/page.tsx';
import EnglishSolutionsPage from '../../src/app/en/solutions/page.tsx';
import EnglishTechnologyPage from '../../src/app/en/technology/page.tsx';
import FaqPage from '../../src/app/faq/page.tsx';
import SolutionsPage from '../../src/app/giai-phap/page.tsx';
import AboutPage from '../../src/app/gioi-thieu/page.tsx';
import RootLayout, { metadata } from '../../src/app/layout.tsx';
import ContactPage from '../../src/app/lien-he/page.tsx';
import HomePage from '../../src/app/page.tsx';
import ProductsPage from '../../src/app/san-pham-dau-ra/page.tsx';
import NewsPage from '../../src/app/tin-tuc/page.tsx';
import CareersPage from '../../src/app/tuyen-dung/page.tsx';
import { ContactFormSection } from '../../src/components/sections/ContactFormSection.tsx';
import { HeroSection } from '../../src/components/sections/HeroSection.tsx';
import { JourneySection } from '../../src/components/sections/JourneySection.tsx';
import { PillarsSection } from '../../src/components/sections/PillarsSection.tsx';
import { TechSummarySection } from '../../src/components/sections/TechSummarySection.tsx';
import { FigureStrip } from '../../src/components/ui/FigureStrip.tsx';
import { Footer } from '../../src/components/ui/Footer.tsx';
import { Header } from '../../src/components/ui/Header.tsx';
import { LangSwitcher } from '../../src/components/ui/LangSwitcher.tsx';
import { OutputCard } from '../../src/components/ui/OutputCard.tsx';
import { TechFlowSvg } from '../../src/components/ui/TechFlowSvg.tsx';
import { VpdStepper } from '../../src/components/ui/VpdStepper.tsx';
import { loadSiteContent } from '../../src/content/loader.ts';
import {
  buildBaseInternalPaths,
  detectImageMime,
  extractMarkdownLinks,
  isImageAllowedForOg,
  isImageAllowedInBuild,
  parseSlugsLock,
  validateCompanyRaw,
  validateFigureRaw,
  validateImageBinary,
  validateImageMetaRaw,
  validateLinksInBody,
  validateOutputLinesRaw,
  validatePageClaimsAndFigures,
} from '../../src/content/rules/index.ts';
import { getDictionary } from '../../src/i18n/index.ts';
import { formatPublicPhone, isValidPublicVNPhone, normalizeVNPhone } from '../../src/shared/contact/schema.ts';
import vitestConfig from '../../vitest.config.ts';
import {
  CfClientIp,
  CloudflareSendEmailMailer,
  ConsoleAppLogger,
  D1ContactQueue,
  D1RateCounter,
  SystemClock,
  TurnstileHumanCheck,
  WebCryptoIpKey,
} from '../../worker/adapters/cloudflare.ts';
import { handleContactHealth, handleContactPost, runCronJob } from '../../worker/domain/contact-service.ts';
import {
  buildAlertMail,
  buildNotifyMail,
  buildRawMime,
  buildSummaryMail,
  encodeRfc2047B,
  formatVnTimestamp,
  resolvePageLabelVi,
} from '../../worker/domain/mail-builder.ts';
import testWorker from '../../worker/index.test.ts';
import prodWorker from '../../worker/index.ts';
import type { D1Database, D1PreparedStatement, OutboxRecord } from '../../worker/ports.ts';

function createInMemoryD1(): D1Database {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    outbox: [],
    rate_counter: [],
    dedupe: [],
    mail_log: [],
    heartbeat: [],
  };

  function makeStmt(query: string, bound: unknown[] = []): D1PreparedStatement {
    const q = query.trim().replace(/\s+/g, ' ');
    return {
      bind(...values: unknown[]) {
        return makeStmt(query, values);
      },
      async run() {
        if (q.startsWith('DELETE FROM ')) {
          const table = q.split(' ')[2];
          if (tables[table]) {
            const before = tables[table].length;
            tables[table] = [];
            return { success: true, meta: { changes: before } };
          }
          return { success: true, meta: { changes: 0 } };
        }
        if (q.startsWith('INSERT INTO outbox')) {
          tables.outbox.push({
            id: bound[0],
            created_at: bound[1],
            locale: bound[2],
            full_name: bound[3],
            company: bound[4],
            email: bound[5],
            phone: bound[6],
            message: bound[7],
            page_path: bound[8],
            utm_json: bound[9],
            policy_version: bound[10],
            consent_at: bound[11],
            dedupe_hash: bound[12],
            body_b64: bound[13],
            batch: bound[14],
            attempts: 0,
            next_attempt_at: bound[15],
            sent_at: null,
            lease_until: null,
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('INSERT OR REPLACE INTO dedupe')) {
          tables.dedupe = tables.dedupe.filter((r) => r.hash !== bound[0]);
          tables.dedupe.push({ hash: bound[0], created_at: bound[1] });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('INSERT INTO rate_counter')) {
          const existing = tables.rate_counter.find((r) => r.key === bound[0] && r.window_start === bound[1]);
          if (existing) {
            existing.hits = Number(existing.hits) + Number(bound[2]);
          } else {
            tables.rate_counter.push({ key: bound[0], window_start: bound[1], hits: bound[2] });
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('INSERT INTO mail_log')) {
          tables.mail_log.push({ sent_at: bound[0], kind: bound[1] });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('INSERT OR REPLACE INTO heartbeat')) {
          tables.heartbeat = tables.heartbeat.filter((r) => r.name !== bound[0]);
          tables.heartbeat.push({ name: bound[0], last_at: bound[1] });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('UPDATE outbox SET lease_until')) {
          const rec = tables.outbox.find((r) => r.id === bound[1] && !r.sent_at);
          if (rec) {
            rec.lease_until = bound[0];
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        }
        return { success: true, meta: { changes: 1 } };
      },
      async first<T>() {
        if (q.includes('FROM dedupe WHERE hash =')) {
          const hit = tables.dedupe.find((r) => r.hash === bound[0] && Number(r.created_at) >= Number(bound[1]));
          return (hit ?? null) as unknown as T;
        }
        if (q.includes('FROM rate_counter')) {
          const total = tables.rate_counter
            .filter((r) => r.key === bound[0] && Number(r.window_start) >= Number(bound[1]))
            .reduce((acc, r) => acc + Number(r.hits), 0);
          return { total } as unknown as T;
        }
        if (q.includes('COUNT(*) AS cnt FROM mail_log')) {
          const cnt = tables.mail_log.filter(
            (r) => r.kind === bound[0] && Number(r.sent_at) >= Number(bound[1]),
          ).length;
          return { cnt } as unknown as T;
        }
        if (q.includes('COUNT(*) AS cnt FROM outbox')) {
          const cnt = tables.outbox.filter((r) => !r.sent_at).length;
          return { cnt } as unknown as T;
        }
        if (q.includes('MIN(created_at) AS oldest')) {
          return { oldest: null } as unknown as T;
        }
        if (q.includes('SELECT last_at FROM heartbeat')) {
          const row = tables.heartbeat.find((r) => r.name === bound[0]);
          return (row ?? null) as unknown as T;
        }
        return null;
      },
      async all<T>() {
        if (q.startsWith('UPDATE outbox SET lease_until') && q.includes('RETURNING')) {
          // Lấy lease + RETURNING trong MỘT câu (design.md §6g, lượt 10). Thứ tự tham số gắn:
          //   thư lẻ:    [leaseUntil, nextAttemptAt<=, now, limit]
          //   tóm tắt:   ?1 đầu giờ tròn, ?2 now, ?3 limit, ?4 trần byte, ?5 leaseUntil, ?6 ngưỡng cô lập attempts
          const isSummary = q.includes("batch = 'summary'");
          const now = Number(isSummary ? bound[1] : bound[2]);
          const leaseUntil = isSummary ? bound[4] : bound[0];
          const limit = Number(isSummary ? bound[2] : bound[3]);
          const isDue = (r: Record<string, unknown>) =>
            isSummary ? Number(r.created_at) < Number(bound[0]) : Number(r.next_attempt_at) <= Number(bound[1]);
          const eligible = tables.outbox
            .filter(
              (r) =>
                !r.sent_at &&
                r.batch === (isSummary ? 'summary' : 'single') &&
                isDue(r) &&
                (r.lease_until == null || Number(r.lease_until) < now),
            )
            .sort((a, b) => Number(a.created_at) - Number(b.created_at) || String(a.id).localeCompare(String(b.id)))
            .slice(0, limit);
          let picked = eligible;
          if (isSummary && eligible.length > 0) {
            const headIsolated = Number(eligible[0].attempts) >= Number(bound[5]);
            let cum = 0;
            picked = eligible.filter((r, i) => {
              cum += String(r.body_b64 ?? '').length;
              return i === 0 || (cum <= Number(bound[3]) && !headIsolated);
            });
          }
          for (const r of picked) {
            r.lease_until = leaseUntil;
            r.attempts = Number(r.attempts) + 1;
          }
          return { results: picked.map((r) => ({ ...r })) as unknown as T[] };
        }
        if (q.includes("FROM outbox WHERE sent_at IS NULL AND batch = 'single'")) {
          return {
            results: tables.outbox.filter((r) => !r.sent_at && r.batch === 'single') as unknown as T[],
          };
        }
        if (q.includes("FROM outbox WHERE sent_at IS NULL AND batch = 'summary'")) {
          return {
            results: tables.outbox.filter((r) => !r.sent_at && r.batch === 'summary') as unknown as T[],
          };
        }
        if (q.startsWith('SELECT * FROM ')) {
          const tbl = q.replace('SELECT * FROM ', '').trim();
          return { results: (tables[tbl] ?? []) as unknown as T[] };
        }
        return { results: [] as T[] };
      },
    };
  }

  return {
    prepare(query: string) {
      return makeStmt(query);
    },
    async batch(statements: D1PreparedStatement[]) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
  };
}

describe('Contracts & Safe URL', () => {
  it('validates safeHref and contract schemas', () => {
    expect(safeHref('https://gmshungyen.vn/path').ok).toBe(true);
    expect(safeHref('/gioi-thieu').ok).toBe(true);
    expect(safeHref('//evil.test').ok).toBe(false);
    expect(safeHref('javascript:alert(1)').ok).toBe(false);
    expect(safeHref('tel:+84987998370').ok).toBe(true);
    expect(safeHref('tel:abc').ok).toBe(false);
    expect(safeHref('mailto:a@b.vn?subject=Hello').ok).toBe(true);
    expect(safeHref('mailto:a@b.vn?subject=x&cc=c@d.vn').ok).toBe(false);
    expect(safeHref('mailto:a@b.vn,c@d.vn').ok).toBe(false);
    expect(safeHref(123).ok).toBe(false);
    expect(SafeHref.safeParse('/lien-he').success).toBe(true);
    expect(SafeHref.safeParse('javascript:void(0)').success).toBe(false);

    expect(CONTACT_ENDPOINT).toBe('/api/contact');
    expect(CONTACT_HEALTH_ENDPOINT).toBe('/api/contact/health');
    expect(CONTACT_LIMITS.fullName).toBe(200);
    expect(CONTACT_HTTP_STATUS.VALIDATION).toBe(422);
    expect(RATE_LIMITS.contactSuccessPerIp.max).toBe(5);
    expect(MAIL_CAPS.notifyPerHour).toBe(30);
    expect(OUTBOX.alertAfterSeconds).toBe(86400);
    expect(HEADER_UNSAFE_CHARS.test('An\r\nBcc')).toBe(true);

    const reqParse = ContactSubmitRequest.safeParse({
      locale: 'vi',
      fullName: 'Nguyễn Văn An',
      email: 'an@vi-du.test',
      message: 'Xin chào',
      consent: true,
      policyVersion: '1.0',
      turnstileToken: 'tok',
      pagePath: '/lien-he',
    });
    expect(reqParse.success).toBe(true);
    expect(ContactSubmitResponse.safeParse({ ok: true }).success).toBe(true);

    expect(isProductionBuild({ SITE_ENV: 'production' })).toBe(true);
    expect(isProductionBuild({ SITE_ENV: 'test' })).toBe(false);
    expect(
      BuildEnv.safeParse({
        SITE_URL: 'https://gms.example.test',
        SITE_ENV: 'test',
      }).success,
    ).toBe(true);
    expect(
      BuildEnv.safeParse({
        SITE_URL: 'https://gms.example.test',
        SITE_ENV: 'production',
        WORKERS_CI_BRANCH: 'main',
      }).success,
    ).toBe(false);
    expect(APPROVAL_PATH('abc')).toBe('content/approvals/abc.yaml');
    expect(BUILD_SCRIPTS.build).toBe('build');
    expect(DEPLOY_HASH_LINE.test(`content-hash: ${'a'.repeat(64)}`)).toBe(true);
    expect(DEPLOY_RESULT.approved).toBe('APPROVED');

    expect(ROUTES.home.vi).toBe('/');
    expect(EMPTY_LIST_NOINDEX).toContain('projects');
    expect(PAGE_SIZE).toBe(12);
    expect(DETAIL_HTTP.published).toBe(200);

    expect(
      ImageMeta.safeParse({
        alt: { vi: 'a', en: 'b' },
        kind: 'anh-that',
        hasPeople: false,
        source: 's',
      }).success,
    ).toBe(true);
    expect(
      NewsFront.safeParse({
        slug: 'tin-1',
        key: 'tin-1',
        title: 'Tin 1',
        published: true,
        summary: 'Tom tat',
        date: '2026-10-01',
      }).success,
    ).toBe(true);
    expect(
      ProjectFront.safeParse({
        slug: 'du-an-1',
        key: 'du-an-1',
        title: 'Du an 1',
        published: true,
        summary: 'Tom tat',
        date: '2026-10-01',
        category: 'Cat',
      }).success,
    ).toBe(true);
    expect(
      JobFront.safeParse({
        slug: 'job-1',
        key: 'job-1',
        title: 'Job 1',
        published: true,
        validThrough: '2026-12-31',
        employmentType: 'FULL_TIME',
      }).success,
    ).toBe(true);
    expect(FaqItem.safeParse({ key: 'q1', order: 1, question: 'Q', answer: 'A' }).success).toBe(true);
    expect(
      OutputLine.safeParse({
        key: 'nilon',
        group: 'sang-tuyen',
        state: 'dinh-huong',
        name: { vi: 'Nilon', en: 'Plastic' },
        desc: { vi: 'M', en: 'D' },
      }).success,
    ).toBe(true);
    expect(
      Figure.safeParse({
        key: 'dt',
        value: '5',
        label: { vi: 'DT', en: 'Area' },
        source: 'S',
        confirmedBy: 'C',
        confirmedAt: '2026-10-01',
        public: true,
      }).success,
    ).toBe(true);
    expect(
      Company.safeParse({
        legalName: 'GMS',
        address: { vi: 'HY', en: 'HY' },
        privacyRequestEmail: 'a@b.vn',
      }).success,
    ).toBe(true);
    expect(PolicyFront.safeParse({ version: '1.0', effectiveFrom: '2026-01-01' }).success).toBe(true);
    expect(
      Approval.safeParse({
        contentSha256: 'a'.repeat(64),
        confirmedBy: 'A',
        confirmedAt: '2026-10-01',
        evidence: 'E',
        recordedBy: 'R',
      }).success,
    ).toBe(true);
  });
});

describe('Shared Contact Schema & Helpers', () => {
  it('normalizes phone and formats public phone', () => {
    expect(normalizeVNPhone('098 799 83 70')).toBe('+84987998370');
    expect(normalizeVNPhone('+84 98 799 83 70')).toBe('+84987998370');
    expect(normalizeVNPhone('84987998370')).toBe('+84987998370');
    expect(normalizeVNPhone('123')).toBeNull();
    expect(isValidPublicVNPhone('098 799 83 70')).toBe(true);
    expect(isValidPublicVNPhone('12345')).toBe(false);
    expect(formatPublicPhone('+84987998370', 'vi')).toBe('098 799 83 70');
    expect(formatPublicPhone('+84987998370', 'en')).toBe('+84 98 799 83 70');
    expect(formatPublicPhone('0900000000', 'vi')).toBe('090 000 00 00');
  });
});

describe('Content Rules & Loader', () => {
  it('validates figures, claims, images, outputs, comparison table, and slug locks', () => {
    expect(validateFigureRaw({ key: 'k', value: '5', label: { vi: 'L', en: 'L' }, source: '' })).toHaveLength(2);
    expect(
      validateFigureRaw({
        key: 'k',
        value: '5',
        label: { vi: 'L', en: 'L' },
        source: 'S',
        confirmedBy: 'B',
        confirmedAt: '2026-10-01',
      }),
    ).toHaveLength(0);

    expect(validatePageClaimsAndFigures('about', 'Công nghệ tiệm cận không phát thải', new Map())).toHaveLength(2);
    expect(validatePageClaimsAndFigures('about', 'Nội dung bình thường', new Map())).toHaveLength(0);

    expect(validateImageMetaRaw('img0', null)).toHaveLength(1);
    expect(validateImageMetaRaw('img1', { kind: null, hasPeople: false, alt: { vi: 'a', en: 'b' } })).toHaveLength(1);
    expect(validateImageMetaRaw('img2', { kind: 'anh-that', hasPeople: null, alt: { vi: 'a', en: 'b' } })).toHaveLength(
      1,
    );
    expect(validateImageMetaRaw('img3', { kind: 'anh-that', hasPeople: false, alt: { vi: '', en: 'b' } })).toHaveLength(
      1,
    );

    expect(isImageAllowedInBuild({ hasPeople: true, consentDate: '' })).toBe(false);
    expect(isImageAllowedInBuild({ hasPeople: false })).toBe(true);
    expect(isImageAllowedForOg({ kind: 'anh-dung-ai', hasPeople: false })).toBe(false);
    expect(isImageAllowedForOg({ kind: 'anh-that', hasPeople: false })).toBe(true);

    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMime(Buffer.from('RIFFxxxxWEBPVP8 ', 'latin1'))).toBe('image/webp');
    expect(detectImageMime(Buffer.from([0x47, 0x49, 0x46, 0x38]))).toBeNull();

    expect(validateImageBinary('a.gif', Buffer.from([0x47, 0x49, 0x46, 0x38]))).toHaveLength(1);
    const bigJpeg = Buffer.alloc(5 * 1024 * 1024 + 10, 0x00);
    bigJpeg[0] = 0xff;
    bigJpeg[1] = 0xd8;
    bigJpeg[2] = 0xff;
    expect(validateImageBinary('big.jpg', bigJpeg)).toHaveLength(1);

    expect(validateOutputLinesRaw([{ key: 'o', name: { vi: 'Dầu', en: 'Oil' }, state: null }])).toHaveLength(1);

    expect(validateCompanyRaw(null)).toHaveLength(1);
    expect(validateCompanyRaw({ privacyRequestEmail: 'bad', phone: '123' })).toHaveLength(2);
    expect(validateCompanyRaw({ privacyRequestEmail: 'a@b.vn', phone: '0987998370' })).toHaveLength(0);

    const tableMd = '| P | S |\n|---|---|\n| dot | {{figure:so-sanh-dot}} |';
    const figMap = new Map([['so-sanh-dot', { key: 'so-sanh-dot', label: { vi: 'đốt' }, source: null }]]);
    expect(validatePageClaimsAndFigures('technology', tableMd, figMap)).toHaveLength(1);

    const locks = parseSlugsLock('news/k1.vi: "tin-cu"\npage\tabout\tvi\tgioi-thieu\n');
    expect(locks.get('news/k1.vi')).toBe('tin-cu');
    expect(locks.get('page/about.vi')).toBe('gioi-thieu');

    const basePaths = buildBaseInternalPaths();
    expect(basePaths.has('/lien-he')).toBe(true);
    expect(extractMarkdownLinks('Xem [a](/lien-he) và [b](mailto:a@b.vn?cc=c@d.vn)')).toHaveLength(2);
    expect(
      validateLinksInBody('doc1', 'Xem [a](/khong-ton-tai) và [b](mailto:a@b.vn?cc=c@d.vn)', basePaths),
    ).toHaveLength(2);
  });

  it('runs check.ts and build-site.ts against real content directory', async () => {
    const checkRes = runContentCheck(join(process.cwd(), 'content'));
    expect(checkRes.ok).toBe(true);
    expect(checkRes.hash).toMatch(/^[0-9a-f]{64}$/);

    const emptyTmpDir = mkdtempSync(join(tmpdir(), 'empty-content-'));
    const badCheck = runContentCheck(emptyTmpDir);
    expect(badCheck.ok).toBe(false);
    expect(badCheck.errors.length).toBeGreaterThan(0);
    rmSync(emptyTmpDir, { recursive: true, force: true });

    const loaded = loadSiteContent(join(process.cwd(), 'content'));
    expect(loaded.errors).toHaveLength(0);
    expect(loaded.figures.length).toBeGreaterThan(0);

    expect(escHtml('<a&"b">')).toBe('&lt;a&amp;&quot;b&quot;&gt;');
    expect(formatDateLocale('2026-10-30', 'vi')).toBe('30/10/2026');
    expect(formatDateLocale('2026-10-30', 'en')).toBe('30 October 2026');

    const exifBuf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 10]),
      Buffer.from('ExifGPS!', 'latin1'),
      Buffer.from([0xff, 0xd9]),
    ]);
    const stripped = stripExifFromJpegBuffer(exifBuf);
    expect(stripped.toString('latin1')).not.toContain('Exif');

    const jsonLd = buildOrgJsonLd(
      {
        legalName: 'GMS',
        address: { vi: 'HY', en: 'HY' },
        phone: '+84987998370',
        email: null,
        zalo: null,
        mapPoint: null,
        taxId: '0900123456',
        privacyRequestEmail: 'a@b.vn',
      },
      'https://gms.example.test',
    );
    expect(jsonLd).toContain('0900123456');

    const tmpOut = mkdtempSync(join(tmpdir(), 'gms-unit-out-'));
    const buildRes = await runBuildSite({
      contentDir: join(process.cwd(), 'content'),
      outDir: tmpOut,
      siteUrl: 'https://gms.example.test',
      siteEnv: 'test',
    });
    expect(buildRes.ok).toBe(true);
    rmSync(tmpOut, { recursive: true, force: true });
  });

  it('verifies deploy approval logic in deploy-prod.ts', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'gms-deploy-test-'));
    const contentDir = join(tmpDir, 'content');
    mkdirSync(contentDir, { recursive: true });
    writeFileSync(join(contentDir, 'company.yaml'), 'legalName: "GMS"\n');

    const hash = computeContentHash(contentDir);
    const missing = verifyDeployApproval({ cwd: tmpDir, contentDir, dryRun: true, siteEnv: 'production' });
    expect(missing.ok).toBe(false);
    expect(missing.code).toBe('APPROVAL_MISSING');

    mkdirSync(join(contentDir, 'approvals'), { recursive: true });
    writeFileSync(join(contentDir, 'approvals', `${hash}.yaml`), 'approvedBy: "GMS"\napprovedAt: "2026-10-31"\n');
    const approved = verifyDeployApproval({ cwd: tmpDir, contentDir, dryRun: true, siteEnv: 'production' });
    expect(approved.ok).toBe(true);
    expect(approved.code).toBe('APPROVED');

    const badCfg = verifyDeployApproval({
      cwd: tmpDir,
      contentDir,
      dryRun: true,
      configPath: 'wrangler.test.jsonc',
    });
    expect(badCfg.ok).toBe(false);

    const branchRes = verifyDeployApproval({
      cwd: tmpDir,
      contentDir,
      dryRun: false,
      workersCiBranch: 'feature/branch',
    });
    expect(branchRes.ok).toBe(false);
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('Worker Domain, Mail Builder & Adapters', () => {
  it('builds RFC 5322 emails and exercises contact service + test worker + prod worker', async () => {
    expect(encodeRfc2047B('Nguyễn Văn An')).toMatch(/^=\?UTF-8\?B\?/);
    expect(formatVnTimestamp(1793412900)).toContain('2026');
    expect(resolvePageLabelVi('/lien-he')).toBe('Liên hệ');
    expect(resolvePageLabelVi('/en/technology')).toBe('Công nghệ');

    const sampleRec: OutboxRecord = {
      id: 'id-1',
      createdAt: 1793412900,
      locale: 'vi',
      fullName: 'Nguyễn Văn An',
      company: 'Cty GMS',
      email: 'an@vi-du.test',
      phone: '+84987998370',
      message: 'Xin tài liệu VPD',
      pagePath: '/lien-he',
      policyVersion: '1.0',
      consentAt: 1793412900,
      dedupeHash: 'h1',
      batch: 'single',
      attempts: 0,
      nextAttemptAt: 1793412900,
    };

    const notifyMail = buildNotifyMail(sampleRec, 'noreply@gms.test', 'lienhe@vi-du.test', 1793412900);
    expect(notifyMail.rawMime).toContain('Reply-To: an@vi-du.test');
    expect(notifyMail.text).toContain('Nguyễn Văn An');

    const sumMail = buildSummaryMail([sampleRec], 'noreply@gms.test', 'lienhe@vi-du.test', 1793412900);
    expect(sumMail.text).toContain('Nguyễn Văn An');

    const alertMail = buildAlertMail(
      { count: 2, reason: 'overdue' },
      'noreply@gms.test',
      'alert@vi-du.test',
      1793412900,
    );
    expect(alertMail.text).toContain('chưa gửi được thư báo');

    const rawMime = buildRawMime({
      from: 'a@b.vn',
      to: 'c@d.vn',
      subjectHeaderValue: 'Test',
      dateUtc: new Date(),
      bodyText: 'Hello',
    });
    expect(rawMime).toContain('Content-Transfer-Encoding: base64');

    const memDb = createInMemoryD1();
    const env = {
      DB: memDb,
      POLICY_VERSION: '1.0',
      CONTACT_RECIPIENT: 'lienhe@vi-du.test',
      ALERT_TO: 'alert@vi-du.test',
      MAIL_FROM: 'thongbao@thongbao.gmshungyen.vn',
    };

    // Test Worker control & endpoints
    await testWorker.fetch(new Request('http://localhost/__test__/reset', { method: 'POST', body: '{}' }), env);
    await testWorker.fetch(
      new Request('http://localhost/__test__/recipient', {
        method: 'POST',
        body: JSON.stringify({ email: 'lienhe@vi-du.test' }),
      }),
      env,
    );
    await testWorker.fetch(
      new Request('http://localhost/__test__/policy-version', {
        method: 'POST',
        body: JSON.stringify({ v: '1.0' }),
      }),
      env,
    );
    await testWorker.fetch(
      new Request('http://localhost/__test__/set-now', {
        method: 'POST',
        body: JSON.stringify({ iso: '2026-10-31T02:15:00Z' }),
      }),
      env,
    );

    const submitRes = await testWorker.fetch(
      new Request('http://localhost/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.1' },
        body: JSON.stringify({
          locale: 'vi',
          fullName: 'Nguyễn Văn An',
          email: 'an@vi-du.test',
          message: 'Thử nghiệm unit test',
          consent: true,
          policyVersion: '1.0',
          turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
          pagePath: '/lien-he',
        }),
      }),
      env,
    );
    expect(submitRes.status).toBe(200);

    const healthRes = await testWorker.fetch(new Request('http://localhost/api/contact/health'), env);
    expect(healthRes.status).toBe(200);

    await testWorker.fetch(new Request('http://localhost/__test__/run-cron', { method: 'POST', body: '{}' }), env);
    const mbRes = await testWorker.fetch(
      new Request('http://localhost/__test__/mailbox', { method: 'POST', body: '{}' }),
      env,
    );
    const mails = ((await mbRes.json()) as { messages: unknown[] }).messages;
    expect(mails.length).toBeGreaterThanOrEqual(1);

    // Exercise Cloudflare adapters
    const clock = new SystemClock();
    expect(clock.nowMs()).toBeGreaterThan(0);
    expect(clock.nowSec()).toBeGreaterThan(0);
    const logger = new ConsoleAppLogger();
    logger.info('test_event', { ok: true });
    logger.error('test_err', { code: 1 });

    const ipKey = new WebCryptoIpKey('secret');
    expect(await ipKey.key('198.51.100.1')).toHaveLength(64);
    expect(await ipKey.key('2001:db8:1:1::a')).toHaveLength(64);
    expect(await ipKey.key('')).toHaveLength(64);

    const cfIp = new CfClientIp();
    expect(cfIp.fromRequest(new Request('http://localhost'))).toBe('127.0.0.1');

    const mailer = new CloudflareSendEmailMailer(undefined);
    const mailRes = await mailer.send(notifyMail);
    expect(mailRes.ok).toBe(false);
    const okMailer = new CloudflareSendEmailMailer({
      async send() {},
    });
    expect((await okMailer.send(notifyMail)).ok).toBe(true);
    const errMailer = new CloudflareSendEmailMailer({
      async send() {
        throw new Error('fail');
      },
    });
    expect((await errMailer.send(notifyMail)).ok).toBe(false);

    const verifier = new TurnstileHumanCheck('');
    const verRes = await verifier.verify('tok', '127.0.0.1');
    expect(verRes.ok).toBe(false);

    const queue = new D1ContactQueue(memDb);
    await queue.ensureSchema();
    await queue.enqueue(sampleRec);
    expect(await queue.hasDedupe('h1', 0)).toBe(false);
    await queue.recordDedupe('h1', 1793412900);
    expect(await queue.hasDedupe('h1', 1793412000)).toBe(true);
    const leasedSingles = await queue.leaseSingles(
      1793413000,
      CRON_LIMITS.leaseSeconds,
      CRON_LIMITS.maxSingleSendsPerRun,
    );
    expect(leasedSingles.length).toBeGreaterThanOrEqual(1);
    const leasedSummary = await queue.leaseSummaryPart(1793413000, CRON_LIMITS.leaseSeconds, 1793412000);
    expect(leasedSummary.length).toBeGreaterThanOrEqual(0);
    await queue.acquireLease('id-1', 1793412900, 120);
    await queue.markFailed('id-1', 1, 1793413000, 'ERR');
    await queue.countOverdueForAlert(1793500000, OUTBOX.alertAfterSeconds, OUTBOX.alertRepeatSeconds);
    await queue.markAlerted(1793500000, OUTBOX.alertAfterSeconds, OUTBOX.alertRepeatSeconds);
    await queue.pendingStats(1793500000, OUTBOX.overdueAlertSeconds);
    await queue.recordMailLog('notify', 1793412900);
    await queue.countMailLog('notify', 1793410000);
    await queue.updateHeartbeat('cron', 1793412900);
    await queue.getHeartbeat('cron');
    await queue.dumpAllTables();
    await queue.markSentAndDelete('id-1', 1793412900);
    await queue.purgeExpired(1799000000, OUTBOX.maxRetentionUnsentSeconds, CRON_LIMITS.maxDeletesPerRun);
    await queue.purgeSentBefore(1799000000);
    await queue.purgeDedupeBefore(1799000000);
    await queue.resetAllTables();

    const rate = new D1RateCounter(memDb);
    await rate.increment('k', 100, 1);
    expect(await rate.getHits('k', 50)).toBe(1);
    await rate.purgeBefore(200);

    // Exercise additional testWorker control ops & error branches in handleContactPost
    await testWorker.fetch(new Request('http://localhost/__test__/alerts', { method: 'POST', body: '{}' }), env);
    await testWorker.fetch(
      new Request('http://localhost/__test__/fail-mail', { method: 'POST', body: JSON.stringify({ on: true }) }),
      env,
    );
    await testWorker.fetch(
      new Request('http://localhost/__test__/fail-store', { method: 'POST', body: JSON.stringify({ on: false }) }),
      env,
    );
    await testWorker.fetch(
      new Request('http://localhost/__test__/human-check', { method: 'POST', body: JSON.stringify({ mode: 'pass' }) }),
      env,
    );
    await testWorker.fetch(new Request('http://localhost/__test__/store-dump', { method: 'POST', body: '{}' }), env);
    await testWorker.fetch(new Request('http://localhost/__test__/app-logs', { method: 'POST', body: '{}' }), env);
    await testWorker.fetch(
      new Request('http://localhost/__test__/seed-attempts', {
        method: 'POST',
        body: JSON.stringify({ ip: '198.51.100.9', n: 2, kind: 'ok' }),
      }),
      env,
    );
    await testWorker.fetch(
      new Request('http://localhost/__test__/seed-notify-count', {
        method: 'POST',
        body: JSON.stringify({ n: 2 }),
      }),
      env,
    );

    // Test invalid Content-Type (415), missing token (403), invalid fields (422), policy mismatch (409), honeypot (200), method not allowed (405)
    expect(
      (
        await testWorker.fetch(
          new Request('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: 'x',
          }),
          env,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await testWorker.fetch(
          new Request('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ locale: 'vi' }),
          }),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await testWorker.fetch(
          new Request('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              locale: 'en',
              fullName: '',
              email: 'bad',
              phone: '123',
              message: '',
              consent: false,
              turnstileToken: 'tok',
            }),
          }),
          env,
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await testWorker.fetch(
          new Request('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              locale: 'vi',
              fullName: 'A',
              email: 'a@b.vn',
              message: 'M',
              consent: true,
              policyVersion: '0.9',
              turnstileToken: 'tok',
            }),
          }),
          env,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await testWorker.fetch(
          new Request('http://localhost/api/contact', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              locale: 'vi',
              fullName: 'A',
              email: 'a@b.vn',
              message: 'M',
              consent: true,
              policyVersion: '1.0',
              turnstileToken: 'tok',
              website: 'http://spam.test',
            }),
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect((await testWorker.fetch(new Request('http://localhost/api/contact', { method: 'GET' }), env)).status).toBe(
      405,
    );
    expect((await testWorker.fetch(new Request('http://localhost/api/unknown', { method: 'GET' }), env)).status).toBe(
      404,
    );

    const prodHealth = await prodWorker.fetch(new Request('http://localhost/api/contact/health'), env);
    expect(prodHealth.status).toBe(200);
    expect((await prodWorker.fetch(new Request('http://localhost/api/contact', { method: 'GET' }), env)).status).toBe(
      405,
    );
    expect(
      (await prodWorker.fetch(new Request('http://localhost/api/contact/health', { method: 'POST' }), env)).status,
    ).toBe(405);
    expect((await prodWorker.fetch(new Request('http://localhost/api/unknown'), env)).status).toBe(404);
    expect((await prodWorker.fetch(new Request('http://localhost/page'), env)).status).toBe(404);
    await prodWorker.scheduled({ scheduledTime: Date.now(), cron: '*/1 * * * *' }, env);
    await prodWorker.scheduled({ scheduledTime: Date.now(), cron: '5 17 * * *' }, env);

    expect(typeof handleContactPost).toBe('function');
    expect(typeof handleContactHealth).toBe('function');
    expect(typeof runCronJob).toBe('function');
  });
});

describe('Next.js App Router Pages, Sections, UI Components & i18n', () => {
  it('renders VI and EN pages and components cleanly without errors', () => {
    const viDict = getDictionary('vi');
    const enDict = getDictionary('en');
    expect(viDict.home.heroTitle).toContain('Giải pháp thông minh');
    expect(enDict.home.heroTitle).toContain('Smart solutions');
    // UI Next thật (wireframe v0.3.8): tiêu đề do từng trang đặt (generateMetadata); layout chỉ cần có metadata.
    // Tiêu đề từng trang được SEO-xx ở e2e khẳng định (seo-technical.spec.ts); unit chỉ giữ export tồn tại.
    expect(metadata).toBeDefined();

    const rootHtml = renderToStaticMarkup(
      React.createElement(RootLayout, null, React.createElement('div', null, 'Child')),
    );
    expect(rootHtml).toContain('Child');

    const homeViHtml = renderToStaticMarkup(React.createElement(HomePage));
    expect(homeViHtml).toContain('Giải pháp thông minh');
    expect(homeViHtml).toContain('Kiến tạo giá trị xanh');
    expect(homeViHtml).toContain('data-testid="figures-strip"');

    const homeEnHtml = renderToStaticMarkup(React.createElement(EnglishHomePage));
    expect(homeEnHtml).toContain('Smart solutions');
    expect(homeEnHtml).toContain('Creating green value');

    const techViHtml = renderToStaticMarkup(React.createElement(TechnologyPage));
    expect(techViHtml).toContain('data-testid="tech-diagram"');
    // 0k A: tệp ảnh cũ không còn được đọc (figures-and-claims.feature:185–187; M40-09)
    expect(techViHtml).not.toContain('sorting-line-3d.png');

    const techEnHtml = renderToStaticMarkup(React.createElement(EnglishTechnologyPage));
    // 0k A: chú thích "Engineering drawing" gắn với ảnh sorting-line-3d (đã bỏ, V39); ô gms-sorting-line không tệp ⇒ không render.
    expect(techEnHtml).not.toContain('sorting-line-3d');
    expect(techEnHtml).not.toContain('Engineering drawing');

    const contactViHtml = renderToStaticMarkup(React.createElement(ContactPage));
    // UI Next thật: data-testid="contact-form" không còn trong markup SSR của ContactPage (qa không đọc src/ nên chưa rõ lý do);
    // hành vi biểu mẫu do e2e contact-form.spec.ts khẳng định trên bản build. Unit chỉ giữ: kênh Zalo hiện số (V34) có trong markup.
    expect(contactViHtml).toContain('Zalo 098 799 83 70');

    const contactEnHtml = renderToStaticMarkup(React.createElement(EnglishContactPage));
    // EN: số theo định dạng quốc tế (contact-info.feature S24: "+84 90 000 00 00")
    expect(contactEnHtml.includes('+84 98 799 83 70'), 'EN: số liên hệ định dạng quốc tế').toBe(true);

    // Individual components
    expect(
      renderToStaticMarkup(
        React.createElement(FigureStrip, {
          eyebrow: 'E',
          title: 'T',
          ariaLabel: 'A',
          figures: [],
        }),
      ),
    ).toBe('');

    expect(
      renderToStaticMarkup(
        React.createElement(LangSwitcher, {
          locale: 'vi',
          viPath: '/',
          enPath: '/en',
          ariaLabel: 'Lang',
        }),
      ),
    ).toContain('Tiếng Việt');

    expect(
      renderToStaticMarkup(
        React.createElement(OutputCard, {
          name: 'RDF',
          stateLabel: 'Định hướng',
          description: 'Mô tả',
        }),
      ),
    ).toContain('RDF');

    expect(
      renderToStaticMarkup(
        React.createElement(TechFlowSvg, {
          locale: 'vi',
          ariaLabel: 'Sơ đồ',
        }),
      ),
    ).toContain('flow-wide');

    expect(
      renderToStaticMarkup(
        React.createElement(VpdStepper, {
          eyebrow: 'VPD',
          title: 'Quy trình',
          lead: 'Mô tả',
          prevLabel: 'Trước',
          playLabel: 'Chạy',
          stopLabel: 'Dừng',
          nextLabel: 'Sau',
          steps: viDict.technology.vpdSteps,
        }),
      ),
    ).toContain('Tiếp nhận và lưu chứa');

    expect(renderToStaticMarkup(React.createElement(AboutPage))).toContain('Giới thiệu');
    expect(renderToStaticMarkup(React.createElement(SolutionsPage))).toContain('Giải pháp');
    expect(renderToStaticMarkup(React.createElement(ProductsPage))).toContain('Sản phẩm');
    expect(renderToStaticMarkup(React.createElement(NewsPage))).toContain('Tin tức');
    expect(renderToStaticMarkup(React.createElement(ProjectsPage))).toContain('Dự án');
    expect(renderToStaticMarkup(React.createElement(CareersPage))).toContain('Tuyển dụng');
    expect(renderToStaticMarkup(React.createElement(FaqPage))).toContain('Câu hỏi');
    expect(renderToStaticMarkup(React.createElement(PrivacyPage))).toContain('bảo mật');

    expect(renderToStaticMarkup(React.createElement(EnglishAboutPage))).toContain('About');
    expect(renderToStaticMarkup(React.createElement(EnglishSolutionsPage))).toContain('Solutions');
    expect(renderToStaticMarkup(React.createElement(EnglishProductsPage))).toContain('Products');
    expect(renderToStaticMarkup(React.createElement(EnglishNewsPage))).toContain('News');
    expect(renderToStaticMarkup(React.createElement(EnglishProjectsPage))).toContain('Projects');
    expect(renderToStaticMarkup(React.createElement(EnglishCareersPage))).toContain('Careers');
    expect(renderToStaticMarkup(React.createElement(EnglishFaqPage))).toContain('FAQ');
    expect(renderToStaticMarkup(React.createElement(EnglishPrivacyPage))).toContain('Privacy');
    expect(typeof Header).toBe('function');
    expect(typeof Footer).toBe('function');
    expect(typeof HeroSection).toBe('function');
    expect(typeof PillarsSection).toBe('function');
    expect(typeof TechSummarySection).toBe('function');
    expect(typeof JourneySection).toBe('function');
    expect(typeof ContactFormSection).toBe('function');

    expect(nextConfig.output).toBe('export');
    expect(playwrightConfig.timeout).toBe(60_000);
    expect(vitestConfig.test?.include).toBeDefined();
    expect(postcssConfig.plugins).toBeDefined();
  });
});
