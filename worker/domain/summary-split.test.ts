// Thư tóm tắt tách phần theo số/byte (CRON_LIMITS) + cảnh báo SUMMARY_SPLIT (api.ts §5b, §5d; design.md §6g).
// Chạy trên SQLite thật (node:sqlite) qua lớp mỏng D1 để câu window function của leaseSummaryPart được chạy thật.
// Chạy: `vitest run --root worker` (vitest.config.ts của repo chỉ gom tests/unit/**).
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { CRON_LIMITS, MAIL_ALERT_CODES } from '../../contracts/api.ts';
import { D1ContactQueue, D1RateCounter } from '../adapters/cloudflare.ts';
import type { D1Database, D1PreparedStatement, MailSendInput, WorkerConfig } from '../ports.ts';
import { type ContactDeps, runCronJob } from './contact-service.ts';
import { encodeBodyB64, notifyBodyText } from './mail-builder.ts';

const HOUR = 1793412000; // chia hết 3600 ⇒ đầu giờ tròn
const NAME = 'Nguyễn Văn An';
const EMAIL = 'an@vi-du.test';

function d1(db: DatabaseSync): D1Database {
  const stmt = (sql: string, params: unknown[] = []): D1PreparedStatement => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    run: async () => ({
      success: true,
      meta: { changes: Number(db.prepare(sql).run(...(params as never[])).changes) },
    }),
    all: async <T>() => ({ results: db.prepare(sql).all(...(params as never[])) as T[] }),
    first: async <T>() => (db.prepare(sql).get(...(params as never[])) ?? null) as T | null,
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: D1PreparedStatement[]) => {
      for (const s of list) await s.run();
      return [];
    },
  };
}

async function setup(alertTo = 'kythuat@gmshungyen.vn') {
  const db = d1(new DatabaseSync(':memory:'));
  const queue = new D1ContactQueue(db);
  await queue.ensureSchema();
  const sent: MailSendInput[] = [];
  const config: WorkerConfig = {
    formEnabled: true,
    policyVersion: '1.0',
    siteOrigin: 'http://localhost',
    mailFrom: 'thongbao@thongbao.gmshungyen.vn',
    alertTo,
    contactRecipient: 'lienhe@vi-du.test',
  };
  let now = HOUR + 3660;
  const deps = {
    queue,
    rate: new D1RateCounter(db),
    mailer: {
      send: async (m: MailSendInput) => {
        sent.push(m);
        return { ok: true as const };
      },
    },
    clock: { nowSec: () => now, nowMs: () => now * 1000 },
    logger: { info: () => {}, error: () => {} },
    config: () => config,
  } as unknown as ContactDeps;
  const add = async (i: number, message: string) => {
    await queue.enqueue({
      id: `id-${String(i).padStart(4, '0')}`,
      createdAt: HOUR + 60 + (i % 3000),
      locale: 'vi',
      fullName: NAME,
      email: EMAIL,
      message,
      pagePath: '/lien-he',
      policyVersion: '1.0',
      consentAt: HOUR + 60,
      dedupeHash: `h${i}`,
      bodyB64: encodeBodyB64(
        notifyBodyText({
          fullName: NAME,
          email: EMAIL,
          message,
          locale: 'vi',
          pagePath: '/lien-he',
          policyVersion: '1.0',
          consentAt: HOUR + 60,
        } as never),
      ),
      batch: 'summary',
      nextAttemptAt: HOUR + 60,
    });
  };
  const cron = async (minute: number) => {
    now = HOUR + minute * 60;
    await runCronJob(deps, now);
  };
  return { db, queue, sent, add, cron };
}

const summaries = (sent: MailSendInput[]) => sent.filter((m) => m.kind === 'summary');
const alerts = (sent: MailSendInput[]) => sent.filter((m) => m.kind === 'alert');

describe('thư tóm tắt tách phần', () => {
  it('250 liên hệ trong một giờ ⇒ 3 phần [100,100,50], 3 hàng mail_log, đúng 1 SUMMARY_SPLIT không PII', async () => {
    const s = await setup();
    for (let i = 0; i < 250; i++) await s.add(i, `tóm tắt ${i}`);
    const sizes: number[] = [];
    for (const minute of [61, 62, 63]) {
      await s.cron(minute);
      sizes.push(Number(/Tóm tắt (\d+) liên hệ/.exec(summaries(s.sent).at(-1)?.text ?? '')?.[1]));
    }
    expect(sizes).toEqual([100, 100, 50]);
    expect(summaries(s.sent)).toHaveLength(3);
    expect(await s.queue.countMailLog('summary', HOUR, { summaryHour: HOUR })).toBe(3);

    const split = alerts(s.sent).filter((a) => (a.subject + a.text).includes(MAIL_ALERT_CODES.summaryParts));
    expect(split).toHaveLength(1);
    for (const pii of [NAME, EMAIL, 'id-0'])
      expect(split[0].subject + split[0].text + split[0].rawMime).not.toContain(pii);
    expect(split[0].text).toContain('đã gửi 2 phần, còn 50 liên hệ chờ'); // cảnh báo gửi sau phần 2: 250 − 200
  });

  it('SUMMARY_SPLIT chỉ một lần mỗi giờ: lượt Cron sau phần 3 và phần 4 trống không gửi thêm', async () => {
    const s = await setup();
    for (let i = 0; i < 250; i++) await s.add(i, `m ${i}`);
    for (const minute of [61, 62, 63, 64, 65]) await s.cron(minute);
    expect(summaries(s.sent)).toHaveLength(3);
    expect(alerts(s.sent).filter((a) => a.subject.includes(MAIL_ALERT_CODES.summaryParts))).toHaveLength(1);
    expect(await s.queue.countMailLog('alert', HOUR, { code: MAIL_ALERT_CODES.summaryParts })).toBe(1);
  });

  it('một phần duy nhất (≤ 100 liên hệ, ≤ 384 KiB) ⇒ không có SUMMARY_SPLIT', async () => {
    const s = await setup();
    for (let i = 0; i < 12; i++) await s.add(i, `ít ${i}`);
    await s.cron(61);
    await s.cron(62);
    expect(summaries(s.sent)).toHaveLength(1);
    expect(alerts(s.sent)).toHaveLength(0);
  });

  it('ALERT_TO rỗng ⇒ thư tóm tắt vẫn gửi, không có cảnh báo', async () => {
    const s = await setup('');
    for (let i = 0; i < 150; i++) await s.add(i, `x ${i}`);
    await s.cron(61);
    await s.cron(62);
    expect(summaries(s.sent)).toHaveLength(2);
    expect(alerts(s.sent)).toHaveLength(0);
  });

  it('tách theo byte: phần dừng ở maxSummaryPartB64Bytes dù chưa đủ maxSummaryContacts, mọi liên hệ đi đúng 1 lần', async () => {
    const s = await setup();
    const big = 'ễ'.repeat(5000); // 15 000 byte UTF-8 ⇒ khối ~20 KB, < bodyB64MaxBytes
    const total = 40;
    for (let i = 0; i < total; i++) await s.add(i, `${i} ${big}`);
    const first = await s.queue.leaseSummaryPart(HOUR + 3660, CRON_LIMITS.leaseSeconds, HOUR);
    const bytes = first.reduce((n, r) => n + (r.bodyB64?.length ?? 0), 0);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first.length).toBeLessThan(CRON_LIMITS.maxSummaryContacts);
    expect(first.length).toBeLessThan(total);
    expect(bytes).toBeLessThanOrEqual(CRON_LIMITS.maxSummaryPartB64Bytes);
    const oneBlock = first[0].bodyB64?.length ?? 0;
    expect(bytes + oneBlock, 'thêm một khối nữa sẽ vượt trần').toBeGreaterThan(CRON_LIMITS.maxSummaryPartB64Bytes);

    // Trả lease rồi chạy Cron thật: phủ đủ, không trùng
    await s.queue.releaseLeases(
      first.map((r) => r.id),
      HOUR + 3661,
      'TEST',
    );
    for (let m = 61; m < 70; m++) await s.cron(m);
    const parts = summaries(s.sent);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const delivered = parts.reduce((n, p) => n + Number(/Tóm tắt (\d+) liên hệ/.exec(p.text)?.[1]), 0);
    expect(delivered).toBe(total);
    expect(await s.queue.countSummaryPending(HOUR)).toBe(0);
    expect(alerts(s.sent).filter((a) => a.subject.includes(MAIL_ALERT_CODES.summaryParts))).toHaveLength(1);
  });

  it('16 liên hệ ~4,9 KB (tổng ~107 KB < 384 KiB) ⇒ theo contract là MỘT phần (ghi lại xung đột với CC-09: XQ trong báo cáo)', async () => {
    const s = await setup();
    for (let i = 0; i < 16; i++) await s.add(i, `${i} ${'x'.repeat(4900)}`);
    await s.cron(61);
    await s.cron(62);
    expect(summaries(s.sent)).toHaveLength(1);
  });

  it('liên hệ đơn lẻ cỡ tối đa của một khối vẫn được gửi (phần luôn có ít nhất 1 liên hệ)', async () => {
    const s = await setup();
    await s.add(1, 'ễ'.repeat(5000));
    await s.cron(61);
    expect(summaries(s.sent)).toHaveLength(1);
    expect(alerts(s.sent)).toHaveLength(0);
  });
});
