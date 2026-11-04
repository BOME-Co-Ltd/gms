// Hạn gửi để tính "quá hạn 15 phút" (design.md §6 "Tín hiệu khi hỏng âm thầm"; api.ts §3 ContactHealth, §6 OUTBOX):
// `single` = created_at; `summary` = hết giờ tròn + summaryDeliverWithinSecondsAfterHour. Cron cảnh báo
// PENDING_OVERDUE_15M và health.oldestOverdueSec cùng dùng pendingStats nên test cả hai.
// SQLite thật (node:sqlite) qua lớp mỏng D1, cùng khuôn với summary-split.test.ts.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MAIL_ALERT_CODES, MAIL_CAPS, OUTBOX } from '../../contracts/api.ts';
import { D1ContactQueue, D1RateCounter } from '../adapters/cloudflare.ts';
import type { D1Database, D1PreparedStatement, MailSendInput, WorkerConfig } from '../ports.ts';
import { type ContactDeps, handleContactHealth, runCronJob } from './contact-service.ts';
import { encodeBodyB64 } from './mail-builder.ts';

const HOUR = 1793412000; // chia hết 3600 ⇒ đầu giờ tròn
const T0 = HOUR + 300; // liên hệ nhận lúc 5 phút sau đầu giờ
const MIN = 60;

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

// contactRecipient rỗng ⇒ Cron không thử gửi thư báo (đường thư hỏng suốt), bản ghi nằm yên trong outbox.
async function setup() {
  const db = d1(new DatabaseSync(':memory:'));
  const queue = new D1ContactQueue(db);
  await queue.ensureSchema();
  const sent: MailSendInput[] = [];
  const config: WorkerConfig = {
    formEnabled: true,
    policyVersion: '1.0',
    siteOrigin: 'http://localhost',
    mailFrom: 'thongbao@thongbao.gmshungyen.vn',
    alertTo: 'kythuat@gmshungyen.vn',
    contactRecipient: '',
  };
  let now = T0;
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
  const add = (id: string, batch: 'single' | 'summary', createdAt: number) =>
    queue.enqueue({
      id,
      createdAt,
      locale: 'vi',
      fullName: 'Nguyễn Văn An',
      email: 'an@vi-du.test',
      message: 'nội dung',
      pagePath: '/lien-he',
      policyVersion: '1.0',
      consentAt: createdAt,
      dedupeHash: `h-${id}`,
      bodyB64: encodeBodyB64('x'),
      batch,
      nextAttemptAt: createdAt,
    });
  const at = async (sec: number) => {
    now = sec;
    await runCronJob(deps, now);
  };
  const health = async (sec: number) => {
    now = sec;
    return (await handleContactHealth(deps).then((r) => r.json())) as {
      ok: boolean;
      lastCronAgeSec: number;
      pending: number;
      oldestOverdueSec: number;
    };
  };
  // Mã cảnh báo ghi ở mail_log (không nằm trong chữ thư); thư gửi đi phải khớp số dòng log.
  const overdueAlerts = async () => {
    const logged = await queue.countMailLog('alert', 0, { code: MAIL_ALERT_CODES.overdue15m });
    expect(sent.filter((m) => m.kind === 'alert')).toHaveLength(logged);
    return logged;
  };
  return { queue, add, at, health, overdueAlerts };
}

describe('quá hạn gửi 15 phút tính từ created_at với thư riêng (single)', () => {
  it('14 phút: chưa cảnh báo; 16 phút: đúng 1 cảnh báo PENDING_OVERDUE_15M', async () => {
    const s = await setup();
    await s.add('single-1', 'single', T0);

    await s.at(T0 + 14 * MIN);
    expect(await s.overdueAlerts()).toBe(0);

    await s.at(T0 + 16 * MIN);
    expect(await s.overdueAlerts()).toBe(1);

    await s.at(T0 + 17 * MIN); // một thư mỗi đợt hỏng
    expect(await s.overdueAlerts()).toBe(1);
  });

  it('pendingStats: 14 phút overdue=0, 16 phút overdue=1, oldestDueSec = created_at', async () => {
    const s = await setup();
    await s.add('single-1', 'single', T0);
    expect(await s.queue.pendingStats(T0 + 14 * MIN, OUTBOX.overdueAlertSeconds)).toEqual({
      pending: 1,
      oldestDueSec: T0,
      overdue: 0,
    });
    expect(await s.queue.pendingStats(T0 + 16 * MIN, OUTBOX.overdueAlertSeconds)).toEqual({
      pending: 1,
      oldestDueSec: T0,
      overdue: 1,
    });
  });

  it('health.oldestOverdueSec khớp: tuổi tính từ created_at, vượt 900 s chỉ sau 15 phút', async () => {
    const s = await setup();
    await s.add('single-1', 'single', T0);
    expect(await s.health(T0 + 14 * MIN)).toMatchObject({ pending: 1, oldestOverdueSec: 14 * MIN });
    const late = await s.health(T0 + 16 * MIN);
    expect(late.oldestOverdueSec).toBe(16 * MIN);
    expect(late.oldestOverdueSec).toBeGreaterThan(OUTBOX.overdueAlertSeconds);
  });
});

describe('thư tóm tắt (summary) giữ nguyên hạn gửi = hết giờ tròn + 120 s', () => {
  it('chưa quá hạn cho tới 15 phút sau hạn gửi, không phải sau created_at', async () => {
    const s = await setup();
    const due = HOUR + 3600 + MAIL_CAPS.summaryDeliverWithinSecondsAfterHour;
    await s.add('sum-1', 'summary', T0);
    // 30 phút sau created_at nhưng hạn gửi còn ở tương lai ⇒ không quá hạn
    expect((await s.queue.pendingStats(T0 + 30 * MIN, OUTBOX.overdueAlertSeconds)).overdue).toBe(0);
    expect(await s.queue.pendingStats(due + 14 * MIN, OUTBOX.overdueAlertSeconds)).toMatchObject({
      oldestDueSec: due,
      overdue: 0,
    });
    expect((await s.queue.pendingStats(due + 16 * MIN, OUTBOX.overdueAlertSeconds)).overdue).toBe(1);
    expect((await s.health(due - MIN)).oldestOverdueSec).toBe(0);
  });
});

describe('health.ok theo api.ts §3: lastCronAgeSec ≤ cronStaleAlertSeconds VÀ oldestOverdueSec ≤ overdueAlertSeconds', () => {
  it('Cron im: ok đúng tại biên cronStaleAlertSeconds, sai khi vượt 1 s', async () => {
    const s = await setup();
    await s.at(T0); // Cron ghi heartbeat
    const edge = await s.health(T0 + OUTBOX.cronStaleAlertSeconds);
    expect(edge).toMatchObject({ lastCronAgeSec: OUTBOX.cronStaleAlertSeconds, oldestOverdueSec: 0, ok: true });
    const over = await s.health(T0 + OUTBOX.cronStaleAlertSeconds + 1);
    expect(over).toMatchObject({ lastCronAgeSec: OUTBOX.cronStaleAlertSeconds + 1, oldestOverdueSec: 0, ok: false });
  });

  it('bản ghi quá hạn gửi: ok đúng tại biên overdueAlertSeconds, sai khi vượt 1 s (Cron vẫn chạy)', async () => {
    const s = await setup();
    await s.add('single-1', 'single', T0);
    // heartbeat sát thời điểm hỏi để chỉ điều kiện oldestOverdueSec quyết định
    const ask = async (age: number) => {
      await s.at(T0 + age - MIN);
      return s.health(T0 + age);
    };
    expect(await ask(OUTBOX.overdueAlertSeconds)).toMatchObject({
      oldestOverdueSec: OUTBOX.overdueAlertSeconds,
      lastCronAgeSec: MIN,
      ok: true,
    });
    expect(await ask(OUTBOX.overdueAlertSeconds + 1)).toMatchObject({
      oldestOverdueSec: OUTBOX.overdueAlertSeconds + 1,
      ok: false,
    });
  });

  it('khoẻ: Cron mới chạy, không bản ghi chờ ⇒ ok', async () => {
    const s = await setup();
    await s.at(T0);
    expect(await s.health(T0 + MIN)).toMatchObject({ ok: true, pending: 0, oldestOverdueSec: 0 });
  });
});
