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
  /** Lease bằng MỘT `UPDATE … RETURNING` (attempts+1 ngay lúc lấy); chỉ các cột CRON_SELECT_COLUMNS.single. */
  leaseSingles(nowSec: number, leaseSec: number, limit: number): Promise<OutboxRecord[]>;
  /** created_at nhỏ nhất của bản ghi tóm tắt chưa gửi (null nếu không có). */
  oldestSummaryCreatedAt(): Promise<number | null>;
  /** Lease MỘT phần thư tóm tắt của giờ tròn [hourStart, hourStart+3600) (cột CRON_SELECT_COLUMNS.summaryPart). */
  leaseSummaryPart(nowSec: number, leaseSec: number, hourStart: number): Promise<OutboxRecord[]>;
  acquireLease(id: string, nowSec: number, leaseSec: number): Promise<boolean>;
  markSentAndDelete(id: string, nowSec: number): Promise<void>;
  /** Gửi xong cả phần: ghi sent_at rồi xoá, mỗi bước MỘT câu (id qua json_each(?)). */
  markManySentAndDelete(ids: string[], nowSec: number): Promise<void>;
  markFailed(id: string, attempts: number, nextAttemptAt: number, errorCode: string): Promise<void>;
  /** Nhả lease cả phần để lượt Cron sau thử lại (attempts đã tăng lúc lease). */
  releaseLeases(ids: string[], nextAttemptAt: number, errorCode: string): Promise<void>;
  /** Số bản ghi chưa gửi, hạn gửi sớm nhất, số bản ghi quá hạn gửi > overdueSec. Một câu, không PII. */
  pendingStats(
    nowSec: number,
    overdueSec: number,
  ): Promise<{ pending: number; oldestDueSec: number | null; overdue: number }>;
  countOverdueForAlert(nowSec: number, alertAfterSec: number, alertRepeatSec: number): Promise<number>;
  markAlerted(nowSec: number, alertAfterSec: number, alertRepeatSec: number): Promise<void>;
  /** Xoá tối đa `limit` dòng quá hạn lưu; trả số dòng CHƯA gửi bị xoá. */
  purgeExpired(nowSec: number, maxRetentionSec: number, limit: number): Promise<number>;
  purgeSentBefore(beforeSec: number, limit?: number): Promise<void>;
  purgeDedupeBefore(beforeSec: number, limit?: number): Promise<void>;
  /** Số thư báo trong giờ tròn hiện tại (VN) và trong 24 giờ trượt. */
  countNotify(hourStartSec: number, since24hSec: number): Promise<{ hour: number; day: number }>;
  /** Số liên hệ batch 'summary' chưa gửi có created_at trong giờ tròn [hourStart, hourStart + 3600). Chỉ số đếm. */
  countSummaryPending(hourStartSec: number): Promise<number>;
  /** Số dòng mail_log; `code` lọc cho kind='alert', `summaryHour` lọc cho kind='summary'. */
  countMailLog(
    kind: 'notify' | 'summary' | 'alert',
    sinceSec: number,
    filter?: { code?: string; summaryHour?: number },
  ): Promise<number>;
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
  purgeBefore(beforeSec: number, limit?: number): Promise<void>;
}

export type MailSendInput = {
  /** confirm = thư xác nhận gửi khách (chỉ qua SMTP; binding send_email chỉ tới địa chỉ đã xác minh). */
  kind: 'notify' | 'summary' | 'alert' | 'confirm';
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  /** Thân chữ đầy đủ cho kênh SMTP khi `text` bỏ trống phần đã nằm sẵn trong body_b64 (thư tóm tắt). */
  plainText?: string;
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
  /** Gửi thư xác nhận tới email khách sau khi thư báo chủ site đi thành công (CONFIRM_TO_CUSTOMER ≠ "false"). */
  confirmToCustomer?: boolean;
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
