# Mô hình nội dung dạng file — contract (lượt 5, 31/10/2026)

Mô hình collection Payload của lượt 2–4 **đã bỏ** (bỏ CMS, raw 31/10; còn trong lịch sử git). Nguồn: prd.md v0.5 §3b. Schema máy đọc: `content-model.ts`.

| Loại (prd §3b) | Nơi trong repo code | Schema |
|---|---|---|
| Tin | `content/news/<slug>.<vi\|en>.md` | `NewsFront` + thân Markdown |
| Dự án / Thư viện | `content/projects/<slug>.<locale>.md` | `ProjectFront` |
| Tin tuyển dụng | `content/jobs/<slug>.<locale>.md` | `JobFront` |
| FAQ | `content/faq.<locale>.yaml` | `FaqItem[]` |
| Dòng đầu ra | `content/output-lines.yaml` | `OutputLine[]` |
| Số liệu | `content/figures.yaml` | `Figure[]` |
| Đối tác | `content/partners.yaml` | `Partner[]` — lượt 10 (S33): `role` song ngữ, `permissionBasis` (chuỗi mô tả căn cứ, vd "thư Xanh Asian 02/11, số …"; văn bản gốc **không** vào repo), `allowedAssets` ⊆ `PARTNER_ASSET_TYPES`; **không có logo** |
| Bảng so sánh | `content/comparison-tables.yaml` | `ComparisonTable[]` (lượt 10) |
| Lộ trình 5 bước | `content/journey-steps.yaml` | `JourneyStep[]` (lượt 10) |
| Ảnh | `content/images/<tên>.<đuôi>` + `<tên>.yaml` | `ImageMeta` |
| Trang cố định (11 khoá `routes.ts → PageKey`) | `content/pages/<key>.<locale>.md` | `Common` |
| Chính sách bảo mật | `content/policy/<version>.<locale>.md` | `PolicyFront`; bản có `effectiveFrom` mới nhất ≤ ngày build là bản hiệu lực, version của nó ⇒ `POLICY_VERSION` |
| Thông tin công ty | `content/company.yaml` | `Company` |
| Xác nhận của GMS | `content/approvals/<sha256>.yaml` | `Approval` (không tính vào băm) |
| Khoá slug | `content/slugs.lock` | slug đã lên production; đổi ⇒ build đỏ, đổi thật thì thêm 301 vào `_redirects` |

Luật:
- `published: false` ⇒ không sinh trang, không vào sitemap, không được liên kết tới (liên kết tới ⇒ build đỏ "liên kết nội bộ gãy").
- Bảng so sánh (S33, lượt 10 thay luật cũ "thiếu ô ⇒ ẩn bảng"): ô số là `{figure: slug}`; dòng có ô thiếu nguồn hoặc số viết tay ⇒ **build đỏ** nêu bảng + dòng (`build.ts §8`). Figure `public: false` ⇒ ẩn cả bảng.
- Đối tác (lượt 10): `permissionBasis` trống ⇒ build đỏ nêu tên đối tác và trường; ảnh `partnerAsset.type` ngoài `allowedAssets` (vd "logo") ⇒ build đỏ; `keepTitleBlock: true` ⇒ không cắt, giữ tệp gốc, nhãn ảnh dựng. Không đối tác ⇒ không khối.
- `company.yaml` (lượt 10): `taxId`, `privacyRequestEmail` tuỳ chọn — thiếu ⇒ build xanh, form đóng (`build.ts §9`); điện thoại/`zaloPhone` theo `VN_PHONE`.
- Markdown: markdown-it `html: false`; chỉ cho các token ở `safe-url.ts → MARKDOWN_ALLOWED_TOKENS`; gặp token khác ⇒ build đỏ. Mọi `href` qua `safeHref` lúc build, và render lại qua `safeHref` (không hợp lệ ⇒ chữ).
- Ảnh `anh-dung-ai` luôn kèm nhãn theo locale. Ảnh `hasPeople` mà không có `consentDate` thì không được dùng ở trang công khai hay OG.
- Bài fanpage: `origin` + `gmsSelected: true` + `gmsSelectedBasis` (lượt 10; thiếu ⇒ build đỏ); thân chỉ là chữ đã escape (design.md §8b).
