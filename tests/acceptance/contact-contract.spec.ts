// Contract lượt 9–10 (api.ts §5b–§5d, §12; test-control.ts; d1-schema.sql) + ca appsec XQ-35 (Q10-1..4, M31, M30-b).
// Nguồn kỳ vọng: threat-model.md §00000.4/XQ-35, design.md §6g, contracts/README "Lượt 10". Mọi tên op theo test-control.ts.
// Ca nào Worker chưa đạt thì để ĐỎ (không nới); xem bug-report ở 04-build/.
import { expect, test } from '@playwright/test';
import { control } from '../support/control';
import { VALID, postContact } from '../support/ui';

const TO = 'lienhe@vi-du.test';
const HOUR0 = '2026-10-31T03:00:00Z'; // 10:00 giờ VN
const at = (min: number) => new Date(Date.parse(HOUR0) + min * 60_000).toISOString();
const MARK = 'DONGHOADAUVET-7731';

test.beforeEach(async () => {
  await control.reset();
  await control.recipient(TO);
  await control.failMail(false);
  await control.humanCheck('pass');
});

// ---- Định dạng: 415 / 422 -------------------------------------------------------------------------------------------
test('CC-01 Content-Type sai hoặc thiếu ⇒ 415 UNSUPPORTED_MEDIA_TYPE, không ghi D1 (@S21 api.ts §5b)', async ({ request }) => {
  for (const headers of [
    { 'content-type': 'text/plain' },
    { 'content-type': 'application/x-www-form-urlencoded' },
    {} as Record<string, string>,
  ]) {
    const r = await request.post('/api/contact', { headers, data: Buffer.from('a=b') });
    expect(r.status(), JSON.stringify(headers)).toBe(415);
    expect((await r.json()).code).toBe('UNSUPPORTED_MEDIA_TYPE');
  }
  const dump = await control.storeDump();
  expect(dump.tables.outbox ?? []).toHaveLength(0);
});

test('CC-02 JSON có charset được nhận; 422 chỉ dành cho VALIDATION (@S21 api.ts §5b)', async ({ request }) => {
  const ok = await request.post('/api/contact', {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    data: JSON.stringify({
      locale: 'vi', fullName: VALID.name, email: VALID.email, message: VALID.message, consent: true,
      policyVersion: '1.0', turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX', pagePath: '/lien-he',
    }),
  });
  expect(ok.status()).toBe(200);
  const bad = await postContact(request, { ...VALID, email: 'khong-phai-email' });
  expect(bad.status).toBe(422);
  expect(bad.json?.code).toBe('VALIDATION');
});

// ---- M31: 8 mode Turnstile ------------------------------------------------------------------------------------------
const MODES: Array<[Parameters<typeof control.humanCheck>[0], number, string | null]> = [
  ['pass', 200, null],
  ['fail', 403, 'HUMAN_CHECK_FAILED'],
  ['wrong-hostname', 403, 'HUMAN_CHECK_FAILED'],
  ['wrong-action', 403, 'HUMAN_CHECK_FAILED'],
  ['error', 503, 'HUMAN_CHECK_UNAVAILABLE'],
  ['timeout', 503, 'HUMAN_CHECK_UNAVAILABLE'],
  ['http-error', 503, 'HUMAN_CHECK_UNAVAILABLE'],
  ['bad-body', 503, 'HUMAN_CHECK_UNAVAILABLE'],
];
for (const [mode, status, code] of MODES) {
  test(`CC-03 M31 human-check "${mode}" ⇒ ${status}${code ? ` ${code}` : ''} (@S21 api.ts §12)`, async ({ request }) => {
    await control.humanCheck(mode);
    const r = await postContact(request, VALID, { ip: '198.51.100.31' });
    expect(r.status).toBe(status);
    if (code) {
      expect(r.json?.code).toBe(code);
      const dump = await control.storeDump();
      expect(dump.tables.outbox ?? [], 'không ghi D1 khi chưa qua kiểm tra người thật').toHaveLength(0);
      expect(dump.tables.rate_counter ?? [], 'lần chưa qua Turnstile không được đếm (S21)').toHaveLength(0);
    }
  });
}

for (const secret of ['', '1x0000000000000000000000000000000AA']) {
  test(`CC-04 M31 TURNSTILE_SECRET "${secret || '(rỗng)'}" ⇒ 503 FORM_DISABLED (@S19 api.ts §12)`, async ({ request }) => {
    await control.turnstileSecret(secret);
    const r = await postContact(request, VALID);
    expect(r.status).toBe(503);
    expect(r.json?.code).toBe('FORM_DISABLED');
    expect(await control.mailbox(TO)).toHaveLength(0);
  });
}
test('CC-04b Secret thường ⇒ nhận bình thường', async ({ request }) => {
  await control.turnstileSecret('0x4AAAAAAA-secret-that-khong-phai-test');
  expect((await postContact(request, VALID)).status).toBe(200);
});

// ---- S21: chỉ lần đã qua Turnstile mới tính vào 20 lần / 10 phút / IP -----------------------------------------------
test('CC-05 50 lần chưa qua Turnstile không tốn hạn mức; lần hợp lệ sau đó vẫn nhận (@S21)', async ({ request }) => {
  const ip = '198.51.100.41';
  await control.humanCheck('fail');
  for (let i = 0; i < 50; i++) expect((await postContact(request, VALID, { ip })).status).toBe(403);
  await control.humanCheck('pass');
  expect((await postContact(request, VALID, { ip })).status).toBe(200);
});

test('CC-06 Biên 20/21: 19 lần đã qua Turnstile ⇒ lần 20 nhận, lần 21 ⇒ 429 (@S21)', async ({ request }) => {
  const ip = '198.51.100.42';
  await control.seedAttempts(ip, 19, 'ok');
  expect((await postContact(request, { ...VALID, message: 'lần 20' }, { ip })).status).toBe(200);
  const r = await postContact(request, { ...VALID, message: 'lần 21' }, { ip });
  expect(r.status).toBe(429);
});

// ---- Giữ liên hệ chưa gửi tối đa 7 ngày, cảnh báo chỉ nêu số lượng (S19) ---------------------------------------------
test('CC-07 Liên hệ chưa gửi được: ngày 6 còn, sau 7 ngày xoá + cảnh báo chỉ có số lượng, không PII (@S19)', async ({ request }) => {
  await control.setNow(HOUR0);
  await control.failMail(true, 'permanent');
  expect((await postContact(request, { ...VALID, message: `giữ ${MARK}` })).status).toBe(200);
  await control.runCron(at(6 * 24 * 60));
  expect((await control.storeDump()).tables.outbox, 'ngày thứ 6 vẫn giữ').toHaveLength(1);
  await control.runCron(at(7 * 24 * 60 + 5));
  const dump = await control.storeDump();
  expect(dump.tables.outbox, 'sau 7 ngày phải xoá').toHaveLength(0);
  const alerts = await control.alerts();
  const text = alerts.map((a) => a.subject + a.body).join('\n');
  expect(text).toMatch(/\b1\b/);
  for (const pii of [VALID.name, VALID.email, VALID.message, MARK]) expect(text).not.toContain(pii);
});

// ---- Q10-1: 250 liên hệ trong 1 giờ ⇒ 3 phần, 3 hàng mail_log, đúng 1 SUMMARY_SPLIT ---------------------------------------
test('CC-08 Q10-1: 250 liên hệ trong một giờ ⇒ 3 phần qua 3 lượt Cron, 3 hàng mail_log summary, 1 SUMMARY_SPLIT, phần 2 không bị summaryMaxPerHour chặn (@S19 XQ-35)', async ({ request }) => {
  test.setTimeout(240_000);
  await control.setNow(at(1));
  await control.seedNotifyCount(30, HOUR0); // vượt trần thư riêng ⇒ sang đường tóm tắt
  for (let i = 0; i < 250; i++) {
    const r = await postContact(request, { ...VALID, message: `tóm tắt ${i}` }, { ip: `203.0.113.${(i % 250) + 1}` });
    expect(r.status, `liên hệ ${i}`).toBe(200);
  }
  const sizes: number[] = [];
  for (const k of [61, 62, 63]) {
    const before = (await control.mailbox(TO)).filter((m) => m.kind === 'summary').length;
    await control.runCron(at(k));
    const sums = (await control.mailbox(TO)).filter((m) => m.kind === 'summary');
    expect(sums.length, `lượt Cron thứ ${k - 60}`).toBe(before + 1);
    sizes.push((sums.at(-1)?.body.match(/tóm tắt \d+/g) ?? []).length);
  }
  expect(sizes).toEqual([100, 100, 50]);
  const rows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(rows).toHaveLength(3);
  const split = (await control.alerts()).filter((a) => /SUMMARY_SPLIT/.test(a.subject + a.body));
  expect(split, 'đúng 1 cảnh báo SUMMARY_SPLIT trong giờ đó').toHaveLength(1);
});

// ---- Giới hạn byte: 46 KiB mỗi thư, mail_log.code/summary_hour -------------------------------------------------------
test('CC-09 CRON_LIMITS: liên hệ lớn ⇒ tách phần, mỗi thư thô ≤ 46 KiB, mỗi phần có hàng mail_log summary + summary_hour (@S19)', async ({ request }) => {
  test.setTimeout(240_000);
  await control.setNow(at(1));
  await control.seedNotifyCount(30, HOUR0);
  const big = 'x'.repeat(4900);
  for (let i = 0; i < 16; i++)
    expect((await postContact(request, { ...VALID, message: `${i} ${big}` }, { ip: `203.0.113.${i + 1}` })).status).toBe(200);
  for (const k of [61, 62, 63, 64]) await control.runCron(at(k));
  const sums = (await control.mailbox(TO)).filter((m) => m.kind === 'summary');
  expect(sums.length).toBeGreaterThanOrEqual(2);
  for (const s of sums) expect(Buffer.byteLength(s.raw), 'thư thô ≤ 46 KiB').toBeLessThanOrEqual(46 * 1024);
  const rows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(rows).toHaveLength(sums.length);
  for (const r of rows) expect(r.summary_hour, 'summary_hour phải có').toBeTruthy();
});

// ---- Q10-3: marker không lọt log; last_error chỉ là mã --------------------------------------------------------------
for (const [name, setup] of [
  ['fail-mail permanent', async () => { await control.failMail(true, 'permanent'); }],
  ['fail-store', async () => { await control.failStore(true); }],
] as Array<[string, () => Promise<void>]>) {
  test(`CC-10 Q10-3: marker trong thân không có trong app-logs khi ${name}; outbox.last_error chỉ là mã (@S19 XQ-35)`, async ({ request }) => {
    await control.setNow(HOUR0);
    await setup();
    await postContact(request, { ...VALID, message: `gửi ${MARK}` });
    await control.failStore(false);
    await control.runCron(at(3));
    await control.runCron(at(6));
    expect((await control.appLogs()).text).not.toContain(MARK);
    for (const row of (await control.storeDump()).tables.outbox ?? [])
      expect(String(row.last_error ?? ''), 'last_error chỉ chứa mã lỗi').toMatch(/^[A-Z0-9_:-]{0,60}$/);
  });
}

// ---- Q10-4: hai run-cron chồng nhau ---------------------------------------------------------------------------------
test('CC-11 Q10-4: hai run-cron chạy chồng ⇒ mỗi liên hệ nằm đúng 1 thư (@S19 XQ-35)', async ({ request }) => {
  await control.setNow(HOUR0);
  await control.failMail(true);
  for (let i = 0; i < 5; i++) await postContact(request, { ...VALID, message: `chồng ${i}` }, { ip: `203.0.113.${i + 1}` });
  await control.failMail(false);
  await Promise.all([control.runCron(at(5)), control.runCron(at(5))]);
  const body = (await control.mailbox(TO)).map((m) => m.body).join('\n');
  for (let i = 0; i < 5; i++) expect(body.split(`chồng ${i}`).length - 1, `chồng ${i}`).toBe(1);
});

// ---- M30-b: ký tự điều khiển/Reply-To trong tên ----------------------------------------------------------------------
test('CC-12 M30-b: tên có "Reply-To:" hoặc ký tự điều khiển/U+2028 ⇒ 422 INVALID_CHARS (@S21)', async ({ request }) => {
  for (const name of ['A Reply-To: x@evil', 'An B', 'An\u0085B', 'An\u0000B']) {
    const r = await postContact(request, { ...VALID, name });
    expect(r.status, JSON.stringify(name)).toBe(422);
    expect(r.json?.code).toBe('VALIDATION');
  }
});

// ---- Q10-2 trên D1 cục bộ thật: chưa dựng được ca độc lập (xem test-plan §Ca chưa có) --------------------------------
test.fixme('CC-13 Q10-2: phần đầy maxSummaryContacts=100 trên D1 cục bộ thật — lease, không lỗi bound-parameter, bước xoá >7 ngày chạy (@S19 XQ-35)', async () => {
  // Cần op đặt outbox.attempts / chạy `wrangler d1 --local` ngoài Worker; chưa có op ⇒ ghi "chưa có" trong test-plan.
});
test.fixme('CC-14 design §6g: bản ghi đầu hàng đợi attempts ≥ 3 ⇒ phần thư chỉ chứa bản ghi đó', async () => {
  // Không có op seed outbox.attempts ⇒ XQ gửi backend/architect (test-plan).
});
