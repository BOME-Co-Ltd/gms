# Mô hình nội dung dạng file — contract (lượt 5, 31/10/2026)

Thay mô hình collection Payload của lượt 2–4 (còn trong lịch sử git). Nguồn: prd.md v0.3 §3b. Schema máy đọc: `content-model.ts`.

| Loại (prd §3b) | Nơi trong repo code | Schema |
|---|---|---|
| Tin | `content/news/<slug>.<vi\|en>.md` | `NewsFront` + thân Markdown |
| Dự án / Thư viện | `content/projects/<slug>.<locale>.md` | `ProjectFront` |
| Tin tuyển dụng | `content/jobs/<slug>.<locale>.md` | `JobFront` |
| FAQ | `content/faq.<locale>.yaml` | `FaqItem[]` |
| Dòng đầu ra | `content/output-lines.yaml` | `OutputLine[]` |
| Số liệu | `content/figures.yaml` | `Figure[]` |
| Đối tác | `content/partners.yaml` | `Partner[]` (văn bản cho phép **không** vào repo, chỉ `permissionOnFile: true`) |
| Ảnh | `content/images/<tên>.<đuôi>` + `<tên>.yaml` | `ImageMeta` |
| Trang cố định (11 khoá `routes.ts → PageKey`) | `content/pages/<key>.<locale>.md` | `Common` |
| Chính sách bảo mật | `content/policy/<version>.<locale>.md` | `PolicyFront`; bản có `effectiveFrom` mới nhất ≤ ngày build là bản hiệu lực, version của nó ⇒ `POLICY_VERSION` |
| Thông tin công ty | `content/company.yaml` | `Company` |
| Xác nhận của GMS | `content/approvals/<sha256>.yaml` | `Approval` (không tính vào băm) |
| Khoá slug | `content/slugs.lock` | slug đã lên production; đổi ⇒ build đỏ, đổi thật thì thêm 301 vào `_redirects` |

Luật:
- `published: false` ⇒ không sinh trang, không vào sitemap, không được liên kết tới (liên kết tới ⇒ build đỏ "liên kết nội bộ gãy").
- Bảng so sánh (S33) trong `pages/technology.*.md` tham chiếu `figures` bằng `key`. Thiếu một ô (figure không `public` hoặc thiếu nguồn) ⇒ ẩn cả bảng.
- Markdown: markdown-it `html: false`; chỉ cho các token ở `safe-url.ts → MARKDOWN_ALLOWED_TOKENS`; gặp token khác ⇒ build đỏ. Mọi `href` qua `safeHref` lúc build, và render lại qua `safeHref` (không hợp lệ ⇒ chữ).
- Ảnh `anh-dung-ai` luôn kèm nhãn theo locale. Ảnh `hasPeople` mà không có `consentDate` thì không được dùng ở trang công khai hay OG.
- Bài fanpage: `origin` + `gmsSelected: true`; thân chỉ là chữ đã escape (design.md §8b).
