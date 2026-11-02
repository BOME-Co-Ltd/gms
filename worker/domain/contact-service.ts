import {
  CONTACT_HTTP_STATUS,
  CONTACT_LIMITS,
  CONTACT_REQUIRED_MESSAGE,
  HEADER_UNSAFE_CHARS,
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
import { buildAlertMail, buildNotifyMail, buildSummaryMail } from './mail-builder.ts';

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

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
  const ct = (req.headers.get('content-type') ?? '').toLowerCase();
  const isJson = ct.includes('application/json');
  const isForm = ct.includes('application/x-www-form-urlencoded');
  if (!isJson && !isForm) {
    deps.logger.error('UNSUPPORTED_MEDIA_TYPE');
    return jsonResponse({ ok: false, code: 'VALIDATION' }, 415);
  }

  const rawBuffer = await req.arrayBuffer();
  if (rawBuffer.byteLength > CONTACT_LIMITS.bodyBytes) {
    deps.logger.error('PAYLOAD_TOO_LARGE', { bytes: rawBuffer.byteLength });
    return jsonResponse({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, CONTACT_HTTP_STATUS.PAYLOAD_TOO_LARGE);
  }

  // 2. FORM_ENABLED & recipient check
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
  if (isJson) {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      } else {
        return jsonResponse({ ok: false, code: 'VALIDATION' }, 422);
      }
    } catch {
      return jsonResponse({ ok: false, code: 'VALIDATION' }, 422);
    }
  } else {
    const params = new URLSearchParams(rawText);
    for (const [k, v] of params.entries()) {
      body[k] = v;
    }
    if (body.consent === 'true' || body.consent === 'on' || body.consent === '1') {
      body.consent = true;
    }
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
    deps.logger.error('HUMAN_CHECK_ERROR');
    return jsonResponse({ ok: false, code: 'STORE_FAILED' }, 503);
  }
  if (!humanRes.ok) {
    deps.logger.error('HUMAN_CHECK_FAILED');
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
  const dedupeHash = await sha256Hex(contactKey);
  const isDuplicate = await deps.queue.hasDedupe(dedupeHash, nowSec - RATE_LIMITS.dedupeWindowSeconds);
  if (isDuplicate) {
    await deps.rate.increment(okKey, nowSec, 1);
    deps.logger.info('DEDUPE_HIT');
    return jsonResponse({ ok: true }, 200);
  }

  // Check mail caps (30/hour, 45/24h)
  const sentLastHour = await deps.queue.countMailLog('notify', nowSec - 3600);
  const sentLast24h = await deps.queue.countMailLog('notify', nowSec - 24 * 3600);
  const overCap = sentLastHour >= MAIL_CAPS.notifyPerHour || sentLast24h >= MAIL_CAPS.notifyPer24h;
  const batch: 'single' | 'summary' = overCap ? 'summary' : 'single';

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

export async function trySendSingleRecord(rec: OutboxRecord, deps: ContactDeps, nowSec: number): Promise<void> {
  const cfg = deps.config();
  if (!cfg.contactRecipient) return;
  const leased = await deps.queue.acquireLease(rec.id, nowSec, OUTBOX.leaseSeconds);
  if (!leased) return;

  const mail = buildNotifyMail(rec, cfg.mailFrom, cfg.contactRecipient, nowSec);
  const res = await deps.mailer.send(mail);
  if (res.ok) {
    await deps.queue.recordMailLog('notify', nowSec);
    await deps.queue.markSentAndDelete(rec.id, nowSec);
    deps.logger.info('MAIL_NOTIFY_SENT', { id: rec.id });
  } else {
    const nextAttempts = rec.attempts + 1;
    const backoffIdx = Math.min(nextAttempts - 1, OUTBOX.retryBackoffMinutes.length - 1);
    const delaySec = OUTBOX.retryBackoffMinutes[backoffIdx] * 60;
    await deps.queue.markFailed(rec.id, nextAttempts, nowSec + delaySec, res.code);
    deps.logger.error('MAIL_NOTIFY_FAILED', { id: rec.id, attempts: nextAttempts, code: res.code });
  }
}

export async function runCronJob(deps: ContactDeps, nowOverrideSec?: number): Promise<void> {
  const nowSec = nowOverrideSec ?? deps.clock.nowSec();
  const cfg = deps.config();

  await deps.queue.updateHeartbeat('cron', nowSec);

  // 1. Retry due single records
  const dueSingles = await deps.queue.dueSingle(nowSec);
  for (const rec of dueSingles) {
    const sentLastHour = await deps.queue.countMailLog('notify', nowSec - 3600);
    const sentLast24h = await deps.queue.countMailLog('notify', nowSec - 24 * 3600);
    if (sentLastHour >= MAIL_CAPS.notifyPerHour || sentLast24h >= MAIL_CAPS.notifyPer24h) {
      break;
    }
    await trySendSingleRecord(rec, deps, nowSec);
  }

  // 2. Process summary records (at most 1 summary per hour, delivered when window clears or summary due)
  const summaries = await deps.queue.dueSummary(nowSec);
  if (summaries.length > 0 && cfg.contactRecipient) {
    const summarySentLastHour = await deps.queue.countMailLog('summary', nowSec - 3600);
    const oldestCreated = Math.min(...summaries.map((s) => s.createdAt));
    const hourRolledOver = Math.floor(nowSec / 3600) > Math.floor(oldestCreated / 3600);
    const readyToSendSummary =
      summarySentLastHour < MAIL_CAPS.summaryMaxPerHour && (hourRolledOver || nowSec - oldestCreated >= 3600);

    if (readyToSendSummary) {
      const leasedRecords: OutboxRecord[] = [];
      for (const s of summaries) {
        if (await deps.queue.acquireLease(s.id, nowSec, OUTBOX.leaseSeconds)) {
          leasedRecords.push(s);
        }
      }
      if (leasedRecords.length > 0) {
        const mail = buildSummaryMail(leasedRecords, cfg.mailFrom, cfg.contactRecipient, nowSec);
        const res = await deps.mailer.send(mail);
        if (res.ok) {
          await deps.queue.recordMailLog('summary', nowSec);
          for (const s of leasedRecords) {
            await deps.queue.markSentAndDelete(s.id, nowSec);
          }
          deps.logger.info('MAIL_SUMMARY_SENT', { count: leasedRecords.length });
        } else {
          for (const s of leasedRecords) {
            const nextAttempts = s.attempts + 1;
            await deps.queue.markFailed(s.id, nextAttempts, nowSec + 60, res.code);
          }
        }
      }
    }
  }

  // 3. Alert for overdue (> 24h) unsent records (repeat every 24h, no PII)
  const overdue = await deps.queue.overdueForAlert(nowSec, OUTBOX.alertAfterSeconds, OUTBOX.alertRepeatSeconds);
  if (overdue.length > 0 && cfg.alertTo) {
    const alertMail = buildAlertMail({ count: overdue.length, reason: 'overdue' }, cfg.mailFrom, cfg.alertTo, nowSec);
    // Alerts go to technical contact even if user notify mail is failing or we record alert directly
    await deps.mailer.send(alertMail);
    await deps.queue.recordMailLog('alert', nowSec);
    await deps.queue.markAlerted(
      overdue.map((o) => o.id),
      nowSec,
    );
    deps.logger.info('ALERT_OVERDUE_SENT', { count: overdue.length });
  }

  // 4. Purge unsent > 7 days & send alert with count only
  const purgedCount = await deps.queue.purgeExpiredUnsent(nowSec, OUTBOX.maxRetentionUnsentSeconds);
  if (purgedCount > 0 && cfg.alertTo) {
    const alertMail = buildAlertMail(
      { count: purgedCount, reason: 'expired_purged' },
      cfg.mailFrom,
      cfg.alertTo,
      nowSec,
    );
    await deps.mailer.send(alertMail);
    await deps.queue.recordMailLog('alert', nowSec);
    deps.logger.info('ALERT_PURGED_SENT', { count: purgedCount });
  }

  // 5. Purge sent records older than deleteSentWithinSeconds & stale dedupe/rate counters
  await deps.queue.purgeSentBefore(nowSec - OUTBOX.deleteSentWithinSeconds);
  await deps.queue.purgeDedupeBefore(nowSec - RATE_LIMITS.counterTtlSecondsMax);
  await deps.rate.purgeBefore(nowSec - RATE_LIMITS.counterTtlSecondsMax);
}

export async function handleContactHealth(deps: ContactDeps): Promise<Response> {
  const nowSec = deps.clock.nowSec();
  const lastCron = await deps.queue.getHeartbeat('cron');
  const lastCronAgeSec = lastCron !== null ? Math.max(0, nowSec - lastCron) : 0;
  const pending = await deps.queue.pendingCount();
  return jsonResponse({ ok: true, lastCronAgeSec, pending }, 200);
}
