# Đo: đổi `recommended: true` → `preset: "recommended"` ở commit 61020e9 (biome.json)

Ngày 05/11/2026, vai devops. Biome **2.6.4** (`bun.lock`; `node_modules/@biomejs/biome/package.json`).
Cây code: HEAD (6c91eab), cây làm việc sạch trước khi thêm thư mục này.

## Kết luận: GIỐNG

Hai cấu hình cho **cùng 35 error / 142 warning / 24 info**, cùng 110 file, cùng danh sách file có vi phạm,
cùng bảng 16 rule với cùng số đếm (bảng dưới). Phần khác duy nhất: cấu hình A in thêm một thông báo
`DEPRECATED` ("recommended field has been deprecated... Use preset instead") — đúng lý do của commit 61020e9.

## Cách đo

- (B) = `biome.json` ở HEAD, chép nguyên văn sang `ci/measure-cfg/biome-B.json`.
- (A) = (B) với đúng một dòng `"preset": "recommended"` thay bằng `"recommended": true`
  (`ci/measure-cfg/biome-A.json`).
- **Hạn chế khi dựng A:** hook READ-VIA-BASH cấm `git show 61020e9^:biome.json` với vai devops nên A **không lấy từ lịch sử**
  mà dựng lại từ mô tả của task (đổi một dòng, dòng 26). Chỉ chứng được gián tiếp:
  `git log --stat -- biome.json` báo 61020e9 là "1 insertion, 1 deletion" trên biome.json, khớp thay đổi một dòng.
  Admin/appsec/qa có quyền đọc lịch sử nên có thể đối chiếu `git show 61020e9^:biome.json` với `ci/measure-cfg/biome-A.json`
  (phải giống từng byte).
- Đối chứng: chạy B qua `--config-path` ra kết quả **trùng từng dòng** với chạy mặc định (đọc `biome.json` gốc) — nên cách
  `--config-path` không làm lệch phạm vi file.
- Chạy trong sandbox (Plan 19) từ gốc Forge. Mỗi lệnh dạng
  `ruby scripts/sandbox/sandbox_run.rb --role devops --project gms-hungyen-web -- <lệnh dưới>`:
  1. `bun x biome check . --reporter=summary --colors=off` (cấu hình gốc = HEAD)
  2. `bun x biome check . --config-path=ci/measure-cfg/biome-B.json --reporter=summary --colors=off`
  3. `bun x biome check . --config-path=ci/measure-cfg/biome-A.json --reporter=summary --colors=off`
- Không đo được: `biome rage --linter` / `biome explain` không nằm trong allowlist của vai (chỉ `bun x biome check`).
  Vì vậy **bằng chứng là số chẩn đoán theo rule, không phải danh sách rule bật**: rule bật mà không sinh chẩn đoán
  trên cây này thì không được so. Nếu cần chứng bộ rule bật, nhờ admin chạy `bun x biome rage --linter --config-path=...`
  cho A và B rồi diff.

## Số chẩn đoán theo mức (A = trước, B = sau)

| Mức | A | B | Chênh |
|---|---|---|---|
| error | 35 | 35 | 0 |
| warning | 142 | 142 | 0 |
| info | 24 | 24 | 0 |

## Theo rule

| Rule | Mức | A | B | Chênh |
|---|---|---|---|---|
| assist/source/organizeImports | error | 8 | 8 | 0 |
| lint/a11y/noSvgWithoutTitle | error | 4 | 4 | 0 |
| lint/correctness/noUnusedVariables | error | 2 | 2 | 0 |
| lint/complexity/noExcessiveCognitiveComplexity | warning | 19 | 19 | 0 |
| lint/complexity/noImportantStyles | warning | 48 | 48 | 0 |
| lint/complexity/useOptionalChain | warning | 12 | 12 | 0 |
| lint/correctness/noUnusedFunctionParameters | warning | 1 | 1 | 0 |
| lint/performance/noAccumulatingSpread | warning | 1 | 1 | 0 |
| lint/performance/noImgElement | warning | 11 | 11 | 0 |
| lint/performance/useDomNodeTextContent | warning | 7 | 7 | 0 |
| lint/style/noDescendingSpecificity | warning | 5 | 5 | 0 |
| lint/style/noNonNullAssertion | warning | 35 | 35 | 0 |
| lint/style/useImportType | warning | 2 | 2 | 0 |
| lint/suspicious/noConfusingVoidType | warning | 1 | 1 | 0 |
| lint/complexity/useLiteralKeys | info | 7 | 7 | 0 |
| lint/style/useTemplate | info | 17 | 17 | 0 |

Còn 21 file "need to be formatted" (chẩn đoán format, không nằm trong bảng rule), cùng danh sách ở A và B.

## Nguồn của các error hiện có

Không error nào do đổi preset: mọi rule đều chênh 0. Cả 35 error đã có ở A. Cơ cấu: 14 error từ 3 rule ở bảng
(8 organizeImports + 4 noSvgWithoutTitle + 2 noUnusedVariables) và 21 error format (21 file "need to be formatted").

## Lệch với số admin nêu

Admin nêu HEAD là **38 error / 143 warning / 24 info**; lượt này đo **35 / 142 / 24** trên HEAD 6c91eab. Chênh 3 error + 1 warning
không do đổi preset (A và B bằng nhau). Nhiều khả năng số kia đo trước các commit dọn lint gần đây (6c91eab "dọn lint")
hoặc trên cây có file chưa commit — admin đối chiếu lại số cũ ở commit nào.
