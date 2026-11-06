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
| Bảng so sánh | `content/comparison-tables.yaml` | `ComparisonTable[]` (lượt 10); ẩn ở v1 (không có tệp), bật thì chỉ số GMS có nguồn (V39) |
| Lộ trình 5 bước | `content/journey-steps.yaml` | `JourneyStep[]` (lượt 10); nội dung v1 cả 5 bước `status: "đã xong"` (V40) |
| Ảnh | `content/images/<tên>.<đuôi>` + `<tên>.yaml` | `ImageMeta` |
| Ô ảnh dây chuyền sàng tuyển của GMS (M4, lượt 13, V39) | `content/images/gms-sorting-line.<jpg\|jpeg\|png\|webp>` + `.yaml` | `ImageMeta`; tên cố định `TECHNOLOGY_IMAGE_SLOTS.sortingLine`; không có ảnh dùng được ⇒ ẩn khung |
| Cặp ảnh "Trước ↔ Sau" trang chủ (M1 khối S6, lượt 14, V41 (b)) | `content/images/gms-before.<đuôi>` + `.yaml`, `content/images/gms-after.<đuôi>` + `.yaml` | `ImageMeta`, `kind` bắt buộc `"anh-that"` (`HOME_IMAGE_SLOT_KIND`); tên cố định `HOME_IMAGE_SLOTS`; thiếu một trong hai ảnh dùng được ⇒ ẩn cả khối |
| Tên không được nêu (lượt 14, V38/V41 (c)(d)) | `content/denylist.yaml` | `ForbiddenNames` (`names: string[]`, ≥ 1); v1 `["Xanh Asian"]`; **không** render, không vào `public/`/`out/`; thiếu/rỗng/sai ⇒ build đỏ `DENYLIST_MISSING` |
| Trang cố định (11 khoá `routes.ts → PageKey`) | `content/pages/<key>.<locale>.md` | `Common` |
| Chính sách bảo mật | `content/policy/<version>.<locale>.md` | `PolicyFront`; bản có `effectiveFrom` mới nhất ≤ ngày build là bản hiệu lực, version của nó ⇒ `POLICY_VERSION` |
| Thông tin công ty | `content/company.yaml` | `Company` |
| Xác nhận của GMS | `content/approvals/<sha256>.yaml` | `Approval` (không tính vào băm) |
| Khoá slug | `content/slugs.lock` | slug đã lên production; đổi ⇒ build đỏ, đổi thật thì thêm 301 vào `_redirects` |

Luật:
- `published: false` ⇒ không sinh trang, không vào sitemap, không được liên kết tới (liên kết tới ⇒ build đỏ "liên kết nội bộ gãy").
- Bảng so sánh (S33, lượt 10 thay luật cũ "thiếu ô ⇒ ẩn bảng"): ô số là `{figure: slug}`; dòng có ô thiếu nguồn hoặc số viết tay ⇒ **build đỏ** nêu bảng + dòng (`build.ts §8`). Figure `public: false` ⇒ ẩn cả bảng.
- Lượt 13 (ux-spec V38/V39, thay V30): web không nêu tên công ty nào khác GMS ở bất cứ chữ nào (tiêu đề, câu, alt, chú thích, meta, JSON-LD, bản EN); trang Công nghệ chỉ dùng tư liệu của GMS. Thực thể nguồn tư liệu bên ngoài (lượt 10/12) **đã bỏ**: không tệp nội dung, không khoá ảnh, không trường bảng so sánh, không mã lỗi. Khoá cũ trong meta ảnh hoặc bảng so sánh ⇒ build đỏ (`.strict()`): meta ảnh ⇒ `IMAGE_META_KEY_UNKNOWN` (nêu ảnh + khoá), bảng so sánh ⇒ `COMPARISON_SCHEMA_INVALID` (nêu bảng + dòng + đường khoá; cùng mã cho mọi lỗi schema khác của `comparison-tables.yaml`) — `build.ts §8`, lượt 18. `ImageMeta.source`/ghi chú nguồn là nội bộ, không lên trang; `Figure.source` **có** hiện trên trang (dải số liệu) ⇒ chỉ ghi nguồn của GMS.
- Ô ảnh cố định (V39, V41 (b); luật chung ở `content-model.ts` "Ô ảnh cố định"): ô chỉ có ảnh khi đúng một tệp + meta hợp lệ + qua mọi luật ảnh (ảnh có người thiếu `consentDate` = không có ảnh). Trùng basename khác đuôi ⇒ build đỏ `IMAGE_SLOT_DUPLICATE`. Ô dây chuyền: ảnh chụp thật `kind: anh-that` ⇒ không nhãn; bản vẽ/phối cảnh/render `kind: anh-dung-ai` ⇒ nhãn C29. Ô `gms-before`/`gms-after`: chỉ `anh-that`, khác ⇒ build đỏ `IMAGE_SLOT_KIND_INVALID`; cặp chỉ hiện khi cả hai ô có ảnh.
- Lượt 14 (V41 (e)): **bỏ `keepTitleBlock`** — khoá cũ trong meta ảnh ⇒ build đỏ (`.strict()`). Khung tên bản vẽ ghi tên đơn vị khác ⇒ cắt/che trên tệp nguồn trước khi thả vào `content/images/`; người duyệt nội dung xem ảnh mới/đổi ở cỡ gốc (design.md §6f). Mọi ảnh ra qua sharp, không metadata, không chép tệp gốc.
- Tên không được nêu (lượt 14): content-check quét `content/**` (trừ `denylist.yaml`, `approvals/**`) ⇒ `FORBIDDEN_NAME_IN_CONTENT`; output-check quét mọi tệp văn bản và mọi đường dẫn dưới `out/` ⇒ `FORBIDDEN_NAME_IN_OUTPUT`. So sau chuẩn hoá NFC + chữ thường + bỏ dấu, gồm dạng viết liền/gạch nối/dấu `+` (`findForbiddenNames`; lượt 15: thêm `+`, cụm `%XX` có byte hỏng vẫn giải phần hợp lệ; lượt 16: giải mã HTML/JS/`%` lặp tới khi không đổi, tối đa `NAME_SCAN_DECODE_PASSES_MAX` = 3 lớp — lớp thứ 4 trở lên lọt; ký tự định dạng vô hình `\p{Cf}` như gạch nối mềm, rộng-không bị xoá trước khi so, `&shy;` được giải). Tên dịch vụ do chức năng/luật bắt buộc (Cloudflare, dịch vụ thư, Zalo, Facebook, Messenger, dịch vụ bản đồ) không thuộc danh sách (V41 (c)).
- `company.yaml` (lượt 10): `taxId`, `privacyRequestEmail` tuỳ chọn — thiếu ⇒ build xanh, form đóng (`build.ts §9`); điện thoại/`zaloPhone` theo `VN_PHONE`. Lượt 12 (V29): bản đồ chỉ từ `mapPoint` (`mapEmbedSrc`/`mapOpenHref`, `MAP_EMBED`); bỏ `mapImage`, `mapUrl`.
- Markdown: markdown-it `html: false`; chỉ cho các token ở `safe-url.ts → MARKDOWN_ALLOWED_TOKENS`; gặp token khác ⇒ build đỏ. Mọi `href` qua `safeHref` lúc build, và render lại qua `safeHref` (không hợp lệ ⇒ chữ).
- Ảnh `anh-dung-ai` luôn kèm nhãn theo locale. Ảnh `hasPeople` mà không có `consentDate` thì không được dùng ở trang công khai hay OG.
- Bài fanpage: `origin` + `gmsSelected: true` + `gmsSelectedBasis` (lượt 10; thiếu ⇒ build đỏ); thân chỉ là chữ đã escape (design.md §8b).
