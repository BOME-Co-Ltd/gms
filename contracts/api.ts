// Contract HTTP của Worker `gms-contact` (lượt 5, 31/10/2026 — bỏ CMS; phần Payload/login/jobs đã xoá,
// xem README.md "Đổi ở lượt 5"). Nguồn: prd.md v0.5 §3b, §6; acceptance/contact-form.feature; design.md §6a.
// Lượt 8 (04/11): chỉ nhận JSON; trần 75/24 giờ; CRON_LIMITS (trần CPU 10 ms gói Free).
// Lượt 9 (04/11, XQ-32/M38, XQ-25(b)/M31, M29(1)): mã 415 riêng; trần BYTE mỗi phần tóm tắt; luật HumanCheck (§12);
// health thêm tuổi bản ghi quá hạn. README.md "Lượt 9".
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
import { z } from "zod";

export const Locale = z.enum(["vi", "en"]);
export type Locale = z.infer<typeof Locale>;

// §1 Giới hạn trường (giữ nguyên lượt 4)
export const CONTACT_LIMITS = {
  fullName: 200, company: 200, message: 5000, email: 254, phone: 20, bodyBytes: 32 * 1024,
} as const;

export const CONTACT_REQUIRED_MESSAGE = {
  vi: "Vui lòng nhập email hoặc số điện thoại",
  en: "Please enter an email or a phone number",
} as const;

// §2 Request
// XQ-25(a)/M30 (lượt 6): fullName, company có ký tự điều khiển ⇒ TỪ CHỐI (422, mã INVALID_CHARS), không làm sạch
// rồi nhận. Bộ cấm: C0 U+0000–U+001F (gồm CR đơn, LF, TAB), DEL U+007F, C1 U+0080–U+009F (gồm U+0085 NEL),
// U+2028, U+2029. Kiểm SAU trim (trim chỉ bỏ khoảng trắng hai đầu; CR/LF ở hai đầu cũng bị trim bỏ — chấp nhận,
// vì phần còn lại không mang được ký tự nào ở trên). message KHÔNG theo luật này (cần xuống dòng); message chỉ
// vào thân thư base64 (§8), không bao giờ vào header.
// M30-b (31/10): U+2028/U+2029 viết dạng thoát `\u{…}` + cờ `u`. Ký tự thô trong regex literal là
// LineTerminator ⇒ SyntaxError; xoá chúng cho hết lỗi thì hai ký tự lọt.
// biome-ignore lint/suspicious/noControlCharactersInRegex: chính là thứ cần chặn
export const HEADER_UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u{2028}\u{2029}]/u;
const HeaderSafeText = (max: number) =>
  z.string().trim().max(max).refine((v) => !HEADER_UNSAFE_CHARS.test(v), { message: "INVALID_CHARS" });

export const ContactSubmitRequest = z
  .object({
    locale: Locale,
    fullName: HeaderSafeText(CONTACT_LIMITS.fullName).pipe(z.string().min(1)),
    company: HeaderSafeText(CONTACT_LIMITS.company).optional(),
    email: z.string().trim().max(CONTACT_LIMITS.email).email().optional(),
    phone: z.string().trim().max(CONTACT_LIMITS.phone).regex(/^\+?[0-9 .-]{8,20}$/).optional(),
    message: z.string().trim().min(1).max(CONTACT_LIMITS.message),
    consent: z.literal(true),
    policyVersion: z.string().min(1).max(40),
    turnstileToken: z.string().min(1).max(2048), // Turnstile: ≤ 2048 ký tự, dùng một lần, sống 300 s
    pagePath: z.string().max(512).startsWith("/"), // trang nơi gửi (G2), Worker không tin để định tuyến
    utm: z.object({ source: z.string().max(100), medium: z.string().max(100), campaign: z.string().max(100) })
      .partial().optional(),
    website: z.string().max(0).optional(), // honeypot: có giá trị ⇒ 200 giả, không ghi
  })
  .refine((v) => Boolean(v.email || v.phone), { path: ["email"], message: "CONTACT_REQUIRED" });
export type ContactSubmitRequest = z.infer<typeof ContactSubmitRequest>;

export const CONTACT_ENDPOINT = "/api/contact";
export const CONTACT_HEALTH_ENDPOINT = "/api/contact/health"; // GET, không PII
// Lượt 8: CHỈ JSON (bỏ urlencoded). Form luôn gửi bằng fetch sau Turnstile (Q-UX-13: không có đường gửi khi tắt JS),
// nên không có `<form method=post>` cần urlencoded; urlencoded cũng không mang được `utm` lồng nhau và `consent: true`
// kiểu boolean. Thêm: application/json từ origin khác buộc trình duyệt preflight (CORS), Worker không trả OPTIONS ⇒
// trang lạ không gửi "simple request" vào được. Kiểu khác (gồm urlencoded, multipart, text/plain) hoặc thiếu header
// ⇒ 415 UNSUPPORTED_MEDIA_TYPE (lượt 9, XQ-32(e): một mã một status; VALIDATION luôn là 422).
// So khớp: phần trước ";" của Content-Type, hạ chữ thường, bỏ khoảng trắng; tham số charset bỏ qua.
export const CONTACT_CONTENT_TYPES = ["application/json"] as const;

// §3 Response
export const FieldErrorCode = z.enum([
  "REQUIRED", "TOO_LONG", "INVALID_EMAIL", "INVALID_PHONE", "CONTACT_REQUIRED", "CONSENT_REQUIRED",
  "INVALID_CHARS", // lượt 6, M30: fullName/company có ký tự điều khiển — câu chữ: [cần hỏi ux_ui]
]);
export const ContactErrorCode = z.enum([
  "VALIDATION",          // 422 — chỉ lỗi zod/trường; không bao giờ đi với status khác
  "UNSUPPORTED_MEDIA_TYPE", // 415 — lượt 9, XQ-32(e): Content-Type thiếu hoặc khác CONTACT_CONTENT_TYPES
  "POLICY_CHANGED",      // 409 — kèm policyVersion hiện hành (Q-UX-15)
  "PAYLOAD_TOO_LARGE",   // 413
  "HUMAN_CHECK_FAILED",  // 403 — Turnstile thiếu/trượt/sai hostname/sai action (§12)
  "HUMAN_CHECK_UNAVAILABLE", // 503 — lượt 9, M31: siteverify lỗi mạng/timeout/không 200/thân hỏng (§12). Không bao giờ coi là đạt
  "ORIGIN_REJECTED",     // 403 — lượt 6, M32: header Origin có mà khác SITE_ORIGIN
  "RATE_LIMITED",        // 429 + Retry-After
  "FORM_DISABLED",       // 503 (chưa có tên miền/Email Routing, tắt khẩn, hoặc TURNSTILE_SECRET rỗng/là secret thử §12)
  "STORE_FAILED",        // 503 — D1 lỗi: KHÔNG báo đã nhận
]);
export const CONTACT_HTTP_STATUS: Record<z.infer<typeof ContactErrorCode>, number> = {
  VALIDATION: 422, UNSUPPORTED_MEDIA_TYPE: 415, POLICY_CHANGED: 409, PAYLOAD_TOO_LARGE: 413,
  HUMAN_CHECK_FAILED: 403, HUMAN_CHECK_UNAVAILABLE: 503, ORIGIN_REJECTED: 403, RATE_LIMITED: 429,
  FORM_DISABLED: 503, STORE_FAILED: 503,
};
export const ContactSubmitOk = z.object({ ok: z.literal(true) });
export const ContactSubmitError = z.object({
  ok: z.literal(false),
  code: ContactErrorCode,
  fields: z.record(z.string(), FieldErrorCode).optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
  // Q-UX-15 (lượt 6): chỉ có khi code = POLICY_CHANGED. FE thay policyVersion đang giữ bằng giá trị này, bỏ tick
  // đồng ý, KHÔNG tải lại trang. Trang Chính sách (routes.ts privacy) luôn là bản mới nhất vì Static Assets và
  // Worker deploy cùng một phiên bản: 409 chỉ xảy ra khi trang được mở trước lần deploy đó.
  policyVersion: z.string().min(1).max(40).optional(),
});
export const ContactSubmitResponse = z.discriminatedUnion("ok", [ContactSubmitOk, ContactSubmitError]);
// Frontend: mọi phản hồi không phải 200 {ok:true} — kể cả 429/1027 của Cloudflare không có body JSON —
// hiện câu mời gọi điện/Zalo (design.md §7b), không bao giờ hiện "đã nhận".

// Lượt 9 (M38, M29(1)): heartbeat ghi ở bước 1 của Cron nên vẫn tươi khi lượt Cron bị ngắt ở bước tóm tắt ⇒ thêm
// oldestOverdueSec = tuổi (giây) của bản ghi chưa gửi QUÁ HẠN GỬI lâu nhất, 0 nếu không có. Hạn gửi: batch 'single' =
// created_at; batch 'summary' = hết giờ tròn chứa created_at + summaryDeliverWithinSecondsAfterHour. Chỉ là số, không id.
// ok = lastCronAgeSec ≤ OUTBOX.cronStaleAlertSeconds VÀ oldestOverdueSec ≤ OUTBOX.overdueAlertSeconds.
export const ContactHealth = z.object({
  ok: z.boolean(), lastCronAgeSec: z.number().int(), pending: z.number().int(), oldestOverdueSec: z.number().int().nonnegative(),
});

// §4 Ngưỡng (prd §6; XQ-14 bỏ login*)
// Lượt 6 (M29): cả hai bộ đếm ở D1 nhưng CHỈ chạy sau khi Turnstile đạt (design.md §6a bước 6–7, 10).
// Bộ đếm lần thử đọc trước: đã đủ max ⇒ 429, không ghi dòng ⇒ tối đa `max` dòng ghi / cửa sổ / khoá IP.
// Lớp trước Worker: luật rate limiting WAF (EDGE_RATE_LIMIT, devops cấu hình) — chặn ở edge, không gọi Worker.
export const RATE_LIMITS = {
  contactSuccessPerIp: { max: 5, windowSeconds: 600 },
  // Đếm mọi lần ĐÃ QUA Turnstile (bẫy, 422, 409, 429 thành công, thành công). Lần chưa qua Turnstile đã bị 403/415/413
  // và không bao giờ tới hộp thư; chúng bị luật WAF (EDGE_RATE_LIMIT) chặn dồn dập, không đếm ở D1 (M29: mỗi lần đếm
  // là một dòng ghi D1). Khớp prd v0.5.1 §6 Chống spam (3) (XQ-PM1/XQ-34 đã đóng: CÓ). 503 HUMAN_CHECK_UNAVAILABLE
  // không đếm (chưa qua kiểm).
  contactAttemptsPerIp: { max: 20, windowSeconds: 600 },
  ipv6PrefixBits: 64,
  dedupeWindowSeconds: 600,
  counterTtlSecondsMax: 3600,
} as const;

// §5 Trần thư (prd v0.5 §6 dòng Chống spam (4)(5); lượt 8: 75/24 giờ = 100 − 24 tóm tắt − 1 giám sát, không còn dự
// trữ thư đăng nhập CMS). send_email tới địa chỉ đã verify không tính quota nhà cung cấp (ADR-004 [S5b]) ⇒ trần chỉ
// chống ngập hộp thư GMS. notifyPerHour đếm theo GIỜ TRÒN Asia/Ho_Chi_Minh; notifyPer24h là 24 giờ TRƯỢT.
// Liên hệ vượt trần ⇒ outbox batch='summary', thư tóm tắt của giờ đó gửi ≤ 120 s sau khi hết giờ tròn.
export const MAIL_CAPS = {
  notifyPerHour: 30,
  notifyPer24h: 75,
  hourBoundaryTimeZone: "Asia/Ho_Chi_Minh",
  // Lượt 9: MỘT thư tóm tắt cho mỗi giờ tròn; thư đó tách "phần k/n" khi vượt CRON_LIMITS (trần số hoặc trần byte).
  // Mỗi phần ghi một dòng mail_log kind 'summary'. Mốc ≤ 120 s chỉ bảo đảm cho phần 1; phần k gửi ở lượt Cron thứ k
  // sau đó (mỗi phút một phần). Phần thứ 2 của một giờ ⇒ một cảnh báo không PII (MAIL_ALERT_CODES.summaryParts).
  summaryMaxPerHour: 1,
  summaryDeliverWithinSecondsAfterHour: 120,
  firstSendWithinSeconds: 120,
} as const;

// §5b Ngân sách CPU (lượt 8). Workers Free: 10 ms CPU cho MỖI lần gọi, áp cả HTTP lẫn Cron Trigger (trang Limits,
// cập nhật 29/10/2026, đọc 04/11/2026). Chờ I/O (fetch, D1, send_email) KHÔNG tính. Vượt ⇒ lần gọi bị ngắt
// (outcome `exceededCpu`; HTTP trả 1102). Trong Worker không đo được CPU lúc chạy (performance.now chỉ nhích sau I/O)
// ⇒ chặn bằng SỐ LƯỢNG việc mỗi lần gọi, không bằng đồng hồ. Ngân sách từng việc: design.md §6g.
export const CRON_LIMITS = {
  cpuBudgetMs: 10,               // trần nhà cung cấp, không phải mục tiêu
  cpuTargetMs: 7,                // mục tiêu thiết kế (70%); p99 đo được vượt mức này ⇒ đường lui design.md §6g
  maxSingleSendsPerRun: 5,       // thư báo một người mỗi lượt Cron
  maxSummaryContacts: 100,       // liên hệ trong MỘT phần thư tóm tắt; quá ⇒ chia phần (design.md §6g bước lui 1)
  // Lượt 9 (XQ-32(a), M38): trần TỔNG length(body_b64) của một phần (body_b64 chỉ ASCII ⇒ ký tự = byte). Phần dừng ở
  // trần nào tới trước (số hoặc byte); phần luôn nhận ít nhất 1 liên hệ (một khối ≤ bodyB64MaxBytes < trần). Chọn
  // 384 KiB ≥ 12 × khối cỡ tối đa của một ContactSubmitRequest hợp lệ (≈ 25 KB: message 5000 ký tự × 3 byte UTF-8,
  // fullName/company 200 × 3, email, phone, pagePath, utm, nhãn; base64 + CRLF) ⇒ kịch bản "12 liên hệ ⇒ đúng 1 thư tóm tắt" (contact-form.feature dòng 265–270) luôn
  // là một phần, dù mỗi liên hệ cỡ tối đa. Lọc bằng SQL phía D1 (design.md §6g), isolate không nhận dòng vượt trần.
  // Ước CPU parse + ghép ở mức này ≈ 1–2 ms (CHƯA ĐO); ca đo §6g quyết, vượt ⇒ hạ số này (bước lui 1).
  maxSummaryPartB64Bytes: 384 * 1024,
  // Trần một khối body_b64 (một liên hệ): thân ≤ CONTACT_LIMITS.bodyBytes byte UTF-8 ⇒ base64 + CRLF mỗi 76 ký tự.
  // POST từ chối dựng khối vượt số này (không xảy ra với ContactSubmitRequest hợp lệ; chặn để trần phần luôn đúng).
  bodyB64MaxBytes: 46 * 1024,
  // Lượt 10 (XQ-33(a)): `DELETE … WHERE id IN (SELECT id FROM <bảng> WHERE <điều kiện> LIMIT ?)` — KHÔNG dùng
  // `DELETE … LIMIT` (cần SQLITE_ENABLE_UPDATE_DELETE_LIMIT, chưa kiểm D1 có). Áp cho outbox, rate_counter, dedupe.
  maxDeletesPerRun: 200,
  bodyBlockBytesMultiple: 57,    // khối thân mỗi liên hệ đệm tới bội 57 byte ⇒ base64 tròn dòng 76 ký tự, ghép được
  // Lượt 10 (XQ-33(a)): số tham số gắn của MỌI câu SQL là hằng số, không phụ thuộc số dòng — cấm `IN (?, ?, …)` dựng
  // theo danh sách id; danh sách id (nếu cần, đường lui hai câu) đi qua MỘT tham số `json_each(?)`. Câu Cron nhiều tham
  // số nhất ≤ maxBoundParamsCron; câu nhiều nhất toàn Worker là INSERT outbox (= số cột, < 32). Trần của D1:
  // d1MaxBoundParamsPerQuery = 100 **[chưa kiểm — trí nhớ model; lượt 10 vai architect không đọc được web: tool
  // WebFetch không có, Agent web-fetch bị hook chặn]**. Thiết kế không dựa vào số chính xác: chỉ cần trần thật ≥ 32.
  // backend đọc developers.cloudflare.com/d1/platform/limits/ và ghi số + ngày đọc vào đây trước merge_to_main.
  maxBoundParamsCron: 8,
  d1MaxBoundParamsPerQuery: 100,
  // Lượt 10 (XQ-33(b)): bản ghi đầu hàng tóm tắt (rn = 1) có attempts ≥ số này ⇒ phần kế CHỈ gồm đúng 1 liên hệ (lọc
  // trong cùng câu window: FIRST_VALUE(attempts) OVER w, design.md §6g). attempts tăng lúc lấy lease ⇒ 3 lượt bị ngắt
  // liền ⇒ lượt 4 cô lập bản ghi đó; phần sau nó đi tiếp ngay khi lease của nó còn hiệu lực (lease 120 s).
  summaryHeadAttemptsIsolate: 3,
  leaseSeconds: 120,
} as const;

// §5c Cột Cron được đọc (lượt 9, XQ-32(b)). Không `SELECT *` trên outbox ở bất kỳ đường nào của Worker. body_b64 và
// mọi cột PII KHÔNG bao giờ vào log (console, Workers Logs, last_error, thư cảnh báo); lỗi chỉ log id + mã.
export const CRON_SELECT_COLUMNS = {
  // lượt 10 (XQ-33(a)): là cột của `UPDATE … RETURNING` (design.md §6g); created_at để isolate sắp lại và tính "giờ" của phần
  summaryPart: ["id", "body_b64", "email", "created_at"], // email chỉ dùng khi phần có đúng 1 liên hệ (Reply-To, §8)
  single: ["id", "body_b64", "email", "full_name"], // full_name cho Subject (§8), email cho Reply-To
  housekeeping: ["id", "created_at", "batch", "sent_at", "attempts", "alerted_at"], // đếm, cảnh báo, dọn: không PII
} as const;

// §5d Mã cảnh báo tới ALERT_TO (lượt 9). Thư cảnh báo chỉ có mã + số đếm, không id, không PII. Ghi mail_log kind
// 'alert' kèm cột code (d1-schema.sql) để giới hạn lặp.
export const MAIL_ALERT_CODES = {
  // M29(1): có bản ghi quá hạn gửi > OUTBOX.overdueAlertSeconds. MỘT thư mỗi đợt hỏng: chỉ gửi khi mail_log chưa có
  // dòng code này với sent_at ≥ hạn gửi của bản ghi quá hạn lâu nhất, và chưa có trong giờ tròn hiện tại. Đợt kéo dài
  // thì chỉ PENDING_OVERDUE_24H lặp (không 24 thư/ngày khi đường thư chết).
  overdue15m: "PENDING_OVERDUE_15M",
  overdue24h: "PENDING_OVERDUE_24H",   // XQ-2: bản ghi chưa gửi quá 24 giờ; lặp mỗi alertRepeatSeconds (alerted_at)
  expired7d: "UNSENT_DELETED_7D",      // XQ-A2: số liên hệ chưa gửi bị xoá vì quá 7 ngày
  summaryParts: "SUMMARY_SPLIT",       // XQ-32(d): thư tóm tắt của một giờ cần phần thứ 2; tối đa 1 thư/giờ tròn
} as const;

// §6 Hàng đợi gửi lại (design.md §6a)
export const OUTBOX = {
  retryBackoffMinutes: [1, 2, 5, 10, 30, 60] as const, // sau đó mỗi 60 phút
  alertAfterSeconds: 24 * 3600,      // cảnh báo đầu, không PII; liên hệ vẫn giữ
  alertRepeatSeconds: 24 * 3600,     // XQ-A2 (admin chốt 31/10): lặp cảnh báo không PII mỗi 24 giờ khi còn chưa gửi được
  deleteSentWithinSeconds: 24 * 3600,
  leaseSeconds: 120,
  cronStaleAlertSeconds: 600,
  // Lượt 9 (M29(1)): "chờ quá 15 phút" do Cron kiểm ở bước 2 (design.md §6g), KHÔNG ở POST (POST không còn đọc D1
  // trước Turnstile, và không có POST thì không ai biết). Cron chết thì Cron không tự báo được ⇒ health
  // (oldestOverdueSec, lastCronAgeSec) + smoke devops là lớp thứ hai.
  overdueAlertSeconds: 15 * 60,
  // XQ-A2 (admin chốt 31/10): tính từ created_at (lúc nhận). Hết hạn ⇒ xoá bản ghi + MỘT cảnh báo chỉ nêu SỐ LƯỢNG đã
  // xoá (không id, không PII). Cộng D1 Time Travel 7 ngày ⇒ bản sao xa nhất ≤ 14 ngày (con số cho Chính sách).
  // Lượt 9 (prd v0.5.1 §3b): trần này áp cho MỌI dòng outbox, kể cả dòng đã gửi (sent_at có) mà chưa kịp xoá ⇒ không
  // dòng nào sống quá 7 ngày từ created_at, nên mốc 14 ngày đúng cả khi gửi được ở ngày thứ 7.
  maxRetentionUnsentSeconds: 7 * 24 * 3600,
} as const;

// §7 Header lấy IP (XQ-9): chỉ CF-Connecting-IP
export const CLIENT_IP_HEADER = "CF-Connecting-IP";

// §8 Dựng thư (XQ-25(a)/M30, lượt 6). Trình dựng thư là hàm thuần trong worker/domain (không thư viện MIME).
// Thư ra CHỈ có đúng các header dưới, đúng thứ tự; không header nào khác, không header nào lặp.
export const MAIL_HEADERS = [
  "From",                      // = MAIL_FROM (wrangler var), không có tên hiển thị lấy từ dữ liệu người gửi
  "To",                        // = destination_address của binding (V3) hoặc ALERT_TO
  "Reply-To",                  // CHỈ thư báo/tóm tắt-một-người, CHỈ khi email đã qua zod `.email()`; không có ⇒ bỏ header
  "Subject",
  "Date",                      // RFC 5322, giờ UTC
  "Message-ID",                // <uuid@MAIL_FROM-domain>
  "MIME-Version",              // "1.0"
  "Content-Type",              // "text/plain; charset=utf-8" — không bao giờ text/html, không multipart
  "Content-Transfer-Encoding", // "base64" — thân luôn base64, dòng ≤ 76 ký tự
] as const;
// Subject: tiền tố cố định + fullName (đã qua HEADER_UNSAFE_CHARS). Phần có dữ liệu người nhập LUÔN mã hoá RFC 2047
// dạng B (`=?UTF-8?B?…?=`, mỗi encoded-word ≤ 75 ký tự, tách ở biên ký tự UTF-8), kể cả khi chỉ có ASCII.
// Thư tóm tắt và cảnh báo: Subject cố định, không có dữ liệu người gửi.
export const MAIL_SUBJECT_PREFIX = { notify: "[Liên hệ web] ", summary: "[Liên hệ web] Tóm tắt ", alert: "[Cảnh báo web] " } as const;
// Reply-To lấy đúng chuỗi email sau zod (đã trim, không khoảng trắng/ký tự điều khiển); địa chỉ không có tên hiển thị.
// company, phone, message, pagePath, utm: chỉ vào THÂN thư (base64), không vào header nào.

// §9 Header của mọi phản hồi Worker (M32, lượt 6). `public/_headers` KHÔNG áp cho phản hồi do Worker tạo
// (threat-model §0 [docs]) ⇒ Worker tự đặt trên MỌI phản hồi của /api/*, kể cả lỗi, 404, 405 và nhánh honeypot.
export const WORKER_RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
} as const;
// KHÔNG đặt Access-Control-Allow-Origin (form cùng origin; không CORS). Không trả OPTIONS ngoài 405.
// Origin: POST có header Origin mà khác SITE_ORIGIN (wrangler var, vd "https://<tên miền>") ⇒ 403 ORIGIN_REJECTED,
// trước mọi I/O. Không có Origin ⇒ cho đi tiếp (Turnstile quyết).
export const FORBIDDEN_RESPONSE_HEADERS = ["Access-Control-Allow-Origin", "Set-Cookie"] as const;

// §10 Luật rate limiting WAF ngày đầu (XQ-26(2), M29) — devops cấu hình trên zone, KHÔNG phải mã Worker.
// Chặn ở edge ⇒ không gọi Worker. Gói Free (docs WAF rate limiting, đọc 31/10/2026): 1 luật, cửa sổ đếm 10 s,
// thời gian chặn 10 s, đếm theo IP, biểu thức chỉ dùng được trường Path (không lọc theo method). Free KHÔNG có cửa sổ
// 600 s ⇒ luật này chỉ chặn dồn dập; trần 20/600 s và 5/600 s vẫn ở D1. [chưa kiểm]: hành động "block" có ở Free;
// toán tử so khớp tiền tố Path ở Free; request bị WAF chặn có tính vào 100.000 request Worker/ngày không.
export const EDGE_RATE_LIMIT = {
  match: { pathPrefix: "/api/" }, // mọi method (Free không lọc method) — gồm cả GET /api/contact/health
  countBy: "ip",
  requests: 3,
  periodSeconds: 10,
  action: "block",
  mitigationSeconds: 10,
} as const;

// §11 Turnstile (Q-UX-14, lượt 6): widget chế độ Managed, appearance "interaction-only" — người dùng thường không thấy gì;
// khi Cloudflare cần tương tác thì ô kiểm hiện trong chỗ đặt sẵn ngay trên nút Gửi. Token dùng một lần ⇒ sau MỌI phản hồi
// không phải 200 {ok:true} FE gọi turnstile.reset() và chờ token mới trước lần gửi kế.
export const TURNSTILE_WIDGET = { appearance: "interaction-only", size: "flexible", languageFromLocale: true } as const;

// §12 Luật HumanCheck (lượt 9, XQ-25(b)/M31). Quyết định là hàm thuần trong worker/domain (`judgeSiteverify`); adapter
// production chỉ gọi fetch. Adapter kiểm thử (test-control.ts op "human-check") chỉ thay PHẢN HỒI siteverify, hàm quyết
// định vẫn là bản production ⇒ ca qa kiểm đúng luật dưới.
// Frontend đặt `action: TURNSTILE_ACTION` khi render widget (data-action / render option).
export const TURNSTILE_ACTION = "contact" as const;
export const TURNSTILE_SITEVERIFY = {
  url: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
  method: "POST",
  timeoutMs: 5000, // thời gian chờ (I/O, không tính CPU); quá ⇒ HUMAN_CHECK_UNAVAILABLE
} as const;
// Đạt KHI VÀ CHỈ KHI: HTTP 200, thân parse được theo SiteverifyResponse, success === true, hostname ∈
// allowedHostnames (= [new URL(SITE_ORIGIN).hostname], so khớp nguyên văn sau hạ chữ thường; không so hậu tố), và
// action === TURNSTILE_ACTION. Kết quả:
//   - lỗi mạng, hết timeoutMs, status ≠ 200, thân không phải JSON hoặc sai schema ⇒ 503 HUMAN_CHECK_UNAVAILABLE
//     (không đếm lần thử: chưa qua kiểm người thật; log mã TURNSTILE_UNAVAILABLE + status, không token).
//   - success false, hoặc success true mà hostname/action sai ⇒ 403 HUMAN_CHECK_FAILED (log error-codes + mã
//     TURNSTILE_HOSTNAME / TURNSTILE_ACTION, không token, không hostname người gửi tự đặt).
//   - không có nhánh nào khác: mọi ngoại lệ ném ra trong verify ⇒ HUMAN_CHECK_UNAVAILABLE, không bao giờ "đạt".
export const SiteverifyResponse = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).default([]),
  challenge_ts: z.string().optional(),
});
// Secret thử của Cloudflare (luôn đạt/luôn trượt/token đã dùng…) có dạng "<chữ số>x0…0AA". Điểm vào production
// (`worker/index.ts`, mọi môi trường deploy, kể cả staging) kiểm ở §6a bước 2, TRƯỚC siteverify: TURNSTILE_SECRET
// rỗng/thiếu hoặc khớp mẫu dưới ⇒ 503 FORM_DISABLED + log mã TURNSTILE_SECRET_INVALID (không in secret).
// Điểm vào test (`worker/index.test.ts`) không dùng adapter siteverify thật nên không cần secret.
export const TURNSTILE_TEST_SECRET = /^[0-9]x0+AA$/;
