// Tiện ích dùng chung cho test công khai. Quy ước data-testid là YÊU CẦU với frontend (test-plan.md §4).
import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { TURNSTILE_TEST_TOKEN } from './env';
import { API_CONTACT, type Locale, type PageKey, path } from './routes';

export const VN_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
export const RETRY_LATER = { vi: /thử lại sau|vui lòng thử lại/i, en: /try again later|please try again/i };

export const tid = (page: Page, id: string) => page.getByTestId(id);
export const bodyText = (page: Page) => page.locator('body').innerText();
export const htmlLang = (page: Page) => page.locator('html').getAttribute('lang');
export const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1;

export async function open(page: Page, key: PageKey, locale: Locale = 'vi') {
  const res = await page.goto(path(key, locale));
  expect(res?.status(), `${key}/${locale}`).toBe(200);
}

export async function expectNoHorizontalScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
}

// Dữ liệu form hợp lệ (tên khoá = trường UI; postContact đổi sang tên trường API api.ts).
export const VALID = {
  name: 'Nguyễn Văn An',
  email: 'an@vi-du.test',
  message: 'Xin tài liệu về công nghệ VPD',
  consent: true,
};
export type FormData = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  message?: string;
  consent?: boolean;
  trap?: string;
};

export async function fillAndSubmit(page: Page, d: FormData) {
  if (d.name !== undefined) await tid(page, 'contact-name').fill(d.name);
  if (d.company !== undefined) await tid(page, 'contact-company').fill(d.company);
  if (d.email !== undefined) await tid(page, 'contact-email').fill(d.email);
  if (d.phone !== undefined) await tid(page, 'contact-phone').fill(d.phone);
  if (d.message !== undefined) await tid(page, 'contact-message').fill(d.message);
  if (d.trap !== undefined)
    await tid(page, 'contact-trap').evaluate((el, v) => {
      (el as HTMLInputElement).value = v as string;
    }, d.trap);
  const box = tid(page, 'contact-consent');
  if (d.consent === true) await box.check();
  else if (d.consent === false) await box.uncheck();
  await tid(page, 'contact-submit').click();
}

// POST thẳng tới Worker như trình duyệt (JSON). ip ⇒ CF-Connecting-IP (adapter kiểm thử chấp nhận dưới wrangler dev --local, XQ-20).
export async function postContact(
  request: APIRequestContext,
  d: FormData & { policyVersion?: string; pagePath?: string },
  o: { ip?: string; locale?: Locale; raw?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...(o.ip ? { 'CF-Connecting-IP': o.ip } : {}), ...o.headers };
  const res =
    o.raw !== undefined
      ? await request.post(API_CONTACT, { headers: { ...headers, 'content-type': 'application/json' }, data: o.raw })
      : await request.post(API_CONTACT, {
          headers,
          data: {
            locale: o.locale ?? 'vi',
            fullName: d.name ?? '',
            company: d.company,
            email: d.email,
            phone: d.phone,
            message: d.message ?? '',
            consent: d.consent ?? true,
            policyVersion: d.policyVersion ?? '1.0',
            turnstileToken: TURNSTILE_TEST_TOKEN,
            pagePath: d.pagePath ?? path('contact', o.locale ?? 'vi'),
            website: d.trap,
          },
        });
  const text = await res.text();
  let json: { ok?: boolean; code?: string; fields?: Record<string, string>; retryAfterSeconds?: number } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* không phải JSON (vd 413/1027 của Cloudflare) */
  }
  return { status: res.status(), text, json, headers: res.headers() };
}
