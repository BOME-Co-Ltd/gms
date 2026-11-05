import {
  CONTACT_CONTENT_TYPES,
  CONTACT_HTTP_STATUS,
  CONTACT_LIMITS,
  CONTACT_REQUIRED_MESSAGE,
  CRON_LIMITS,
  HEADER_UNSAFE_CHARS,
  MAIL_ALERT_CODES,
  MAIL_CAPS,
  OUTBOX,
  RATE_LIMITS,
  WORKER_RESPONSE_HEADERS,
} from '../../contracts/api.ts';
import { normalizeVNPhone } from '../../src/shared/contact/schema.ts';
import type {
  AppLogger,
  ClientIp,
  Clock,
  ContactQueue,
  HumanCheck,
  IpKey,
  Mailer,
  OutboxRecord,
  RateCounter,
  WorkerConfig,
} from '../ports.ts';
import { buildAlertMail, buildNotifyMail, buildSummaryMail, encodeBodyB64, notifyBodyText } from './mail-builder.ts';

export type ContactDeps = {
  queue: ContactQueue;
  rate: RateCounter;
  mailer: Mailer;
  human: HumanCheck;
  clock: Clock;
  clientIp: ClientIp;
  ipKey: IpKey;
  logger: AppLogger;
  config: () => WorkerConfig;
};

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...WORKER_RESPONSE_HEADERS,
      ...extraHeaders,
    },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_LABELS: Record<'vi' | 'en', Record<string, string>> = {
  vi: {
    fullName: 'họ tên',
    company: 'công ty',
    email: 'email',
    phone: 'số điện thoại',
    message: 'nội dung',
  },
  en: {
    fullName: 'full name',
    company: 'company',
    email: 'email',
    phone: 'phone number',
    message: 'message',
  },
};

function rateLimitMessage(locale: 'vi' | 'en'): string {
  return locale === 'en'
    ? 'Too many requests. Please try again later.'
    : 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau.';
}

export async function handleContactPost(req: Request, deps: ContactDeps): Promise<Response> {
  const cfg = deps.config();

  // 1. Content-Type & body size
  const mediaType = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!(CONTACT_CONTENT_TYPES as readonly string[]).includes(mediaType)) {
    deps.logger.error('UNSUPPORTED_MEDIA_TYPE');
    return jsonResponse({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' }, CONTACT_HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE);
  }

  const rawBuffer = await req.arrayBuffer();
  if (rawBuffer.byteLength > CONTACT_LIMITS.bodyBytes) {
    deps.logger.error('PAYLOAD_TOO_LARGE', { bytes: rawBuffer.byteLength });
    return jsonResponse({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, CONTACT_HTTP_STATUS.PAYLOAD_TOO_LARGE);
  }

  // 2. FORM_ENABLED & recipient check
  if (cfg.humanSecretValid === false) {
    deps.logger.error('TURNSTILE_SECRET_INVALID');
    return jsonResponse({ ok: false, code: 'FORM_DISABLED' }, CONTACT_HTTP_STATUS.FORM_DISABLED);
  }
  if (!cfg.formEnabled || !cfg.contactRecipient || cfg.contactRecipient.trim() === '') {
    deps.logger.error('FORM_DISABLED');
    return jsonResponse({ ok: false, code: 'FORM_DISABLED' }, CONTACT_HTTP_STATUS.FORM_DISABLED);
  }

  // 3. Origin check
  const origin = req.headers.get('origin');
  if (origin && cfg.siteOrigin && origin !== cfg.siteOrigin) {
    try {
      const reqUrl = new URL(req.url);
      if (origin !== reqUrl.origin) {
        deps.logger.error('ORIGIN_REJECTED');
        return jsonResponse({ ok: false, code: 'ORIGIN_REJECTED' }, CONTACT_HTTP_STATUS.ORIGIN_REJECTED);
      }
    } catch {
      deps.logger.error('ORIGIN_REJECTED');
      return jsonResponse({ ok: false, code: 'ORIGIN_REJECTED' }, CONTACT_HTTP_STATUS.ORIGIN_REJECTED);
    }
  }

  // 4. Parse body
  const rawText = new TextDecoder('utf-8').decode(rawBuffer);
  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    } else {
      return jsonResponse({ ok: false, code: 'VALIDATION' }, CONTACT_HTTP_STATUS.VALIDATION);
    }
  } catch {
    return jsonResponse({ ok: false, code: 'VALIDATION' }, CONTACT_HTTP_STATUS.VALIDATION);
  }

  const locale: 'vi' | 'en' = body.locale === 'en' ? 'en' : 'vi';
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
  if (!token || token.length > 2048) {
    deps.logger.error('HUMAN_CHECK_MISSING_TOKEN');
    return jsonResponse({ ok: false, code: 'HUMAN_CHECK_FAILED' }, CONTACT_HTTP_STATUS.HUMAN_CHECK_FAILED);
  }

  // 5. Turnstile verify
  const ip = deps.clientIp.fromRequest(req);
  const humanRes = await deps.human.verify(token, ip);
  if (humanRes.error) {
    deps.logger.error(humanRes.reason ?? 'TURNSTILE_UNAVAILABLE');
    return jsonResponse({ ok: false, code: 'HUMAN_CHECK_UNAVAILABLE' }, CONTACT_HTTP_STATUS.HUMAN_CHECK_UNAVAILABLE);
  }
  if (!humanRes.ok) {
    deps.logger.error(humanRes.reason ?? 'HUMAN_CHECK_FAILED');
    return jsonResponse({ ok: false, code: 'HUMAN_CHECK_FAILED' }, CONTACT_HTTP_STATUS.HUMAN_CHECK_FAILED);
  }

  // 6. RateCounter attempts (20 / 600s)
  const nowSec = deps.clock.nowSec();
  const ipHmac = await deps.ipKey.key(ip);
  const windowSec = RATE_LIMITS.contactAttemptsPerIp.windowSeconds;
  const windowStart = nowSec - windowSec;
  const tryKey = `try:${ipHmac}`;
  const currentTries = await deps.rate.getHits(tryKey, windowStart);
  if (currentTries >= RATE_LIMITS.contactAttemptsPerIp.max) {
    deps.logger.error('RATE_LIMITED_ATTEMPTS');
    return jsonResponse(
      {
        ok: false,
        code: 'RATE_LIMITED',
        retryAfterSeconds: windowSec,
        message: rateLimitMessage(locale),
      },
      CONTACT_HTTP_STATUS.RATE_LIMITED,
      { 'Retry-After': String(windowSec) },
    );
  }
  await deps.rate.increment(tryKey, nowSec, 1);

  // 7. Honeypot (`website`)
  const website = typeof body.website === 'string' ? body.website : '';
  if (website.length > 0) {
    deps.logger.info('HONEYPOT_TRIGGERED');
    return jsonResponse({ ok: true }, 200);
  }

  // 8. Validate fields
  const fields: Record<string, string> = {};
  const rawName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const rawCompany = typeof body.company === 'string' ? body.company.trim() : '';
  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
  const consent = body.consent === true;
  const policyVersion = typeof body.policyVersion === 'string' ? body.policyVersion.trim() : '';
  const pagePath =
    typeof body.pagePath === 'string' && body.pagePath.startsWith('/') ? body.pagePath.slice(0, 512) : '/';

  if (!rawName) {
    fields.fullName = locale === 'en' ? 'REQUIRED: Please enter your full name.' : 'REQUIRED: Vui lòng nhập họ và tên.';
  } else if ([...rawName].length > CONTACT_LIMITS.fullName) {
    fields.fullName =
      locale === 'en'
        ? `TOO_LONG: ${FIELD_LABELS.en.fullName} is too long.`
        : `TOO_LONG: Trường ${FIELD_LABELS.vi.fullName} quá dài (tối đa ${CONTACT_LIMITS.fullName} ký tự).`;
  } else if (HEADER_UNSAFE_CHARS.test(rawName)) {
    fields.fullName = 'INVALID_CHARS';
  }

  if (rawCompany) {
    if ([...rawCompany].length > CONTACT_LIMITS.company) {
      fields.company =
        locale === 'en'
          ? `TOO_LONG: ${FIELD_LABELS.en.company} is too long.`
          : `TOO_LONG: Trường ${FIELD_LABELS.vi.company} quá dài (tối đa ${CONTACT_LIMITS.company} ký tự).`;
    } else if (HEADER_UNSAFE_CHARS.test(rawCompany)) {
      fields.company = 'INVALID_CHARS';
    }
  }

  if (!rawEmail && !rawPhone) {
    fields.email = CONTACT_REQUIRED_MESSAGE[locale];
    fields.phone = CONTACT_REQUIRED_MESSAGE[locale];
  } else {
    if (rawEmail) {
      if (rawEmail.length > CONTACT_LIMITS.email) {
        fields.email =
          locale === 'en'
            ? `TOO_LONG: ${FIELD_LABELS.en.email} is too long.`
            : `TOO_LONG: Trường ${FIELD_LABELS.vi.email} quá dài (tối đa ${CONTACT_LIMITS.email} ký tự).`;
      } else if (!EMAIL_RE.test(rawEmail) || HEADER_UNSAFE_CHARS.test(rawEmail)) {
        fields.email =
          locale === 'en' ? "INVALID_EMAIL: That email doesn't look right." : 'INVALID_EMAIL: Email chưa đúng dạng.';
      }
    }
    if (rawPhone) {
      if (rawPhone.length > CONTACT_LIMITS.phone) {
        fields.phone =
          locale === 'en'
            ? `TOO_LONG: ${FIELD_LABELS.en.phone} is too long.`
            : `TOO_LONG: Trường ${FIELD_LABELS.vi.phone} quá dài (tối đa ${CONTACT_LIMITS.phone} ký tự).`;
      } else if (!normalizeVNPhone(rawPhone)) {
        fields.phone =
          locale === 'en'
            ? "INVALID_PHONE: That phone number doesn't look right."
            : 'INVALID_PHONE: Số điện thoại chưa đúng.';
      }
    }
  }

  if (!rawMessage) {
    fields.message = locale === 'en' ? 'REQUIRED: Please enter your message.' : 'REQUIRED: Vui lòng nhập nội dung.';
  } else if ([...rawMessage].length > CONTACT_LIMITS.message) {
    fields.message =
      locale === 'en'
        ? `TOO_LONG: ${FIELD_LABELS.en.message} is too long.`
        : `TOO_LONG: Trường ${FIELD_LABELS.vi.message} quá dài (tối đa ${CONTACT_LIMITS.message} ký tự).`;
  }

  if (!consent) {
    fields.consent =
      locale === 'en'
        ? 'CONSENT_REQUIRED: Please agree to the processing of your details.'
        : 'CONSENT_REQUIRED: Vui lòng đồng ý với việc xử lý thông tin.';
  }

  if (Object.keys(fields).length > 0) {
    deps.logger.error('VALIDATION_FAILED', { fieldCount: Object.keys(fields).length });
    return jsonResponse({ ok: false, code: 'VALIDATION', fields }, CONTACT_HTTP_STATUS.VALIDATION);
  }

  // 9. Policy version check
  if (policyVersion !== cfg.policyVersion) {
    deps.logger.error('POLICY_CHANGED');
    return jsonResponse(
      { ok: false, code: 'POLICY_CHANGED', policyVersion: cfg.policyVersion },
      CONTACT_HTTP_STATUS.POLICY_CHANGED,
    );
  }

  // 10. RateCounter success per IP (5 / 600s)
  const okKey = `ok:${ipHmac}`;
  const currentOk = await deps.rate.getHits(okKey, windowStart);
  if (currentOk >= RATE_LIMITS.contactSuccessPerIp.max) {
    deps.logger.error('RATE_LIMITED_SUCCESS');
    return jsonResponse(
      {
        ok: false,
        code: 'RATE_LIMITED',
        retryAfterSeconds: windowSec,
        message: rateLimitMessage(locale),
      },
      CONTACT_HTTP_STATUS.RATE_LIMITED,
      { 'Retry-After': String(windowSec) },
    );
  }

  // 11. Dedupe 10 minutes
  const normalizedEmail = rawEmail ? rawEmail.toLowerCase() : null;
  const normalizedPhone = rawPhone ? normalizeVNPhone(rawPhone) : null;
  const contactKey = `${normalizedEmail ?? ''}|${normalizedPhone ?? ''}|${rawMessage.replace(/\s+/g, ' ').trim()}`;
  const dedupeHash = await deps.ipKey.hmac(contactKey);
  const isDuplicate = await deps.queue.hasDedupe(dedupeHash, nowSec - RATE_LIMITS.dedupeWindowSeconds);
  if (isDuplicate) {
    await deps.rate.increment(okKey, nowSec, 1);
    deps.logger.info('DEDUPE_HIT');
    return jsonResponse({ ok: true }, 200);
  }

  // Trần thư báo: notifyPerHour theo giờ tròn VN, notifyPer24h theo 24 giờ trượt (api.ts §5)
  const batch: 'single' | 'summary' = (await notifyRoom(deps, nowSec)) > 0 ? 'single' : 'summary';

  const id = crypto.randomUUID();
  const utmJson = body.utm && typeof body.utm === 'object' ? JSON.stringify(body.utm) : null;

  const rec: OutboxRecord = {
    id,
    createdAt: nowSec,
    locale,
    fullName: rawName,
    company: rawCompany || null,
    email: normalizedEmail,
    phone: normalizedPhone,
    message: rawMessage,
    pagePath,
    utmJson,
    policyVersion,
    consentAt: nowSec,
    dedupeHash,
    batch,
    attempts: 0,
    nextAttemptAt: nowSec,
  };
  rec.bodyB64 = encodeBodyB64(notifyBodyText(rec));
  if (rec.bodyB64.length > CRON_LIMITS.bodyB64MaxBytes) {
    return jsonResponse({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, CONTACT_HTTP_STATUS.PAYLOAD_TOO_LARGE);
  }

  // 12. Enqueue into D1
  try {
    await deps.queue.enqueue(rec);
    await deps.queue.recordDedupe(dedupeHash, nowSec);
    await deps.rate.increment(okKey, nowSec, 1);
  } catch {
    deps.logger.error('STORE_FAILED');
    return jsonResponse({ ok: false, code: 'STORE_FAILED' }, CONTACT_HTTP_STATUS.STORE_FAILED);
  }

  // 13. Immediate attempt if single batch
  if (batch === 'single') {
    await trySendSingleRecord(rec, deps, nowSec);
  }

  deps.logger.info('CONTACT_ACCEPTED', { id, batch });
  return jsonResponse({ ok: true }, 200);
}

/** Số thư báo còn được gửi ngay: min(trần giờ tròn VN, trần 24 giờ trượt). Một câu D1. */
async function notifyRoom(deps: ContactDeps, nowSec: number): Promise<number> {
  const hourStart = Math.floor(nowSec / 3600) * 3600; // múi VN = UTC+7 nguyên giờ ⇒ giờ tròn VN trùng giờ tròn UTC
  const used = await deps.queue.countNotify(hourStart, nowSec - 24 * 3600);
  return Math.max(0, Math.min(MAIL_CAPS.notifyPerHour - used.hour, MAIL_CAPS.notifyPer24h - used.day));
}

/** Gửi một thư báo đã giữ lease (attempts đã +1 lúc lease). Không log nội dung, chỉ id + mã. */
async function sendLeasedSingle(rec: OutboxRecord, deps: ContactDeps, nowSec: number): Promise<void> {
  const cfg = deps.config();
  const res = await deps.mailer.send(buildNotifyMail(rec, cfg.mailFrom, cfg.contactRecipient, nowSec));
  if (res.ok) {
    await deps.queue.recordMailLog('notify', nowSec);
    await deps.queue.markSentAndDelete(rec.id, nowSec);
    deps.logger.info('MAIL_NOTIFY_SENT', { id: rec.id });
  } else {
    const backoffIdx = Math.min(Math.max(rec.attempts, 1) - 1, OUTBOX.retryBackoffMinutes.length - 1);
    const delaySec = OUTBOX.retryBackoffMinutes[backoffIdx] * 60;
    await deps.queue.markFailed(rec.id, rec.attempts, nowSec + delaySec, res.code);
    deps.logger.error('MAIL_NOTIFY_FAILED', { id: rec.id, attempts: rec.attempts, code: res.code });
  }
}

export async function trySendSingleRecord(rec: OutboxRecord, deps: ContactDeps, nowSec: number): Promise<void> {
  if (!deps.config().contactRecipient) return;
  const leased = await deps.queue.acquireLease(rec.id, nowSec, OUTBOX.leaseSeconds);
  if (!leased) return;
  await sendLeasedSingle({ ...rec, attempts: rec.attempts + 1 }, deps, nowSec);
}

async function sendSummaryPart(deps: ContactDeps, nowSec: number): Promise<void> {
  const cfg = deps.config();
  const oldest = await deps.queue.oldestSummaryCreatedAt();
  if (oldest === null) return;
  const hourStart = Math.floor(oldest / 3600) * 3600;
  if (nowSec < hourStart + 3600) return; // chỉ gửi giờ tròn ĐÃ HẾT
  const part = await deps.queue.leaseSummaryPart(nowSec, CRON_LIMITS.leaseSeconds, hourStart);
  if (part.length === 0) return;
  const k = (await deps.queue.countMailLog('summary', hourStart, { summaryHour: hourStart })) + 1;
  const res = await deps.mailer.send(
    buildSummaryMail(part, cfg.mailFrom, cfg.contactRecipient, nowSec, { hourStart, part: k }),
  );
  const ids = part.map((r) => r.id);
  if (!res.ok) {
    await deps.queue.releaseLeases(ids, nowSec + 60, res.code);
    deps.logger.error('MAIL_SUMMARY_FAILED', { count: ids.length, code: res.code });
    return;
  }
  await deps.queue.recordMailLog('summary', nowSec, { summaryHour: hourStart });
  await deps.queue.markManySentAndDelete(ids, nowSec);
  deps.logger.info('MAIL_SUMMARY_SENT', { count: ids.length, part: k });
  if (k === 2 && cfg.alertTo) {
    // Phần thứ 2 của một giờ ⇒ MỘT cảnh báo không PII (api.ts MAIL_ALERT_CODES.summaryParts)
    const remaining = await deps.queue.countSummaryPending(hourStart);
    await deps.mailer.send(
      buildAlertMail({ count: remaining, parts: k, reason: 'summary_split' }, cfg.mailFrom, cfg.alertTo, nowSec),
    );
    await deps.queue.recordMailLog('alert', nowSec, { code: MAIL_ALERT_CODES.summaryParts });
  }
}

export async function runCronJob(deps: ContactDeps, nowOverrideSec?: number): Promise<void> {
  const nowSec = nowOverrideSec ?? deps.clock.nowSec();
  const cfg = deps.config();

  await deps.queue.updateHeartbeat('cron', nowSec);

  if (cfg.contactRecipient) {
    // 1. Thư báo tới hạn gửi lại: tối đa maxSingleSendsPerRun, không vượt trần giờ/24 giờ
    const room = Math.min(CRON_LIMITS.maxSingleSendsPerRun, await notifyRoom(deps, nowSec));
    if (room > 0) {
      for (const rec of await deps.queue.leaseSingles(nowSec, CRON_LIMITS.leaseSeconds, room)) {
        await sendLeasedSingle(rec, deps, nowSec);
      }
    }
    // 2a. Thư tóm tắt của giờ tròn đã hết (một phần mỗi lượt)
    await sendSummaryPart(deps, nowSec);
  }

  // 2b. Chờ gửi quá hạn 15 phút: MỘT thư mỗi đợt hỏng, không quá một thư trong giờ tròn hiện tại
  const stats = await deps.queue.pendingStats(nowSec, OUTBOX.overdueAlertSeconds);
  if (stats.overdue > 0 && stats.oldestDueSec !== null && cfg.alertTo) {
    const hourStart = Math.floor(nowSec / 3600) * 3600;
    const since = Math.min(stats.oldestDueSec, hourStart);
    if ((await deps.queue.countMailLog('alert', since, { code: MAIL_ALERT_CODES.overdue15m })) === 0) {
      await deps.mailer.send(
        buildAlertMail({ count: stats.overdue, reason: 'overdue_15m' }, cfg.mailFrom, cfg.alertTo, nowSec),
      );
      await deps.queue.recordMailLog('alert', nowSec, { code: MAIL_ALERT_CODES.overdue15m });
      deps.logger.info('ALERT_PENDING_15M_SENT', { count: stats.overdue });
    }
  }

  // 3. Quá 24 giờ chưa gửi: cảnh báo không PII, lặp theo alertRepeatSeconds
  const overdue = await deps.queue.countOverdueForAlert(nowSec, OUTBOX.alertAfterSeconds, OUTBOX.alertRepeatSeconds);
  if (overdue > 0 && cfg.alertTo) {
    await deps.mailer.send(buildAlertMail({ count: overdue, reason: 'overdue' }, cfg.mailFrom, cfg.alertTo, nowSec));
    await deps.queue.recordMailLog('alert', nowSec, { code: MAIL_ALERT_CODES.overdue24h });
    await deps.queue.markAlerted(nowSec, OUTBOX.alertAfterSeconds, OUTBOX.alertRepeatSeconds);
    deps.logger.info('ALERT_OVERDUE_SENT', { count: overdue });
  }

  // 4. Quá 7 ngày: xoá (tối đa maxDeletesPerRun) + MỘT cảnh báo chỉ nêu số lượng chưa gửi đã xoá
  const purgedCount = await deps.queue.purgeExpired(
    nowSec,
    OUTBOX.maxRetentionUnsentSeconds,
    CRON_LIMITS.maxDeletesPerRun,
  );
  if (purgedCount > 0 && cfg.alertTo) {
    await deps.mailer.send(
      buildAlertMail({ count: purgedCount, reason: 'expired_purged' }, cfg.mailFrom, cfg.alertTo, nowSec),
    );
    await deps.queue.recordMailLog('alert', nowSec, { code: MAIL_ALERT_CODES.expired7d });
    deps.logger.info('ALERT_PURGED_SENT', { count: purgedCount });
  }

  // 5. Dọn dòng đã gửi, dedupe, bộ đếm hết hạn: mỗi bảng một câu có LIMIT
  const cap = CRON_LIMITS.maxDeletesPerRun;
  await deps.queue.purgeSentBefore(nowSec - OUTBOX.deleteSentWithinSeconds, cap);
  await deps.queue.purgeDedupeBefore(nowSec - RATE_LIMITS.counterTtlSecondsMax, cap);
  await deps.rate.purgeBefore(nowSec - RATE_LIMITS.counterTtlSecondsMax, cap);
}

export async function handleContactHealth(deps: ContactDeps): Promise<Response> {
  const nowSec = deps.clock.nowSec();
  const lastCron = await deps.queue.getHeartbeat('cron');
  const lastCronAgeSec = lastCron !== null ? Math.max(0, nowSec - lastCron) : 0;
  const stats = await deps.queue.pendingStats(nowSec, OUTBOX.overdueAlertSeconds);
  // oldestOverdueSec đo từ HẠN GỬI (không từ created_at): 0 khi chưa bản ghi nào quá hạn gửi
  const oldestOverdueSec = stats.oldestDueSec === null ? 0 : Math.max(0, nowSec - stats.oldestDueSec);
  // api.ts ContactHealth: ok sai khi Cron im quá cronStaleAlertSeconds HOẶC quá hạn gửi quá overdueAlertSeconds
  const ok = lastCronAgeSec <= OUTBOX.cronStaleAlertSeconds && oldestOverdueSec <= OUTBOX.overdueAlertSeconds;
  return jsonResponse({ ok, lastCronAgeSec, pending: stats.pending, oldestOverdueSec }, 200);
}
