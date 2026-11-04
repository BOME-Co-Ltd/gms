// Cổng điều khiển kiểm thử của Worker `gms-contact` (lượt 6, 31/10/2026 — trả lời qa XQ-QA20).
// Lượt 9 (04/11): human-check thêm mode; thêm op turnstile-secret (M31).
// SỐ PHẬN (lượt 8, 04/11): DÙNG, là contract hiện hành giữa backend và qa. Không xoá khi design_approved. Bản lượt 3–4
// (gắn với CMS, đã bỏ raw 31/10) chỉ còn trong lịch sử git.
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
//
// Chạy ở đâu: CHỈ dưới `wrangler dev --local --config wrangler.test.jsonc` (devops). Không có ở bản deploy nào.
// Hai lớp giữ cổng khỏi production (appsec soát — họ M4/M21/M31(2)):
//  1. Theo ĐIỂM VÀO, không theo env: `wrangler.jsonc` (production/staging) có `main: "worker/index.ts"`, file này KHÔNG
//     import gì trong `worker/testing/**`. `wrangler.test.jsonc` có `main: "worker/index.test.ts"`: bọc handler production,
//     thêm cổng `/__test__/*` và chọn adapter kiểm thử của `worker/ports.ts` (design.md §3). Production chỉ có
//     `run_worker_first: ["/api/*"]` ⇒ `/__test__/*` đi vào Static Assets (404), kể cả khi mã lọt.
//  2. Ca CI (devops dựng, qa viết): (a) `wrangler deploy --dry-run --outdir <thư mục>` với `wrangler.jsonc` ⇒ bundle KHÔNG
//     chứa chuỗi nào trong BUILD_FORBIDDEN_STRINGS; (b) `scripts/deploy/**` từ chối deploy khi cấu hình là
//     `wrangler.test.jsonc` hoặc khi `main` khác `worker/index.ts`; (c) bundle production không chứa chuỗi đánh dấu adapter
//     kiểm thử (`TEST_ADAPTER_MARKER`).
//  Thêm: điểm vào test trả 404 cho `/__test__/*` khi hostname của request không phải localhost/127.0.0.1/[::1].
//  Không dùng bí mật header (lượt 4): cổng không bao giờ được deploy, bí mật chỉ thêm ma sát cho qa mà không thêm lớp chặn.
//
// IP người gửi trong test: qa đặt header `CF-Connecting-IP` (đề xuất qa được nhận). Adapter `ClientIp` production
// KHÔNG đổi (đọc đúng header này; ở production edge Cloudflare ghi đè). [chưa kiểm] `wrangler dev --local` có giữ
// nguyên CF-Connecting-IP do client gửi không: nếu nó ghi đè, điểm vào test chép `TEST_PEER_IP_HEADER` sang
// CF-Connecting-IP trước khi gọi handler production (mã chỉ ở worker/index.test.ts). Production không có mode IP riêng.
//
// Đường: POST ${BASE_URL}${TEST_CONTROL_BASE}/<op>, thân JSON theo schema của op (thiếu thân = {}), trả 200 JSON.
// Op lạ ⇒ 404 { error: "UNKNOWN_OP" }; thân sai schema ⇒ 400 { error: "BAD_BODY", issues }.
// Op chỉ dựng tiền điều kiện và đọc trạng thái; khẳng định hành vi phải qua `POST /api/contact` như người dùng thật.
import { z } from "zod";

export const TEST_CONTROL_BASE = "/__test__" as const; // Worker không có quy ước thư mục "_" của Next ⇒ dùng được
export const TEST_PEER_IP_HEADER = "x-test-peer-ip" as const; // chỉ dùng nếu wrangler dev ghi đè CF-Connecting-IP
export const TEST_CONTROL_HOSTS = ["localhost", "127.0.0.1", "[::1]"] as const;
export const TEST_ADAPTER_MARKER = "gms-test-adapter" as const;
export const BUILD_FORBIDDEN_STRINGS = ["__test__", TEST_PEER_IP_HEADER, TEST_ADAPTER_MARKER] as const;

const Iso = z.string().datetime({ offset: true });
const Email = z.string().email();

// Thư đã "gửi" qua Mailer giả: giữ cả MIME thô để qa đọc nguồn thư (M30: bộ header cố định, Subject RFC 2047).
export const MailboxMessage = z.object({
  kind: z.enum(["notify", "summary", "alert"]),
  to: Email, from: Email, replyTo: Email.optional(),
  subject: z.string(),      // đã giải mã RFC 2047
  text: z.string(),         // thân đã giải mã base64
  raw: z.string(),          // MIME thô đúng như đưa cho send_email
  sentAt: Iso,
});

export const TestControlOps = {
  // Xoá mọi bảng D1, hộp thư giả, cảnh báo, log; tắt mọi lỗi tiêm; đồng hồ về giờ thật; policyVersion và
  // người nhận về giá trị của wrangler.test.jsonc; HumanCheck về "pass"; TURNSTILE_SECRET về giá trị test.
  reset: z.object({}),
  "set-now": z.object({ iso: Iso.nullable() }),                    // Clock giả; null = giờ thật
  "policy-version": z.object({ v: z.string().min(1).max(40) }),    // ghi đè POLICY_VERSION của Worker test
  // ghi đè đích thư báo của Mailer giả (`CONTACT_RECIPIENT` của wrangler.test.jsonc). Production không có biến này:
  // đích là `destination_address` của binding MAIL (design.md §4b).
  recipient: z.object({ to: Email }),
  mailbox: z.object({ to: Email.optional() }),                     // ⇒ { messages: MailboxMessage[] } (kind notify|summary)
  alerts: z.object({}),                                            // ⇒ { messages: MailboxMessage[] } (kind alert, tới ALERT_TO)
  "fail-mail": z.object({ on: z.boolean(), mode: z.enum(["temporary", "permanent", "slow"]).default("temporary") }),
  "fail-store": z.object({ on: z.boolean() }),                     // ContactQueue.enqueue ném ⇒ 503 STORE_FAILED
  // Lượt 9 (M31, api.ts §12): mode chỉ thay PHẢN HỒI siteverify; hàm quyết định là bản production. Kỳ vọng:
  //   pass ⇒ 200 · fail (success false) / wrong-hostname / wrong-action ⇒ 403 HUMAN_CHECK_FAILED ·
  //   error (lỗi mạng) / timeout (quá TURNSTILE_SITEVERIFY.timeoutMs) / http-error (status 500) / bad-body (không JSON)
  //   ⇒ 503 HUMAN_CHECK_UNAVAILABLE, không ghi D1.
  "human-check": z.object({
    mode: z.enum(["pass", "fail", "error", "timeout", "http-error", "bad-body", "wrong-hostname", "wrong-action"]),
  }),
  // Lượt 9 (M31): ghi đè TURNSTILE_SECRET mà handler production thấy (mặc định của wrangler.test.jsonc là chuỗi không phải
  // secret thử). "" hoặc khớp api.ts TURNSTILE_TEST_SECRET (vd "1x0000000000000000000000000000000AA") ⇒ 503 FORM_DISABLED.
  "turnstile-secret": z.object({ value: z.string().max(200) }),
  "run-cron": z.object({ cron: z.enum(["* * * * *", "5 17 * * *"]).default("* * * * *"), nowIso: Iso.optional() }),
  // ⇒ { outbox, rate_counter, dedupe, mail_log, heartbeat } — dòng D1 thô (có PII: chỉ tồn tại trong bản test)
  "store-dump": z.object({}),
  "app-logs": z.object({}),                                        // ⇒ { lines: string[] } — console của Worker, chuỗi thô
  // Dựng bộ đếm D1 cho một IP: kind "ok" ghi cả bộ đếm thành công lẫn lần thử; "trap"/"invalid" chỉ lần thử.
  "seed-attempts": z.object({ ip: z.string().min(2), n: z.number().int().positive(), kind: z.enum(["ok", "trap", "invalid"]), atIso: Iso.optional() }),
  "seed-notify-count": z.object({ n: z.number().int().nonnegative(), windowStartIso: Iso }), // dòng mail_log kind notify
} as const;
export type TestControlOp = keyof typeof TestControlOps;
