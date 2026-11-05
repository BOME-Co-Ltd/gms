// Cửa điều khiển của Worker `gms-contact` dưới `wrangler dev --local --config wrangler.test.jsonc`.
// Contract hiện hành: 02-design/contracts/test-control.ts (lượt 9–10). POST {CONTROL_URL}/<op> JSON ⇒ JSON.
// Lớp này giữ hình dạng cũ (Mail.body/contentType/headers, appLogs().text, storeDump().text) bằng cách chuyển từ hình dạng mới
// (messages[].text/raw, lines[], bảng thô) để test cũ không phải viết lại; hình dạng mới nằm trong trường `raw`/`tables`.
import { CONTROL_URL } from './env';

export type Mail = {
  kind: 'notify' | 'summary' | 'alert';
  to: string;
  from: string;
  subject: string;
  body: string; // = text đã giải mã
  text: string;
  raw: string;
  contentType: string; // lấy từ MIME thô
  sentAt: string;
  headers: Record<string, string>; // lấy từ MIME thô (khoá viết thường)
};
export type Alert = Mail;
export type HumanCheckMode =
  | 'pass'
  | 'fail'
  | 'error'
  | 'timeout'
  | 'http-error'
  | 'bad-body'
  | 'wrong-hostname'
  | 'wrong-action';

// Hình dạng một dòng của op `seed-outbox` (contracts/test-control.ts:94–103). Chỉ các trường contract khai.
export type SeedOutboxRow = {
  batch: 'summary' | 'single';
  createdAtIso: string;
  attempts?: number;
  sentAtIso?: string;
  leaseUntilIso?: string;
  bodyB64?: string;
};

async function call<T = unknown>(op: string, args: object = {}): Promise<T> {
  const res = await fetch(`${CONTROL_URL}/${op}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Cửa điều khiển "${op}" trả ${res.status}`);
  return (await res.json()) as T;
}

function parseRaw(raw: string): { headers: Record<string, string>; contentType: string } {
  const head = raw.split(/\r?\n\r?\n/, 1)[0] ?? '';
  const headers: Record<string, string> = {};
  let last = '';
  for (const line of head.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && last) {
      headers[last] += ` ${line.trim()}`;
      continue;
    }
    const i = line.indexOf(':');
    if (i < 1) continue;
    last = line.slice(0, i).toLowerCase();
    headers[last] = line.slice(i + 1).trim();
  }
  return { headers, contentType: headers['content-type'] ?? '' };
}

type Raw = { kind: Mail['kind']; to: string; from: string; subject: string; text: string; raw: string; sentAt: string };
const toMail = (m: Raw): Mail => ({ ...m, body: m.text, ...parseRaw(m.raw) });

export const control = {
  reset: () => call('reset'),
  setNow: (iso: string | null) => call('set-now', { iso }),
  policyVersion: (v: string) => call('policy-version', { v }),
  // contract: `recipient` nhận { to } (không có "rỗng ⇒ FORM_DISABLED" nữa: dùng turnstileSecret/CONTACT_MAIL_READY).
  recipient: (email: string) => call('recipient', { to: email }),
  mailbox: async (to?: string): Promise<Mail[]> =>
    (await call<{ messages: Raw[] }>('mailbox', { to })).messages.map(toMail),
  alerts: async (): Promise<Alert[]> => (await call<{ messages: Raw[] }>('alerts')).messages.map(toMail),
  failMail: (on: boolean, mode: 'temporary' | 'permanent' | 'slow' = 'temporary') => call('fail-mail', { on, mode }),
  failStore: (on: boolean) => call('fail-store', { on }),
  humanCheck: (mode: HumanCheckMode) => call('human-check', { mode }),
  turnstileSecret: (value: string) => call('turnstile-secret', { value }),
  runCron: (nowIso?: string, cron: '* * * * *' | '5 17 * * *' = '* * * * *') => call('run-cron', { cron, nowIso }),
  storeDump: async () => {
    const tables = await call<Record<string, Array<Record<string, unknown>>>>('store-dump');
    return { text: JSON.stringify(tables), tables };
  },
  appLogs: async () => {
    const { lines } = await call<{ lines: string[] }>('app-logs');
    return { text: lines.join('\n'), lines };
  },
  seedAttempts: (ip: string, n: number, kind: 'ok' | 'trap' | 'invalid', atIso?: string) =>
    call('seed-attempts', { ip, n, kind, atIso }),
  seedNotifyCount: (n: number, windowStartIso: string) => call('seed-notify-count', { n, windowStartIso }),
  // contract lượt 11 (test-control.ts, op seed-outbox): ghi THÊM dòng outbox, ⇒ { ids } cùng thứ tự `rows`.
  seedOutbox: async (rows: SeedOutboxRow[]): Promise<string[]> =>
    (await call<{ ids: string[] }>('seed-outbox', { rows })).ids,
};

export async function pollUntil<T>(
  fn: () => Promise<T>,
  ok: (v: T) => boolean,
  timeoutMs: number,
  everyMs = 500,
): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last = await fn();
  while (!ok(last) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, everyMs));
    last = await fn();
  }
  return last;
}
