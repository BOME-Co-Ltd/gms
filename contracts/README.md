# contracts/ — gms-hungyen-web

## Lượt 11 (05/11/2026): change_api_contract người dùng duyệt 05/11 (phương án A), biên 900 s, MAP_POINT_INVALID

| File | Đổi | Vì sao |
|---|---|---|
| `test-control.ts` | op `seed-outbox` `{ rows: [{ batch, createdAtIso, attempts?, sentAtIso?, leaseUntilIso?, bodyB64? }] }` ⇒ `{ ids }`; mô tả `reset` ghi rõ xoá `outbox`; import `CRON_LIMITS` từ `./api` | CC-13 (Q10-2), CC-14 (§6g, `summaryHeadAttemptsIsolate`) cần dựng hàng chờ mà POST không dựng được (phần đầy 100, dòng > 7 ngày, `attempts` ≥ 3) |
| `api.ts` §5d | comment `overdue15m`: `>` ⇒ `≥` `overdueAlertSeconds` | khớp contact-form.feature:98–102 (admin chốt 05/11) và code `pendingStats` (`due <= now - 900`) |
| `build.ts` §8 | `MAP_POINT_INVALID` (không tham số; câu chữ nguyên văn code c982bff) | code đã báo mã này, contract chưa có |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **`seed-outbox` khác đề xuất backend ở:** (1) trần dòng = `maxSummaryContacts + maxDeletesPerRun + 1` (loại: chỉ `+ vài dòng cũ` — không dựng được ca chạm trần xoá một lượt trong một lần gọi); (2) `bodyB64` thêm `min(1)` + regex ký tự base64/CRLF (loại: chuỗi tự do — khối hỏng làm thư tóm tắt hỏng vì lý do không thuộc ca); (3) `.strict()` mỗi dòng (gõ sai `body_b64` ⇒ 400 thay vì lặng lẽ dùng khối mặc định); (4) trả `{ ids }` để đối chiếu với `store-dump`; (5) không có trường `nextAttemptAtIso` — `next_attempt_at` = `created_at` (câu chọn phần tóm tắt §6g không đọc cột này; ca thư lẻ cần thì thêm sau, D7).
- **`health.ok` giữ `≤ 900`** (không đồng bộ với cảnh báo `≥ 900`): `ok` là lớp phát hiện Cron chết cho smoke/monitor, không thuộc feature nào; lệch đúng một giây không đổi kết quả của smoke hằng ngày hay monitor ≤ 15 phút. Đồng bộ thì phải sửa thêm code + test biên đã khoá (`overdue-alert.test.ts:180–194`) mà không có yêu cầu nào đòi.

Hai lớp giữ cổng khỏi production (test-control.ts đầu tệp) không đổi: op mới chỉ ở `worker/index.test.ts`, adapter ghi dòng ở `worker/testing/**` (không thêm phương thức vào `ContactQueue` production). Hệ quả tự lộ ra: không thấy finding mới — op ghi PII giả cố định, chỉ có ở bản test.

## Lượt 10 (04/11/2026): theo spec v0.5.1 / story-map v0.4 / priorities v4; trả XQ-33 (appsec)

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | `Partner` = {name, role, description?, permissionBasis, allowedAssets}, bỏ `logo` + `permissionOnFile`; `PARTNER_ASSET_TYPES`; `ImageMeta.partnerAsset`, `keepTitleBlock`, `.strict()`; `ComparisonCell`/`ComparisonTable`; `JOURNEY_STATUSES`/`JourneyStep`; `NewsFront.gmsSelectedBasis`; `VN_PHONE`; `Company.taxId?`, `zaloPhone` (thay URL `zalo`), `mapPoint?`, `privacyRequestEmail?` | S33 ×6, lộ trình, fanpage, contact-info (design.md §6h) |
| `build.ts` | §8 `CONTENT_RULE_MESSAGES` (thông báo nguyên văn); §9 `FormStatus`/`formStatusOf`/`CONTACT_MAIL_READY`; `DEPLOY_RESULT.formStatusMismatch` | build đỏ nêu tên đối tác/trường/dòng; form tạm đóng |
| `api.ts` | `CRON_LIMITS.maxBoundParamsCron`, `d1MaxBoundParamsPerQuery` (**chưa kiểm**), `summaryHeadAttemptsIsolate`, `leaseSeconds`; comment `maxDeletesPerRun`; `CRON_SELECT_COLUMNS.summaryPart` thêm `created_at` | XQ-33 (a)(b)(c) |
| `d1-schema.sql` | `mail_log.summary_hour` + CHECK | XQ-33 (c) |
| `safe-url.ts` | chỉ comment (bỏ `zalo`) | — |
| `content-model.md` | bảng + luật theo trên; bỏ "thiếu ô ⇒ ẩn bảng" | mâu thuẫn S33 |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **XQ-33 (a):** chọn MỘT câu `UPDATE … RETURNING` có subquery window thay vì SELECT rồi UPDATE — không có khe giữa hai câu, số tham số hằng (6). Đường lui hai câu dùng `json_each(?)` (một tham số) thay `IN (?,…)`. Xoá dùng `WHERE id IN (SELECT … LIMIT ?)` (`rate_counter` dùng `rowid`, `dedupe` dùng `hash`) — loại `DELETE … LIMIT` vì phụ thuộc cờ biên dịch SQLite chưa kiểm trên D1.
- **XQ-33 (b):** lọc trong câu window bằng `FIRST_VALUE(attempts) OVER w` (loại: lọc ở isolate — phải nhận cả phần về rồi mới bỏ, tốn CPU đúng lúc đang có bản ghi gây vượt CPU). Ngưỡng 3 = số lần bị ngắt liền trước khi cô lập.
- **XQ-33 (c):** "giờ" = giờ tròn VN của bản ghi ĐẦU phần (loại: giờ Cron chạy — phần tồn đọng sẽ mang nhãn giờ sai, k đếm lẫn giữa các giờ). Subject ghi khoảng giờ thật. k đếm bằng `mail_log.summary_hour` (loại: đếm theo `sent_at` trong giờ Cron — sai khi phần 2 rơi sang giờ kế).
- **Form thiếu MST/email quyền riêng tư:** build xanh + form đóng (loại: build đỏ — chặn bàn giao nội dung vì dữ liệu ngoài nội dung, trái ưu tiên 5; loại: form mở — trái ưu tiên 2).

## Lượt 9 (04/11/2026): trả lời appsec lượt soát 9 (threat-model §00000), prd v0.5.1

| File | Đổi | Finding |
|---|---|---|
| `api.ts` §2–§3 | Content-Type thiếu/khác `application/json` ⇒ **415 `UNSUPPORTED_MEDIA_TYPE`** (mã mới). `VALIDATION` chỉ đi với 422. qa so cả status lẫn `code` | XQ-32 (e) |
| `api.ts` §5b `CRON_LIMITS` | `maxSummaryPartB64Bytes` = 384 KiB (tổng `length(body_b64)` một phần), `bodyB64MaxBytes` = 46 KiB (một khối; POST từ chối dựng khối lớn hơn) | XQ-32 (a), M38 |
| `api.ts` §5c `CRON_SELECT_COLUMNS` (mới) | cột Cron được đọc theo đường; cấm `SELECT *` trên outbox; `body_b64`/PII không vào log | XQ-32 (b), `body_b64` không log |
| `api.ts` §5, §5d `MAIL_ALERT_CODES` (mới) | tóm tắt tách "phần k", mỗi phần một dòng `mail_log` kind `summary`; phần 2 trong giờ ⇒ `SUMMARY_SPLIT`; `PENDING_OVERDUE_15M` một thư mỗi đợt hỏng | XQ-32 (d), M29 (1) |
| `api.ts` §3 `ContactHealth`, §6 `OUTBOX` | `oldestOverdueSec`, `overdueAlertSeconds` = 15 phút (Cron kiểm, không phải POST); trần 7 ngày áp mọi dòng outbox | M29 (1), S19 |
| `api.ts` §12 (mới) | luật HumanCheck: đạt khi 200 + schema + `success` + hostname của `SITE_ORIGIN` + `action` = `"contact"`; lỗi mạng/timeout 5 s/≠ 200/thân hỏng/ngoại lệ ⇒ 503 `HUMAN_CHECK_UNAVAILABLE`; secret rỗng hoặc secret thử ⇒ 503 `FORM_DISABLED` | XQ-25 (b), M31 |
| `d1-schema.sql` | `dedupe_hash`/`dedupe.hash` = HMAC với `IP_HMAC_KEY`; `mail_log.code` + CHECK; chú thích `body_b64` | XQ-25 (g)/M37, XQ-32 (d) |
| `test-control.ts` | `human-check` 8 mode khớp §12; op `turnstile-secret` | M31 |
| `build.ts` §1, §7 (mới) | ghi điều kiện XQ-31.1 cho nhánh (2); luật import bundle Worker (`WORKER_ALLOWED_PACKAGES`, `WORKER_ALLOWED_PLATFORM_MODULES`, `TRUSTED_DEPENDENCIES`) | XQ-31.1, XQ-25 (f)/T7 |

### Vì sao chọn như vậy — lượt 9 (cho appsec soát)
- **(e) 415, không 422.** Hai phương án: gộp vào `VALIDATION` 422 hoặc mã riêng 415. Chọn 415: Content-Type sai không có lỗi trường nào để trả `fields`, và qa cần phân biệt "client gửi sai kiểu" với "dữ liệu sai". Một mã ứng đúng một status trong `CONTACT_HTTP_STATUS`.
- **(a) Trần byte lọc phía D1** (window function, design.md §6g), không lọc trong isolate. Lọc trong isolate nghĩa là isolate vẫn nhận và parse cả 2 MB, chính là chỗ M38 vượt CPU. Phương án dự phòng hai câu (`SELECT id, length(body_b64)` rồi `WHERE id IN`) cũng không đưa thân thư thừa vào isolate. 384 KiB chọn để kịch bản 12 liên hệ cỡ tối đa vẫn là một thư; ca đo §6g quyết, vượt thì hạ.
- **M29 (1) ở Cron, không ở POST.** POST đọc D1 để kiểm hàng chờ là I/O trước Turnstile (trái M29). Cảnh báo một thư mỗi đợt hỏng thay vì một thư mỗi giờ: đường thư chết 24 giờ sẽ không thành 24 thư.
- **M31 secret thử chặn ở mọi môi trường deploy.** Staging cũng dùng secret thật; điểm vào test không gọi siteverify thật nên không cần ngoại lệ theo env.

### Hệ quả mới tự lộ ra (nộp appsec soát; không tự vá)
Xem design.md "Câu hỏi liên vai (lượt 9)" mục "Hệ quả tự lộ ra" (i)–(iv): Time Travel phụ thuộc gói ⇒ mốc 14 ngày; `oldestOverdueSec` công khai; 2 cảnh báo khác mã khi đường thư hỏng 24 giờ (XQ-PM3); cảnh báo dùng cùng `send_email`.

## Lượt 6b (31/10/2026): trả lời appsec XQ-29 (T8 vòng 2) và M30-b

| File | Đổi | Finding |
|---|---|---|
| `adr-005` §3.1 | Workers Builds tắt preview build, chỉ build nhánh `production`; `preview_urls: false`; Deploy Hook gắn `production`; xem trước bằng `wrangler dev --local` hoặc artifact CI không token; staging (nếu có) ở tài khoản Cloudflare riêng | XQ-29 (a), T8-b |
| `adr-005` §3.4 | Chỉ người duyệt có Admin GitHub; tài khoản viết chỉ Write; tài khoản viết không là thành viên tài khoản Cloudflare production; runbook kiểm hai danh sách | XQ-29 (b), T8-c |
| `build.ts` §1, §3 | `WORKERS_CI_BRANCH`, `PRODUCTION_BRANCH`, `isProductionBuild`; nhánh và `SITE_ENV` lệch ⇒ `PRODUCTION_ENV_MISMATCH`; `deploy-prod` không `--dry-run` cần nhánh `production` | XQ-29 (c), M36-b |
| `adr-005` §6 | (b) tách thành (b1) GitHub Pro và (b2) Team; không ghi giá, account báo khách | XQ-29 (d) |
| `api.ts` §2 dòng 27 | `HEADER_UNSAFE_CHARS` viết `\u{2028}\u{2029}` cộng cờ `u`. Trước đây là ký tự thô, gây SyntaxError | M30-b |

### Vì sao chọn như vậy (cho appsec soát)
- **(a) Tắt preview build, không tách Worker/D1 preview.** Token build có quyền Workers Scripts trên cả tài khoản. Vì vậy Worker preview riêng vẫn để mã nhánh deploy được lên Worker production, nếu token có trong env build [chưa kiểm]. Tắt build thì không cần biết câu trả lời. Staging công khai đặt ở tài khoản Cloudflare riêng vì token của tài khoản đó không có phạm vi trên tài khoản production.
- **(b) Không cấp thành viên Cloudflare cho tài khoản viết** (không chọn "vai Cloudflare tối thiểu"). Tài liệu không nói vai nào sửa được Settings › Build. Ai sửa được mục đó thì bật lại được preview build, nên lớp (a) chỉ đứng được khi tài khoản viết không có mặt trong tài khoản Cloudflare production.
- **(c) Luật hai chiều**, không chỉ "nhánh `production` ⇒ `SITE_ENV` phải là production". Một trong hai biến nói production thì cả hai phải nói production. Trigger đặt nhầm `SITE_ENV=test` hay ghi đè `WORKERS_CI_BRANCH` đều ra đỏ, không lặng lẽ tắt kiểm approval. `--dry-run` không kiểm nhánh, để qa chạy được trên máy với `tests/fixtures/content-sample`.
- **M30-b dùng `\u{…}` + cờ `u`.** Công cụ sửa tệp của phiên này tự đổi chuỗi ` ` thành ký tự thô. Dạng `\u{2028}` cùng nghĩa và không bị đổi. Cờ `u` không làm đổi kết quả `test()` với bộ ký tự này.

### Hệ quả mới tự lộ ra (nộp appsec soát; không tự vá)
1. Không còn Preview URL theo nhánh, nên khách xem trước nội dung bằng artifact hoặc staging ở tài khoản riêng. Staging đó cần dữ liệu liên hệ giả và hộp thư thử. Devops chọn có dựng staging hay không. Dựng thì appsec soát cấu hình tài khoản thứ hai (thêm một tài khoản Cloudflare cần 2FA và người giữ).
2. Tài khoản viết không vào dashboard Cloudflare production. Devops (vai AI) chỉ ghi cấu hình vào runbook, người duyệt áp tay. Thêm việc tay cho admin/GMS ở mọi lần đổi binding, biến hay trigger.
3. `WORKERS_CI_BRANCH` ghi đè được bằng biến dashboard. Luật hai chiều ở `build.ts` biến chuyện này thành đỏ khi ghi đè lệch. Ghi đè cả hai biến cùng lúc thì chỉ người duyệt làm được (§3.4).

## Lượt 6 (31/10/2026): trả lời appsec threat-model §0 lượt 5, ux_ui v0.2 §9, qa XQ-QA20–22

### Đổi ở lượt 6
| File | Đổi | Finding |
|---|---|---|
| `api.ts` §2 | `HeaderSafeText`: họ tên, công ty từ chối C0, C1 (kể cả `\u0085`), DEL, U+2028/2029, CR đơn ⇒ 422 `INVALID_CHARS`. Nội dung tin nhắn không theo luật này | XQ-25/M30 |
| `api.ts` | `ORIGIN_REJECTED` 403; `policyVersion` trong lỗi 409 | M32, Q-UX-15 |
| `api.ts` OUTBOX | `maxRetentionUnsentSeconds` = 7 ngày từ `created_at`; `alertRepeatSeconds` = 24 giờ | XQ-A2 |
| `api.ts` §8 | `MAIL_HEADERS` cố định, Subject RFC 2047 dạng B, Reply-To chỉ lấy email đã qua zod | M30 |
| `api.ts` §9 | `WORKER_RESPONSE_HEADERS`, `FORBIDDEN_RESPONSE_HEADERS` | M32 |
| `api.ts` §10 | `EDGE_RATE_LIMIT` (luật WAF Free) | XQ-26 |
| `api.ts` §11 | `TURNSTILE_WIDGET` | Q-UX-14 |
| `safe-url.ts` | mailto: dùng `indexOf("?")`, kiểm toàn bộ query | XQ-24-a |
| `test-control.ts` | viết lại cho Worker (`POST /__test__/<op>`) | XQ-QA20 |
| `build.ts` (mới) | biến build, `out/`, băm nội dung, `deploy-prod --dry-run`, `slugs.lock`, `_redirects` | XQ-QA21, M36, XQ-QA22 |
| `d1-schema.sql` | chú thích `rate_counter`, `alerted_at` | M29, XQ-A2 |

### Vì sao chọn như vậy — lượt 6 (cho appsec soát)
- **M29, Turnstile trước D1.** Request chưa qua Turnstile không chạm D1, nên không ăn trần ghi của D1. Bộ đếm lần thử đọc trước rồi mới ghi. Đã đủ thì 429 và không ghi. Loại binding Rate Limiting vì cửa sổ của nó chỉ 10 hoặc 60 s, không biểu diễn được 20 lần/600 s của acceptance. Loại phương án đếm trước Turnstile vì mỗi request rác sẽ thành một lần ghi D1.
- **Cổng test bỏ bí mật header.** Lớp chặn thật là điểm vào riêng cộng ca bundle CI (test-control.ts đầu trang). Bí mật không thêm lớp chặn nào cho một cổng không bao giờ được deploy.
- **Thư từ tên miền con** (ADR-006). Loại phương án bật Email Routing cho gốc vì nó động tới MX của GMS.
- **XQ-27** (ADR-005): ruleset cộng CODEOWNERS do GitHub giữ. Script trong repo chỉ chặn sơ suất. Loại chữ ký vì khoá và script kiểm đều nằm trong repo.

### Hệ quả mới tự lộ ra (finding mới, nộp lại appsec soát; không tự vá)
1. Token Turnstile dùng một lần. Sau 422 hoặc 409, FE phải `turnstile.reset()`; không làm thì lần gửi lại luôn 403. Đã ghi trong api.ts §11, cần qa thêm ca kiểm.
2. WAF Free không lọc được theo method, nên luật 3/10 s áp cho cả `GET /api/contact/health`. Smoke của devops phải gọi thưa hơn mức đó.
3. Dù có WAF, khoảng 4 IP vẫn cạn 100k request/ngày của Workers Free (design.md §6a). Form ngừng tới hôm sau; trang tĩnh không ảnh hưởng.
4. ADR-005 phương án (a) repo public: lộ mã nguồn và mọi file `approvals/`, nên `evidence` không được chứa PII.
5. ADR-005 cần hai người khác nhau. Một người giữ cả hai tài khoản thì ruleset hết tác dụng, và máy không phát hiện được.
6. Bỏ đếm lần thử trước Turnstile nghĩa là kẻ có token hợp lệ (người thật hoặc dịch vụ giải hộ) mới bị đếm. Request không token chỉ bị WAF chặn.

## Lượt 5 (31/10/2026): bỏ CMS, Cloudflare Free. Bảng này thay bảng cũ bên dưới

| File | Ràng buộc gì | Ai hiện thực | Máy validate |
|---|---|---|---|
| `api.ts` | `POST /api/contact` (request có `turnstileToken`, `pagePath`, `utm`; response; mã lỗi + HTTP; thêm `HUMAN_CHECK_FAILED` 403), `GET /api/contact/health`, `RATE_LIMITS`, `MAIL_CAPS`, `OUTBOX`, `CLIENT_IP_HEADER` | backend (Worker) · frontend_web (form) | `bun x tsc --noEmit` |
| `d1-schema.sql` (mới) | D1 `gms_contact`: `outbox`, `rate_counter`, `dedupe`, `mail_log`, `heartbeat` | backend | `wrangler d1 execute --local --file` |
| `content-model.ts` (mới) + `content-model.md` | Nội dung dạng file trong `content/**`: schema frontmatter/YAML, ảnh, xác nhận GMS (`Approval`), `IMAGE_LIMITS` | backend (loader + kiểm lúc build) · frontend_web | tsc + build |
| `routes.ts` | route vi/en, tất cả `static` | frontend_web | tsc |
| `safe-url.ts` | `safeHref` (+ mailto chỉ `subject`/`body`, XQ-24), `MARKDOWN_ALLOWED_TOKENS` thay Lexical | backend (build) · frontend_web (render) | tsc |
| `test-control.ts` (lượt 6; số phận chốt lượt 8: **DÙNG**) | Cổng `/__test__/<op>` của Worker chỉ dưới `wrangler dev --local --config wrangler.test.jsonc`; tên op + thân từng op; chuỗi cấm trong bundle production | backend (cổng) · qa (gọi) · devops (ca CI bundle) | tsc |
| `build.ts` (lượt 6) | Biến build, `isProductionBuild`/`productionEnvMismatch`/`mayDeployProduction`, `DATE_OVERRIDE` chỉ ngày, `out/`, `_redirects`/`_headers` | backend · devops · qa | tsc |
| `ops-tables.sql` | **Đã bỏ** (bỏ CMS). Hook chặn `rm` với architect ⇒ tệp còn 2 dòng báo đã bỏ, admin `git rm` | — | — |

### Lượt 8 (04/11/2026, prd v0.5 + review 04/11)
| Đổi | Ở đâu |
|---|---|
| `DATE_OVERRIDE` chỉ ngày `YYYY-MM-DD` (`BuildDate`) | build.ts §1, design.md §5b XQ-4 |
| Build do Deploy Hook kích có thể không có `WORKERS_CI_BRANCH` ⇒ thiếu nhánh thì tin `SITE_ENV`; deploy cần nhánh `production` hoặc (không nhánh + `WORKERS_CI="1"`) | build.ts §1 `productionEnvMismatch`, `mayDeployProduction`; design.md §5b XQ-4 (nguồn tài liệu) |
| Ngân sách CPU 10 ms (Free) cho Cron và POST; base64 thân thư làm lúc nhận | api.ts `CRON_LIMITS`, d1-schema.sql `outbox.body_b64`, design.md §6g |
| Chỉ nhận `application/json` (bỏ urlencoded) | api.ts `CONTACT_CONTENT_TYPES`, design.md §6a bước 1 |
| `MAIL_CAPS`: 30/giờ tròn (Asia/Ho_Chi_Minh), **75**/24 giờ, tóm tắt ≤ 120 s sau khi giờ kết thúc | api.ts, design.md §5 câu 6, XQ-1 |
| Giữ liên hệ chưa gửi được 7 ngày (XQ-A2, admin chốt 04/11), Cron dọn | d1-schema.sql đầu tệp, design.md XQ-2 |
| `Common` được export | content-model.ts |
| Đích thư production = `destination_address` của binding `MAIL`; `CONTACT_RECIPIENT` chỉ ở `wrangler.test.jsonc` | build.ts đầu tệp, test-control.ts `recipient`, design.md §4b, ADR-006 |
| Dọn Payload/ISR/Lexical: safe-url.ts (giữ — dùng cho URL trong YAML/Markdown), routes.ts (site tĩnh, `_redirects`), ADR-001/002/003 hết hiệu lực | các tệp đó |

**Vì sao chọn (lượt 8):**
- *Deploy Hook:* có hai cách — (a) giữ luật cũ và bắt devops đặt `WORKERS_CI_BRANCH` bằng tay ở biến build production; (b) thiếu nhánh thì dựa `SITE_ENV`. Chọn (b): (a) ghi đè biến hệ thống, build đẩy từ nhánh khác vẫn mang nhãn `production` ⇒ mất lớp kiểm nhánh. (b) vẫn đỏ khi nhánh có mặt mà khác `production`.
- *Đếm 20/10 phút sau Turnstile:* giữ M29 (không ghi D1 trước Turnstile); lệch chữ prd ⇒ XQ-PM1 (design.md cuối tệp).
- *75/24 giờ:* đúng phép tính prd v0.5 §6 (100 − 24 − 1), không còn dự trữ đăng nhập CMS.

**Hệ quả mới tự lộ ra (nộp appsec):** (1) `WORKERS_CI="1"` + `SITE_ENV=production` cho phép deploy khi không có nhánh — ai đặt được hai biến này ngoài Workers Builds (máy local có token Cloudflare) vượt được lớp kiểm nhánh; lớp chặn còn lại là token deploy chỉ ở §3.4 ADR-005. (2) `outbox.body_b64` là bản sao PII thứ hai trong cùng dòng (cùng hạn xoá). (3) Thư tóm tắt tách "phần k/n" ⇒ một lượt quá trần có thể ra nhiều thư hơn `summaryMaxPerHour` cũ — cần soát lại cách đếm.

### Đổi ở lượt 5
- Bỏ khỏi `api.ts`: `/lang`, `/api/jobs/run`, `JOB_AUTH`, bước kiểm thêm đăng nhập (ADR-003), REST CMS, `PAYLOAD_AUTH_ENDPOINTS`, `FILE_ROUTE_*`, `ADMIN_CSP_FIXED`, `login*` trong `RATE_LIMITS` (XQ-14), `MAIL_BUDGET` (thay bằng `MAIL_CAPS`: 30/giờ, 45/24 giờ, XQ-1).
- Lỗi giả cho qa: không còn cổng HTTP. Adapter kiểm thử của `worker/ports.ts` (design.md §3) chạy dưới `wrangler dev --local` và chỉ có trong bản build test. Production không có đường nào bật lỗi giả.

### Vì sao chọn như vậy (cho appsec soát)
- **Đếm chống spam ở D1, không dùng Rate Limiting binding.** Binding chỉ có cửa sổ 10/60 s và đếm theo từng PoP, gần đúng (ADR-004 [S4]). Ngưỡng 5/600 s và 20/600 s cần một nơi đếm. Đã cân Durable Objects: có ở Free **[chưa kiểm]**, nhưng thêm một loại hạ tầng mà không cần.
- **Thứ tự kiểm (lượt 8 soát theo `api.ts`, nguồn duy nhất: design.md §6a):** Origin (bước 3, không I/O) → parse JSON + lấy token (4) → Turnstile (5) → đếm lần thử 20/600 s (6, ghi D1 đầu tiên) → honeypot (7) → zod (8) → chính sách (9) → đếm thành công 5/600 s (10). Token sai bị chặn trước mọi ghi D1 và không tốn lượt của người thật cùng NAT.
- **Gộp trùng ở bảng `dedupe` riêng**, vì outbox bị xoá ngay khi gửi xong. Nếu gộp trùng dựa vào outbox thì bấm gửi lại sau khi thư đã đi sẽ thành thư thứ hai.
- **Hệ quả mới, chưa ai hỏi (nộp appsec):** (1) D1 Time Travel giữ bản DB 7 ngày, nên PII "đã xoá" còn khôi phục được trong 7 ngày (XQ-A3). (2) `send_email` chỉ gửi từ routing domain: thư báo đi ra từ tên miền GMS, nên SPF/DKIM do Cloudflare đặt khi bật Email Routing **[chưa kiểm]**. (3) Thư báo chứa dữ liệu người gửi nhập. Thư là text/plain, nhưng tiêu đề thư lấy từ `fullName` phải bỏ CR/LF (chặn chèn header). Backend làm, qa thêm ca.

**Mock cho frontend_web (còn hiệu lực):** `ContactSubmitResponse` là discriminated union — mock sinh mỗi nhánh `code` một phản hồi (fixture `tests/fixtures/<endpoint>/<code>.json`, lãnh địa qa).

---

## ĐÃ BỎ — lịch sử lượt 2–4 (CMS/Payload, bỏ raw 31/10)

> Mọi thứ dưới dòng này (REST CMS, `LOGIN_LOG_ENDPOINT`, `CmsErrorCode`, `loginAlert`, `StepUpVerifyResponse`, `ops-tables.sql`, Payload, ISR, Lexical, `/api/test-control`) là ghi chú **đã bỏ**, không vai nào hiện thực theo. Contract hiện hành là bảng ở đầu tệp + mục "Lượt 8".

| File | Ràng buộc gì | Ai hiện thực | Máy validate |
|---|---|---|---|
| `api.ts` | `POST /api/contact` (request/response/mã lỗi/HTTP, tên trường form, kiểu thân nhận), `/lang`, `/api/jobs/run` + cách mang bí mật theo V5 (`JOB_AUTH`), `/api/health`, bước kiểm thêm đăng nhập (§5, ADR-003), mọi ngưỡng (`RATE_LIMITS`, `MAIL_BUDGET`), REST CMS + nhật ký đăng nhập + mã lỗi CMS (§6) | backend (server) · frontend_web (form) | `bun x tsc --noEmit` trên thư mục này |
| `test-control.ts` | Cổng điều khiển kiểm thử `POST /api/test-control/<op>`: tên op, thân từng op, header bí mật, header IP giả; ba lớp chặn khỏi production | backend (cổng, chỉ build test) · qa (gọi) · devops (cờ build, ca CI manifest) | như trên |
| `safe-url.ts` (lượt 4) | Luật URL trong nội dung CMS (`safeHref`, `SafeHref` zod), danh sách node Lexical được phép, `rel` liên kết ngoài | backend (hook lưu) · frontend_web (serializer, mọi href từ CMS) | như trên |
| `routes.ts` | Bảng route vi/en (gồm phân trang Tin dạng đường dẫn), chế độ render, tag làm mới, 200/404, trang rỗng noindex, slug cấm, trang hệ thống noindex, kích thước OG | frontend_web | như trên |
| `ops-tables.sql` | Bảng ngoài Payload: bộ đếm, khoá băm IP, outbox thư, nhật ký đăng nhập, địa chỉ quen, thử thách bước kiểm thêm | backend | `psql -v ON_ERROR_STOP=1 -f` vào Postgres trống |
| `content-model.md` | Collections Payload: trường, localized, bắt buộc khi xuất bản, quyền đọc/ghi/xuất bản theo vai; luật ảnh dựng, bảng so sánh, NAP | backend | bảng → `payload generate:types` phải ra đúng tên trường (qa so) |

**Trạng thái kiểm:** chưa chạy `tsc`/`psql` trên các file này — repo code `../gms/gms-hungyen-web` rỗng, chưa có `package.json`, `project.yaml → code.commands` trống. Devops pha 0 thêm lệnh `${cmd.contracts}` chạy hai lệnh trên; tới lúc đó các file là **chưa kiểm**.

**Mock cho frontend_web:** `ContactSubmitResponse` và `StepUpVerifyResponse` là discriminated union — mock sinh mỗi nhánh `code` một phản hồi (fixture `tests/fixtures/<endpoint>/<code>.json`, lãnh địa qa). Frontend không cần backend chạy để làm mọi trạng thái form.

**Gây trạng thái lỗi / dựng tiền điều kiện:** `test-control.ts` (lượt 3; thay `FaultInjection` + `/api/dev/fault` của lượt 2). Chỉ có trong **bản build test**, không bật bằng env lúc chạy.

**Mirror ở repo code:** repo code chưa có `src/contracts`/`ci/contract-snapshot/` (devops pha 0) ⇒ chưa có gì để lệch; khi chép, chép đúng các file trong bảng trên, không thêm file lạ (checklist B).

**D7 (so trước/sau):** devops chụp `contracts/` vào `ci/contract-snapshot/` của repo code; CI fail khi khác mà PR không kèm sửa file này ở Forge.

## Đổi ở lượt 2 (2026-10-31)
- `routes.ts`: 410 ⇒ 404 cho mọi trạng thái không còn xuất bản; phân trang `?trang=` ⇒ `/tin-tuc/trang/:n` (`PAGINATION_SEGMENT`, `RESERVED_NEWS_SLUGS`); thêm `newsPage`, `SYSTEM_NOINDEX_PATHS`. Lý do: design.md §5.5, §6e.
- `ops-tables.sql`: bỏ `ops.url_tombstone` (không còn 410); thêm `ops.login_challenge`, `mail_outbox.kind = 'login_challenge'`, `rate_counter.scope = 'step_up_verify_ip'`.
- `api.ts`: thêm §5 bước kiểm thêm; `HealthResponse.lastJobRunSecondsAgo`; sửa chú thích "ADR-005" ⇒ ADR-003.
- `content-model.md`: `media.kind` còn 2 giá trị theo S17; `news.origin` cho nhập fanpage S31; block `comparisonTable` S33; `company.mapImage/mapUrl`; endpoint công khai thêm `/api/auth/verify-network`.

## Đổi ở lượt 3 (2026-10-31) — trả lời appsec XQ-7, 8, 10–13 và qa XQ-1–4
- `test-control.ts` (mới): thay endpoint gây lỗi theo env (M4). Bỏ `api.ts §4 FaultInjection`.
- `api.ts`: `CONTACT_ENDPOINT`, `CONTACT_FORM_FIELDS` (form `<form method=post>` gửi urlencoded được, luôn trả JSON; kiểu khác ⇒ 415); `RATE_LIMITS.loginAlertPerAccountPerDay`, `challengeResendMax`; `MAIL_BUDGET` (trần theo ngày, tạm); `JOB_AUTH`; §6 REST CMS, `LOGIN_LOG_ENDPOINT`, `EXPECTED_UPDATED_AT_HEADER`, `CmsErrorCode`.
- `content-model.md`: danh sách endpoint công khai **đóng**, lớp `publicFind`; hai bucket R2 (`media.publicUrl` do server đặt, `privateDocs` mới thay `partners.permissionDoc` dạng tệp công khai); quyền mức trường `users`; luật xuất bản ở mọi đường đổi `_status` (gồm khôi phục phiên bản); trường do server đặt; `contacts.consentAt/note/statusChangedBy/At`; forgot-password **tắt** (G6 vẫn chờ admin).
- `ops-tables.sql`: `login_log.email_tried` null khi không khớp tài khoản (+ CHECK) (M13); index `mail_outbox_sent_by_kind`.

## Đổi ở lượt 4 (2026-10-31) — trả lời appsec XQ-15, 16, 17, 18
- `safe-url.ts` (mới, XQ-17): `safeHref` + `SafeHref` (danh sách cho phép lược đồ), `LEXICAL_ALLOWED_NODES`, `LEXICAL_HEADING_TAGS`, `EXTERNAL_LINK_REL`.
- `api.ts`: `JobRunRequest.tasks` thêm `mediaReconcile`; `CmsErrorCode` thêm `UNSAFE_URL`, `LEXICAL_NODE_FORBIDDEN`, `MEDIA_UNPUBLISH_FAILED`; `CmsErrorBody.data.action` (publish/unpublish); §6 ghi chú luật gỡ; §7 `PAYLOAD_AUTH_ENDPOINTS` (mới); §8 `FILE_SERVED_TYPES`, `FILE_ROUTE_HEADERS`, `FILE_ROUTE_DISPOSITION`, `MEDIA_PUBLIC_CACHE_CONTROL`, `ADMIN_CSP_FIXED` (mới).
- `content-model.md`: luật gỡ của 5 loại (XQ-15a); `users.read` chỉ của mình với BTV/ND (XQ-15b); quyền mức trường `media.consent`/`hasPeople` (XQ-15c); endpoint auth Payload đóng + `seed/create-admin` (XQ-15d); thứ tự làm ẩn/làm lộ + `mediaReconcile` + purge CDN + `Cache-Control` + r2.dev tắt + `mimeType` dò từ byte (XQ-16a/b/c/d); "Luật URL" và "Nhập fanpage chỉ là chữ" (XQ-17).
- `test-control.ts`: chú thích ba lớp viết lại theo XQ-18 (thay module lúc build, danh sách cho phép, bí mật trống ⇒ 404, tệp đánh dấu build test, 6 ca CI); hằng `TEST_BUILD_SITE_ENVS`, `PROXY_MODES_PRODUCTION`, `PROXY_MODE_TEST`, `TEST_CONTROL_SECRET_MIN_BYTES`, `BUILD_TEST_MARKER`, `BUILD_FORBIDDEN_STRINGS`; `JobName` thêm `mediaReconcile`.
- Ngoài `contracts/`: `design.md` §2 (backend thêm `src/instrumentation.ts`), §4, §4b (`CDN_ZONE_ID`, `CDN_PURGE_TOKEN`), §6e (CSP `/admin`, header route tệp, việc devops), §7c, §8b, §10 G1, "Chưa kiểm"; `adr-002` dòng `MediaStore` + đoạn `ClientIp`. Không ADR mới: thay module lúc build và các luật trên đều đảo ngược được bằng một PR.

## Vì sao chọn như vậy — lượt 4 (cho appsec soát)
- **URL: danh sách cho phép + kiểm hai lần** (XQ-17). Loại: danh sách cấm `javascript:`/`data:` (lược đồ lạ, biến thể hoa/thường, ký tự điều khiển lọt); chỉ kiểm lúc render (dữ liệu xấu nằm trong DB, đường render mới quên kiểm là lộ); chỉ kiểm lúc lưu (dữ liệu cũ/đường ghi vòng không qua hook). Kiểm ở hook chứ không ở `validate` của trường vì validate có thể bị bỏ khi lưu nháp **[chưa kiểm]**. Ký tự điều khiển/khoảng trắng ⇒ từ chối, không "làm sạch rồi nhận" (làm sạch là nơi sinh lỗi vượt rào).
- **Fanpage chỉ chữ** (XQ-17b). Loại: parse HTML rồi lọc (cần thư viện sanitize — G1 chưa quyết, thêm bề mặt). 7 bài, mất định dạng là chấp nhận được; BTV thêm liên kết tay qua editor (đi qua `safeHref`).
- **Gỡ xuất bản chặn BTV như xuất bản** (XQ-15a). Loại: cho BTV gỡ (gỡ Số liệu đang được bảng so sánh dùng ⇒ ẩn cả bảng — S33 — tức BTV đổi được nội dung công khai mà không qua ND).
- **`users.read` chặt hơn appsec hỏi** (XQ-15b): appsec hỏi BTV; architect áp cả ND vì ND không cần danh sách tài khoản cho việc nào trong prd. Hệ quả hiển thị ghi ở content-model.md.
- **`hasPeople` một chiều với BTV** (XQ-15c). Loại: cấm BTV ghi `hasPeople` (người biết ảnh có người là người tải lên; mặc định sai là lộ); cho BTV ghi tự do (BTV đặt `false` ⇒ ảnh có người lộ mà không qua ND). Một chiều = BTV chỉ làm chặt được.
- **QT đầu tiên bằng script, đóng `first-register` mọi lúc** (XQ-15d). Loại: mở `first-register` khi DB rỗng (khoảng thời gian giữa deploy và tạo tài khoản là cửa sổ chiếm quyền; DB bị xoá nhầm/khôi phục rỗng mở lại cửa).
- **Làm ẩn trước commit, làm lộ sau commit** (XQ-16a). Loại: ghi DB rồi gỡ (lỗi giữa chừng ⇒ DB nói đã rút đồng ý nhưng ảnh còn công khai — đúng lỗi appsec chỉ ra); outbox cho gỡ ảnh (đúng về lâu dài nhưng ảnh còn lộ tới lượt job kế). Giá: rút đồng ý phụ thuộc R2 + API Cloudflare đang chạy — chọn riêng tư hơn sẵn sàng (ưu tiên "hợp pháp" ở priorities.md v2 đứng trên "GMS tự đăng"). Khoá mới mỗi lần publish thay vì dùng lại khoá cũ: URL đã purge không sống lại trong cache bất kỳ ai.
- **Purge theo URL + `Cache-Control` 1 giờ** (XQ-16b). Loại: `max-age` dài + `immutable` (trình duyệt giữ bản ảnh đã rút tới hết hạn, không purge được); không cache (mất CDN, tải ảnh chậm — ngưỡng prd §6). Trình duyệt sẽ kiểm lại ảnh mỗi giờ (304) — chấp nhận.
- **Thay module lúc build** (XQ-18i). Loại: `if (process.env.GMS_TEST_HOOKS)` + tin minifier bỏ nhánh chết (chuỗi vẫn có thể còn trong bundle, không có bằng chứng máy); chỉ dựa vào `pageExtensions` (docs không nói route handler tôn trọng — threat-model §4g). Bằng chứng nhận: ca CI grep đầu ra build, không phải đọc docs.
- **Danh sách cho phép ở gác khởi động** (XQ-18ii). Loại: danh sách cấm "`SITE_ENV=production` thì thoát" (thiếu biến/viết sai `prod` lọt qua — đúng lỗi appsec chỉ ra).
- **Bí mật trống ⇒ 404 nhưng không thoát tiến trình** (XQ-18iii). Loại: thoát tiến trình (bản build test chạy trên máy dev không đặt bí mật vẫn cần dùng app); 404 đủ đóng cổng.
- **Không ADR mới:** mọi thứ trên đảo ngược bằng một PR; ADR chỉ cho quyết định khó đảo ngược.

**Hệ quả mới tự lộ ra ở lượt 4 (appsec soát lại — không tự vá):** (1) `src/instrumentation.ts` trước đây không thuộc lãnh địa nào — giao backend (design.md §2). (2) Rút đồng ý ảnh phụ thuộc R2 + API purge Cloudflare; Cloudflare hỏng ⇒ không rút được (503) — BTV/ND phải thấy lỗi, không phải "đã rút". (3) Bí mật mới `CDN_PURGE_TOKEN`. (4) `MEDIA_PUBLIC_BASE_URL` phải trên zone Cloudflare — nếu DNS khách không ở Cloudflare (P12/V5) thì XQ-16b cần cách khác. (5) Khoá mới mỗi lần publish ⇒ URL ảnh đổi ⇒ phải làm mới tag mọi trang dùng ảnh (đã ghi), ảnh đổi URL làm mất cache trình duyệt cũ — chấp nhận. (6) `users.read` chỉ của mình ⇒ BTV/ND thấy id thay vì tên ở quan hệ `users`. (7) `CDN_PURGE_TOKEN` thiếu ở production làm `assertRuntimeConfig` fail ⇒ site không chạy — gác này chặt; appsec xét có muốn chỉ cảnh báo không.

## Vì sao chọn như vậy (cho appsec soát)
- **Cổng test theo build, không theo env** (XQ-1/M4): env sai ở production là lỗi cấu hình hay gặp; route không có trong bản build thì không có gì để bật nhầm. Thêm gác khởi động + bí mật header là hai lớp phòng khi cờ build lọt. Phương án đã loại: giữ `/api/dev/fault` + kiểm `SITE_ENV` (một lớp, hỏng khi thiếu biến); dùng `/__test__` như qa đề xuất (thư mục `_` là private trong App Router).
- **Hai bucket thay vì URL ký tên** (XQ-8): trang công khai là ISR — URL ký tên hết hạn nằm trong HTML đã cache. Bucket riêng tư giữ mọi tệp; chỉ ảnh `!hasPeople || consent` được chép sang bucket công khai, tên UUID (không đoán từ tên gốc). Rút đồng ý ⇒ xoá bản chép + làm mới tag. Phương án đã loại: một bucket + chặn theo prefix (một cấu hình sai là lộ hết); proxy mọi ảnh qua app (tốn CPU Worker, mất cache CDN).
- **Đóng REST công khai** (XQ-8): mọi trang đọc qua `publicFind` phía server; bỏ quyền `read` ẩn danh của collections ⇒ `?draft=true`, `depth`, `where` trên REST không còn đường đọc bản nháp hay trường riêng.
- **Khôi phục phiên bản bị chặn với BTV** (XQ-7): đường restore đổi `_status` mà không qua form xuất bản; chặn ở access + hook `beforeChange` kiểm vai khi `_status` đổi sang `published` từ bất kỳ đường nào. **[chưa kiểm]** hook có chạy khi restore — backend kiểm, không chạy ⇒ tắt restore cho BTV ở access.
- **forgot-password tắt** (XQ-11): bật cần thêm phạm vi rate limit, phần thư trong `MAIL_BUDGET` và phản hồi chống dò email — chưa có ⇒ tắt là mặc định an toàn; G6 vẫn để admin quyết.
- **Trần thư theo ngày chừa phần cho thư đăng nhập** (XQ-12): spam form không được làm cạn hạn mức nhà cung cấp tới mức chủ không nhận được mã kiểm thêm. Con số `providerDailyQuotaDefault` là **[chưa kiểm — trí nhớ model]** (Resend Free), đọc từ `MAIL_DAILY_QUOTA` để đổi gói không sửa mã.
- **Bí mật job theo phương án** (XQ-13): A gọi trong tiến trình (không bí mật trên đường mạng); B theo cách Vercel Cron gửi (`Bearer`); C loopback. Không bao giờ ở query string (lọt vào log truy cập).
- **CSP tĩnh** (XQ-10, design.md §6e): nonce bắt render động ⇒ mất ISR và lưới ≤ 60 s; chấp nhận `'unsafe-inline'` cho script, bù bằng không HTML thô từ CMS và các chỉ thị khoá khác.
- **Hệ quả mới tự lộ ra (appsec soát lại):** (1) hai bucket thêm một đường ghi (`publish/unpublish`) — lỗi giữa chừng có thể để bản chép mồ côi ở bucket công khai sau khi rút đồng ý. **Thay ở lượt 4 (XQ-16a):** thứ tự duy nhất ở `content-model.md` "Kho tệp riêng tư" (làm ẩn trước commit, làm lộ sau commit), đối soát bằng job `mediaReconcile` (không phải `retention`). (2) Đóng REST công khai làm `GET /api/media/file/*` mặc định của Payload không còn công khai — ảnh công khai chỉ đi qua `MEDIA_PUBLIC_BASE_URL`. (3) `loginAlertPerAccountPerDay` giới hạn thư cảnh báo: kẻ dò mật khẩu sau mức này không còn bị báo thêm trong ngày — nhật ký đăng nhập vẫn ghi.

- Lỗi trả **mã**, không trả câu chữ: chữ theo locale nằm ở frontend; hai chuỗi bắt buộc của `.feature` ghi nguyên văn trong `api.ts`.
- Honeypot trả 200 giả: bot không học được dấu hiệu. Gửi trùng trong 10 phút cũng 200, không thư mới.
- Máy-gọi-máy trả **404** khi sai bí mật: không lộ endpoint.
- `mail_outbox.to_address` chụp lúc xếp hàng: đổi email nhận (G2) không làm thư đã xếp đi sang địa chỉ mới; nếu admin nhận G2 thì thêm một thư báo tới địa chỉ cũ — thêm `kind='recipient_changed'` (đổi CHECK, D7).
- `login_log.ip` giữ IP thô (prd §6 cho phép trong nhật ký đăng nhập, chỉ Quản trị, 90 ngày); bộ đếm và địa chỉ quen chỉ giữ HMAC.
- **Bước kiểm thêm bằng mã email, không TOTP** (ADR-003): đóng S34 mà không thêm thư viện 2FA cộng đồng chưa diễn tập. Chống dò email: `challengeId` chỉ phát khi mật khẩu đúng; email sai/mật khẩu sai cùng một phản hồi. Mã lưu băm, tối đa 5 lần nhập, 10 phút; hết hạn/hết lượt/không tồn tại cùng một mã lỗi. Hệ quả cần appsec soát: hộp thư của tài khoản thành yếu tố thứ hai — chiếm email = vượt bước kiểm thêm (G3/XQ-6 vẫn mở cho 2FA thật).
- **404 thay 410**: không có bảng URL đã gỡ ⇒ không còn nguồn lộ danh sách bài đã gỡ; không đổi bề mặt tấn công.
