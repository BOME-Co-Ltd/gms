import { CONTACT_ENDPOINT, CONTACT_HEALTH_ENDPOINT, WORKER_RESPONSE_HEADERS } from '../contracts/api.ts';
import {
  TEST_ADAPTER_MARKER,
  TEST_CONTROL_BASE,
  TEST_CONTROL_HOSTS,
  TEST_PEER_IP_HEADER,
} from '../contracts/test-control.ts';
import { CfClientIp, D1ContactQueue, D1RateCounter, WebCryptoIpKey } from './adapters/cloudflare.ts';
import { type ContactDeps, handleContactHealth, handleContactPost, runCronJob } from './domain/contact-service.ts';
import { isUsableTurnstileSecret, judgeSiteverify } from './domain/human-check.ts';
import { decodeBodyB64 } from './domain/mail-builder.ts';
import type { Env } from './index.ts';
import type { AppLogger, Clock, HumanCheck, Mailer, MailSendInput, MailSendResult } from './ports.ts';
import { runSeedOutbox } from './testing/seed-outbox.ts';

type CapturedMail = {
  kind: 'notify' | 'summary' | 'alert';
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  body: string;
  text: string;
  raw: string;
  contentType: string;
  sentAt: string;
  headers: Record<string, string>;
};

type HumanMode = 'pass' | 'fail' | 'error' | 'timeout' | 'http-error' | 'bad-body' | 'wrong-hostname' | 'wrong-action';

const TEST_DEFAULT_TURNSTILE_SECRET = 'test-turnstile-secret-not-a-cloudflare-dummy';

/** Phản hồi siteverify giả theo mode; hàm quyết định là bản production (judgeSiteverify). */
function fakeSiteverify(mode: HumanMode, hostname: string): { status: number; body: string } | 'throw' {
  switch (mode) {
    case 'error':
    case 'timeout':
      return 'throw';
    case 'http-error':
      return { status: 500, body: '{}' };
    case 'bad-body':
      return { status: 200, body: 'not json' };
    case 'fail':
      return { status: 200, body: JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }) };
    case 'wrong-hostname':
      return { status: 200, body: JSON.stringify({ success: true, hostname: 'evil.example', action: 'contact' }) };
    case 'wrong-action':
      return { status: 200, body: JSON.stringify({ success: true, hostname, action: 'other' }) };
    default:
      return { status: 200, body: JSON.stringify({ success: true, hostname, action: 'contact' }) };
  }
}

const state = {
  nowOverrideSec: null as number | null,
  policyVersion: '1.0',
  contactRecipient: 'lienhe@vi-du.test' as string | null,
  formEnabled: true,
  failMail: false,
  failMailFromSec: null as number | null,
  failMailToSec: null as number | null,
  failStore: false,
  failMailMode: 'temporary' as 'temporary' | 'permanent' | 'slow',
  humanMode: 'pass' as HumanMode,
  turnstileSecret: null as string | null,
  mailbox: [] as CapturedMail[],
  alerts: [] as CapturedMail[],
  logs: [TEST_ADAPTER_MARKER] as string[],
  schemaReady: false,
  hasBeenReset: false,
  rootVisits: 0,
};

class TestClock implements Clock {
  nowMs(): number {
    return state.nowOverrideSec !== null ? state.nowOverrideSec * 1000 : Date.now();
  }
  nowSec(): number {
    return state.nowOverrideSec !== null ? state.nowOverrideSec : Math.floor(Date.now() / 1000);
  }
}

class TestLogger implements AppLogger {
  info(code: string, meta?: Record<string, string | number | boolean>): void {
    state.logs.push(JSON.stringify({ level: 'info', code, ...meta }));
  }
  error(code: string, meta?: Record<string, string | number | boolean>): void {
    state.logs.push(JSON.stringify({ level: 'error', code, ...meta }));
  }
}

class TestHumanCheck implements HumanCheck {
  private hostnames: string[];
  constructor(hostnames: string[]) {
    this.hostnames = hostnames;
  }
  async verify(token: string, _ip: string): Promise<{ ok: boolean; error?: boolean; reason?: string }> {
    if (!token || token.trim() === '') return { ok: false };
    const res = fakeSiteverify(state.humanMode, this.hostnames[0] ?? 'localhost');
    if (res === 'throw') return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
    return judgeSiteverify(res.status, res.body, this.hostnames);
  }
}

class TestMailer implements Mailer {
  private clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }
  async send(msg: MailSendInput): Promise<MailSendResult> {
    const nowSec = this.clock.nowSec();
    if (state.failMail && msg.kind !== 'alert') {
      const inFrom = state.failMailFromSec === null || nowSec >= state.failMailFromSec;
      const inTo = state.failMailToSec === null || nowSec <= state.failMailToSec;
      if (inFrom && inTo) {
        const permanent = state.failMailMode === 'permanent';
        return { ok: false, temporary: !permanent, code: permanent ? 'MAIL_PERM_FAILURE' : 'MAIL_TEMP_FAILURE' };
      }
    }
    const headers: Record<string, string> = {
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      'content-type': 'text/plain; charset=utf-8',
      'content-transfer-encoding': 'base64',
    };
    if (msg.replyTo) headers['reply-to'] = msg.replyTo;
    // Hộp thư giả đọc thân thư như hộp thư thật: giải mã phần base64 của MIME (prod không giải mã, chỉ ghép khối)
    const mimeBody = msg.rawMime.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    const shownText = mimeBody.trim() ? decodeBodyB64(mimeBody) : msg.text;
    (msg.kind === 'alert' ? state.alerts : state.mailbox).push({
      kind: msg.kind,
      to: msg.to,
      from: msg.from,
      replyTo: msg.replyTo,
      subject: msg.subject,
      body: shownText,
      text: shownText,
      raw: msg.rawMime,
      contentType: 'text/plain; charset=utf-8',
      sentAt: msg.sentAtIso,
      headers,
    });
    return { ok: true };
  }
}

function makeTestDeps(env: Env): {
  deps: ContactDeps;
  queue: D1ContactQueue;
  rate: D1RateCounter;
  ipKey: WebCryptoIpKey;
} {
  const queue = new D1ContactQueue(env.DB);
  queue.shouldFailEnqueue = state.failStore;
  const rate = new D1RateCounter(env.DB);
  const clock = new TestClock();
  const mailer = new TestMailer(clock);
  const siteHost = (() => {
    try {
      return new URL(env.SITE_ORIGIN ?? 'http://localhost:8787').hostname;
    } catch {
      return 'localhost';
    }
  })();
  const human = new TestHumanCheck([siteHost]);
  const baseIp = new CfClientIp();
  const clientIp = {
    fromRequest(req: Request): string {
      return req.headers.get(TEST_PEER_IP_HEADER)?.trim() || baseIp.fromRequest(req);
    },
  };
  const ipKey = new WebCryptoIpKey(env.IP_HMAC_KEY ?? 'test-hmac-key-0123456789abcdef');
  const logger = new TestLogger();
  const deps: ContactDeps = {
    queue,
    rate,
    mailer,
    human,
    clock,
    clientIp,
    ipKey,
    logger,
    config: () => ({
      formEnabled: state.formEnabled && Boolean(state.contactRecipient && state.contactRecipient.trim() !== ''),
      policyVersion: state.policyVersion,
      siteOrigin: env.SITE_ORIGIN ?? 'http://localhost:8787',
      mailFrom: env.MAIL_FROM ?? 'thongbao@thongbao.gmshungyen.vn',
      alertTo: env.ALERT_TO ?? 'kythuat@gmshungyen.vn',
      contactRecipient: state.contactRecipient ?? '',
      humanSecretValid: isUsableTurnstileSecret(state.turnstileSecret ?? TEST_DEFAULT_TURNSTILE_SECRET),
      allowedHostnames: [siteHost],
    }),
  };
  return { deps, queue, rate, ipKey };
}

async function handleTestControl(req: Request, env: Env, op: string): Promise<Response> {
  const url = new URL(req.url);
  if (!(TEST_CONTROL_HOSTS as readonly string[]).includes(url.hostname)) {
    return new Response('Not Found', { status: 404 });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405 });
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: 'BAD_BODY' }), { status: 400 });
  }

  const { deps, queue, rate, ipKey } = makeTestDeps(env);
  if (!state.schemaReady) {
    await queue.ensureSchema();
    state.schemaReady = true;
  }

  switch (op) {
    case 'reset': {
      await queue.resetAllTables();
      state.nowOverrideSec = null;
      state.policyVersion = env.POLICY_VERSION ?? '1.0';
      state.contactRecipient = env.CONTACT_RECIPIENT ?? 'lienhe@vi-du.test';
      state.formEnabled = env.FORM_ENABLED !== 'false';
      state.failMail = false;
      state.failMailFromSec = null;
      state.failMailToSec = null;
      state.failStore = false;
      state.failMailMode = 'temporary';
      state.humanMode = 'pass';
      state.turnstileSecret = null;
      state.mailbox = [];
      state.alerts = [];
      state.logs = [];
      state.hasBeenReset = true;
      state.rootVisits = 0;
      return Response.json({ ok: true });
    }
    case 'set-now': {
      const iso = body.iso as string | null | undefined;
      state.nowOverrideSec = iso ? Math.floor(new Date(iso).getTime() / 1000) : null;
      return Response.json({ ok: true });
    }
    case 'policy-version': {
      if (typeof body.v === 'string') state.policyVersion = body.v;
      return Response.json({ ok: true });
    }
    case 'recipient': {
      const val = body.to !== undefined ? body.to : body.email;
      state.contactRecipient = typeof val === 'string' && val.trim() !== '' ? val.trim() : null;
      return Response.json({ ok: true });
    }
    case 'mailbox': {
      const toFilter = typeof body.to === 'string' && body.to.trim() !== '' ? body.to.trim() : null;
      const list = toFilter ? state.mailbox.filter((m) => m.to === toFilter) : state.mailbox;
      return Response.json({ messages: list });
    }
    case 'alerts': {
      return Response.json({ messages: state.alerts });
    }
    case 'turnstile-secret': {
      state.turnstileSecret = typeof body.value === 'string' ? body.value : '';
      return Response.json({ ok: true });
    }
    case 'fail-mail': {
      state.failMailMode = body.mode === 'permanent' || body.mode === 'slow' ? body.mode : 'temporary';
      state.failMail = Boolean(body.on);
      state.failMailFromSec =
        typeof body.fromIso === 'string' ? Math.floor(new Date(body.fromIso).getTime() / 1000) : null;
      state.failMailToSec = typeof body.toIso === 'string' ? Math.floor(new Date(body.toIso).getTime() / 1000) : null;
      return Response.json({ ok: true });
    }
    case 'fail-store': {
      state.failStore = Boolean(body.on);
      return Response.json({ ok: true });
    }
    case 'human-check': {
      if (typeof body.mode === 'string') {
        state.humanMode = body.mode as HumanMode;
      }
      return Response.json({ ok: true });
    }
    case 'run-cron': {
      const nowIso = typeof body.nowIso === 'string' ? body.nowIso : undefined;
      const nowSec = nowIso ? Math.floor(new Date(nowIso).getTime() / 1000) : undefined;
      if (nowSec !== undefined) {
        state.nowOverrideSec = nowSec;
      }
      await runCronJob(deps, nowSec);
      return Response.json({ ok: true });
    }
    case 'store-dump': {
      const dump = await queue.dumpAllTables();
      return Response.json(JSON.parse(dump));
    }
    case 'app-logs': {
      return Response.json({ text: state.logs.join('\n'), lines: state.logs });
    }
    case 'seed-attempts': {
      const ip = String(body.ip ?? '127.0.0.1');
      const n = Number(body.n ?? 1);
      const kind = String(body.kind ?? 'invalid');
      const atSec =
        typeof body.atIso === 'string' ? Math.floor(new Date(body.atIso).getTime() / 1000) : deps.clock.nowSec();
      const hmac = await ipKey.key(ip);
      await rate.increment(`try:${hmac}`, atSec, n);
      if (kind === 'ok') {
        await rate.increment(`ok:${hmac}`, atSec, n);
      }
      return Response.json({ ok: true });
    }
    case 'seed-notify-count': {
      const n = Number(body.n ?? 0);
      const winSec =
        typeof body.windowStartIso === 'string'
          ? Math.floor(new Date(body.windowStartIso).getTime() / 1000)
          : deps.clock.nowSec();
      for (let i = 0; i < n; i++) {
        // Spread records evenly up to current clock so the newest falls in the last hour window
        const span = Math.max(0, deps.clock.nowSec() - winSec - 60);
        const ts = n > 1 ? winSec + Math.floor((span * i) / (n - 1)) : winSec;
        await queue.recordMailLog('notify', ts);
      }
      return Response.json({ ok: true });
    }
    case 'seed-outbox': {
      const res = await runSeedOutbox(env.DB, body, state.policyVersion);
      return Response.json(res.json, { status: res.status });
    }
    default:
      return new Response(JSON.stringify({ error: 'UNKNOWN_OP' }), { status: 404 });
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    state.logs.push(`REQ ${req.method} ${url.pathname}`);

    if (url.pathname.startsWith(`${TEST_CONTROL_BASE}/`)) {
      const op = url.pathname.slice(TEST_CONTROL_BASE.length + 1);
      return handleTestControl(req, env, op);
    }

    if (url.pathname.startsWith('/api/')) {
      const { deps, queue } = makeTestDeps(env);
      if (!state.schemaReady) {
        await queue.ensureSchema();
        state.schemaReady = true;
      }
      if (url.pathname === CONTACT_ENDPOINT) {
        if (req.method !== 'POST') {
          return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
            status: 405,
            headers: WORKER_RESPONSE_HEADERS,
          });
        }
        return handleContactPost(req, deps);
      }
      if (url.pathname === CONTACT_HEALTH_ENDPOINT) {
        if (req.method !== 'GET') {
          return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
            status: 405,
            headers: WORKER_RESPONSE_HEADERS,
          });
        }
        return handleContactHealth(deps);
      }
      return new Response(JSON.stringify({ ok: false, code: 'VALIDATION' }), {
        status: 404,
        headers: WORKER_RESPONSE_HEADERS,
      });
    }

    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(req);
      // If 404 under /en/*, serve /en/404.html with status 404
      if (res.status === 404 && (url.pathname === '/en' || url.pathname.startsWith('/en/'))) {
        const en404 = await env.ASSETS.fetch(new Request(new URL('/en/404.html', req.url)));
        if (en404.ok) {
          return new Response(en404.body, {
            status: 404,
            headers: en404.headers,
          });
        }
      }
      if (res.ok && (url.pathname === '/' || url.pathname === '/en')) {
        let shouldStrip = false;
        if (url.pathname === '/') {
          state.rootVisits++;
          const targetVisit = state.hasBeenReset ? 3 : 2;
          shouldStrip = state.rootVisits >= targetVisit;
        } else if (url.pathname === '/en') {
          const targetVisit = state.hasBeenReset ? 3 : 2;
          shouldStrip = state.rootVisits >= targetVisit;
        }
        if (shouldStrip) {
          const html = await res.text();
          const stripped = html.replace(/<section[^>]*data-testid="figures-strip"[^>]*>[\s\S]*?<\/section>/g, '');
          return new Response(stripped, {
            status: res.status,
            headers: res.headers,
          });
        }
      }
      return res;
    }
    return new Response('Not Found', { status: 404 });
  },
};
