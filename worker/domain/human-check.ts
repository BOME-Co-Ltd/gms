import { SiteverifyResponse, TURNSTILE_ACTION, TURNSTILE_TEST_SECRET } from '../../contracts/api.ts';

export type HumanVerdict = { ok: boolean; error?: boolean; reason?: string };

/** Secret dùng được: không rỗng và không phải secret thử của Cloudflare (api.ts §12). */
export function isUsableTurnstileSecret(secret: string | undefined | null): boolean {
  const s = (secret ?? '').trim();
  return s !== '' && !TURNSTILE_TEST_SECRET.test(s);
}

/**
 * Hàm quyết định thuần (api.ts §12). status ≠ 200, thân hỏng hoặc sai schema ⇒ unavailable (error: true);
 * success=false, hostname hoặc action sai ⇒ failed. Không bao giờ "đạt" ngoài nhánh đủ điều kiện.
 */
export function judgeSiteverify(status: number, bodyText: string, allowedHostnames: string[]): HumanVerdict {
  if (status !== 200) return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
  }
  const parsed = SiteverifyResponse.safeParse(json);
  if (!parsed.success) return { ok: false, error: true, reason: 'TURNSTILE_UNAVAILABLE' };
  const r = parsed.data;
  if (!r.success) return { ok: false, reason: 'TURNSTILE_REJECTED' };
  const allowed = allowedHostnames.map((h) => h.toLowerCase());
  if (!r.hostname || !allowed.includes(r.hostname.toLowerCase())) return { ok: false, reason: 'TURNSTILE_HOSTNAME' };
  if (r.action !== TURNSTILE_ACTION) return { ok: false, reason: 'TURNSTILE_ACTION' };
  return { ok: true };
}
