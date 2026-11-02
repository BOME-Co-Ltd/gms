// Lượt 5: "CMS" bên dưới = nội dung file trong content/** (kiểm lúc build, không kiểm lúc lưu); "serializer Lexical" = renderer markdown-it.
// Luật URL trong nội dung CMS (trả lời appsec XQ-17, threat-model T3 (a)). MỘT nguồn cho cả hai phía:
//   backend  — hook beforeChange của MỌI collection/global có trường URL hoặc rich text (content-model.md "Luật URL")
//   frontend_web — serializer Lexical → JSX và mọi chỗ render chuỗi CMS thành href
// Cả hai import file này từ src/contracts/ (bản chép), không viết lại luật.
// Máy validate: `bun x tsc --noEmit -p 02-design/contracts` (chưa kiểm — chờ admin, README.md).
//
// Chỉ nhận: https: · http: · mailto: · tel: · đường dẫn nội bộ bắt đầu bằng MỘT "/".
// Mọi thứ khác (javascript:, data:, vbscript:, file:, blob:, "//host", đường tương đối, "#…", rỗng) ⇒ từ chối.
// Không có danh sách cấm: lược đồ lạ mới xuất hiện cũng bị từ chối.
import { z } from "zod";

export const SAFE_URL_SCHEMES = ["https:", "http:", "mailto:", "tel:"] as const;
export const SAFE_URL_MAX = 2048;

// Ký tự điều khiển C0, DEL, khoảng trắng (kể cả tab/xuống dòng mà trình duyệt bỏ qua giữa "java" và "script:"),
// dấu "\" (trình duyệt coi như "/"). Có ở BẤT KỲ đâu ⇒ từ chối, không tự xoá rồi nhận.
// biome-ignore lint/suspicious/noControlCharactersInRegex: chính là thứ cần chặn
const FORBIDDEN_CHARS = /[\u0000- \u007f\\]/;
const TEL_BODY = /^\+?[0-9][0-9.\-]{2,19}$/;

export type SafeHrefResult = { ok: true; href: string } | { ok: false };

// Trả href đã chuẩn hoá (dùng đúng chuỗi này khi render), hoặc { ok: false }.
// Đầu vào đã trim ở hai đầu bởi hàm này; khoảng trắng bên trong vẫn bị từ chối.
export function safeHref(raw: unknown): SafeHrefResult {
  if (typeof raw !== "string") return { ok: false };
  const s = raw.trim();
  if (s.length === 0 || s.length > SAFE_URL_MAX || FORBIDDEN_CHARS.test(s)) return { ok: false };
  // Nội bộ: "/" rồi KHÔNG phải "/" (chặn "//evil.test" — URL không lược đồ trỏ ra ngoài).
  if (s.startsWith("/")) return s.startsWith("//") ? { ok: false } : { ok: true, href: s };
  let u: URL;
  try {
    u = new URL(s); // không base ⇒ chuỗi không có lược đồ ném lỗi ⇒ từ chối
  } catch {
    return { ok: false };
  }
  const scheme = u.protocol.toLowerCase(); // URL đã hạ chữ thường: "JAVASCRIPT:" ⇒ "javascript:"
  if (!(SAFE_URL_SCHEMES as readonly string[]).includes(scheme)) return { ok: false };
  if (scheme === "https:" || scheme === "http:") {
    if (u.hostname === "" || u.username !== "" || u.password !== "") return { ok: false }; // chặn "https://gms.vn@evil.test"
    return { ok: true, href: u.href };
  }
  if (scheme === "tel:") return TEL_BODY.test(s.slice(4)) ? { ok: true, href: `tel:${s.slice(4)}` } : { ok: false };
  // mailto: phải có "@" trong phần địa chỉ (trước dấu "?" ĐẦU TIÊN)
  // XQ-24-a (lượt 6): KHÔNG dùng split("?", 2) — giới hạn 2 cắt bỏ phần sau dấu "?" thứ hai, nên
  // "mailto:a@x?subject=x?y&bcc=k@evil" chỉ kiểm "subject=x" mà href trả về vẫn mang bcc. Kiểm TOÀN BỘ phần sau "?" đầu.
  const rest = s.slice(7);
  const q = rest.indexOf("?");
  const addr = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? "" : rest.slice(q + 1);
  if (!addr.includes("@") || query.includes("#")) return { ok: false }; // fragment trong mailto ⇒ từ chối
  // XQ-24 (admin nhận): chỉ subject/body; cc, bcc, to, tham số lạ, hay nhiều địa chỉ ⇒ không hợp lệ (build đỏ)
  if (addr.includes(",") || addr.includes("%2C") || addr.includes("%2c")) return { ok: false };
  // URLSearchParams giải mã khoá ("%62cc" ⇒ "bcc") rồi mới so ⇒ khoá mã hoá phần trăm không lách được.
  for (const k of new URLSearchParams(query).keys()) {
    if (!(MAILTO_ALLOWED_PARAMS as readonly string[]).includes(k.toLowerCase())) return { ok: false };
  }
  // Ca kiểm bắt buộc (qa): "mailto:a@gms.vn?subject=x?y&bcc=k@evil.test" ⇒ { ok: false } (query = "subject=x?y&bcc=…",
  // URLSearchParams tách theo "&" ⇒ khoá "subject", "bcc" ⇒ bcc bị từ chối); "mailto:a@gms.vn?%62cc=k@evil.test" ⇒ { ok: false }.
  return { ok: true, href: u.href }; // u.href giữ nguyên query đã kiểm (cùng chuỗi `rest`)
}
export const MAILTO_ALLOWED_PARAMS = ["subject", "body"] as const;

// Dùng trong zod (trường URL của collection/global và block). Lỗi ⇒ backend trả 400 UNSAFE_URL (api.ts §6).
export const SafeHref = z.string().transform((v, ctx) => {
  const r = safeHref(v);
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: "UNSAFE_URL" });
    return z.NEVER;
  }
  return r.href;
});

// Lượt 5: Lexical bỏ (không CMS). Token markdown-it được phép (G1: markdown-it `html: false`, `linkify: false`).
// Loader gặp token ngoài danh sách (html_block, html_inline, fence, table…) ⇒ build đỏ, không lặng lẽ bỏ.
export const MARKDOWN_ALLOWED_TOKENS = [
  "paragraph_open", "paragraph_close", "inline", "text", "softbreak", "hardbreak",
  "heading_open", "heading_close", "bullet_list_open", "bullet_list_close", "ordered_list_open",
  "ordered_list_close", "list_item_open", "list_item_close", "blockquote_open", "blockquote_close",
  "strong_open", "strong_close", "em_open", "em_close", "link_open", "link_close", "image",
] as const;
export const MARKDOWN_HEADING_TAGS = ["h2", "h3", "h4"] as const; // "#" (h1) ⇒ build đỏ: h1 là tiêu đề trang
// image: src phải là ImageRef của content-model.ts (ảnh trong repo), không URL ngoài.

// Thuộc tính khi render liên kết (frontend): href = safeHref(...).href; không hợp lệ ⇒ render chữ, không <a>.
// Liên kết ra ngoài site (http/https khác SITE_URL): rel="noopener noreferrer"; target="_blank" chỉ khi node có newTab.
export const EXTERNAL_LINK_REL = "noopener noreferrer" as const;
