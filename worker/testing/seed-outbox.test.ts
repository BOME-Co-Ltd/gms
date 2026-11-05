// Op `seed-outbox` (contracts/test-control.ts lượt 11): nhận hợp lệ, 400 theo schema, ids đúng thứ tự, reset xoá outbox,
// và op không lọt vào điểm vào production. SQLite thật (node:sqlite) qua lớp mỏng D1.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { CRON_LIMITS } from '../../contracts/api.ts';
import { BUILD_FORBIDDEN_STRINGS } from '../../contracts/test-control.ts';
import { D1ContactQueue } from '../adapters/cloudflare.ts';
import { decodeBodyB64, encodeBodyB64, notifyBodyText } from '../domain/mail-builder.ts';
import type { D1Database, D1PreparedStatement } from '../ports.ts';
import { runSeedOutbox } from './seed-outbox.ts';

const T0 = '2026-11-05T10:00:00+07:00';
const T0_SEC = Math.floor(new Date(T0).getTime() / 1000);
const MAX_ROWS = CRON_LIMITS.maxSummaryContacts + CRON_LIMITS.maxDeletesPerRun + 1;

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
    // D1 batch là một giao dịch: lỗi giữa chừng thì không dòng nào được ghi
    batch: async (list: D1PreparedStatement[]) => {
      db.exec('BEGIN');
      try {
        for (const s of list) await s.run();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return [];
    },
  };
}

async function setup() {
  const raw = new DatabaseSync(':memory:');
  const db = d1(raw);
  const queue = new D1ContactQueue(db);
  await queue.ensureSchema();
  const outbox = () => raw.prepare('SELECT * FROM outbox ORDER BY rowid').all() as Record<string, unknown>[];
  return { db, queue, outbox };
}

const row = (over: Record<string, unknown> = {}) => ({ batch: 'summary', createdAtIso: T0, ...over });

describe('seed-outbox — nhận hợp lệ', () => {
  it('điền cột mặc định theo contract và trả ids đúng thứ tự rows', async () => {
    const { db, outbox } = await setup();
    const res = await runSeedOutbox(
      db,
      {
        rows: [
          row({ batch: 'single', createdAtIso: '2026-11-05T10:00:00.900+07:00', attempts: 3 }),
          row({ sentAtIso: '2026-11-05T11:00:00+07:00', leaseUntilIso: '2026-11-05T12:00:00+07:00' }),
        ],
      },
      '2.1',
    );
    expect(res.status).toBe(200);
    if (res.status !== 200) return;
    const stored = outbox();
    expect(res.json.ids).toEqual(stored.map((r) => r.id));
    expect(new Set(res.json.ids).size).toBe(2);
    expect(res.json.ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const [a, b] = stored;
    expect(a).toMatchObject({
      created_at: T0_SEC, // làm tròn xuống giây
      next_attempt_at: T0_SEC,
      consent_at: T0_SEC,
      batch: 'single',
      attempts: 3,
      locale: 'vi',
      full_name: 'Seed 0',
      email: 'seed-0@vi-du.test',
      phone: null,
      message: 'seed 0',
      page_path: '/lien-he',
      policy_version: '2.1',
      company: null,
      utm_json: null,
      last_error: null,
      alerted_at: null,
      lease_until: null,
      sent_at: null,
    });
    expect(String(a?.dedupe_hash)).toMatch(/^[0-9a-f]{32}$/);
    expect(a?.dedupe_hash).not.toBe(b?.dedupe_hash);
    expect(b).toMatchObject({
      full_name: 'Seed 1',
      email: 'seed-1@vi-du.test',
      batch: 'summary',
      attempts: 0,
      sent_at: T0_SEC + 3600,
      lease_until: T0_SEC + 7200,
    });
  });

  it('thiếu bodyB64 ⇒ đúng khối của POST (bội 57 byte, giải mã ra thân thư); có bodyB64 ⇒ giữ nguyên', async () => {
    const { db, outbox } = await setup();
    const given = encodeBodyB64('khối do qa đặt');
    await runSeedOutbox(db, { rows: [row(), row({ bodyB64: given })] }, '1.0');
    const [built, kept] = outbox();
    const expected = encodeBodyB64(
      notifyBodyText({
        id: String(built?.id),
        createdAt: T0_SEC,
        locale: 'vi',
        fullName: 'Seed 0',
        email: 'seed-0@vi-du.test',
        message: 'seed 0',
        pagePath: '/lien-he',
        policyVersion: '1.0',
        consentAt: T0_SEC,
        dedupeHash: '',
        batch: 'summary',
        attempts: 0,
        nextAttemptAt: T0_SEC,
      }),
    );
    expect(built?.body_b64).toBe(expected);
    expect(decodeBodyB64(String(built?.body_b64))).toContain('seed 0');
    expect(String(built?.body_b64).replace(/\r\n/g, '').length % 76).toBe(0);
    expect(kept?.body_b64).toBe(given);
  });

  it('chỉ ghi thêm: lần gọi sau không xoá dòng của lần trước', async () => {
    const { db, outbox } = await setup();
    await runSeedOutbox(db, { rows: [row()] }, '1.0');
    await runSeedOutbox(db, { rows: [row(), row()] }, '1.0');
    expect(outbox()).toHaveLength(3);
  });

  it(`nhận đúng trần ${MAX_ROWS} dòng`, async () => {
    const { db, outbox } = await setup();
    const res = await runSeedOutbox(db, { rows: Array.from({ length: MAX_ROWS }, () => row()) }, '1.0');
    expect(MAX_ROWS).toBe(301);
    expect(res.status).toBe(200);
    expect(outbox()).toHaveLength(MAX_ROWS);
  });
});

describe('seed-outbox — 400 BAD_BODY, không ghi gì', () => {
  const cases: [string, unknown][] = [
    [`${MAX_ROWS + 1} dòng (vượt trần)`, { rows: Array.from({ length: MAX_ROWS + 1 }, () => row()) }],
    ['rows rỗng', { rows: [] }],
    ['thiếu rows', {}],
    ['trường lạ trong dòng (.strict)', { rows: [row({ email: 'x@vi-du.test' })] }],
    ['batch ngoài enum', { rows: [row({ batch: 'other' })] }],
    ['createdAtIso không phải ISO có offset', { rows: [row({ createdAtIso: '2026-11-05' })] }],
    ['attempts âm', { rows: [row({ attempts: -1 })] }],
    ['bodyB64 rỗng', { rows: [row({ bodyB64: '' })] }],
    ['bodyB64 có ký tự ngoài base64/CRLF', { rows: [row({ bodyB64: 'abc def' })] }],
    ['bodyB64 quá bodyB64MaxBytes', { rows: [row({ bodyB64: 'A'.repeat(CRON_LIMITS.bodyB64MaxBytes + 1) })] }],
  ];
  it.each(cases)('%s', async (_name, body) => {
    const { db, outbox } = await setup();
    const res = await runSeedOutbox(db, body, '1.0');
    expect(res.status).toBe(400);
    if (res.status !== 400) return;
    expect(res.json.error).toBe('BAD_BODY');
    expect(res.json.issues.length).toBeGreaterThan(0);
    expect(outbox()).toHaveLength(0);
  });

  it('bodyB64 đúng biên bodyB64MaxBytes vẫn nhận', async () => {
    const { db } = await setup();
    const res = await runSeedOutbox(db, { rows: [row({ bodyB64: 'A'.repeat(CRON_LIMITS.bodyB64MaxBytes) })] }, '1.0');
    expect(res.status).toBe(200);
  });
});

describe('seed-outbox — reset và điểm vào production', () => {
  it('reset (resetAllTables) xoá cả dòng do seed-outbox ghi', async () => {
    const { db, queue, outbox } = await setup();
    await runSeedOutbox(db, { rows: [row(), row()] }, '1.0');
    expect(outbox()).toHaveLength(2);
    await queue.resetAllTables();
    expect(outbox()).toHaveLength(0);
    expect(JSON.parse(await queue.dumpAllTables()).outbox).toEqual([]);
  });

  it('ContactQueue production không có phương thức seed', () => {
    const names = Object.getOwnPropertyNames(D1ContactQueue.prototype);
    expect(names.filter((n) => /seed/i.test(n))).toEqual([]);
  });

  it('không file nào đi tới từ worker/index.ts import worker/testing/** hay chứa BUILD_FORBIDDEN_STRINGS', () => {
    const workerDir = resolve(__dirname, '..');
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/from '(\.[^']+)'/g)) {
        const target = resolve(dirname(file), m[1] ?? '');
        if (existsSync(target)) walk(target);
      }
    };
    walk(resolve(workerDir, 'index.ts'));
    expect(seen.size).toBeGreaterThan(3);
    const files = [...seen];
    expect(files.filter((f) => /[\\/]testing[\\/]/.test(f) || /test-control\.ts$/.test(f))).toEqual([]);
    for (const f of files.filter((p) => p.startsWith(workerDir))) {
      const src = readFileSync(f, 'utf8');
      for (const s of BUILD_FORBIDDEN_STRINGS) expect(src.includes(s), `${f} chứa "${s}"`).toBe(false);
    }
  });
});
