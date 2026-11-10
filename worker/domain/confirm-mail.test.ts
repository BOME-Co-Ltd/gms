// Thư xác nhận cho khách + kênh SMTP (11/2026): gửi một lần sau khi thư báo chủ site đi thành công, không chép chữ
// khách nhập, Reply-To = hộp thư chủ site; SMTP nhận đúng from/to/reply; IP khách lấy qua Vercel khi có secret proxy.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { CfClientIp, D1ContactQueue, D1RateCounter, PROXY_SECRET_HEADER } from '../adapters/cloudflare.ts';
import { SmtpMailer, smtpConfigFromEnv } from '../adapters/smtp.ts';
import type { D1Database, D1PreparedStatement, MailSendInput, MailSendResult, WorkerConfig } from '../ports.ts';
import { type ContactDeps, runCronJob } from './contact-service.ts';
import { buildConfirmMail, CONFIRM_SUBJECT, encodeBodyB64 } from './mail-builder.ts';

const T0 = 1793412300;

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

async function setup(opts: { confirm?: boolean; failKinds?: MailSendInput['kind'][]; email?: string | null } = {}) {
  const db = d1(new DatabaseSync(':memory:'));
  const queue = new D1ContactQueue(db);
  await queue.ensureSchema();
  const sent: MailSendInput[] = [];
  const config: WorkerConfig = {
    formEnabled: true,
    policyVersion: '1.0',
    siteOrigin: 'https://gms.bongmedia.vn',
    mailFrom: 'marketing@bongmedia.vn',
    alertTo: 'golliverdesign@gmail.com',
    contactRecipient: 'golliverdesign@gmail.com',
    confirmToCustomer: opts.confirm,
  };
  const deps = {
    queue,
    rate: new D1RateCounter(db),
    mailer: {
      send: async (m: MailSendInput): Promise<MailSendResult> => {
        sent.push(m);
        return opts.failKinds?.includes(m.kind) ? { ok: false, temporary: true, code: 'X' } : { ok: true };
      },
    },
    clock: { nowSec: () => T0, nowMs: () => T0 * 1000 },
    logger: { info: () => {}, error: () => {} },
    config: () => config,
  } as unknown as ContactDeps;
  await queue.enqueue({
    id: 'c1',
    createdAt: T0 - 30,
    locale: 'vi',
    fullName: 'Spam <b>MUA NGAY</b> evil.example',
    email: opts.email === undefined ? 'khach@vi-du.test' : opts.email,
    phone: opts.email === null ? '0912345678' : null,
    message: 'nội dung riêng của khách',
    pagePath: '/lien-he',
    policyVersion: '1.0',
    consentAt: T0 - 30,
    dedupeHash: 'h-c1',
    bodyB64: encodeBodyB64('Họ tên: x\n'),
    batch: 'single',
    nextAttemptAt: T0 - 30,
  });
  return { deps, sent };
}

describe('thư xác nhận cho khách', () => {
  it('gửi sau thư báo chủ site: tới email khách, từ MAIL_FROM, Reply-To chủ site, không chép chữ khách nhập', async () => {
    const { deps, sent } = await setup();
    await runCronJob(deps);
    expect(sent.map((m) => m.kind)).toEqual(['notify', 'confirm']);
    const [notify, confirm] = sent;
    expect(notify).toMatchObject({
      to: 'golliverdesign@gmail.com',
      from: 'marketing@bongmedia.vn',
      replyTo: 'khach@vi-du.test',
    });
    expect(confirm).toMatchObject({
      to: 'khach@vi-du.test',
      from: 'marketing@bongmedia.vn',
      replyTo: 'golliverdesign@gmail.com',
      subject: CONFIRM_SUBJECT,
    });
    expect(confirm.text).toContain('https://gms.bongmedia.vn');
    expect(confirm.text).not.toMatch(/MUA NGAY|evil\.example|nội dung riêng/);
    // Bản ghi đã xoá ⇒ lượt Cron sau không gửi trùng
    await runCronJob(deps);
    expect(sent.filter((m) => m.kind === 'confirm')).toHaveLength(1);
  });

  it('không gửi khi thư báo chủ site lỗi, khi tắt CONFIRM_TO_CUSTOMER, hoặc khách không có email', async () => {
    const failed = await setup({ failKinds: ['notify'] });
    await runCronJob(failed.deps);
    expect(failed.sent.map((m) => m.kind)).toEqual(['notify']);

    const off = await setup({ confirm: false });
    await runCronJob(off.deps);
    expect(off.sent.map((m) => m.kind)).toEqual(['notify']);

    const noEmail = await setup({ email: null });
    await runCronJob(noEmail.deps);
    expect(noEmail.sent.map((m) => m.kind)).toEqual(['notify']);
  });

  it('thư xác nhận lỗi không làm hỏng hàng đợi', async () => {
    const { deps, sent } = await setup({ failKinds: ['confirm'] });
    await expect(runCronJob(deps)).resolves.toBeUndefined();
    expect(sent.map((m) => m.kind)).toEqual(['notify', 'confirm']);
  });

  it('buildConfirmMail dựng MIME có Reply-To', () => {
    const m = buildConfirmMail(
      { id: 'x', email: 'a@b.test' } as never,
      'marketing@bongmedia.vn',
      'golliverdesign@gmail.com',
      'https://gms.bongmedia.vn/',
      T0,
    );
    expect(m.rawMime).toMatch(
      /^From: marketing@bongmedia\.vn\r\nTo: a@b\.test\r\nReply-To: golliverdesign@gmail\.com\r\n/,
    );
  });
});

describe('SMTP (worker-mailer)', () => {
  it('đọc cấu hình từ biến môi trường; thiếu HOST/USER/PASS ⇒ null', () => {
    expect(smtpConfigFromEnv({ SMTP_HOST: 'smtp.zoho.com', SMTP_USER: 'u' })).toBeNull();
    expect(
      smtpConfigFromEnv({ SMTP_HOST: 'smtp.zoho.com', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM_NAME: 'GMS Hưng Yên' }),
    ).toEqual({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      username: 'u',
      password: 'p',
      fromName: 'GMS Hưng Yên',
    });
    expect(smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_PORT: '587' })?.secure).toBe(false);
  });

  it('gửi đúng from/to/reply/subject; thư tóm tắt dùng plainText; lỗi ⇒ tạm thời', async () => {
    const calls: Array<{ server: Record<string, unknown>; mail: Record<string, unknown> }> = [];
    const mailer = new SmtpMailer(
      { host: 'smtp.zoho.com', port: 465, secure: true, username: 'u', password: 'p', fromName: 'GMS Hưng Yên' },
      async (server, mail) => {
        calls.push({ server, mail });
      },
    );
    const res = await mailer.send({
      kind: 'summary',
      from: 'marketing@bongmedia.vn',
      to: 'golliverdesign@gmail.com',
      replyTo: 'khach@vi-du.test',
      subject: 'S',
      text: 'ngắn',
      plainText: 'đầy đủ',
      rawMime: '',
      sentAtIso: '',
    });
    expect(res).toEqual({ ok: true });
    expect(calls[0].server).toMatchObject({ host: 'smtp.zoho.com', port: 465, secure: true, startTls: false });
    expect(calls[0].mail).toEqual({
      from: { name: 'GMS Hưng Yên', email: 'marketing@bongmedia.vn' },
      to: 'golliverdesign@gmail.com',
      reply: 'khach@vi-du.test',
      subject: 'S',
      text: 'đầy đủ',
    });
    const bad = new SmtpMailer({ host: 'h', port: 465, secure: true, username: 'u', password: 'p' }, async () => {
      throw new Error('535 auth');
    });
    expect(
      await bad.send({ kind: 'notify', from: 'a', to: 'b', subject: 's', text: 't', rawMime: '', sentAtIso: '' }),
    ).toEqual({
      ok: false,
      temporary: true,
      code: 'SMTP_SEND_FAILED',
    });
  });
});

describe('IP khách qua Vercel', () => {
  const req = (h: Record<string, string>) => new Request('https://w.example/api/contact', { headers: h });
  it('đúng secret ⇒ phần tử đầu X-Forwarded-For; sai/thiếu ⇒ CF-Connecting-IP', () => {
    const ip = new CfClientIp('s3cret');
    const base = { 'cf-connecting-ip': '76.76.21.1', 'x-forwarded-for': '113.1.2.3, 76.76.21.1' };
    expect(ip.fromRequest(req({ ...base, [PROXY_SECRET_HEADER]: 's3cret' }))).toBe('113.1.2.3');
    expect(ip.fromRequest(req({ ...base, [PROXY_SECRET_HEADER]: 'sai' }))).toBe('76.76.21.1');
    expect(new CfClientIp('').fromRequest(req({ ...base, [PROXY_SECRET_HEADER]: '' }))).toBe('76.76.21.1');
  });
});
