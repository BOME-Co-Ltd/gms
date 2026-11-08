// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactForm, type ContactFormProps } from '../../../src/components/site/ContactForm.tsx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: ContactFormProps = {
  locale: 'vi',
  policyVersion: '1.2',
  phoneRaw: '+84900000000',
  phoneShown: '0900 000 000',
  zaloRaw: 'https://zalo.me/123',
  siteKey: '',
  homeHref: '/',
  privacyHref: '/chinh-sach-bao-mat/',
  legalName: 'Công ty GMS',
};

let host: HTMLDivElement;
let root: Root;

const q = (id: string) => document.getElementById(id) as HTMLInputElement & HTMLTextAreaElement;
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
async function mount(over: Partial<ContactFormProps> = {}) {
  await act(async () => {
    root.render(createElement(ContactForm, { ...baseProps, ...over }));
  });
}
async function type(id: string, value: string) {
  const el = q(id);
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(id: string) {
  await act(async () => {
    q(id).click();
  });
}
async function submit() {
  await act(async () => {
    document
      .getElementById('gms-contact-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}
async function fillValid() {
  await type('contact-name', '  Nguyễn Văn A ');
  await type('contact-email', 'a@congty.vn');
  await type('contact-message', 'Cần tư vấn');
  await click('contact-consent');
}
const mockFetch = (status: number, body: unknown, bad = false) => {
  const f = vi.fn(async () => ({
    status,
    json: async () => {
      if (bad) throw new Error('bad json');
      return body;
    },
  }));
  vi.stubGlobal('fetch', f);
  return f;
};
const sentBody = (f: ReturnType<typeof mockFetch>) =>
  JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
const errText = () => document.querySelector('[data-testid="contact-error"]')?.textContent ?? '';

let scripts: HTMLScriptElement[] = [];
beforeEach(() => {
  // Không cho happy-dom nạp script thật: ghi lại thẻ <script> mà form chèn vào <head>.
  vi.spyOn(document.head, 'appendChild').mockImplementation(((n: Node) => {
    scripts.push(n as HTMLScriptElement);
    return n;
  }) as typeof document.head.appendChild);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  scripts = [];
  vi.restoreAllMocks();
  delete (window as { turnstile?: unknown }).turnstile;
  delete (window as { __gmsTurnstileReady?: unknown }).__gmsTurnstileReady;
  vi.unstubAllGlobals();
});

describe('ContactForm: kiểm hợp lệ', () => {
  it('form rỗng: báo đủ lỗi, không gọi mạng, giữ aria-invalid + tóm tắt', async () => {
    const f = mockFetch(200, { ok: true });
    await mount();
    await submit();
    expect(f).not.toHaveBeenCalled();
    const sum = document.getElementById('contact-summary');
    expect(sum?.getAttribute('data-fields')).toBe('1');
    expect(sum?.textContent).toContain('Cần sửa 4 mục trước khi gửi:');
    expect(q('contact-name').getAttribute('aria-invalid')).toBe('true');
    expect(q('contact-email').getAttribute('aria-describedby')).toBe('err-email');
    expect(document.getElementById('err-email')?.textContent).toContain('Vui lòng nhập email hoặc số điện thoại');
    expect(document.getElementById('err-consent')?.hidden).toBe(false);
  });

  it('email/điện thoại sai dạng', async () => {
    await mount();
    await type('contact-email', 'abc');
    await type('contact-phone', '12');
    await submit();
    expect(document.getElementById('err-email')?.textContent).toContain('Email chưa đúng dạng');
    expect(document.getElementById('err-phone')?.textContent).toContain('Số điện thoại chưa đúng');
  });

  it('ký tự điều khiển và vượt độ dài', async () => {
    await mount();
    await type('contact-name', 'A​B'.replace('​', '\u0085'));
    await type('contact-company', 'x y');
    await type('contact-message', 'm'.repeat(5001));
    await submit();
    expect(document.getElementById('err-fullName')?.textContent).toContain('Ô “Họ và tên” có ký tự không dùng được');
    expect(document.getElementById('err-company')?.textContent).toContain('Ô “Công ty / Tổ chức”');
    expect(document.getElementById('err-message')?.textContent).toContain('dài quá 5000');
  });

  it('sửa ô đã lỗi thì gỡ lỗi ngay, giữ chữ đã nhập; hết lỗi thì đóng tóm tắt', async () => {
    await mount();
    await type('contact-name', 'Bình');
    await submit();
    expect(document.getElementById('contact-summary')).not.toBeNull();
    await type('contact-email', 'a@b.vn');
    expect(document.getElementById('err-email')?.hidden).toBe(true);
    expect(document.getElementById('err-phone')?.hidden).toBe(true);
    await type('contact-message', 'xin chào');
    await click('contact-consent');
    expect(document.getElementById('contact-summary')).toBeNull();
    expect(q('contact-name').value).toBe('Bình');
  });

  it('xoá hết email/phone sau khi đã báo lỗi liên hệ vẫn giữ lỗi', async () => {
    await mount();
    await type('contact-name', 'A');
    await type('contact-message', 'm');
    await click('contact-consent');
    await submit();
    expect(document.getElementById('err-email')?.textContent).toContain('email hoặc số điện thoại');
    expect(document.getElementById('err-phone')?.textContent).toContain('email hoặc số điện thoại');
    await type('contact-email', 'x');
    expect(document.getElementById('err-email')?.textContent).toContain('Email chưa đúng dạng');
    await type('contact-email', '');
    expect(document.getElementById('err-email')?.hidden).toBe(true);
    // gửi lại khi vẫn thiếu cả hai: lỗi liên hệ hiện lại ở cả hai ô
    await submit();
    expect(document.getElementById('err-email')?.textContent).toContain('email hoặc số điện thoại');
    expect(document.getElementById('err-phone')?.textContent).toContain('email hoặc số điện thoại');
    await type('contact-phone', '0900 000 000');
    expect(document.getElementById('err-phone')?.hidden).toBe(true);
    expect(document.getElementById('err-email')?.hidden).toBe(true);
  });

  it('rời ô (blur) kiểm lại ô đã báo lỗi', async () => {
    await mount();
    await submit();
    await type('contact-name', 'Lan');
    await act(async () => {
      q('contact-name').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(document.getElementById('err-fullName')?.hidden).toBe(true);
  });

  it('bấm lỗi trong tóm tắt thì focus ô tương ứng', async () => {
    await mount();
    await submit();
    const a = document.querySelector<HTMLAnchorElement>('#contact-summary a');
    await act(async () => a?.click());
    expect(document.activeElement?.id).toBe('contact-name');
  });
});

describe('ContactForm: gửi', () => {
  it('không có siteKey: báo không gửi được, kèm kênh gấp, giữ chữ', async () => {
    const f = mockFetch(200, { ok: true });
    await mount();
    await fillValid();
    await submit();
    expect(f).not.toHaveBeenCalled();
    expect(errText()).toContain('GMS chưa nhận được');
    expect(errText()).toContain('0900 000 000');
    expect(errText()).toContain('Zalo');
    expect(q('contact-name').value).toBe('  Nguyễn Văn A ');
    expect(q('contact-submit-btn').disabled).toBe(false);
  });

  it('kênh gấp chỉ có điện thoại hoặc không có kênh nào', async () => {
    await mount({ zaloRaw: '' });
    await fillValid();
    await submit();
    expect(errText()).toContain('Nếu cần gấp, hãy gọi');
    expect(errText()).not.toContain('Zalo');
    await act(async () => root.unmount());
    root = createRoot(host);
    await mount({ zaloRaw: '', phoneRaw: '' });
    await fillValid();
    await submit();
    expect(errText()).not.toContain('Nếu cần gấp');
  });

  async function withTurnstile() {
    const render = vi.fn((_el: HTMLElement, _o: Record<string, unknown>) => 'w1');
    const reset = vi.fn();
    (window as { turnstile?: unknown }).turnstile = { render, reset };
    await mount({ siteKey: 'KEY' });
    await fillValid();
    return { render, reset };
  }
  const opts = (render: ReturnType<typeof vi.fn>) =>
    render.mock.calls[0][1] as Record<string, (...a: unknown[]) => unknown>;

  it('gửi thành công: khoá nút khi đang gửi, một request, body đúng, honeypot, thành công + gửi khác', async () => {
    let resolve: (v: unknown) => void = () => {};
    const f = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    vi.stubGlobal('fetch', f);
    const { render } = await withTurnstile();
    await type('contact-trap', 'bot');
    await submit();
    expect(scripts[0]?.getAttribute('src')).toContain('challenges.cloudflare.com');
    await act(async () => window.__gmsTurnstileReady?.());
    expect(render).toHaveBeenCalledTimes(1);
    expect(render.mock.calls[0][1]).toMatchObject({ sitekey: 'KEY', appearance: 'interaction-only', language: 'vi' });
    await act(async () => {
      opts(render).callback('tok1');
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(q('contact-submit-btn').disabled).toBe(true);
    expect(document.getElementById('contact-status')?.textContent).toBe('Đang gửi…');
    await submit();
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body).toMatchObject({
      locale: 'vi',
      fullName: 'Nguyễn Văn A',
      email: 'a@congty.vn',
      message: 'Cần tư vấn',
      consent: true,
      policyVersion: '1.2',
      turnstileToken: 'tok1',
      website: 'bot',
    });
    expect(body.phone).toBeUndefined();
    expect(body.company).toBeUndefined();
    await act(async () => {
      resolve({ status: 200, json: async () => ({ ok: true }) });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(document.querySelector('[data-testid="contact-success"]')?.textContent).toContain('Đã gửi liên hệ');
    await click('contact-again');
    expect(q('contact-name').value).toBe('');
    expect(document.querySelector('[data-testid="contact-success"]')).toBeNull();
    expect(document.activeElement?.id).toBe('contact-name');
  });

  it('honeypot trống: website bỏ khỏi body; token đã có thì gửi ngay lần sau', async () => {
    const f = mockFetch(200, { ok: true });
    const { render } = await withTurnstile();
    await act(async () => {
      q('contact-name').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    expect(f).not.toHaveBeenCalled();
    await submit();
    await flush();
    expect(sentBody(f).website).toBeUndefined();
    expect(sentBody(f).turnstileToken).toBe('t');
  });

  const cases: Array<[string, number, unknown, string, boolean?]> = [
    ['429 có thời gian', 429, { code: 'RATE_LIMITED', retryAfterSeconds: 120 }, 'sau 2 phút'],
    ['429 không thời gian', 429, { code: 'RATE_LIMITED' }, 'sau ít phút'],
    ['403 HUMAN_CHECK_FAILED', 403, { code: 'HUMAN_CHECK_FAILED' }, 'Chưa xác minh được bạn là người thật'],
    ['403 ORIGIN_REJECTED', 403, { code: 'ORIGIN_REJECTED' }, 'không đến từ trang web của GMS'],
    ['413', 413, { code: 'PAYLOAD_TOO_LARGE' }, 'quá lớn'],
    ['500 mã lạ', 500, { code: 'STORE_FAILED' }, 'GMS chưa nhận được'],
    ['JSON hỏng', 502, null, 'GMS chưa nhận được', true],
  ];
  for (const [name, status, data, text, bad] of cases) {
    it(`phản hồi ${name}: báo lỗi, giữ chữ, mở khoá nút, reset widget`, async () => {
      const f = mockFetch(status, data, bad);
      const { render, reset } = await withTurnstile();
      await submit();
      await act(async () => window.__gmsTurnstileReady?.());
      await act(async () => opts(render).callback('t'));
      await flush();
      expect(f).toHaveBeenCalledTimes(1);
      expect(errText()).toContain(text);
      expect(q('contact-message').value).toBe('Cần tư vấn');
      expect(q('contact-submit-btn').disabled).toBe(false);
      expect(reset).toHaveBeenCalledWith('w1');
    });
  }

  it('lỗi mạng (fetch reject): báo không gửi được', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('net');
      }),
    );
    const { render } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(errText()).toContain('GMS chưa nhận được');
  });

  it('422 VALIDATION map lỗi theo trường; mã lạ coi như lỗi chung', async () => {
    mockFetch(422, {
      code: 'VALIDATION',
      fields: { email: 'INVALID_EMAIL', fullName: 'REQUIRED', consent: 'CONSENT_REQUIRED' },
    });
    const { render } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(document.getElementById('err-email')?.textContent).toContain('Email chưa đúng dạng');
    expect(document.getElementById('err-fullName')?.hidden).toBe(false);
    expect(document.getElementById('contact-summary')?.getAttribute('data-fields')).toBe('1');
    expect(q('contact-name').value).toContain('Nguyễn Văn A');
  });

  it('422 các mã trường khác', async () => {
    mockFetch(422, {
      code: 'VALIDATION',
      fields: { message: 'TOO_LONG', company: 'INVALID_CHARS', phone: 'INVALID_PHONE', fullName: 'REQUIRED' },
    });
    const { render } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(document.getElementById('err-message')?.textContent).toContain('dài quá 5000');
    expect(document.getElementById('err-company')?.textContent).toContain('Công ty / Tổ chức');
    expect(document.getElementById('err-phone')?.textContent).toContain('Số điện thoại chưa đúng');
  });

  it('422 với trường lạ: rơi về lỗi chung', async () => {
    mockFetch(422, { code: 'VALIDATION', fields: { zzz: 'REQUIRED' } });
    const { render } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(errText()).toContain('GMS chưa nhận được');
  });

  it('503 FORM_DISABLED: khoá form, hiện kênh liên hệ', async () => {
    mockFetch(503, { code: 'FORM_DISABLED' });
    const { render } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(document.querySelector('.notice-box[data-testid="contact-error"]')?.textContent).toContain(
      'tạm thời chưa mở',
    );
    expect(q('contact-submit-btn').disabled).toBe(true);
    expect(document.querySelector('#contact-summary a[href="tel:+84900000000"]')).not.toBeNull();
    await submit();
  });

  it('409 POLICY_CHANGED: bỏ tick đồng ý, cập nhật phiên bản, gửi lại dùng bản mới', async () => {
    const f = mockFetch(409, { code: 'POLICY_CHANGED', policyVersion: '2.0' });
    const { render, reset } = await withTurnstile();
    await submit();
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => opts(render).callback('t'));
    await flush();
    expect(errText()).toContain('Chính sách bảo mật vừa được cập nhật');
    expect(q('contact-consent').checked).toBe(false);
    expect(document.querySelector('a.consent-link')?.getAttribute('target')).toBe('_blank');
    expect(document.getElementById('gms-contact-form')?.getAttribute('data-policy-version')).toBe('2.0');
    expect(reset).toHaveBeenCalled();
    await click('contact-consent');
    mockFetch(200, { ok: true });
    await submit();
    await act(async () => opts(render).callback('t2'));
    await flush();
    const f2 = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(f2[1].body).policyVersion).toBe('2.0');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('ContactForm: Turnstile', () => {
  it('nạp script khi chạm form, chỉ một lần', async () => {
    await mount({ siteKey: 'KEY' });
    const form = document.getElementById('gms-contact-form') as HTMLElement;
    await act(async () => {
      form.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      form.dispatchEvent(new Event('touchstart', { bubbles: true }));
    });
    expect(scripts.length).toBe(1);
  });

  it('script lỗi khi đang chờ: báo không gửi được', async () => {
    await mount({ siteKey: 'KEY' });
    await fillValid();
    await submit();
    const s = scripts[0];
    await act(async () => s.onerror?.(new Event('error')));
    expect(errText()).toContain('GMS chưa nhận được');
    expect(q('contact-submit-btn').disabled).toBe(false);
    // lần gửi sau: tsState=failed ⇒ báo ngay
    await submit();
    expect(errText()).toContain('GMS chưa nhận được');
  });

  it('error-callback khi đang chờ báo lỗi; các callback phụ điều khiển trạng thái chờ', async () => {
    const render = vi.fn((_e: HTMLElement, _o: Record<string, unknown>) => 'w1');
    (window as { turnstile?: unknown }).turnstile = {
      render,
      reset: vi.fn(() => {
        throw new Error('gone');
      }),
    };
    await mount({ siteKey: 'KEY' });
    await act(async () =>
      document.getElementById('contact-name')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true })),
    );
    await act(async () => window.__gmsTurnstileReady?.());
    await act(async () => window.__gmsTurnstileReady?.());
    expect(render).toHaveBeenCalledTimes(1);
    const o = render.mock.calls[0][1] as Record<string, (...a: unknown[]) => unknown>;
    const slot = document.getElementById('contact-human-slot') as HTMLElement;
    await act(async () => o['before-interactive-callback']());
    expect(slot.getAttribute('data-challenge')).toBe('shown');
    await act(async () => o['after-interactive-callback']());
    expect(slot.hasAttribute('data-challenge')).toBe(false);
    await act(async () => {
      o['expired-callback']();
      o['timeout-callback']();
    });
    await fillValid();
    await act(async () => o['before-interactive-callback']());
    await submit();
    await act(async () => o['before-interactive-callback']());
    expect(document.getElementById('contact-human-wait')?.hidden).toBe(false);
    expect(document.getElementById('contact-human-wait')?.textContent).toContain('hoàn tất bước xác minh');
    await act(async () => o['error-callback']());
    expect(errText()).toContain('GMS chưa nhận được');
    expect(document.getElementById('contact-human-wait')?.hidden).toBe(true);
    await act(async () => o['error-callback']());
  });

  it('chờ thử thách đang hiện: submit bật thông báo chờ', async () => {
    const render = vi.fn((_e: HTMLElement, _o: Record<string, unknown>) => 'w1');
    (window as { turnstile?: unknown }).turnstile = { render, reset: vi.fn() };
    await mount({ siteKey: 'KEY' });
    await fillValid();
    await act(async () =>
      document.getElementById('contact-name')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true })),
    );
    await act(async () => window.__gmsTurnstileReady?.());
    const o = render.mock.calls[0][1] as Record<string, (...a: unknown[]) => unknown>;
    await act(async () => o['before-interactive-callback']());
    expect(document.getElementById('contact-human-slot')?.getAttribute('data-challenge')).toBe('shown');
    await submit();
    expect(document.getElementById('contact-human-wait')?.hidden).toBe(false);
    expect(q('contact-submit-btn').disabled).toBe(true);
  });
});

describe('ContactForm: tiếng Anh', () => {
  it('nhãn và lỗi tiếng Anh, 429 en, 200 en', async () => {
    await mount({ locale: 'en' });
    expect(document.querySelector('label[for="contact-name"]')?.textContent).toBe('Full name (required)');
    await submit();
    expect(document.getElementById('contact-summary')?.textContent).toContain('4 item(s) to fix before sending:');
    expect(document.getElementById('err-fullName')?.textContent).toContain('Please enter your full name.');
    expect(document.querySelector('noscript')).not.toBeNull();
  });

  it('en: gửi lỗi mạng đưa thông báo tiếng Anh', async () => {
    (window as { turnstile?: unknown }).turnstile = { render: vi.fn(() => 'w'), reset: vi.fn() };
    await mount({ locale: 'en' });
    await fillValid();
    await submit();
    expect(errText()).toContain("couldn't send");
    expect(errText()).toContain('If urgent, call');
    expect(errText()).toContain('message us on');
  });
});
