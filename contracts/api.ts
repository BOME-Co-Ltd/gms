// Contract HTTP của Worker `gms-contact` (lượt 5, 31/10/2026 — bỏ CMS; phần Payload/login/jobs đã xoá,
// xem README.md "Đổi ở lượt 5"). Nguồn: prd.md v0.3 §3b, §6; acceptance/contact-form.feature; design.md §6a.
// Máy validate: `bun x tsc --noEmit -p 02-design/contracts` (chưa kiểm — chờ admin).
import { z } from "zod";

export const Locale = z.enum(["vi", "en"]);

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
export const CONTACT_CONTENT_TYPES = ["application/json", "application/x-www-form-urlencoded"] as const;

// §3 Response
export const FieldErrorCode = z.enum([
  "REQUIRED", "TOO_LONG", "INVALID_EMAIL", "INVALID_PHONE", "CONTACT_REQUIRED", "CONSENT_REQUIRED",
  "INVALID_CHARS", // lượt 6, M30: fullName/company có ký tự điều khiển — câu chữ: [cần hỏi ux_ui]
]);
export const ContactErrorCode = z.enum([
  "VALIDATION",          // 422 (415 khi sai Content-Type)
  "POLICY_CHANGED",      // 409 — kèm policyVersion hiện hành (Q-UX-15)
  "PAYLOAD_TOO_LARGE",   // 413
  "HUMAN_CHECK_FAILED",  // 403 — Turnstile thiếu/trượt
  "ORIGIN_REJECTED",     // 403 — lượt 6, M32: header Origin có mà khác SITE_ORIGIN
  "RATE_LIMITED",        // 429 + Retry-After
  "FORM_DISABLED",       // 503 (chưa có tên miền/Email Routing, hoặc tắt khẩn)
  "STORE_FAILED",        // 503 — D1 lỗi: KHÔNG báo đã nhận
]);
export const CONTACT_HTTP_STATUS: Record<z.infer<typeof ContactErrorCode>, number> = {
  VALIDATION: 422, POLICY_CHANGED: 409, PAYLOAD_TOO_LARGE: 413, HUMAN_CHECK_FAILED: 403,
  ORIGIN_REJECTED: 403, RATE_LIMITED: 429, FORM_DISABLED: 503, STORE_FAILED: 503,
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

export const ContactHealth = z.object({ ok: z.boolean(), lastCronAgeSec: z.number().int(), pending: z.number().int() });

// §4 Ngưỡng (prd §6; XQ-14 bỏ login*)
// Lượt 6 (M29): cả hai bộ đếm ở D1 nhưng CHỈ chạy sau khi Turnstile đạt (design.md §6a bước 6–7, 10).
// Bộ đếm lần thử đọc trước: đã đủ max ⇒ 429, không ghi dòng ⇒ tối đa `max` dòng ghi / cửa sổ / khoá IP.
// Lớp trước Worker: luật rate limiting WAF (EDGE_RATE_LIMIT, devops cấu hình) — chặn ở edge, không gọi Worker.
export const RATE_LIMITS = {
  contactSuccessPerIp: { max: 5, windowSeconds: 600 },
  contactAttemptsPerIp: { max: 20, windowSeconds: 600 }, // đếm mọi lần đã qua Turnstile (bẫy, 422, 409, thành công)
  ipv6PrefixBits: 64,
  dedupeWindowSeconds: 600,
  counterTtlSecondsMax: 3600,
} as const;

// §5 Trần thư (XQ-1 lượt 5: giữ 45/24 giờ — send_email tới địa chỉ đã verify không tính quota)
export const MAIL_CAPS = {
  notifyPerHour: 30,
  notifyPer24h: 45,
  summaryMaxPerHour: 1,
  summaryDeliverWithinSeconds: 120,
  firstSendWithinSeconds: 120,
} as const;

// §6 Hàng đợi gửi lại (design.md §6a)
export const OUTBOX = {
  retryBackoffMinutes: [1, 2, 5, 10, 30, 60] as const, // sau đó mỗi 60 phút
  alertAfterSeconds: 24 * 3600,      // cảnh báo đầu, không PII; liên hệ vẫn giữ
  alertRepeatSeconds: 24 * 3600,     // XQ-A2 (admin chốt 31/10): lặp cảnh báo không PII mỗi 24 giờ khi còn chưa gửi được
  deleteSentWithinSeconds: 24 * 3600,
  leaseSeconds: 120,
  cronStaleAlertSeconds: 600,
  // XQ-A2 (admin chốt 31/10): tính từ created_at (lúc nhận). Hết hạn ⇒ xoá bản ghi + MỘT cảnh báo chỉ nêu SỐ LƯỢNG đã
  // xoá (không id, không PII). Cộng D1 Time Travel 7 ngày ⇒ bản sao xa nhất ≤ 14 ngày (con số cho Chính sách).
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
