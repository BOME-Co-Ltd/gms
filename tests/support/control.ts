// Cửa điều khiển adapter kiểm thử của Worker `gms-contact` dưới `wrangler dev --local` (lượt 5: không còn máy chủ ứng dụng,
// không còn Payload/CMS). Hợp đồng dây: POST {CONTROL_URL}/<op> JSON ⇒ JSON. CHƯA có contract (test-plan.md XQ-20):
// tên op dưới đây là ĐỀ XUẤT của qa. Chưa có Worker ⇒ mọi lời gọi ném lỗi ⇒ test ĐỎ (đúng ở pha 1).
import { CONTROL_URL } from './env';

export type Mail = { to: string; subject: string; body: string; contentType: string; sentAt: string; headers: Record<string, string> };
export type Alert = { subject: string; body: string; sentAt: string };

async function call<T = unknown>(op: string, args: object = {}): Promise<T> {
  const res = await fetch(`${CONTROL_URL}/${op}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Cửa điều khiển "${op}" trả ${res.status} — Worker/adapter kiểm thử chưa dựng (XQ-20)`);
  return (await res.json()) as T;
}

export const control = {
  // Về gốc: hộp thư giả rỗng, D1 rỗng, bộ đếm IP/thư rỗng, tắt mọi lỗi tiêm, đồng hồ về giờ thật,
  // cấu hình: email nhận lienhe@vi-du.test, đầu mối cảnh báo, policyVersion '1.0'.
  reset: () => call('reset'),
  setNow: (iso: string | null) => call('set-now', { iso }),
  policyVersion: (v: string) => call('policy-version', { v }),     // POLICY_VERSION của bản deploy
  recipient: (email: string | null) => call('recipient', { email }), // wrangler var email nhận (rỗng ⇒ FORM_DISABLED)
  mailbox: (to?: string) => call<Mail[]>('mailbox', { to }),         // Mailer giả: mọi thư đã "gửi"
  alerts: () => call<Alert[]>('alerts'),                              // thư cảnh báo kỹ thuật (không PII)
  failMail: (on: boolean, fromIso?: string, toIso?: string) => call('fail-mail', { on, fromIso, toIso }),
  failStore: (on: boolean) => call('fail-store', { on }),             // D1 ném lỗi ⇒ STORE_FAILED
  runCron: (nowIso?: string) => call('run-cron', { nowIso }),         // chạy một lượt Cron (outbox/tóm tắt/dọn)
  // Đổ mọi chữ còn lưu phía web (D1, bộ đếm, KV nếu có) thành chuỗi thô để soát PII. {text}
  storeDump: () => call<{ text: string }>('store-dump'),
  appLogs: () => call<{ text: string }>('app-logs'),                  // log ứng dụng + log lỗi + URL đã truy cập
  seedAttempts: (ip: string, n: number, kind: 'ok' | 'trap' | 'invalid') => call('seed-attempts', { ip, n, kind }),
  seedNotifyCount: (n: number, windowStartIso: string) => call('seed-notify-count', { n, windowStartIso }),
};

export async function pollUntil<T>(fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs: number, everyMs = 500): Promise<T> {
  const end = Date.now() + timeoutMs;
  let last = await fn();
  while (!ok(last) && Date.now() < end) { await new Promise((r) => setTimeout(r, everyMs)); last = await fn(); }
  return last;
}
