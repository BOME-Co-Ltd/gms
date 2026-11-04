export type OutboxRecord = {
  id: string;
  createdAt: number; // epoch seconds
  locale: 'vi' | 'en';
  fullName: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  message: string;
  pagePath: string;
  utmJson?: string | null;
  policyVersion: string;
  consentAt: number; // epoch seconds
  dedupeHash: string;
  /** Khối thân thư base64 (dòng 76 ký tự + CRLF), tính lúc enqueue. Không bao giờ log. */
  bodyB64?: string;
  batch: 'single' | 'summary';
  attempts: number;
  nextAttemptAt: number;
  leaseUntil?: number | null;
  lastError?: string | null;
  alertedAt?: number | null;
  sentAt?: number | null;
};

export interface ContactQueue {
  enqueue(rec: Omit<OutboxRecord, 'attempts' | 'leaseUntil' | 'lastError' | 'alertedAt' | 'sentAt'>): Promise<void>;
  hasDedupe(hash: string, sinceSec: number): Promise<boolean>;
  recordDedupe(hash: string, nowSec: number): Promise<void>;
  dueSingle(nowSec: number): Promise<OutboxRecord[]>;
  dueSummary(nowSec: number): Promise<OutboxRecord[]>;
  acquireLease(id: string, nowSec: number, leaseSec: number): Promise<boolean>;
  markSentAndDelete(id: string, nowSec: number): Promise<void>;
  markFailed(id: string, attempts: number, nextAttemptAt: number, errorCode: string): Promise<void>;
  overdueForAlert(nowSec: number, alertAfterSec: number, alertRepeatSec: number): Promise<OutboxRecord[]>;
  markAlerted(ids: string[], nowSec: number): Promise<void>;
  purgeExpiredUnsent(nowSec: number, maxRetentionSec: number): Promise<number>;
  purgeSentBefore(beforeSec: number): Promise<void>;
  purgeDedupeBefore(beforeSec: number): Promise<void>;
  pendingCount(): Promise<number>;
  oldestPendingAgeSec(nowSec: number): Promise<number>;
  countMailLog(kind: 'notify' | 'summary' | 'alert', sinceSec: number): Promise<number>;
  /** `code` bắt buộc khi kind='alert'; `summaryHour` bắt buộc khi kind='summary' (CHECK của d1-schema.sql). */
  recordMailLog(
    kind: 'notify' | 'summary' | 'alert',
    nowSec: number,
    extra?: { code?: string; summaryHour?: number },
  ): Promise<void>;
  updateHeartbeat(name: string, nowSec: number): Promise<void>;
  getHeartbeat(name: string): Promise<number | null>;
}

export interface RateCounter {
  getHits(key: string, windowStartSec: number): Promise<number>;
  increment(key: string, windowStartSec: number, delta?: number): Promise<number>;
  purgeBefore(beforeSec: number): Promise<void>;
}

export type MailSendInput = {
  kind: 'notify' | 'summary' | 'alert';
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  rawMime: string;
  sentAtIso: string;
};

export type MailSendResult = { ok: true } | { ok: false; temporary: boolean; code: string };

export interface Mailer {
  send(msg: MailSendInput): Promise<MailSendResult>;
}

export interface HumanCheck {
  /** error=true ⇒ siteverify không dùng được (503 HUMAN_CHECK_UNAVAILABLE); ok=false không error ⇒ 403. */
  verify(token: string, ip: string): Promise<{ ok: boolean; error?: boolean; reason?: string }>;
}

export interface Clock {
  nowMs(): number;
  nowSec(): number;
}

export interface ClientIp {
  fromRequest(req: Request): string;
}

export interface IpKey {
  key(ip: string): Promise<string>;
  hmac(input: string): Promise<string>;
}

export interface AppLogger {
  info(code: string, meta?: Record<string, string | number | boolean>): void;
  error(code: string, meta?: Record<string, string | number | boolean>): void;
}

export type WorkerConfig = {
  formEnabled: boolean;
  policyVersion: string;
  siteOrigin: string;
  mailFrom: string;
  alertTo: string;
  contactRecipient: string;
  /** false khi TURNSTILE_SECRET rỗng hoặc là secret thử (api.ts §12) ⇒ 503 FORM_DISABLED. Mặc định true. */
  humanSecretValid?: boolean;
  /** Hostname được phép trong siteverify (= hostname của SITE_ORIGIN). */
  allowedHostnames?: string[];
};

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{ success?: boolean; meta?: { changes?: number }; results?: T[] }>;
  all<T = Record<string, unknown>>(): Promise<{ success?: boolean; results?: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface Fetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry?(): void;
}
