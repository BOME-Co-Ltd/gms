import { describe, expect, it } from 'vitest';
import {
  buildContactRowsHtml,
  buildFooterHtml,
  displayUrl,
  FOOTER_CSS,
  type FooterInput,
  parseSocial,
} from './static-footer.ts';

const LEGAL = 'Công ty Mẫu GMS';

function base(over: Partial<FooterInput> = {}): FooterInput {
  return {
    locale: 'vi',
    legalName: LEGAL,
    slogan: 'Khẩu hiệu',
    year: 2026,
    phone: { href: 'tel:+84987998370', text: '098 799 83 70' },
    zalo: { href: 'https://zalo.me/0987998370', text: '098 799 83 70' },
    fanpages: [{ url: 'https://www.facebook.com/gmshungyen/' }],
    address: 'Quốc lộ 39 & Hưng Yên',
    taxId: '0900000000',
    explore: [
      { href: '/gioi-thieu', label: 'Giới thiệu' },
      { href: '/cong-nghe', label: 'Công nghệ', current: true },
    ],
    info: [
      { href: '/tuyen-dung', label: 'Tuyển dụng' },
      { href: '/lien-he', label: 'Liên hệ' },
    ],
    ...over,
  };
}

const EMOJI = /[\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{1F300}-\u{1FAFF}]|\u{FE0F}/u;

describe('buildFooterHtml — chân trang U10 (ux-spec §14a)', () => {
  it('giữ data-testid footer, thứ tự DOM thương hiệu → liên hệ → nav → bản quyền, một <nav aria-label>', () => {
    const html = buildFooterHtml(base());
    expect(html).toContain('<footer class="ft on-dark" data-testid="footer">');
    const order = ['ft-brand', 'ft-contact', 'ft-nav', 'ft-bottom'].map((c) => html.indexOf(`class="${c}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/<nav /g)).toHaveLength(1);
    expect(html).toContain('<nav class="ft-nav" aria-label="Liên kết chân trang">');
  });

  it('aria-current="page" đúng một liên kết, mọi liên kết là .ft-link', () => {
    const html = buildFooterHtml(base());
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('<a class="ft-link" href="/cong-nghe" aria-current="page">Công nghệ</a>');
    expect(html).toContain('Tuyển dụng');
  });

  it('tên pháp lý hiện ở cả vi và en, nguyên chuỗi; khung EN đánh dấu lang="vi" và nhãn tiếng Anh', () => {
    const vi = buildFooterHtml(base());
    expect(vi).toContain(`<p class="ft-name">${LEGAL}</p>`);
    expect(vi).toContain(`© 2026 ${LEGAL}. Tất cả các quyền được bảo lưu.`);
    const en = buildFooterHtml(base({ locale: 'en' }));
    expect(en).toContain(`<p class="ft-name" lang="vi">${LEGAL}</p>`);
    expect(en).toContain(`<span lang="vi">${LEGAL}</span>. All rights reserved.`);
    expect(en).toContain('aria-label="Footer links"');
    expect(en).toContain('(opens in a new tab)');
    expect(en).toContain('Tax ID');
  });

  it('không còn emoji/ký tự hình, không còn đoạn Pháp lý & Tiêu chuẩn / chip công nghệ', () => {
    for (const locale of ['vi', 'en'] as const) {
      const html = buildFooterHtml(base({ locale }));
      expect(html).not.toMatch(EMOJI);
      expect(html).not.toMatch(/Pháp lý|Compliance|Công nghệ sạch|Clean circular/);
    }
    expect(FOOTER_CSS).not.toMatch(EMOJI);
    expect(FOOTER_CSS).toContain('outline: 3px solid var(--white)');
    expect(FOOTER_CSS).toContain('min-height: 44px');
    expect(FOOTER_CSS).toContain('(min-width: 600px)');
    expect(FOOTER_CSS).toContain('(min-width: 900px)');
    expect(FOOTER_CSS).toContain('forced-colors: active');
  });
});

describe('buildContactRowsHtml — hàng NAP', () => {
  it('đủ trường: tel:, Zalo/Fanpage target=_blank + "(mở tab mới)" .sr-only, <address>, tax-id ở <li>', () => {
    const html = buildContactRowsHtml(base());
    expect(html).toContain('href="tel:+84987998370"');
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html.match(/<span class="sr-only"> \(mở tab mới\)<\/span>/g)).toHaveLength(2);
    expect(html).toContain('facebook.com/gmshungyen<span');
    expect(html).toContain('<address class="ft-value">Quốc lộ 39 &amp; Hưng Yên</address>');
    expect(html).toContain('<li data-testid="tax-id">');
    expect(html).toContain('<svg');
    expect(html.match(/aria-hidden="true" focusable="false"/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('trường trống ⇒ ẩn cả hàng và nhãn; không có hàng nào ⇒ ẩn cả khối Liên hệ', () => {
    const noTax = buildContactRowsHtml(base({ taxId: '  ' }));
    expect(noTax).not.toContain('tax-id');
    expect(noTax).not.toContain('Mã số thuế');
    const none = base({ phone: null, zalo: null, fanpages: [], address: null, taxId: null });
    expect(buildContactRowsHtml(none)).toBe('');
    const html = buildFooterHtml(none);
    expect(html).not.toContain('ft-contact');
    expect(html).not.toContain('Liên hệ</h2>');
    expect(html).toContain('data-testid="footer"');
    expect(html).not.toContain('Fanpage');
  });

  it('chỉ địa chỉ ⇒ một hàng không bấm được', () => {
    const html = buildContactRowsHtml(base({ phone: null, zalo: null, fanpages: [], taxId: null }));
    expect(html).toContain('<div class="ft-row">');
    expect(html).not.toContain('<a ');
  });
});

describe('parseSocial / displayUrl', () => {
  it('chỉ giữ URL an toàn; thiếu hoặc sai dạng ⇒ []', () => {
    expect(parseSocial(undefined)).toEqual([]);
    expect(parseSocial('x')).toEqual([]);
    expect(
      parseSocial([
        { name: 'Facebook', url: 'https://facebook.com/gmshungyen' },
        { name: 'Xấu', url: 'javascript:alert(1)' },
        { name: 'Thiếu' },
        null,
      ]),
    ).toEqual([{ url: 'https://facebook.com/gmshungyen' }]);
  });

  it('displayUrl bỏ giao thức, www và dấu / cuối', () => {
    expect(displayUrl('https://www.facebook.com/gmshungyen/')).toBe('facebook.com/gmshungyen');
    expect(displayUrl('http://zalo.me/0987')).toBe('zalo.me/0987');
  });
});
