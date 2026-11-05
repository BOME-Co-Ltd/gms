// Op `seed-outbox` của cổng kiểm thử (contracts/test-control.ts, lượt 11): ghi THẲNG dòng outbox cho CC-13/CC-14.
// Chỉ worker/index.test.ts import file này; worker/index.ts (production) không import gì trong worker/testing/**.
import type { z } from 'zod';
import { TestControlOps } from '../../contracts/test-control.ts';
import { encodeBodyB64, notifyBodyText } from '../domain/mail-builder.ts';
import type { D1Database, OutboxRecord } from '../ports.ts';

const INSERT_SQL = `INSERT INTO outbox (
  id, created_at, locale, full_name, company, email, phone, message, page_path, utm_json,
  policy_version, consent_at, dedupe_hash, body_b64, batch, attempts, next_attempt_at,
  lease_until, last_error, alerted_at, sent_at
) VALUES (?, ?, 'vi', ?, NULL, ?, NULL, ?, '/lien-he', NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`;

type SeedRow = z.infer<(typeof TestControlOps)['seed-outbox']>['rows'][number];

const toSec = (iso: string): number => Math.floor(new Date(iso).getTime() / 1000);
const toSecOrNull = (iso: string | undefined): number | null => (iso === undefined ? null : toSec(iso));

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ghi thêm các dòng (không xoá dòng cũ). Mỗi dòng một câu INSERT, 14 tham số cố định; db.batch chạy một giao dịch. */
export async function seedOutbox(db: D1Database, rows: SeedRow[], policyVersion: string): Promise<string[]> {
  const ids: string[] = [];
  const statements = rows.map((row, i) => {
    const id = crypto.randomUUID();
    ids.push(id);
    const createdAt = toSec(row.createdAtIso);
    const fullName = `Seed ${i}`;
    const email = `seed-${i}@vi-du.test`;
    const message = `seed ${i}`;
    // Thiếu bodyB64 ⇒ ĐÚNG hàm dựng khối của POST (contact-service.ts: encodeBodyB64(notifyBodyText(rec)))
    const bodyB64 =
      row.bodyB64 ??
      encodeBodyB64(
        notifyBodyText({
          id,
          createdAt,
          locale: 'vi',
          fullName,
          email,
          message,
          pagePath: '/lien-he',
          policyVersion,
          consentAt: createdAt,
          dedupeHash: '',
          batch: row.batch,
          attempts: row.attempts,
          nextAttemptAt: createdAt,
        } satisfies OutboxRecord),
      );
    return db
      .prepare(INSERT_SQL)
      .bind(
        id,
        createdAt,
        fullName,
        email,
        message,
        policyVersion,
        createdAt,
        randomHex(16),
        bodyB64,
        row.batch,
        row.attempts,
        createdAt,
        toSecOrNull(row.leaseUntilIso),
        toSecOrNull(row.sentAtIso),
      );
  });
  await db.batch(statements);
  return ids;
}

/** Validate thân theo contract (strict, trần dòng, bodyB64) rồi ghi. Sai schema ⇒ 400 BAD_BODY { issues }, không ghi gì. */
export async function runSeedOutbox(
  db: D1Database,
  body: unknown,
  policyVersion: string,
): Promise<{ status: 200; json: { ids: string[] } } | { status: 400; json: { error: 'BAD_BODY'; issues: unknown[] } }> {
  const parsed = TestControlOps['seed-outbox'].safeParse(body);
  if (!parsed.success) return { status: 400, json: { error: 'BAD_BODY', issues: parsed.error.issues } };
  return { status: 200, json: { ids: await seedOutbox(db, parsed.data.rows, policyVersion) } };
}
