import { CLIENT_IP_HEADER, CRON_LIMITS, MAIL_CAPS, TURNSTILE_SITEVERIFY } from '../../contracts/api.ts';
import { judgeSiteverify } from '../domain/human-check.ts';
import type {
  AppLogger,
  ClientIp,
  Clock,
  ContactQueue,
  D1Database,
  HumanCheck,
  IpKey,
  Mailer,
  MailSendInput,
  MailSendResult,
  OutboxRecord,
  RateCounter,
} from '../ports.ts';

function normalizeIpOrPrefix(ipRaw: string): string {
  const s = ipRaw.trim().toLowerCase();
  if (!s) return '0.0.0.0';
  if (!s.includes(':')) return s; // IPv4
  // Expand IPv6 and take first 4 hextets (/64)
  const parts = s.split('::');
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(':') : [];
  const missing = Math.max(0, 8 - (left.length + right.length));
  const full = [...left, ...Array(missing).fill('0'), ...right].map((h) => h.padStart(4, '0'));
  return `${full.slice(0, 4).join(':')}::/64`;
}

export class WebCryptoIpKey implements IpKey {
  private secret: string;
  constructor(secret: string) {
    this.secret = secret || 'default-local-hmac-key-0123456789abcdef';
  }
  async key(ip: string): Promise<string> {
    return this.hmac(normalizeIpOrPrefix(ip));
  }
  /** HMAC-SHA256 hex của chuỗi bất kỳ (dùng cho dedupe, M37). */
  async hmac(normalized: string): Promise<string> {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(normalized));
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export class CfClientIp implements ClientIp {
  fromRequest(req: Request): string {
    return req.headers.get(CLIENT_IP_HEADER)?.trim() || '127.0.0.1';
  }
}

export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
  nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }
}

export class ConsoleAppLogger implements AppLogger {
  info(code: string, meta?: Record<string, string | number | boolean>): void {
    console.log(JSON.stringify({ level: 'info', code, ...meta }));
  }
  error(code: string, meta?: Record<string, string | number | boolean>): void {
    console.error(JSON.stringify({ level: 'error', code, ...meta }));
  }
}

export class TurnstileHumanCheck implements HumanCheck {
  private secret: string;
  private allowedHostnames: string[];
  constructor(secret: string, allowedHostnames: string[] = []) {
    this.secret = secret;
    this.allowedHostnames = allowedHostnames;
  }
  async verify(token: string, ip: string): Promise<{ ok: boolean; error?: boolean; reason?: string }> {
    if (!this.secret) return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
    try {
      const form = new URLSearchParams();
      form.set('secret', this.secret);
      form.set('response', token);
      if (ip) form.set('remoteip', ip);
      const res = await fetch(TURNSTILE_SITEVERIFY.url, {
        method: TURNSTILE_SITEVERIFY.method,
        body: form,
        signal: AbortSignal.timeout(TURNSTILE_SITEVERIFY.timeoutMs),
      });
      return judgeSiteverify(res.status, await res.text(), this.allowedHostnames);
    } catch {
      return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
    }
  }
}

export class CloudflareSendEmailMailer implements Mailer {
  private binding?: { send(msg: unknown): Promise<void> };
  constructor(binding?: { send(msg: unknown): Promise<void> }) {
    this.binding = binding;
  }
  async send(msg: MailSendInput): Promise<MailSendResult> {
    if (!this.binding) {
      return { ok: false, temporary: true, code: 'MAIL_BINDING_MISSING' };
    }
    try {
      await this.binding.send({
        from: msg.from,
        to: msg.to,
        raw: msg.rawMime,
      });
      return { ok: true };
    } catch {
      return { ok: false, temporary: true, code: 'SEND_EMAIL_FAILED' };
    }
  }
}

type D1Row = Record<string, unknown>;

/** Hàng chỉ có cột CRON_SELECT_COLUMNS: các trường không đọc để rỗng, không bao giờ log. */
function leasedRow(r: D1Row): OutboxRecord {
  const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
  return {
    id: String(r.id),
    createdAt: Number(r.created_at ?? 0),
    locale: 'vi',
    fullName: str(r.full_name) ?? '',
    email: str(r.email),
    message: '',
    pagePath: '',
    policyVersion: '',
    consentAt: 0,
    dedupeHash: '',
    bodyB64: str(r.body_b64) ?? '',
    batch: r.created_at === undefined ? 'single' : 'summary',
    attempts: Number(r.attempts ?? 0),
    nextAttemptAt: 0,
  };
}

export class D1ContactQueue implements ContactQueue {
  private db: D1Database;
  public shouldFailEnqueue = false;

  constructor(db: D1Database) {
    this.db = db;
  }

  async ensureSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        locale TEXT NOT NULL CHECK (locale IN ('vi','en')),
        full_name TEXT NOT NULL,
        company TEXT,
        email TEXT,
        phone TEXT,
        message TEXT NOT NULL,
        page_path TEXT NOT NULL,
        utm_json TEXT,
        policy_version TEXT NOT NULL,
        consent_at INTEGER NOT NULL,
        dedupe_hash TEXT NOT NULL,
        body_b64 TEXT NOT NULL,
        batch TEXT NOT NULL DEFAULT 'single' CHECK (batch IN ('single','summary')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL,
        lease_until INTEGER,
        last_error TEXT,
        alerted_at INTEGER,
        sent_at INTEGER,
        CHECK (email IS NOT NULL OR phone IS NOT NULL)
      )`),
      this.db.prepare('CREATE INDEX IF NOT EXISTS outbox_due ON outbox (sent_at, next_attempt_at)'),
      this.db.prepare('CREATE INDEX IF NOT EXISTS outbox_dedupe ON outbox (dedupe_hash, created_at)'),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS rate_counter (
        key TEXT NOT NULL,
        window_start INTEGER NOT NULL,
        hits INTEGER NOT NULL,
        PRIMARY KEY (key, window_start)
      )`),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS dedupe (
        hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      )`),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS mail_log (
        sent_at INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('notify','summary','alert')),
        code TEXT CHECK ((kind = 'alert') = (code IS NOT NULL)),
        summary_hour INTEGER CHECK ((kind = 'summary') = (summary_hour IS NOT NULL))
      )`),
      this.db.prepare('CREATE INDEX IF NOT EXISTS mail_log_kind_time ON mail_log (kind, sent_at)'),
      this.db.prepare(`CREATE TABLE IF NOT EXISTS heartbeat (
        name TEXT PRIMARY KEY,
        last_at INTEGER NOT NULL
      )`),
    ]);
  }

  async enqueue(
    rec: Omit<OutboxRecord, 'attempts' | 'leaseUntil' | 'lastError' | 'alertedAt' | 'sentAt'>,
  ): Promise<void> {
    if (this.shouldFailEnqueue) {
      throw new Error('D1_STORE_FAILED');
    }
    await this.db
      .prepare(
        `INSERT INTO outbox (
          id, created_at, locale, full_name, company, email, phone, message,
          page_path, utm_json, policy_version, consent_at, dedupe_hash, body_b64, batch, attempts, next_attempt_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        rec.id,
        rec.createdAt,
        rec.locale,
        rec.fullName,
        rec.company ?? null,
        rec.email ?? null,
        rec.phone ?? null,
        rec.message,
        rec.pagePath,
        rec.utmJson ?? null,
        rec.policyVersion,
        rec.consentAt,
        rec.dedupeHash,
        rec.bodyB64 ?? '',
        rec.batch,
        rec.nextAttemptAt,
      )
      .run();
  }

  async hasDedupe(hash: string, sinceSec: number): Promise<boolean> {
    const row = await this.db
      .prepare('SELECT hash FROM dedupe WHERE hash = ? AND created_at >= ? LIMIT 1')
      .bind(hash, sinceSec)
      .first();
    return Boolean(row);
  }

  async recordDedupe(hash: string, nowSec: number): Promise<void> {
    await this.db.prepare('INSERT OR REPLACE INTO dedupe (hash, created_at) VALUES (?, ?)').bind(hash, nowSec).run();
  }

  async leaseSingles(nowSec: number, leaseSec: number, limit: number): Promise<OutboxRecord[]> {
    const res = await this.db
      .prepare(
        `UPDATE outbox SET lease_until = ?, attempts = attempts + 1
         WHERE id IN (
           SELECT id FROM outbox
           WHERE sent_at IS NULL AND batch = 'single' AND next_attempt_at <= ?
             AND (lease_until IS NULL OR lease_until < ?)
           ORDER BY created_at, id LIMIT ?)
         RETURNING id, body_b64, email, full_name, attempts`,
      )
      .bind(nowSec + leaseSec, nowSec, nowSec, limit)
      .all<D1Row>();
    return (res.results ?? []).map(leasedRow);
  }

  async oldestSummaryCreatedAt(): Promise<number | null> {
    const row = await this.db
      .prepare("SELECT MIN(created_at) AS oldest FROM outbox WHERE sent_at IS NULL AND batch = 'summary'")
      .first<{ oldest: number | null }>();
    return row?.oldest === null || row?.oldest === undefined ? null : Number(row.oldest);
  }

  async leaseSummaryPart(nowSec: number, leaseSec: number, hourStart: number): Promise<OutboxRecord[]> {
    // Một câu, 7 tham số cố định (≤ maxBoundParamsCron). Lọc trần số/byte và cô lập đầu hàng attempts ≥ 3 phía D1.
    const res = await this.db
      .prepare(
        `UPDATE outbox SET lease_until = ?, attempts = attempts + 1
         WHERE id IN (
           SELECT id FROM (
             SELECT id,
                    ROW_NUMBER() OVER w AS rn,
                    SUM(length(body_b64)) OVER w AS cum,
                    FIRST_VALUE(attempts) OVER w AS head_attempts
             FROM outbox
             WHERE sent_at IS NULL AND batch = 'summary' AND created_at >= ? AND created_at < ?
               AND (lease_until IS NULL OR lease_until < ?)
             WINDOW w AS (ORDER BY created_at, id))
           WHERE rn = 1 OR (rn <= ? AND cum <= ? AND head_attempts < ?))
         RETURNING id, body_b64, email, created_at, attempts`,
      )
      .bind(
        nowSec + leaseSec,
        hourStart,
        hourStart + 3600,
        nowSec,
        CRON_LIMITS.maxSummaryContacts,
        CRON_LIMITS.maxSummaryPartB64Bytes,
        CRON_LIMITS.summaryHeadAttemptsIsolate,
      )
      .all<D1Row>();
    return (res.results ?? []).map(leasedRow).sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id));
  }

  async acquireLease(id: string, nowSec: number, leaseSec: number): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE outbox SET lease_until = ?, attempts = attempts + 1
         WHERE id = ? AND sent_at IS NULL AND (lease_until IS NULL OR lease_until < ?)`,
      )
      .bind(nowSec + leaseSec, id, nowSec)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }

  async markSentAndDelete(id: string, nowSec: number): Promise<void> {
    await this.db.prepare('UPDATE outbox SET sent_at = ? WHERE id = ?').bind(nowSec, id).run();
    await this.db.prepare('DELETE FROM outbox WHERE id = ?').bind(id).run();
  }

  async markManySentAndDelete(ids: string[], nowSec: number): Promise<void> {
    const json = JSON.stringify(ids);
    await this.db
      .prepare('UPDATE outbox SET sent_at = ? WHERE id IN (SELECT value FROM json_each(?))')
      .bind(nowSec, json)
      .run();
    await this.db.prepare('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))').bind(json).run();
  }

  async releaseLeases(ids: string[], nextAttemptAt: number, errorCode: string): Promise<void> {
    await this.db
      .prepare(
        'UPDATE outbox SET lease_until = NULL, next_attempt_at = ?, last_error = ? WHERE id IN (SELECT value FROM json_each(?))',
      )
      .bind(nextAttemptAt, errorCode, JSON.stringify(ids))
      .run();
  }

  async markFailed(id: string, attempts: number, nextAttemptAt: number, errorCode: string): Promise<void> {
    await this.db
      .prepare('UPDATE outbox SET attempts = ?, next_attempt_at = ?, lease_until = NULL, last_error = ? WHERE id = ?')
      .bind(attempts, nextAttemptAt, errorCode, id)
      .run();
  }

  async pendingStats(
    nowSec: number,
    overdueSec: number,
  ): Promise<{ pending: number; oldestDueSec: number | null; overdue: number }> {
    // Hạn gửi (design.md §6 "Tín hiệu khi hỏng âm thầm"): thư riêng = created_at; thư tóm tắt = hết giờ tròn +
    // summaryDeliver… (giờ tròn VN = UTC+7 là bội số của 3600 ⇒ chia nguyên theo UTC khớp).
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS pending, MIN(due) AS oldest_due, COALESCE(SUM(due <= ?), 0) AS overdue FROM (
           SELECT CASE WHEN batch = 'summary' THEN (created_at / 3600 + 1) * 3600 + ? ELSE created_at END AS due
           FROM outbox WHERE sent_at IS NULL)`,
      )
      .bind(nowSec - overdueSec, MAIL_CAPS.summaryDeliverWithinSecondsAfterHour)
      .first<{ pending: number; oldest_due: number | null; overdue: number }>();
    return {
      pending: Number(row?.pending ?? 0),
      oldestDueSec: row?.oldest_due === null || row?.oldest_due === undefined ? null : Number(row.oldest_due),
      overdue: Number(row?.overdue ?? 0),
    };
  }

  async countOverdueForAlert(nowSec: number, alertAfterSec: number, alertRepeatSec: number): Promise<number> {
    const row = await this.db
      .prepare(
        'SELECT COUNT(*) AS cnt FROM outbox WHERE sent_at IS NULL AND created_at <= ? AND (alerted_at IS NULL OR alerted_at <= ?)',
      )
      .bind(nowSec - alertAfterSec, nowSec - alertRepeatSec)
      .first<{ cnt: number }>();
    return Number(row?.cnt ?? 0);
  }

  async markAlerted(nowSec: number, alertAfterSec: number, alertRepeatSec: number): Promise<void> {
    await this.db
      .prepare(
        'UPDATE outbox SET alerted_at = ? WHERE sent_at IS NULL AND created_at <= ? AND (alerted_at IS NULL OR alerted_at <= ?)',
      )
      .bind(nowSec, nowSec - alertAfterSec, nowSec - alertRepeatSec)
      .run();
  }

  async purgeExpired(nowSec: number, maxRetentionSec: number, limit: number): Promise<number> {
    const res = await this.db
      .prepare('DELETE FROM outbox WHERE id IN (SELECT id FROM outbox WHERE created_at <= ? LIMIT ?) RETURNING sent_at')
      .bind(nowSec - maxRetentionSec, limit)
      .all<{ sent_at: number | null }>();
    return (res.results ?? []).filter((r) => r.sent_at === null || r.sent_at === undefined).length;
  }

  async purgeSentBefore(beforeSec: number, limit: number = CRON_LIMITS.maxDeletesPerRun): Promise<void> {
    await this.db
      .prepare('DELETE FROM outbox WHERE id IN (SELECT id FROM outbox WHERE sent_at IS NOT NULL AND sent_at <= ? LIMIT ?)')
      .bind(beforeSec, limit)
      .run();
  }

  async purgeDedupeBefore(beforeSec: number, limit: number = CRON_LIMITS.maxDeletesPerRun): Promise<void> {
    await this.db
      .prepare('DELETE FROM dedupe WHERE hash IN (SELECT hash FROM dedupe WHERE created_at <= ? LIMIT ?)')
      .bind(beforeSec, limit)
      .run();
  }

  async countNotify(hourStartSec: number, since24hSec: number): Promise<{ hour: number; day: number }> {
    const row = await this.db
      .prepare(
        "SELECT COALESCE(SUM(sent_at >= ?), 0) AS hour, COUNT(*) AS day FROM mail_log WHERE kind = 'notify' AND sent_at >= ?",
      )
      .bind(hourStartSec, since24hSec)
      .first<{ hour: number; day: number }>();
    return { hour: Number(row?.hour ?? 0), day: Number(row?.day ?? 0) };
  }

  async countSummaryPending(hourStartSec: number): Promise<number> {
    const row = await this.db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM outbox WHERE sent_at IS NULL AND batch = 'summary' AND created_at >= ? AND created_at < ?",
      )
      .bind(hourStartSec, hourStartSec + 3600)
      .first<{ cnt: number }>();
    return Number(row?.cnt ?? 0);
  }

  async countMailLog(
    kind: 'notify' | 'summary' | 'alert',
    sinceSec: number,
    filter: { code?: string; summaryHour?: number } = {},
  ): Promise<number> {
    const row = await this.db
      .prepare(
        'SELECT COUNT(*) AS cnt FROM mail_log WHERE kind = ? AND sent_at >= ? AND (? IS NULL OR code = ?) AND (? IS NULL OR summary_hour = ?)',
      )
      .bind(
        kind,
        sinceSec,
        filter.code ?? null,
        filter.code ?? null,
        filter.summaryHour ?? null,
        filter.summaryHour ?? null,
      )
      .first<{ cnt: number }>();
    return Number(row?.cnt ?? 0);
  }

  async recordMailLog(
    kind: 'notify' | 'summary' | 'alert',
    nowSec: number,
    extra: { code?: string; summaryHour?: number } = {},
  ): Promise<void> {
    await this.db
      .prepare('INSERT INTO mail_log (sent_at, kind, code, summary_hour) VALUES (?, ?, ?, ?)')
      .bind(
        nowSec,
        kind,
        kind === 'alert' ? (extra.code ?? 'UNKNOWN') : null,
        kind === 'summary' ? (extra.summaryHour ?? Math.floor(nowSec / 3600) * 3600) : null,
      )
      .run();
  }

  async updateHeartbeat(name: string, nowSec: number): Promise<void> {
    await this.db.prepare('INSERT OR REPLACE INTO heartbeat (name, last_at) VALUES (?, ?)').bind(name, nowSec).run();
  }

  async getHeartbeat(name: string): Promise<number | null> {
    const row = await this.db
      .prepare('SELECT last_at FROM heartbeat WHERE name = ?')
      .bind(name)
      .first<{ last_at: number }>();
    return row ? Number(row.last_at) : null;
  }

  async dumpAllTables(): Promise<string> {
    const [outbox, rate, dedupe, mailLog, hb] = await Promise.all([
      this.db.prepare('SELECT * FROM outbox').all(),
      this.db.prepare('SELECT * FROM rate_counter').all(),
      this.db.prepare('SELECT * FROM dedupe').all(),
      this.db.prepare('SELECT * FROM mail_log').all(),
      this.db.prepare('SELECT * FROM heartbeat').all(),
    ]);
    return JSON.stringify({
      outbox: outbox.results ?? [],
      rate_counter: rate.results ?? [],
      dedupe: dedupe.results ?? [],
      mail_log: mailLog.results ?? [],
      heartbeat: hb.results ?? [],
    });
  }

  async resetAllTables(): Promise<void> {
    await this.ensureSchema();
    await this.db.batch([
      this.db.prepare('DELETE FROM outbox'),
      this.db.prepare('DELETE FROM rate_counter'),
      this.db.prepare('DELETE FROM dedupe'),
      this.db.prepare('DELETE FROM mail_log'),
      this.db.prepare('DELETE FROM heartbeat'),
    ]);
  }
}

export class D1RateCounter implements RateCounter {
  private db: D1Database;
  constructor(db: D1Database) {
    this.db = db;
  }
  async getHits(key: string, windowStartSec: number): Promise<number> {
    const row = await this.db
      .prepare('SELECT COALESCE(SUM(hits), 0) AS total FROM rate_counter WHERE key = ? AND window_start >= ?')
      .bind(key, windowStartSec)
      .first<{ total: number }>();
    return Number(row?.total ?? 0);
  }
  async increment(key: string, windowStartSec: number, delta = 1): Promise<number> {
    await this.db
      .prepare(
        `INSERT INTO rate_counter (key, window_start, hits) VALUES (?, ?, ?)
         ON CONFLICT(key, window_start) DO UPDATE SET hits = hits + excluded.hits`,
      )
      .bind(key, windowStartSec, delta)
      .run();
    return this.getHits(key, windowStartSec);
  }
  async purgeBefore(beforeSec: number, limit: number = CRON_LIMITS.maxDeletesPerRun): Promise<void> {
    await this.db
      .prepare('DELETE FROM rate_counter WHERE rowid IN (SELECT rowid FROM rate_counter WHERE window_start <= ? LIMIT ?)')
      .bind(beforeSec, limit)
      .run();
  }
}
