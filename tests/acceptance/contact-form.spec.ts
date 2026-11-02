// contact-form.feature (v0.3) → FORM-01..FORM-34. Form → Worker `gms-contact` → thư báo (Mailer giả) → web không giữ PII.
// Đi qua UI khi kịch bản nói "trang hiện"; đi thẳng POST /api/contact khi kịch bản nói về máy/địa chỉ/kích thước (postContact).
// [giả định — chờ khách] V3, V4, N27. Cửa điều khiển: XQ-20; lệnh build: XQ-21 (tên biến CONTACT_RECIPIENT là đề xuất).
import { expect, test } from '@playwright/test';
import { buildSite, htmlOf } from '../support/build';
import { control, pollUntil } from '../support/control';
import { companyFile } from '../support/fixtures';
import { type Locale, path } from '../support/routes';
import { bodyText, fillAndSubmit, open, postContact, RETRY_LATER, tid, VALID, VN_DIACRITIC } from '../support/ui';

const TO = 'lienhe@vi-du.test';
const T0 = '2026-10-31T02:15:00Z'; // 09:15 giờ Việt Nam
const ISO = (h: number, m = 0) => `2026-10-31T${String(h - 7).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`; // giờ VN → UTC
const ACK = { vi: /đã nhận|cảm ơn/i, en: /received|thank/i };

test.beforeEach(async () => {
  await control.reset();
  await control.recipient(TO);
  await control.policyVersion('1.0');
});
test.afterEach(async () => {
  await control.setNow(null);
  await control.failMail(false);
  await control.failStore(false);
});

const inbox = () => control.mailbox(TO);

test('FORM-01 Gửi thành công: GMS nhận 1 thư chữ thuần đủ nội dung (@S19 @cho-khach:V3 @cho-khach:V4)', async ({
  page,
}) => {
  await control.setNow(T0);
  await open(page, 'contact', 'vi');
  await fillAndSubmit(page, {
    name: 'Nguyễn Văn An',
    email: 'an@vi-du.test',
    message: 'Xin tài liệu về công nghệ VPD',
    consent: true,
  });
  await expect(tid(page, 'contact-success')).toBeVisible();
  expect(await bodyText(page)).toMatch(ACK.vi);
  const mails = await pollUntil(inbox, (m) => m.length >= 1, 120_000);
  expect(mails).toHaveLength(1);
  const m = mails[0];
  expect(m.contentType).toMatch(/^text\/plain/);
  for (const s of [
    'Nguyễn Văn An',
    'an@vi-du.test',
    'Xin tài liệu về công nghệ VPD',
    'vi',
    'Liên hệ',
    '31/10/2026 09:15',
    '1.0',
  ])
    expect(m.body, s).toContain(s);
  expect(m.body).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // không địa chỉ mạng
  expect(m.body).not.toMatch(/user-?agent|Mozilla|Chrome/i);
});

test('FORM-02 Thẻ HTML người gửi gõ chỉ đi vào thư chữ thuần (@S19 @risk:mail-relay)', async ({ page, request }) => {
  const evil = '<a href="http://lua-dao.test">bấm</a><script>x()</script>';
  const r = await postContact(request, { ...VALID, message: evil });
  expect(r.status).toBe(200);
  const m = (await pollUntil(inbox, (x) => x.length >= 1, 120_000))[0];
  expect(m.contentType).toMatch(/^text\/plain/);
  expect(m.body).toContain(evil);
  expect(m.body).not.toMatch(/<html|<body|Content-Type:\s*text\/html/i);
  for (const k of ['home', 'contact', 'news'] as const) {
    await open(page, k, 'vi');
    expect(await page.content()).not.toContain('lua-dao.test');
  }
});

for (const [loc, msg] of [
  ['vi', 'Vui lòng nhập email hoặc số điện thoại'],
  ['en', 'Please enter an email or a phone number'],
] as Array<[Locale, string]>) {
  test(`FORM-03 Bỏ trống cả email và SĐT: lỗi đúng ngôn ngữ (${loc}) (@S19 @risk:contact-normalize)`, async ({
    page,
  }) => {
    await open(page, 'contact', loc);
    await fillAndSubmit(page, { name: VALID.name, message: VALID.message, consent: true });
    await expect(page.getByText(msg, { exact: false }).first()).toBeVisible();
    expect(await inbox()).toHaveLength(0);
    const r = await postContact(page.context().request, { name: VALID.name, message: VALID.message }, { locale: loc });
    expect(r.status).toBe(422);
    expect(r.json?.code).toBe('VALIDATION');
    expect(JSON.stringify(r.json?.fields ?? {})).toContain(msg);
  });
}

test('FORM-04 Email sai dạng: lỗi tiếng Anh ở trang EN, không có chữ Việt (@S19 @risk:locale-error)', async ({
  page,
}) => {
  await open(page, 'contact', 'en');
  await fillAndSubmit(page, { name: 'An', email: 'an@', message: 'Hello', consent: true });
  await expect(tid(page, 'contact-error').first()).toBeVisible();
  const text = (await tid(page, 'contact-error').allInnerTexts()).join(' ');
  expect(text.trim().length).toBeGreaterThan(0);
  expect(text).not.toMatch(VN_DIACRITIC);
  expect(await inbox()).toHaveLength(0);
});

for (const typed of ['0987998370', '098 799 83 70', '+84 98 799 83 70', '+84987998370']) {
  test(`FORM-05 SĐT "${typed}" chuẩn hoá về +84987998370 (@S19 @risk:contact-normalize)`, async ({ request }) => {
    const r = await postContact(request, { name: VALID.name, phone: typed, message: VALID.message, consent: true });
    expect(r.status).toBe(200);
    const mails = await pollUntil(inbox, (m) => m.length >= 1, 120_000);
    expect(mails[0].body).toContain('+84987998370');
  });
}

test('FORM-06 Gửi lại cùng nội dung trong 10 phút chỉ một thư; cả hai lần có xác nhận (@S19 @risk:duplicate-submit)', async ({
  request,
}) => {
  const a = await postContact(request, { ...VALID, email: ' An@Vi-Du.test ' });
  const b = await postContact(request, { ...VALID, email: 'an@vi-du.test' });
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.json?.ok).toBe(true);
  expect(b.json?.ok).toBe(true);
  await control.runCron();
  expect(await inbox()).toHaveLength(1);
});

test('FORM-07 Cùng email, hai nội dung khác: hai thư, mỗi thư một nội dung (@S19 @risk:duplicate-submit)', async ({
  request,
}) => {
  await postContact(request, { ...VALID, message: 'Nội dung thứ nhất' });
  await postContact(request, { ...VALID, message: 'Nội dung thứ hai' });
  const mails = await pollUntil(inbox, (m) => m.length >= 2, 120_000);
  expect(mails).toHaveLength(2);
  expect(mails.filter((m) => m.body.includes('Nội dung thứ nhất'))).toHaveLength(1);
  expect(mails.filter((m) => m.body.includes('Nội dung thứ hai'))).toHaveLength(1);
});

test('FORM-08 Dịch vụ thư lỗi 09:00–15:00: trang vẫn xác nhận, sau 15:00 có đúng 1 thư đủ nội dung (@S19 @risk:mail-failure)', async ({
  page,
}) => {
  await control.failMail(true, ISO(9), ISO(15));
  await control.setNow(ISO(9, 10));
  await open(page, 'contact', 'vi');
  await fillAndSubmit(page, { name: VALID.name, email: VALID.email, message: VALID.message, consent: true });
  await expect(tid(page, 'contact-success')).toBeVisible();
  await control.runCron(ISO(12));
  expect(await inbox()).toHaveLength(0);
  await control.runCron(ISO(15, 1));
  const mails = await inbox();
  expect(mails).toHaveLength(1);
  for (const s of [VALID.name, VALID.email, VALID.message]) expect(mails[0].body).toContain(s);
});

test('FORM-09 Lỗi thư liên tục 25 giờ: sau 24 giờ có 1 cảnh báo không PII, liên hệ vẫn giữ (@S19 @risk:mail-failure)', async ({
  request,
}) => {
  const start = ISO(9);
  await control.failMail(true, start, '2026-11-01T11:00:00Z'); // 25 giờ
  await control.setNow(start);
  const r = await postContact(request, VALID);
  expect(r.status).toBe(200);
  await control.runCron('2026-11-01T01:30:00Z'); // 18,5 giờ: chưa tới 24 giờ
  expect(await control.alerts()).toHaveLength(0);
  await control.runCron('2026-11-01T02:05:00Z'); // > 24 giờ
  const alerts = await control.alerts();
  expect(alerts).toHaveLength(1);
  expect(alerts[0].subject + alerts[0].body).toMatch(/có liên hệ chưa gửi được thư báo/);
  for (const pii of [VALID.name, VALID.email, VALID.message])
    expect(alerts[0].subject + alerts[0].body).not.toContain(pii);
  await control.runCron('2026-11-01T02:10:00Z');
  expect(await control.alerts(), 'không cảnh báo lặp mỗi lượt Cron').toHaveLength(1);
  await control.failMail(false);
  await control.runCron('2026-11-01T12:00:00Z');
  const mails = await inbox();
  expect(mails).toHaveLength(1);
  expect(mails[0].body).toContain(VALID.message);
});

test('FORM-10 Nơi giữ tạm lỗi thì KHÔNG báo đã nhận, giữ chữ đã nhập, gợi cách liên hệ khác (@S19 @risk:mail-failure)', async ({
  page,
  request,
}) => {
  await control.failStore(true);
  const api = await postContact(request, VALID);
  expect(api.status).toBe(503);
  expect(api.json?.ok).toBe(false);
  expect(api.json?.code).toBe('STORE_FAILED');
  await open(page, 'contact', 'vi');
  await fillAndSubmit(page, { name: VALID.name, email: VALID.email, message: VALID.message, consent: true });
  await expect(tid(page, 'contact-success')).toHaveCount(0);
  await expect(tid(page, 'contact-error').first()).toBeVisible();
  expect(await bodyText(page)).not.toMatch(ACK.vi);
  await expect(tid(page, 'contact-name')).toHaveValue(VALID.name);
  await expect(tid(page, 'contact-message')).toHaveValue(VALID.message);
  await expect(tid(page, 'contact-error').first().locator('a[href^="tel:"]')).toHaveCount(1); // SĐT trong Thông tin công ty
  expect(await inbox()).toHaveLength(0);
});

test('FORM-11 Form không gửi thư tới địa chỉ người gửi nhập (@S19 @risk:mail-relay)', async ({ request }) => {
  await postContact(request, { ...VALID, email: 'nan-nhan@vi-du.test' });
  await control.runCron();
  expect(await control.mailbox('nan-nhan@vi-du.test')).toHaveLength(0);
  const all = await control.mailbox();
  expect(all.length).toBeGreaterThan(0);
  expect(new Set(all.map((m) => m.to))).toEqual(new Set([TO]));
  for (const m of all) {
    expect(m.headers['cc'] ?? '').toBe('');
    expect(m.headers['bcc'] ?? '').toBe('');
  }
});

test('FORM-12 Tiêu đề thư không cho chèn dòng từ tên người gửi (@S19 @risk:mail-relay) [qa thêm]', async ({
  request,
}) => {
  const r = await postContact(request, { ...VALID, name: 'An\r\nBcc: nan-nhan@vi-du.test' });
  expect([200, 422]).toContain(r.status);
  await control.runCron();
  for (const m of await control.mailbox()) {
    expect(m.subject).not.toMatch(/[\r\n]/);
    expect(m.headers['bcc'] ?? '').toBe('');
  }
  expect(await control.mailbox('nan-nhan@vi-du.test')).toHaveLength(0);
});

test('FORM-13 Dữ liệu cá nhân không vào log ứng dụng, log lỗi, URL (@S19 @risk:pii-log)', async ({ page, request }) => {
  await open(page, 'contact', 'vi');
  await fillAndSubmit(page, {
    name: 'Nguyễn Văn An',
    email: 'an@vi-du.test',
    phone: '0987998370',
    message: 'Xin tài liệu',
    consent: true,
  });
  await postContact(request, {
    name: 'Nguyễn Văn An',
    email: 'an@vi-du.test',
    phone: '0987998370',
    message: 'Xin tài liệu',
    consent: false,
  }); // đường lỗi
  await control.failMail(true);
  await postContact(request, {
    name: 'Nguyễn Văn An',
    email: 'an@vi-du.test',
    phone: '0987998370',
    message: 'Xin tài liệu 2',
  });
  await control.runCron();
  const { text } = await control.appLogs();
  for (const s of ['Nguyễn Văn An', 'Nguyen Van An', 'an@vi-du.test', 'an%40vi-du.test', '0987998370', '+84987998370'])
    expect(text, s).not.toContain(s);
  expect(page.url()).not.toMatch(/an@|an%40|0987998370|Nguy/);
});

test('FORM-14 Thư đã gửi thì phía web không còn họ tên, email, SĐT, nội dung (@S19 @risk:pii-log)', async ({
  request,
}) => {
  await control.setNow(ISO(9, 12));
  await postContact(request, {
    name: 'Nguyễn Văn An',
    email: 'an@vi-du.test',
    phone: '0987998370',
    message: 'Lời nhắn riêng tư số 14',
  });
  await control.runCron(ISO(9, 13));
  expect((await inbox()).length).toBe(1);
  await control.runCron('2026-11-01T02:12:00Z'); // 09:12 ngày 01/11/2026 giờ VN
  const { text } = await control.storeDump();
  for (const s of ['Nguyễn Văn An', 'an@vi-du.test', '0987998370', '+84987998370', 'Lời nhắn riêng tư số 14'])
    expect(text, s).not.toContain(s);
});

test('FORM-15 Chưa có email nhận thì bản build không có form, vẫn còn cách liên hệ khác (@S19 @cho-khach:V3 @kiem-luc-build)', () => {
  const r = buildSite({ ...companyFile() }, { CONTACT_RECIPIENT: '' });
  expect(r.ok, r.log).toBe(true);
  for (const loc of ['vi', 'en'] as Locale[]) {
    const html = htmlOf(r, path('contact', loc))!;
    expect(html).not.toContain('data-testid="contact-form"');
    expect(html).toContain('tel:');
  }
});

test('FORM-16 API đóng khi cấu hình thiếu email nhận (@S19 @cho-khach:V3) [qa thêm: lớp Worker]', async ({
  request,
}) => {
  await control.recipient(null);
  const r = await postContact(request, VALID);
  expect(r.status).toBe(503);
  expect(r.json?.code).toBe('FORM_DISABLED');
});

test('FORM-17 Ô đồng ý không tick sẵn, có liên kết chính sách bản vi, gắn phiên bản vào thư (@S20 @risk:policy-version)', async ({
  page,
}) => {
  await open(page, 'contact', 'vi');
  await expect(tid(page, 'contact-consent')).not.toBeChecked();
  await expect(tid(page, 'contact-consent-label').locator(`a[href="${path('privacy', 'vi')}"]`)).toHaveCount(1);
  await fillAndSubmit(page, { name: VALID.name, email: VALID.email, message: VALID.message, consent: true });
  await expect(tid(page, 'contact-success')).toBeVisible();
  const m = (await pollUntil(inbox, (x) => x.length >= 1, 120_000))[0];
  expect(m.body).toContain('1.0');
});

for (const loc of ['vi', 'en'] as Locale[]) {
  test(`FORM-18 Nhãn đồng ý nêu loại dữ liệu, mục đích, bên kiểm soát, không dẫn số văn bản (${loc}) (@S20 @cho-khach:N27)`, async ({
    page,
  }) => {
    await open(page, 'contact', loc);
    const label = (await tid(page, 'contact-consent-label').innerText()).trim();
    expect(label).toContain('Công ty Mẫu GMS');
    if (loc === 'vi') {
      expect(label).toMatch(/họ tên/i);
      expect(label).toMatch(/email|số điện thoại/i);
      expect(label).toMatch(/nội dung/i);
      expect(label).toMatch(/trả lời/i);
    } else {
      expect(label.replace('Công ty Mẫu GMS', '')).not.toMatch(VN_DIACRITIC);
      expect(label).toMatch(/name/i);
      expect(label).toMatch(/email|phone/i);
      expect(label).toMatch(/message/i);
      expect(label).toMatch(/reply|respond|answer/i);
    }
    expect(label).not.toMatch(/Nghị định|13\/2023|356\/2025|91\/2025|Decree|Law No/i);
  });
}

test('FORM-19 Chưa có tên pháp lý thì bản build không có form (@S20 @cho-khach:N27 @kiem-luc-build)', () => {
  const r = buildSite({ ...companyFile({ legalName: null }) });
  expect(r.ok, r.log).toBe(true);
  const html = htmlOf(r, path('contact', 'vi'))!;
  expect(html).not.toContain('data-testid="contact-form"');
  expect(html).toContain('tel:');
});

test('FORM-20 Không tick đồng ý thì không gửi, lỗi tiếng Anh yêu cầu đồng ý (@S20)', async ({ page, request }) => {
  await open(page, 'contact', 'en');
  await fillAndSubmit(page, { name: 'An', email: VALID.email, message: 'Hello', consent: false });
  const err = (await tid(page, 'contact-error').allInnerTexts()).join(' ');
  expect(err).toMatch(/consent|agree/i);
  expect(err).not.toMatch(VN_DIACRITIC);
  const r = await postContact(request, { ...VALID, consent: false }, { locale: 'en' });
  expect(r.status).toBe(422);
  expect(await inbox()).toHaveLength(0);
});

test('FORM-21 Bản deploy có chính sách 1.1 thì thư sau đó ghi 1.1; form cũ (1.0) bị POLICY_CHANGED (@S20 @risk:policy-version)', async ({
  request,
}) => {
  await postContact(request, VALID);
  await control.policyVersion('1.1');
  const stale = await postContact(request, { ...VALID, message: 'Từ trang cũ' });
  expect(stale.status).toBe(409);
  expect(stale.json?.code).toBe('POLICY_CHANGED');
  const fresh = await postContact(request, { ...VALID, message: 'Từ trang mới', policyVersion: '1.1' });
  expect(fresh.status).toBe(200);
  await control.runCron();
  const mails = await inbox();
  expect(mails.find((m) => m.body.includes(VALID.message))?.body).toContain('1.0');
  expect(mails.find((m) => m.body.includes('Từ trang mới'))?.body).toContain('1.1');
  expect(mails.some((m) => m.body.includes('Từ trang cũ'))).toBe(false);
});

test('FORM-22 Ô bẫy bị điền thì không có thư báo (@S21 @risk:spam-flood)', async ({ page, request }) => {
  await open(page, 'contact', 'vi');
  await fillAndSubmit(page, {
    name: VALID.name,
    email: VALID.email,
    message: VALID.message,
    trap: 'bot@spam.test',
    consent: true,
  });
  const r = await postContact(request, { ...VALID, trap: 'bot@spam.test' });
  expect([200, 400, 422]).toContain(r.status);
  await control.runCron();
  expect(await inbox()).toHaveLength(0);
});

test('FORM-23 Lần gửi thứ 6 trong 10 phút từ một địa chỉ bị từ chối; còn đúng 5 thư (@S21 @risk:spam-flood)', async ({
  request,
}) => {
  const ip = '198.51.100.10';
  for (let i = 1; i <= 5; i++)
    expect((await postContact(request, { ...VALID, message: `Lần ${i}` }, { ip })).status, `lần ${i}`).toBe(200);
  const sixth = await postContact(request, { ...VALID, message: 'Lần 6' }, { ip, locale: 'vi' });
  expect(sixth.status).toBe(429);
  expect(sixth.json?.code).toBe('RATE_LIMITED');
  expect(Number(sixth.headers['retry-after'])).toBeGreaterThan(0);
  expect(JSON.stringify(sixth.json)).toMatch(RETRY_LATER.vi);
  const en = await postContact(request, { ...VALID, message: 'Lần 7' }, { ip, locale: 'en' });
  expect(JSON.stringify(en.json)).toMatch(RETRY_LATER.en);
  await control.runCron();
  expect(await inbox()).toHaveLength(5);
});

test('FORM-24 Lần gửi không thành công cũng bị đếm: 20 lần lỗi rồi lần 21 hợp lệ bị từ chối (@S21 @risk:spam-flood)', async ({
  request,
}) => {
  const ip = '198.51.100.11';
  await control.seedAttempts(ip, 10, 'trap');
  await control.seedAttempts(ip, 10, 'invalid');
  const r = await postContact(request, VALID, { ip });
  expect(r.status).toBe(429);
  expect(JSON.stringify(r.json)).toMatch(RETRY_LATER.vi);
  await control.runCron();
  expect(await inbox()).toHaveLength(0);
});

test('FORM-25 Đổi địa chỉ IPv6 trong cùng /64 không lách được trần (@S21 @risk:spam-flood)', async ({ request }) => {
  for (const s of ['a', 'b', 'c', 'd', 'e'])
    expect((await postContact(request, { ...VALID, message: `v6 ${s}` }, { ip: `2001:db8:1:1::${s}` })).status).toBe(
      200,
    );
  const f = await postContact(request, { ...VALID, message: 'v6 f' }, { ip: '2001:db8:1:1::f' });
  expect(f.status).toBe(429);
  expect(JSON.stringify(f.json)).toMatch(RETRY_LATER.vi);
  expect((await postContact(request, { ...VALID, message: 'v6 khác /64' }, { ip: '2001:db8:1:2::a' })).status).toBe(
    200,
  );
});

test('FORM-26 Header địa chỉ gốc tự đặt không lách được trần (@S21 @risk:spam-flood)', async ({ request }) => {
  const ip = '198.51.100.12';
  for (let i = 1; i <= 5; i++)
    expect((await postContact(request, { ...VALID, message: `Lần ${i}` }, { ip })).status).toBe(200);
  const spoof = await postContact(
    request,
    { ...VALID, message: 'Lần 6 giả mạo' },
    {
      ip,
      headers: { 'X-Forwarded-For': '203.0.113.77', 'X-Real-IP': '203.0.113.77', 'True-Client-IP': '203.0.113.77' },
    },
  );
  expect(spoof.status).toBe(429);
  expect(JSON.stringify(spoof.json)).toMatch(RETRY_LATER.vi);
});

test('FORM-27 Vượt trần thư theo giờ: 12 liên hệ gộp vào đúng 1 thư tóm tắt trước 10:02, không mất (@S21 @risk:spam-flood)', async ({
  request,
}) => {
  await control.setNow(ISO(9, 40));
  await control.seedNotifyCount(30, ISO(9));
  for (let i = 1; i <= 12; i++) {
    const r = await postContact(
      request,
      { name: `Người ${i}`, email: `n${i}@vi-du.test`, message: `Lời nhắn số ${i}` },
      { ip: `198.51.100.${100 + i}` },
    );
    expect(r.status, `liên hệ ${i}`).toBe(200);
  }
  await control.runCron(ISO(9, 45));
  expect(await inbox(), 'không thư riêng nào trong khung 09:00–10:00').toHaveLength(0);
  await control.runCron(ISO(10, 1));
  const mails = await inbox();
  expect(mails).toHaveLength(1);
  expect(mails[0].body).toContain('12');
  for (let i = 1; i <= 12; i++)
    for (const s of [`Người ${i}`, `n${i}@vi-du.test`, `Lời nhắn số ${i}`]) expect(mails[0].body, s).toContain(s);
});

test('FORM-28 Vượt trần thư theo ngày: liên hệ thứ 46 gộp vào thư tóm tắt trước 15:02 (@S21 @risk:spam-flood)', async ({
  request,
}) => {
  await control.setNow(ISO(14, 20));
  await control.seedNotifyCount(45, '2026-10-30T07:20:00Z'); // 45 thư riêng trong 24 giờ trước 14:20 (giờ VN)
  const r = await postContact(request, { name: 'Người 46', email: 'n46@vi-du.test', message: 'Lời nhắn thứ 46' });
  expect(r.status).toBe(200);
  await control.runCron(ISO(14, 30));
  expect(await inbox(), 'không thư riêng').toHaveLength(0);
  await control.runCron(ISO(15, 1));
  const mails = await inbox();
  expect(mails).toHaveLength(1);
  for (const s of ['Người 46', 'n46@vi-du.test', 'Lời nhắn thứ 46']) expect(mails[0].body).toContain(s);
});

const TOO_LONG: Array<[string, 'name' | 'company' | 'message' | 'email' | 'phone', number, string]> = [
  ['họ tên', 'name', 201, 'fullName'],
  ['công ty', 'company', 201, 'company'],
  ['nội dung', 'message', 5001, 'message'],
  ['email', 'email', 255, 'email'],
  ['số điện thoại', 'phone', 21, 'phone'],
];
for (const [label, key, len, apiField] of TOO_LONG) {
  test(`FORM-29 Trường "${label}" dài ${len} ký tự bị từ chối, nêu đúng trường (@S21 @risk:spam-flood)`, async ({
    request,
  }) => {
    const value =
      key === 'email'
        ? 'a'.repeat(len - '@vi-du.test'.length) + '@vi-du.test'
        : key === 'phone'
          ? '0'.repeat(len)
          : 'x'.repeat(len);
    const base = key === 'phone' ? { ...VALID, email: undefined } : VALID;
    const r = await postContact(request, { ...base, [key]: value });
    expect(r.status).toBe(422);
    expect(r.json?.code).toBe('VALIDATION');
    expect(Object.keys(r.json?.fields ?? {})).toContain(apiField);
    expect((r.json?.fields ?? {})[apiField]).toMatch(/quá dài/i);
    await control.runCron();
    expect(await inbox()).toHaveLength(0);
  });
}

test('FORM-30 Yêu cầu thân 33 KB bị từ chối, không có thư (@S21 @risk:spam-flood)', async ({ request }) => {
  const r = await postContact(request, VALID, {
    raw: JSON.stringify({ ...VALID, fullName: VALID.name, message: 'x'.repeat(33 * 1024) }),
  });
  expect(r.status).toBe(413);
  await control.runCron();
  expect(await inbox()).toHaveLength(0);
});

test('FORM-31 Họ tên 200 ký tự và nội dung 5000 ký tự vẫn được nhận đủ (@S21)', async ({ request }) => {
  const name = 'Â'.repeat(200);
  const message = 'ệ'.repeat(5000);
  const r = await postContact(request, { ...VALID, name, message });
  expect(r.status).toBe(200);
  const m = (await pollUntil(inbox, (x) => x.length >= 1, 120_000))[0];
  expect(m.body).toContain(name);
  expect(m.body).toContain(message);
});

test('FORM-32 Sai content-type bị từ chối 415; thiếu token người-thật bị từ chối 403 (@S21) [qa thêm: contract api.ts]', async ({
  request,
}) => {
  const r = await request.post('/api/contact', { headers: { 'content-type': 'text/plain' }, data: 'x' });
  expect(r.status()).toBe(415);
  const bad = await request.post('/api/contact', {
    data: {
      locale: 'vi',
      fullName: 'An',
      email: VALID.email,
      message: 'Hi',
      consent: true,
      policyVersion: '1.0',
      turnstileToken: '',
    },
  });
  expect(bad.status()).toBe(403);
  expect((await bad.json()).code).toBe('HUMAN_CHECK_FAILED');
  expect(await inbox()).toHaveLength(0);
});

test('FORM-33 Sức khoẻ: /api/contact/health báo ok, tuổi Cron, số hàng chờ — không lộ PII (@S19) [qa thêm: contract api.ts]', async ({
  request,
}) => {
  await postContact(request, VALID);
  const r = await request.get('/api/contact/health');
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.ok).toBe(true);
  expect(typeof j.lastCronAgeSec).toBe('number');
  expect(typeof j.pending).toBe('number');
  expect(JSON.stringify(j)).not.toContain(VALID.email);
});

test('FORM-34 Trang EN: xác nhận bằng tiếng Anh sau khi gửi (@S19 @risk:locale-error)', async ({ page }) => {
  await open(page, 'contact', 'en');
  await fillAndSubmit(page, { name: 'An', email: VALID.email, message: 'Hello GMS', consent: true });
  await expect(tid(page, 'contact-success')).toBeVisible();
  const t = await tid(page, 'contact-success').innerText();
  expect(t).toMatch(ACK.en);
  expect(t).not.toMatch(VN_DIACRITIC);
});
