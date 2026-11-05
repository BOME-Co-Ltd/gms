// Contract lượt 9–10 (api.ts §5b–§5d, §12; test-control.ts; d1-schema.sql) + ca appsec XQ-35 (Q10-1..4, M31, M30-b).
// Nguồn kỳ vọng: threat-model.md §00000.4/XQ-35, design.md §6g, contracts/README "Lượt 10". Mọi tên op theo test-control.ts.
// Ca nào Worker chưa đạt thì để ĐỎ (không nới); xem bug-report ở 04-build/.
import { expect, test } from '@playwright/test';
import { CRON_LIMITS, OUTBOX } from '../../contracts/api';
import { control } from '../support/control';
import { postContact, VALID } from '../support/ui';

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
test('CC-01 Content-Type sai hoặc thiếu ⇒ 415 UNSUPPORTED_MEDIA_TYPE, không ghi D1 (@S21 api.ts §5b)', async ({
  request,
}) => {
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
      locale: 'vi',
      fullName: VALID.name,
      email: VALID.email,
      message: VALID.message,
      consent: true,
      policyVersion: '1.0',
      turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
      pagePath: '/lien-he',
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
  test(`CC-03 M31 human-check "${mode}" ⇒ ${status}${code ? ` ${code}` : ''} (@S21 api.ts §12)`, async ({
    request,
  }) => {
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
  test(`CC-04 M31 TURNSTILE_SECRET "${secret || '(rỗng)'}" ⇒ 503 FORM_DISABLED (@S19 api.ts §12)`, async ({
    request,
  }) => {
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

// prd §6 "Chống spam (S21)" có HAI trần: (2) 5 lần gửi THÀNH CÔNG / 10 phút; (3) 20 lần ĐÃ QUA Turnstile / 10 phút (đếm cả
// lần qua kiểm rồi bị từ chối). Seed 'ok' ghi cả bộ đếm thành công lẫn lần thử (test-control.ts) ⇒ vượt trần (2) ngay ở lần
// 6; để kiểm riêng biên 20/21 của trần (3) phải seed lần qua Turnstile nhưng KHÔNG thành công ('trap'). Biên 5/6 của trần
// (2): FORM-23 (5 lần thật rồi lần 6 ⇒ 429) và CC-06b dưới đây (seed 4 'ok' ⇒ lần 5 nhận, lần 6 ⇒ 429).
test('CC-06 Biên 20/21 (trần 3): 19 lần qua Turnstile nhưng bị từ chối ⇒ lần 20 nhận, lần 21 ⇒ 429 RATE_LIMITED (@S21)', async ({
  request,
}) => {
  const ip = '198.51.100.42';
  await control.seedAttempts(ip, 19, 'trap');
  expect((await postContact(request, { ...VALID, message: 'lần 20' }, { ip })).status, 'lần 20 còn trong trần').toBe(
    200,
  );
  const r = await postContact(request, { ...VALID, message: 'lần 21' }, { ip });
  expect(r.status).toBe(429);
  expect(r.json?.code).toBe('RATE_LIMITED');
});

test('CC-06b Biên 5/6 (trần 2): 4 lần thành công ⇒ lần 5 nhận, lần 6 ⇒ 429 RATE_LIMITED dù mới 6 lần thử (@S21)', async ({
  request,
}) => {
  const ip = '198.51.100.43';
  await control.seedAttempts(ip, 4, 'ok');
  expect((await postContact(request, { ...VALID, message: 'lần 5' }, { ip })).status, 'lần 5 còn trong trần').toBe(200);
  const r = await postContact(request, { ...VALID, message: 'lần 6' }, { ip });
  expect(r.status).toBe(429);
  expect(r.json?.code).toBe('RATE_LIMITED');
});

// ---- Giữ liên hệ chưa gửi tối đa 7 ngày, cảnh báo chỉ nêu số lượng (S19) ---------------------------------------------
test('CC-07 Liên hệ chưa gửi được: ngày 6 còn, sau 7 ngày xoá + cảnh báo chỉ có số lượng, không PII (@S19)', async ({
  request,
}) => {
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
test('CC-08 Q10-1: 250 liên hệ trong một giờ ⇒ 3 phần qua 3 lượt Cron, 3 hàng mail_log summary, 1 SUMMARY_SPLIT, phần 2 không bị summaryMaxPerHour chặn (@S19 XQ-35)', async ({
  request,
}) => {
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

// ---- Giới hạn byte của thư tóm tắt (api.ts CRON_LIMITS dòng 145–177) ---------------------------------------------------
// Đọc contract đúng nghĩa (sửa CC-09 cũ, vốn khẳng định "mỗi thư thô ≤ 46 KiB" — sai):
//  · bodyB64MaxBytes = 46 KiB là trần của MỘT khối liên hệ (dòng 157–159), không phải của cả thư;
//  · maxSummaryPartB64Bytes = 384 KiB là trần TỔNG length(body_b64) của MỘT phần thư tóm tắt (dòng 150–156);
//  · maxSummaryContacts = 100 là trần theo SỐ liên hệ; phần dừng ở trần nào tới trước (dòng 149–151).
// Khối mỗi liên hệ được nối liền trong thân base64 (design.md §6g: "Cron ghép thư chỉ là nối chuỗi"; khối đệm tới bội
// 57 byte ⇒ 76 ký tự + CRLF = 78 ký tự thô mỗi 57 byte, dòng 163). Thân thô không có ranh giới khối, nên đo khối bằng
// thân đã giải mã: khoảng giữa hai dấu `[#k]` đầu nội dung của hai liên hệ liền nhau, đổi sang cỡ base64 theo 78/57.
const CAP_PART = 384 * 1024;
const CAP_BLOCK = 46 * 1024;
const MAX_CONTACTS_PER_PART = 100;
const INTRO_SLACK = 2 * 1024; // dòng đầu thân (số liên hệ, số còn chờ — design.md §6g) nằm ngoài body_b64

const b64Of = (bytes: number) => Math.ceil(bytes / 57) * 78;
const tag = (k: number) => `[#${k}]`;
// Liên hệ cỡ tối đa của ContactSubmitRequest (api.ts §1): họ tên/công ty 200 ký tự, nội dung 5000 ký tự, mỗi ký tự 3 byte.
const maxContact = (k: number) => ({
  name: `${String(k).padStart(2, '0')}${'ế'.repeat(198)}`,
  company: 'ế'.repeat(200),
  email: `an${k}@vi-du.test`,
  phone: '+84 912 345 678',
  message: `${tag(k)} ${'ế'.repeat(5000 - tag(k).length - 1)}`,
  consent: true,
});

function analyze(mail: { raw: string; text: string }) {
  const rawBody = mail.raw
    .split(/\r?\n\r?\n/)
    .slice(1)
    .join('\n\n');
  const marks = [...mail.text.matchAll(/\[#(\d+)\]/g)].map((m) => ({ k: Number(m[1]), at: m.index ?? 0 }));
  const blocks = marks.map((m, i) => {
    const end = i + 1 < marks.length ? (marks[i + 1]?.at ?? mail.text.length) : mail.text.length;
    return b64Of(Buffer.byteLength(mail.text.slice(m.at, end)));
  });
  return { rawBodyBytes: Buffer.byteLength(rawBody), ids: marks.map((m) => m.k), blocks };
}

async function postMax(request: Parameters<typeof postContact>[0], n: number) {
  for (let k = 0; k < n; k++) {
    const r = await postContact(request, maxContact(k), { ip: `203.0.113.${k + 1}` });
    expect(r.status, `liên hệ ${k}`).toBe(200);
  }
}

test('CC-09 CRON_LIMITS (byte): ~400 KiB liên hệ cỡ tối đa (<100 liên hệ) ⇒ tách phần theo BYTE; mỗi khối ≤ 46 KiB, mỗi phần ≤ 384 KiB, mỗi phần có hàng mail_log summary + summary_hour, phần k gửi ở lượt Cron k (@S19 XQ-32)', async ({
  request,
}) => {
  test.setTimeout(240_000);
  const N = 18; // 18 × ~23 KiB base64 ≈ 400+ KiB; 18 < maxSummaryContacts ⇒ tách chỉ có thể do byte
  expect(N).toBeLessThan(MAX_CONTACTS_PER_PART);
  await control.setNow(at(1));
  await control.seedNotifyCount(30, HOUR0); // vượt trần thư riêng ⇒ sang đường tóm tắt
  await postMax(request, N);
  expect(
    (await control.mailbox(TO)).filter((m) => m.kind === 'summary'),
    'chưa tới giờ Cron ⇒ chưa có thư tóm tắt',
  ).toHaveLength(0);

  // Phần k gửi ở lượt Cron thứ k: mỗi lượt đúng 1 phần, cho tới khi hết hàng đợi (không khoảng trống).
  const increments: number[] = [];
  for (const k of [61, 62, 63, 64, 65]) {
    const before = (await control.mailbox(TO)).filter((m) => m.kind === 'summary').length;
    await control.runCron(at(k));
    increments.push((await control.mailbox(TO)).filter((m) => m.kind === 'summary').length - before);
  }
  expect(increments.slice(0, 2), 'phần 1 ở lượt Cron 1, phần 2 ở lượt Cron 2').toEqual([1, 1]);
  for (let i = 1; i < increments.length; i++)
    expect(increments[i], `lượt Cron ${i + 1}`).toBeLessThanOrEqual(increments[i - 1] ?? 0);
  const sums = (await control.mailbox(TO)).filter((m) => m.kind === 'summary');
  expect(sums.length, 'số phần = tổng các lượt').toBe(increments.reduce((a, b) => a + b, 0));
  expect(sums.length).toBeGreaterThanOrEqual(2);

  const parts = sums.map(analyze);
  // (i) mỗi khối liên hệ ≤ 46 KiB (bodyB64MaxBytes)
  for (const [p, part] of parts.entries())
    for (const [i, size] of part.blocks.entries())
      expect(size, `phần ${p + 1}, khối thứ ${i + 1} (liên hệ ${part.ids[i]})`).toBeLessThanOrEqual(CAP_BLOCK);
  // (ii) mỗi phần ≤ 384 KiB (maxSummaryPartB64Bytes): tổng các khối và thân thô
  for (const [p, part] of parts.entries()) {
    expect(
      part.blocks.reduce((a, b) => a + b, 0),
      `phần ${p + 1}: tổng khối`,
    ).toBeLessThanOrEqual(CAP_PART);
    expect(part.rawBodyBytes, `phần ${p + 1}: thân thô (+ dòng đầu)`).toBeLessThanOrEqual(CAP_PART + INTRO_SLACK);
  }
  // (iii) tách do BYTE, không do số: tổng > 384 KiB trong khi < 100 liên hệ, và phần 1 đã "đầy" (thêm khối kế sẽ vượt trần)
  const total = parts.flatMap((p) => p.blocks).reduce((a, b) => a + b, 0);
  expect(total, 'tổng thân phải vượt một phần thì tách mới do byte').toBeGreaterThan(CAP_PART);
  const first = parts[0];
  const second = parts[1];
  expect(first?.ids.length ?? 0, 'phần 1 không phải một liên hệ lẻ').toBeGreaterThan(1);
  expect(first?.ids.length ?? 0, 'phần 1 dừng vì byte, không vì số').toBeLessThan(MAX_CONTACTS_PER_PART);
  expect(
    (first?.blocks.reduce((a, b) => a + b, 0) ?? 0) + (second?.blocks[0] ?? 0),
    'thêm khối kế vào phần 1 sẽ vượt 384 KiB',
  ).toBeGreaterThan(CAP_PART);
  // không mất, không trùng liên hệ nào qua các phần
  expect(parts.flatMap((p) => p.ids).sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, k) => k));

  // mail_log: mỗi phần một hàng summary kèm summary_hour (cùng một giờ, vì mọi liên hệ cùng giờ tròn)
  const rows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(rows).toHaveLength(sums.length);
  for (const r of rows) expect(r.summary_hour, 'summary_hour phải có').toBeTruthy();
  expect(new Set(rows.map((r) => String(r.summary_hour))).size, 'mọi phần cùng một summary_hour').toBe(1);
  // design.md §6g: phần thứ 2 của một giờ ⇒ đúng 1 cảnh báo SUMMARY_SPLIT (không PII)
  const split = (await control.alerts()).filter((a) => /SUMMARY_SPLIT/.test(a.subject + a.body));
  expect(split, 'đúng 1 cảnh báo SUMMARY_SPLIT').toHaveLength(1);
});

test('CC-09b contact-form.feature:265–270 với liên hệ cỡ tối đa: 12 liên hệ ⇒ đúng 1 thư tóm tắt, một phần ≤ 384 KiB, đủ họ tên + cách liên hệ + nội dung của cả 12 (@S21 api.ts:152–156)', async ({
  request,
}) => {
  test.setTimeout(240_000);
  await control.setNow(at(1));
  await control.seedNotifyCount(30, HOUR0);
  await postMax(request, 12);
  expect(
    (await control.mailbox(TO)).filter((m) => m.kind === 'notify'),
    'không có thư báo riêng nào',
  ).toHaveLength(0);
  for (const k of [61, 62, 63]) await control.runCron(at(k));
  const sums = (await control.mailbox(TO)).filter((m) => m.kind === 'summary');
  expect(sums, 'đúng 1 thư tóm tắt').toHaveLength(1);
  const mail = sums[0];
  if (!mail) throw new Error('thiếu thư tóm tắt');
  const part = analyze(mail);
  expect(part.ids.sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, k) => k));
  for (const size of part.blocks) expect(size).toBeLessThanOrEqual(CAP_BLOCK);
  expect(
    part.blocks.reduce((a, b) => a + b, 0),
    '12 khối cỡ tối đa vẫn nằm trong một phần',
  ).toBeLessThanOrEqual(CAP_PART);
  expect(mail.text, 'dòng đầu ghi 12 liên hệ').toMatch(/\b12\b/);
  for (let k = 0; k < 12; k++) {
    const c = maxContact(k);
    expect(mail.text, `họ tên ${k}`).toContain(c.name);
    expect(mail.text, `email ${k}`).toContain(c.email);
    expect(mail.text, `nội dung ${k}`).toContain(c.message);
  }
  const rows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(rows, 'một hàng mail_log summary').toHaveLength(1);
  expect(
    (await control.alerts()).filter((a) => /SUMMARY_SPLIT/.test(a.subject + a.body)),
    'không tách ⇒ không SUMMARY_SPLIT',
  ).toHaveLength(0);
});

// ---- Q10-3: marker không lọt log; last_error chỉ là mã --------------------------------------------------------------
for (const [name, setup] of [
  [
    'fail-mail permanent',
    async () => {
      await control.failMail(true, 'permanent');
    },
  ],
  [
    'fail-store',
    async () => {
      await control.failStore(true);
    },
  ],
] as Array<[string, () => Promise<void>]>) {
  test(`CC-10 Q10-3: marker trong thân không có trong app-logs khi ${name}; outbox.last_error chỉ là mã (@S19 XQ-35)`, async ({
    request,
  }) => {
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
  for (let i = 0; i < 5; i++)
    await postContact(request, { ...VALID, message: `chồng ${i}` }, { ip: `203.0.113.${i + 1}` });
  await control.failMail(false);
  await Promise.all([control.runCron(at(5)), control.runCron(at(5))]);
  const body = (await control.mailbox(TO)).map((m) => m.body).join('\n');
  for (let i = 0; i < 5; i++) expect(body.split(`chồng ${i}`).length - 1, `chồng ${i}`).toBe(1);
});

// ---- M30-b: ký tự điều khiển/Reply-To trong tên ----------------------------------------------------------------------
// api.ts §2 (dòng 23–33, HEADER_UNSAFE_CHARS) + §3 (dòng 65–70, 81–85): họ tên/công ty có C0 (gồm CR đơn, LF, TAB), DEL, C1
// (gồm U+0085), U+2028/2029 ⇒ 422, code `VALIDATION`, `fields.<trường>` = `INVALID_CHARS` (INVALID_CHARS là mã TRƯỜNG,
// không phải mã lỗi cấp trên). Chuỗi "Reply-To:" KHÔNG có ký tự điều khiển thì không bị bộ cấm bắt ⇒ 200 (CC-12b): chỉ
// CR/LF mới chèn được header.
test('CC-12 M30-b: tên/công ty có ký tự điều khiển (CR/LF, NEL, NUL, U+2028…) ⇒ 422 VALIDATION + fields.<trường> = INVALID_CHARS (@S21)', async ({
  request,
}) => {
  for (const name of [
    'A\r\nReply-To: x@evil',
    'An\nB',
    'An\rB',
    'An\tB',
    'An\u007fB',
    'An B',
    'An B',
    'An\u0085B',
    'An\u0000B',
  ]) {
    const r = await postContact(request, { ...VALID, name });
    expect(r.status, JSON.stringify(name)).toBe(422);
    expect(r.json?.code, JSON.stringify(name)).toBe('VALIDATION');
    expect(r.json?.fields?.fullName, JSON.stringify(name)).toBe('INVALID_CHARS');
  }
  const c = await postContact(request, { ...VALID, company: 'Cty\r\nBcc: x@evil' });
  expect(c.status).toBe(422);
  expect(c.json?.code).toBe('VALIDATION');
  expect(c.json?.fields?.company).toBe('INVALID_CHARS');
  expect((await control.storeDump()).tables.outbox ?? [], 'bị từ chối thì không ghi D1').toHaveLength(0);
});

test('CC-12b M30-b: tên có chữ "Reply-To:" nhưng KHÔNG có ký tự điều khiển ⇒ 200, không bị coi là chèn header (@S21)', async ({
  request,
}) => {
  const r = await postContact(request, { ...VALID, name: 'A Reply-To: x@evil' });
  expect(r.status).toBe(200);
  expect(r.json?.ok).toBe(true);
});

// ---- Q10-2 / CC-14 trên D1 cục bộ thật, dựng bằng op seed-outbox (test-control.ts:81–103, lượt 11) -----------------------
// Chuỗi: reset (beforeEach) → seed-outbox → run-cron → đọc mailbox / store-dump / app-logs / alerts. Mọi số lấy từ contract
// (api.ts CRON_LIMITS, OUTBOX), không viết cứng. Adapter điền PII giả theo chỉ số dòng: email `seed-<i>@vi-du.test`
// (test-control.ts:86–90) ⇒ dùng email để đếm liên hệ trong thân thư.
const T = at(61); // 11:01 giờ VN: hết giờ tròn 10:00–11:00 ⇒ thư tóm tắt của giờ 10:00 đến hạn (design.md §6g bước 4)
const iso = (sec: number) => new Date(Date.parse(HOUR0) + sec * 1000).toISOString();
const seedIds = (text: string) => [...text.matchAll(/seed-(\d+)@vi-du\.test/g)].map((m) => Number(m[1]));
const summaries = async () => (await control.mailbox(TO)).filter((m) => m.kind === 'summary');
const outboxById = async () =>
  new Map(((await control.storeDump()).tables.outbox ?? []).map((r) => [String(r.id), r] as const));

test('CC-13 Q10-2: phần đầy maxSummaryContacts trên D1 cục bộ thật — Cron không lỗi bound-parameter, lease đúng (hai lượt chồng + lượt ngay sau không gửi lặp) (@S19 XQ-35; design.md §6g bước 4)', async () => {
  const N = CRON_LIMITS.maxSummaryContacts;
  // N liên hệ tóm tắt chưa gửi, created_at lệch 30 s, đều trước đầu giờ tròn của T (04:00Z ⇒ 03:00Z..03:49:30Z).
  const rows = Array.from({ length: N }, (_, i) => ({ batch: 'summary' as const, createdAtIso: iso(i * 30) }));
  const ids = await control.seedOutbox(rows);
  expect(ids, 'seed-outbox trả một id cho mỗi dòng').toHaveLength(N);
  expect(new Set(ids).size).toBe(N);

  await control.setNow(T);
  await Promise.all([control.runCron(T), control.runCron(T)]); // chồng nhau: chỉ một lượt lấy được lease
  await control.runCron(at(62)); // lượt ngay sau: các dòng đã gửi/đang lease ⇒ không gửi lại

  const sums = await summaries();
  expect(sums, 'đúng 1 thư tóm tắt cho phần đầy, không lặp').toHaveLength(1);
  const got = seedIds(sums[0]?.text ?? '');
  expect(got, 'mỗi liên hệ đúng 1 lần trong thân thư').toHaveLength(N);
  expect([...new Set(got)].sort((a, b) => a - b)).toEqual(Array.from({ length: N }, (_, i) => i));

  // design.md §6a (dòng 149): thứ tự gửi → ghi sent_at → xoá ⇒ Cron xoá dòng ngay trong lượt gửi được.
  // `OUTBOX.deleteSentWithinSeconds` là HẠN phải xoá xong, không phải thời gian giữ dòng.
  const byId = await outboxById();
  for (const [i, id] of ids.entries()) {
    expect(
      byId.has(id),
      `dòng ${i} đã gửi ⇒ không còn trong outbox (xoá trong ${OUTBOX.deleteSentWithinSeconds}s)`,
    ).toBe(false);
  }
  const logRows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(logRows, 'một hàng mail_log summary').toHaveLength(1);
  expect(
    (await control.alerts()).filter((a) => /SUMMARY_SPLIT/.test(a.subject + a.text)),
    'vừa một phần ⇒ không SUMMARY_SPLIT',
  ).toHaveLength(0);
  const { lines } = await control.appLogs();
  const dbErrors = lines.filter((l) =>
    /bound|too many (sql )?(variables|parameters)|SQLITE_|D1_ERROR|parameter/i.test(l),
  );
  expect(dbErrors, 'app-logs không có lỗi D1 / bound-parameter').toEqual([]);
});

test('CC-13c Q10-2: gửi lỗi ⇒ mọi dòng còn trong outbox, chưa sent_at, attempts ≥ 1, không có thư summary, không lỗi D1 (@S19 XQ-35; design.md §6g bước 4, dòng 149)', async () => {
  const N = CRON_LIMITS.maxSummaryContacts;
  const ids = await control.seedOutbox(
    Array.from({ length: N }, (_, i) => ({ batch: 'summary' as const, createdAtIso: iso(i * 30) })),
  );
  await control.setNow(T);
  await control.failMail(true); // dòng không được xoá vì chưa gửi được (design.md §6a: xoá chỉ sau gửi + ghi sent_at)
  await Promise.all([control.runCron(T), control.runCron(T)]);
  await control.runCron(at(62)); // cách T 60 s < leaseSeconds=120 ⇒ vẫn trong lease

  const byId = await outboxById();
  for (const [i, id] of ids.entries()) {
    const row = byId.get(id);
    expect(row, `dòng ${i} chưa gửi được ⇒ còn trong outbox`).toBeDefined();
    expect(row?.sent_at ?? null, `dòng ${i} chưa gửi`).toBeNull();
    // Gửi lỗi ⇒ lease được nhả (design không quy định giữ lease) nên mỗi lượt Cron có thể lấy lại: chỉ đòi ≥ 1.
    expect(Number(row?.attempts), `dòng ${i}: đã lấy lease ít nhất một lần`).toBeGreaterThanOrEqual(1);
  }
  expect(await summaries(), 'gửi lỗi ⇒ mailbox không có thư summary').toHaveLength(0);
  const { lines } = await control.appLogs();
  const dbErrors = lines.filter((l) =>
    /bound|too many (sql )?(variables|parameters)|SQLITE_|D1_ERROR|parameter/i.test(l),
  );
  expect(dbErrors, 'app-logs không có lỗi D1 / bound-parameter').toEqual([]);
});

test('CC-13b Q10-2: bước 3 xoá dòng quá OUTBOX.maxRetentionUnsentSeconds (kể cả dòng đã gửi), ≤ maxDeletesPerRun mỗi lượt; dòng chưa quá hạn còn nguyên (@S19 XQ-35; api.ts:215–217, 160–162)', async () => {
  const OLD = CRON_LIMITS.maxDeletesPerRun + 1; // đủ chạm trần xoá của một lượt
  const nowSec = Date.parse(T) / 1000;
  const sentIso = new Date((nowSec - 60) * 1000).toISOString(); // vừa gửi 1 phút trước: chưa tới hạn xoá dòng đã gửi
  const ago = (sec: number) => new Date((nowSec - sec) * 1000).toISOString();
  const oldIds = await control.seedOutbox(
    Array.from({ length: OLD }, (_, i) => ({
      batch: 'single' as const,
      createdAtIso: ago(OUTBOX.maxRetentionUnsentSeconds + 3600 + i), // quá hạn 1 giờ+
      sentAtIso: sentIso,
    })),
  );
  const [keepId] = await control.seedOutbox([
    { batch: 'single', createdAtIso: ago(OUTBOX.maxRetentionUnsentSeconds - 3600), sentAtIso: sentIso }, // còn 1 giờ nữa mới quá hạn
  ]);
  expect(oldIds).toHaveLength(OLD);

  await control.setNow(T);
  await control.runCron(T);
  let byId = await outboxById();
  const left1 = oldIds.filter((id) => byId.has(id)).length;
  const deleted1 = OLD - left1;
  expect(deleted1, 'lượt 1 xoá được dòng quá hạn trên D1 thật').toBeGreaterThan(0);
  expect(deleted1, `lượt 1 xoá ≤ maxDeletesPerRun=${CRON_LIMITS.maxDeletesPerRun}`).toBeLessThanOrEqual(
    CRON_LIMITS.maxDeletesPerRun,
  );

  await control.runCron(at(62));
  byId = await outboxById();
  expect(
    oldIds.filter((id) => byId.has(id)),
    'lượt 2 xoá nốt phần còn lại',
  ).toEqual([]);
  expect(byId.has(keepId ?? ''), 'dòng chưa quá hạn không bị xoá').toBe(true);
  const { lines } = await control.appLogs();
  expect(
    lines.filter((l) => /bound|too many (sql )?(variables|parameters)|SQLITE_|D1_ERROR|parameter/i.test(l)),
  ).toEqual([]);
});

// design.md §6g (dòng 207–219, 233) + api.ts:172–175: bản ghi đầu hàng (rn = 1, thứ tự (created_at, id)) có attempts ≥
// summaryHeadAttemptsIsolate ⇒ phần kế CHỈ gồm bản ghi đó. Id ngẫu nhiên ⇒ bản ghi đầu xác định nhờ created_at lệch ≥ 1 s.
const SIBLINGS = 4;
async function seedHeadAndSiblings(headAttempts: number) {
  const ids = await control.seedOutbox([
    { batch: 'summary', createdAtIso: iso(0), attempts: headAttempts },
    ...Array.from({ length: SIBLINGS }, (_, i) => ({ batch: 'summary' as const, createdAtIso: iso(60 * (i + 1)) })),
  ]);
  await control.setNow(T);
  return ids;
}

test('CC-14 design §6g: bản ghi đầu hàng attempts ≥ summaryHeadAttemptsIsolate ⇒ phần thư chỉ chứa bản ghi đó; phần sau đi tiếp, không mất liên hệ (@S19 XQ-35)', async () => {
  const head = CRON_LIMITS.summaryHeadAttemptsIsolate;
  const ids = await seedHeadAndSiblings(head);

  await control.runCron(T);
  let sums = await summaries();
  expect(sums, 'lượt 1: đúng 1 thư tóm tắt').toHaveLength(1);
  expect(seedIds(sums[0]?.text ?? ''), 'phần 1 chỉ gồm bản ghi đầu (seed-0)').toEqual([0]);
  let byId = await outboxById();
  // design.md §6a (dòng 149): gửi → ghi sent_at → xoá ⇒ bản ghi đầu đã gửi thì không còn trong outbox.
  expect(byId.has(ids[0] ?? ''), 'bản ghi đầu đã gửi ⇒ đã xoá khỏi outbox').toBe(false);
  for (const id of ids.slice(1)) {
    expect(byId.get(id)?.sent_at ?? null, 'bản ghi sau chưa bị kéo vào phần cô lập').toBeNull();
    expect(Number(byId.get(id)?.attempts), 'bản ghi sau chưa lấy lease').toBe(0);
  }

  await control.runCron(at(62));
  sums = await summaries();
  expect(sums, 'lượt 2: thêm 1 phần').toHaveLength(2);
  expect(
    seedIds(sums[1]?.text ?? '').sort((a, b) => a - b),
    'phần 2 gồm đủ các bản ghi còn lại, không có bản ghi đầu',
  ).toEqual(Array.from({ length: SIBLINGS }, (_, i) => i + 1));
  byId = await outboxById();
  for (const id of ids) expect(byId.has(id), 'mọi liên hệ đã gửi ⇒ outbox không còn dòng nào của lô').toBe(false);
  const logRows = ((await control.storeDump()).tables.mail_log ?? []).filter((r) => r.kind === 'summary');
  expect(logRows, 'hai phần ⇒ hai hàng mail_log summary').toHaveLength(2);
});

test('CC-14c design §6g: mail lỗi ⇒ bản ghi đầu attempts ≥ summaryHeadAttemptsIsolate ở lại outbox với attempts +1; bản ghi sau không bị kéo vào lease (@S19 XQ-35; design.md dòng 213, 225)', async () => {
  const head = CRON_LIMITS.summaryHeadAttemptsIsolate;
  const ids = await seedHeadAndSiblings(head);
  await control.failMail(true);

  await control.runCron(T);
  const byId = await outboxById();
  const first = byId.get(ids[0] ?? '');
  expect(first, 'bản ghi đầu chưa gửi được ⇒ còn trong outbox').toBeDefined();
  expect(first?.sent_at ?? null, 'bản ghi đầu chưa gửi').toBeNull();
  expect(Number(first?.attempts), 'attempts tăng +1 lúc lấy lease').toBe(head + 1);
  for (const id of ids.slice(1)) {
    expect(byId.get(id)?.sent_at ?? null, 'bản ghi sau chưa gửi').toBeNull();
    expect(Number(byId.get(id)?.attempts), 'bản ghi sau không nằm trong phần cô lập ⇒ chưa lấy lease').toBe(0);
  }
});

test('CC-14b biên: bản ghi đầu attempts = summaryHeadAttemptsIsolate − 1 ⇒ KHÔNG cô lập, cả hàng nằm chung một phần (@S19 XQ-35)', async () => {
  await seedHeadAndSiblings(CRON_LIMITS.summaryHeadAttemptsIsolate - 1);
  await control.runCron(T);
  const sums = await summaries();
  expect(sums, 'đúng 1 thư tóm tắt').toHaveLength(1);
  expect(seedIds(sums[0]?.text ?? '').sort((a, b) => a - b)).toEqual(Array.from({ length: SIBLINGS + 1 }, (_, i) => i));
});
