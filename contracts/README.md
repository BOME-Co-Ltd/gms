# contracts/ — gms-hungyen-web

## Lượt 16 (07/11/2026): XQ-42 — giải mã lặp tới bất động (M40-b), xoá ký tự định dạng vô hình (M40-c)

Theo lời giao việc task `architect-20261106170355-57a8` (`--fixes appsec:M40`) và appsec threat-model.md §000000000.3–.4 (lượt soát 13, XQ-42). `design_approved` chưa qua ⇒ sửa trong chặng design. Mirror `contracts/` trong repo code tiếp tục lệch (D7 (a)).

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | `normalizeForNameScan` `:201–209`: xoá `\p{Cf}` ĐẦU TIÊN (trước NFC và trước gộp khoảng trắng). Comment giải mã `:211–218`. Hằng mới `NAME_SCAN_DECODE_PASSES_MAX = 3` (export) `:219`. `NAMED_REFS` `:220–224` đổi từ object literal sang `ReadonlyMap`, thêm `shy` ⇒ U+00AD; `nbsp`, `shy` viết bằng `String.fromCharCode(0xa0/0xad)`. Thân giải mã cũ đổi tên thành `decodeOnceForNameScan` `:256–266` (không export, không đổi bước nào ngoài `NAMED_REFS.get`). `decodeForNameScan` `:267–279` lặp `decodeOnceForNameScan` tới khi chuỗi không đổi, tối đa `NAME_SCAN_DECODE_PASSES_MAX` lượt. `utf8SeqLength`, `decodePercentRun`, `forbiddenNamePattern` (lớp nối `[\s_./+-]*`), `findForbiddenNames` **không đổi** | XQ-42 (1)(2); M40-b, M40-c |
| `build.ts` | Chỉ comment: luật (6) `:218–222` (giới hạn mới: trần 3 lớp, Cf; trỏ XQ-43); `:173` (`content-pages.feature:46–51`), `:180` và `:212` (`figures-and-claims.feature:119–124`) trỏ số dòng `.feature` hiện hành | XQ-42 (3) |
| `content-model.md` | Dòng "Tên không được nêu" | khớp `.ts` |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **Xoá Cf ở `normalizeForNameScan`, bước đầu tiên (chọn)**, thay vì ở `decodeForNameScan` (loại: `normalizeForNameScan` còn chạy trên chính tên trong danh sách ở `forbiddenNamePattern`, hai phía phải qua cùng một phép) hay sau NFC (loại: Cf đứng giữa chữ gốc và dấu kết hợp chặn NFC ghép; xoá trước thì không phải nghĩ tới). Hệ quả: Cf giữa hai chữ của tên làm hai chữ dính nhau ("xanhasian") — lớp nối `*` vốn đã bắt dạng viết liền, không cần thêm Cf vào lớp nối. U+FEFF thuộc `\s` của JS và thuộc Cf: trước lượt 16 thành dấu cách, nay bị xoá — cả hai đều bị bắt.
- **Lặp có trần 3 lượt, dừng sớm khi không đổi (chọn, đúng XQ-42 (1))**, thay vì lặp không trần (loại: không chứng minh được dừng trên mọi đầu vào nếu sau này thêm bước giải) hay giải đệ quy từng dạng (loại: phải tự viết thứ tự ưu tiên giữa HTML/JS/`%`). Trần là hằng export để ca qa dùng cùng giá trị.
- **`NAMED_REFS` thành `Map` (chọn, ngoài yêu cầu, sửa cùng chỗ)**: object literal trả `Object.prototype` cho `&constructor;`, `&toString;`… (giá trị là hàm, `replace` đổi thành chữ mã nguồn của hàm). Không làm lọt tên nào; chỉ là đầu ra sai. Đổi hành vi duy nhất: các thực thể lạ đó nay giữ nguyên.

Ca giá trị (hàm thuần; admin/qa chạy bằng một tệp thử nhập `content-model.ts`; **architect chưa chạy ca nào**, mọi ô "Ra" là dò tay theo mã). Cột "Vào" là **biểu thức JS** chép thẳng vào script được; ký tự vô hình viết bằng `String.fromCharCode(…)` để không có ký tự vô hình nằm trong tệp này. `F(x)` = `findForbiddenNames(x, ["Xanh Asian"])`, `D(x)` = `decodeForNameScan(x)`.

| # | Vào (biểu thức JS) | Gọi | Ra mong đợi | Dò tay: các lượt giải |
|---|---|---|---|---|
| 1 | `"xanh%2520asian"` | `F` | `["Xanh Asian"]` (lượt 15: `[]`) | `%20` ⇒ ` ` ⇒ dừng |
| 2 | `"xanh%26nbsp%3Basian"` | `F` | `["Xanh Asian"]` | `&nbsp;` ⇒ U+00A0 |
| 3 | `"xanh%5Cu0020asian"` | `F` | `["Xanh Asian"]` | lượt 1: `%5C` ⇒ gạch chéo ngược, còn chữ "gạch chéo + u0020"; lượt 2: bước JS ⇒ dấu cách |
| 4 | `"Xanh&amp;nbsp;Asian"` | `F` | `["Xanh Asian"]` | `&nbsp;` ⇒ U+00A0 |
| 5 | `"Xanh&amp;#x20;Asian"` | `F` | `["Xanh Asian"]` | `&#x20;` ⇒ ` ` |
| 6 | `"xanh%252520asian"` (3 lớp) | `F` | `["Xanh Asian"]` | `%2520` ⇒ `%20` ⇒ ` ` (đủ 3 lượt) |
| 7 | `"xanh%25252520asian"` (4 lớp) | `F` | `[]` — **giới hạn** trần 3 lượt | sau 3 lượt còn `xanh%20asian` |
| 8 | `"Xanh&amp;amp;amp;nbsp;Asian"` (4 lớp HTML) | `F` | `[]` — **giới hạn** trần 3 lượt | sau 3 lượt còn `&nbsp;` |
| 9 | `"Xanh" + String.fromCharCode(0x200b) + "Asian"` | `F` | `["Xanh Asian"]` | không giải gì; chuẩn hoá xoá Cf ⇒ `xanhasian` |
| 10 | `"Xa" + String.fromCharCode(0xad) + "nh Asian"` | `F` | `["Xanh Asian"]` | chuẩn hoá ⇒ `xanh asian` |
| 11 | `"Xa&shy;nh Asian"` | `F` | `["Xanh Asian"]` | `&shy;` ⇒ U+00AD ⇒ xoá |
| 12 | `"Xanh&#x200B;Asian"` | `F` | `["Xanh Asian"]` | ⇒ U+200B ⇒ xoá |
| 13 | `"xanh%E2%80%8Basian"` | `F` | `["Xanh Asian"]` | `%E2%80%8B` ⇒ U+200B ⇒ xoá |
| 14 | `"Xanh" + String.fromCharCode(0x2060) + " Asian"` | `F` | `["Xanh Asian"]` | U+2060 xoá, dấu cách giữ |
| 15 | `"Xanh, Asian"` | `F` | `[]` (cố ý, như lượt 14) | — |
| 16 | `"C++ +84"` | `F` | `[]` | — |
| 17 | `"/?q=Xanh+Asian"` | `F` | `["Xanh Asian"]` (giữ lượt 15) | `+` không giải |
| 18 | `"xanh%2Basian"` | `F` | `["Xanh Asian"]` (giữ lượt 15) | ⇒ `xanh+asian` ⇒ dừng |
| 19 | `"%20%FF%20"` | `D` | `" %FF "` (giữ lượt 15) | lượt 2 giữ `%FF` ⇒ không đổi ⇒ dừng |
| 20 | `"%C3%C3%A1"` | `D` | `"%C3á"` (giữ lượt 15) | lượt 2: `%C3` một mình hỏng ⇒ giữ |
| 21 | `"&constructor;"` | `D` | `"&constructor;"` (lượt 15: chữ mã nguồn của hàm `Object`) | `Map` không có khoá |

Bảng ca "Lượt 15" bên dưới vẫn đúng **trừ** dòng `xanh%2520asian` ⇒ `[]`: nay là ca 1 ở trên (`["Xanh Asian"]`).

Hệ quả tự lộ ra (gửi appsec lượt soát 14; không tự vá, không mở vòng mới — ghi ở design.md "Câu hỏi liên vai (lượt 16)"): (1) **Thực thể không có dấu `;`.** Regex giải chỉ nhận `&name;`, `&#NN;`, `&#xHH;`. Trình duyệt vẫn hiểu `&nbsp` (một số tên cũ) và `&#32`, `&#x20` khi thiếu `;` trong HTML thô ⇒ `Xanh&nbspAsian` viết tay trong một tệp HTML/SVG của `public/` hiện ra "Xanh Asian" mà luật không bắt [dò tay; hành vi trình duyệt: trí nhớ model, chưa kiểm]. React và Markdown (CommonMark đòi `;`) không sinh dạng này từ i18n/`content/` — chỉ có từ tệp viết tay. Cùng họ M40-b. (2) **Ký tự trống không thuộc Cf và không thuộc `\s`**: U+3164, U+FFA0, U+115F/U+1160 (thuộc `\p{L}`), U+2800 (chữ nổi trống, `\p{So}`). Trình duyệt vẽ thành khoảng trống ⇒ `"Xanh" + String.fromCharCode(0x2800) + "Asian"` lọt [dò tay]. Không có trong Word/PDF/web thường gặp ⇒ thuộc nhóm "phải cố ý né" như chữ đồng hình (threat-model §000000000.3 cuối); kể cả U+202E (đảo chiều) + chữ viết ngược: Cf bị xoá nhưng chữ còn ngược ⇒ lọt. (3) Cf nằm GIỮA một thực thể hay một `%XX` (`&nb` + U+200B + `sp;`) không được giải vì giải chạy trước chuẩn hoá — trình duyệt cũng không giải dạng đó nhưng hiện nguyên chữ "Xanh&nbsp;Asian" (U+200B không được vẽ), nên đây **là** đường lọt kiểu dấu câu hiện ra giữa hai chữ, cùng loại "Xanh, Asian" (ca 15), chỉ có khi cố ý chèn ⇒ chấp nhận là giới hạn (appsec lượt soát 14, M40-f; architect lượt 17 sửa lý do, bản lượt 16 ghi sai là "không phải đường lọt"). appsec lượt soát 14 chấp nhận cả ba hệ quả là giới hạn mức Thấp (M40-d, M40-e, M40-f; threat-model §0000000000.2).

**Chưa kiểm:** `tsc --strict` (target es2022) chưa chạy trên bản lượt 16; chưa ca nào ở bảng trên chạy (vai architect không có `tsc`, `node`). Điểm dễ lỗi khi tsc: `new Map<string, string>([...])` gán vào `ReadonlyMap<string, string>`; `NAMED_REFS.get(...) ?? m` (kiểu `string | undefined` ⇒ `string`); `NAME_SCAN_DECODE_PASSES_MAX` kiểu chữ `3` trong `pass < …`; regex `/\p{Cf}+/gu` cần cờ `u` (ES2018+). `catch {}` không biến ở `decodePercentRun` giữ từ lượt 15 (đã qua tsc es2022 ngày 06/11). Lưu ý cho người viết script: **công cụ ghi tệp của phiên architect đổi chuỗi thoát `\u` + 4 số hex thành chính ký tự đó** (07/11: lần ghi đầu `NAMED_REFS` ra ký tự U+00A0/U+00AD thật trong nguồn, đã sửa sang `String.fromCharCode`); vì vậy bảng dùng `String.fromCharCode`, không dùng chuỗi thoát.

## Lượt 15 (06/11/2026): vá hệ quả (i)(ii) của lượt 14, giữ (iii) là giới hạn

Theo ux-spec §12 V42 (4) (admin chốt 06/11, được khách uỷ quyền) và lời giao việc task `architect-20261106164831-df83`. Ba hệ quả là của architect lượt 14 (design.md "Câu hỏi liên vai lượt 14", đoạn "Hệ quả tự lộ ra"). `design_approved` chưa qua ⇒ sửa trong chặng design. Mirror `contracts/` trong repo code tiếp tục lệch (D7 (a)).

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | Comment giải mã `:208–213` (byte hỏng giữ nguyên, chuỗi hợp lệ vẫn giải; một lượt; `+` không giải). Thêm `utf8SeqLength` `:217–225` và `decodePercentRun` `:226–245` (không export). `decodeForNameScan` gọi `decodePercentRun` cho mỗi cụm `%XX` `:253`. Lớp nối `[\s_./-]*` ⇒ `[\s_./+-]*` `:263`, comment `:256–259` thêm "xanh+asian", "xanh%2Basian" | hệ quả (i), (ii) lượt 14 |
| `build.ts` | Chỉ comment `:218–220`: thêm hai giới hạn (chữ dựng lúc chạy, mã hoá lồng nhau), trỏ design.md §6f | hệ quả (iii) |
| `content-model.md` | Dòng "Tên không được nêu": thêm dấu `+`, cụm `%XX` hỏng | khớp `.ts` |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **(i) Đi từng chuỗi UTF-8, mỗi chuỗi n byte hỏi `decodeURIComponent` (chọn).** Byte đầu cho n theo RFC 3629 (`utf8SeqLength`); tính hợp lệ của n byte (byte nối, dạng dài thừa, nửa cặp thay thế, > U+10FFFF) do `decodeURIComponent` quyết. Hỏng ⇒ giữ `%XX` của byte đầu, đồng bộ lại ở byte kế. Cả cụm hợp lệ thì vẫn một lần gọi như lượt 14 (đường thường không đổi). Loại: `TextDecoder` (thay byte hỏng bằng U+FFFD — trái "byte hỏng giữ nguyên", và không thuộc ECMAScript: kiểu nằm ở `lib dom`); tự viết bảng kiểm UTF-8 đủ luật (lặp lại logic có sẵn, thêm chỗ sai); giải từng `%XX` riêng lẻ (chữ nhiều byte như `%C3%A1` "á" không bao giờ giải được).
- **(ii) Thêm `+` vào lớp nối (chọn), KHÔNG giải `+` thành dấu cách trong `decodeForNameScan` (loại).** Hai cách bắt cùng các dạng của một tên trong danh sách ("xanh+asian", "xanh++asian", "xanh%2Basian" vì `%2B` ⇒ `+` rồi tới lớp nối). Lớp nối chỉ tác động giữa hai chữ của một tên; giải `+` toàn cục đổi mọi `+` trong mọi tệp (`C++`, `+84`, toán tử JS) — rộng hơn mà không bắt thêm gì. Loại cả cách giải `+` chỉ trong query string: phải nhận diện URL trong văn bản tuỳ ý. Đánh đổi: không có đỏ oan mới — với `*` thì dạng viết liền "XanhAsian" vốn đã bị bắt, chuỗi có `+` giữa hai chữ của tên cũng là nêu tên.
- **(iii) Giữ là giới hạn, không thêm cơ chế máy (chọn).** Không có ca: site tĩnh, CSP `connect-src 'self'`, chữ hiển thị đến từ `content/` + i18n (đều bị quét nguyên chuỗi). Quét DOM sau khi chạy JS (loại) là cơ chế mới cần trình duyệt trong build. Người giữ phần dư: design.md §6f "Giới hạn (lượt 15)".

Ca giá trị (hàm thuần; qa/admin chạy được bằng một tệp thử nhập `content-model.ts`; architect chưa chạy — xem "Chưa kiểm"):

| Vào | Hàm | Ra mong đợi |
|---|---|---|
| `%20%FF%20` | `decodeForNameScan` | `" %FF "` |
| `%E1%BA%20` | `decodeForNameScan` | `"%E1%BA "` |
| `%C3%C3%A1` | `decodeForNameScan` | `"%C3á"` |
| `%ED%A0%80%20` | `decodeForNameScan` | `"%ED%A0%80 "` (nửa cặp thay thế giữ nguyên) |
| `%F0%9F%98%80%FF` | `decodeForNameScan` | `"😀%FF"` |
| `xanh%20asian%FF` | `findForbiddenNames(_, ["Xanh Asian"])` | `["Xanh Asian"]` (lượt 14: `[]`) |
| `/?q=Xanh+Asian` | `findForbiddenNames(_, ["Xanh Asian"])` | `["Xanh Asian"]` (lượt 14: `[]`) |
| `xanh%2Basian` | `findForbiddenNames(_, ["Xanh Asian"])` | `["Xanh Asian"]` |
| `Xanh, Asian` | `findForbiddenNames(_, ["Xanh Asian"])` | `[]` (cố ý, như lượt 14) |
| `xanh%2520asian` | `findForbiddenNames(_, ["Xanh Asian"])` | `[]` — **giới hạn** mã hoá lồng nhau, hệ quả mới (1) |

Hệ quả tự lộ ra (design.md "Câu hỏi liên vai lượt 15", XQ-APPSEC-L15; không tự vá): (1) giải mã **một lượt** theo thứ tự cố định ⇒ mã hoá lồng nhau mà lớp ngoài là `%` (`%2520` ⇒ `%20`, `%26nbsp%3B` ⇒ `&nbsp;`, `%5Cu0020` ⇒ ` `; cả `&#37;2520`) chỉ bóc một lớp, tên lọt. Lớp ngoài là HTML/JS bọc `%` (`&#37;20`, `%20`) thì vẫn bắt vì bước `%` chạy sau cùng. Có từ lượt 14, lượt 15 mới thấy khi viết ca giá trị. Nếu appsec muốn vá: lặp `decodeForNameScan` tới khi chuỗi không đổi, trần 3 lượt (một hằng). (2) Chữ hằng ghép trực tiếp trong chunk JS (`"Xanh"+" Asian"`) chỉ bị bắt nếu trình nén gộp hằng **[suy luận, chưa kiểm]**; dấu nháy không thuộc lớp nối và không nên thêm (câu thường có nháy giữa hai chữ sẽ đỏ oan). (3) ux-spec §12 V42 (4) ghi (i)–(iii) là "appsec tự nêu ở threat-model lượt soát 12" — threat-model.md không có các ý này (không có `decodeForNameScan`, `+`); nguồn là design.md lượt 14. Lệch chữ ở tệp của ux_ui/admin, không đổi việc.

**Chưa kiểm:** `tsc --strict` (target es2022) chưa chạy trên bản lượt 15; các hàm mới chưa chạy lần nào (vai architect bị hook chặn `node -e`, 06/11). Admin chạy như lượt 12–14 và chạy bảng ca giá trị trên.

## Lượt 14 (06/11/2026): V41 — cặp ảnh Trước ↔ Sau, luật tên không được nêu, bỏ `keepTitleBlock`

Theo ux-spec §12 V41 (b)(c)(d)(e) (admin chốt 06/11, được khách uỷ quyền), appsec threat-model M40/XQ-40 và pm XQ-2 (admin chuyển, muốn cả hai CÓ). Đối chiếu prd v0.7.1, `content-pages.feature:6–44`, `figures-and-claims.feature:103–146`. `design_approved` chưa qua ⇒ sửa trong chặng design. Bản sao `contracts/` trong repo code tiếp tục lệch (D7 (a)).

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | `ImageMeta`: bỏ `keepTitleBlock` (khoá cũ ⇒ `.strict()` đỏ), `:20–34`. Khối "Ô ảnh cố định" `:36–58`: luật chung cho mọi ô (đúng 1 tệp + meta hợp lệ + qua mọi luật ảnh; `hasPeople` thiếu `consentDate` = không có ảnh; trùng basename ⇒ `IMAGE_SLOT_DUPLICATE`; không ảnh ⇒ không render, build xanh). Thêm `HOME_IMAGE_SLOTS = { before: "gms-before", after: "gms-after" }`, `HOME_IMAGE_SLOT_KIND = "anh-that"`, `ALL_IMAGE_SLOTS`, `type ImageSlot`. Cuối tệp `:187–239`: `DENYLIST_PATH`, `ForbiddenNames`, `normalizeForNameScan`, `decodeForNameScan`, `forbiddenNamePattern`, `findForbiddenNames` (hàm thuần, loader/output-check/ca qa dùng chung) | V41 (b)(c)(d)(e); M40 (1)(3)(4)(6); pm XQ-2 |
| `build.ts` | `import type { Locale } from "./api"`. §2 `BUILD_SCRIPTS`: build = content-check → next build → **output-check** (`:68`). §8 thêm `IMAGE_SLOT_KIND_INVALID {slot, file, kind}` (`:174`), `DENYLIST_MISSING` (`:178`), `FORBIDDEN_NAME_IN_CONTENT {file, locale?, field?, name}` (`:183`), `FORBIDDEN_NAME_IN_OUTPUT {file, name, inPath}` (`:188`), `DENYLIST_IN_OUTPUT {file}` (`:191`). Khối luật ảnh/bảng viết lại (1)–(6) `:195–218`; `OUTPUT_SCAN_BINARY_EXTENSIONS` (`:220`) | V41 (b)(d)(e); M40 (1)–(4) |
| `routes.ts` | `home.tags` thêm `images` (`:24`) | V41 (b) |
| `content-model.md` | hàng bảng cặp ảnh Trước ↔ Sau và `denylist.yaml`; luật ô ảnh, bỏ `keepTitleBlock`, tên không được nêu | — |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **`DENYLIST_MISSING` đỏ ở mọi `SITE_ENV` (chọn) thay vì chỉ production (M40 (1) nguyên văn) hay cảnh báo ở preview (đề xuất lượt 13, loại):** tệp nằm trong repo, không phụ thuộc môi trường; một nhánh "chỉ cảnh báo" là một đường để preview xanh với danh sách rỗng rồi lên production bằng cùng commit. Tập trội so với M40 (1); ca qa chạy được với `SITE_ENV=test`. Đánh đổi: không có.
- **Quét hai lượt `content/` + `out/` (chọn) thay vì chỉ `out/` (loại):** `figures-and-claims.feature:114–118` đòi thông báo nêu ảnh + locale — `out/` chỉ cho biết tệp đầu ra. Lượt `out/` vẫn cần cho chữ không qua contract (i18n, mã khối, chunk JS, tên tệp ảnh — `:121–133`). Đánh đổi: hai chỗ gọi cùng hàm thuần `findForbiddenNames`, không hai bản logic.
- **`out/`: danh sách LOẠI TRỪ đuôi nhị phân (chọn) thay vì danh sách đuôi văn bản cần quét (loại):** loại tệp mới (vd `.webmanifest`, `.map`, tệp không đuôi `_headers`) mặc định bị quét (M40 (2)). Đánh đổi: thêm một đuôi nhị phân mới (vd `.avif` đã có) mà quên liệt kê thì tệp đó bị đọc UTF-8 — chậm hơn và có thể khớp nhầm trên byte rác, tức là đỏ ồn, không lọt.
- **Đuôi nhị phân vẫn so đường dẫn (chọn):** pm XQ-2 (2) và `:133` "tên một tệp ảnh XanhAsian".
- **`IMAGE_SLOT_KIND_INVALID` làm build đỏ (chọn) thay vì ẩn khối (loại):** ẩn là mất ý định im lặng — người sửa nội dung thả ảnh vào, khối không hiện mà không ai biết vì sao; priorities ưu tiên 1 (không dẫn sai người đọc) và `content-pages.feature:40–44` đòi đỏ. Ngược lại thiếu ảnh ⇒ ẩn (không lỗi) vì đó là trạng thái hợp lệ "GMS chưa gửi".
- **`denylist.yaml` nằm trong `contentHash` (chọn) thay vì loại khỏi băm như `approvals/` (loại):** danh sách là một phần của nội dung đã duyệt; bỏ một tên khỏi danh sách cũng là thay đổi cần GMS xác nhận lại. Đánh đổi: sửa danh sách ⇒ phải xác nhận lại trước deploy prod.
- **Bỏ `keepTitleBlock` (chọn, V41 (e)):** cắt/che trên tệp nguồn + người soát ảnh cỡ gốc (design.md §6f). Hệ quả: bản vẽ hiện như mọi ảnh, cách giữ trọn bản vẽ chuyển sang CSS (XQ-UX-V41).
- **Ô ảnh Trước/Sau bằng tên tệp cố định (giữ cách lượt 13, admin chỉ định tên):** kịch bản S6 dùng tên ảnh tự do "gắn vào vị trí" ⇒ XQ-PM-V41 (1) xin pm đổi chữ, không đổi contract.

Hệ quả tự lộ ra (design.md "Câu hỏi liên vai lượt 14", gửi appsec soát): (i) cụm `%XX` có byte UTF-8 hỏng giữ nguyên cả cụm (`content-model.ts:221–223`); (ii) `+` không thuộc lớp nối `[\s_./-]*` (`:232`) ⇒ "Xanh+Asian" trong query string lọt; (iii) tên dựng lúc chạy trong JS trình duyệt không quét được. (iv) `figures-and-claims.feature:116` nói "chú thích bản en" — `ImageMeta` chỉ có `alt` ⇒ XQ-PM-V41 (2).

**Đã kiểm:** tsc strict trên bản lượt 13 xanh (admin chạy 06/11, theo lời giao việc).
**Chưa kiểm:** `tsc` chưa chạy trên bản lượt 14 (regex cờ `u` với `\p{L}`/`\p{M}`, `catch {}` không biến, `import type { Locale }` mới trong `build.ts`). Admin chạy như lượt 12–13.

## Lượt 13 (06/11/2026): V38/V39/V40 — bỏ thực thể nguồn tư liệu bên ngoài, tư liệu M4 chỉ của GMS, lộ trình cả 5 bước đã xong

Theo ux-spec §12 V38, V39, V40 (admin chốt 06/11, thay V30). `design_approved` chưa qua ⇒ sửa trong chặng design. Bản sao `contracts/` trong repo code tiếp tục lệch (D7 (a)) tới khi frontend_web chép lại nguyên byte.

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | Bỏ `TechSource`, `TECH_SOURCE_ASSET_TYPES`, `TechSourceAssetType`, `ImageMeta.techSourceAsset`, `ComparisonTable.techSource` (khoá cũ ⇒ build đỏ nhờ `.strict()`). Thêm `TECHNOLOGY_IMAGE_SLOTS = { sortingLine: "gms-sorting-line" }` (ô ảnh tuỳ chọn; không tệp ⇒ ẩn khung). Comment `ImageMeta.kind`: `anh-dung-ai` = mọi ảnh không phải ảnh chụp thật (bản vẽ, phối cảnh, render) ⇒ C29; `source` nội bộ. Comment `JOURNEY_STATUSES`: nội dung v1 cả 5 "đã xong" | V38, V39, V40 |
| `build.ts` §8 | Bỏ `TECH_SOURCE_PERMISSION_MISSING` / `TECH_SOURCE_ASSET_NOT_ALLOWED` / `TECH_SOURCE_UNKNOWN`. Thêm `IMAGE_SLOT_DUPLICATE`. Viết lại khối luật S33 (1)–(5) thành luật ảnh/bảng trang Công nghệ | V38, V39 |
| `routes.ts` | `technology.tags`: bỏ `techSources`, thêm `images` | V38 |
| `content-model.md` | bỏ dòng bảng + luật nguồn tư liệu; thêm ô ảnh dây chuyền, ghi chú V39/V40 | — |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **Ô ảnh dây chuyền bằng tên tệp cố định (chọn) thay vì trường frontmatter của `content/pages/technology.<locale>.md` (loại):** trường frontmatter phải lặp ở hai tệp vi/en và cần thêm luật "hai bản trỏ cùng ảnh"; tên cố định khớp cách code đang đọc ảnh M4 (`build-site.ts:1089` đọc `images/sorting-line-3d.png` cố định). Đánh đổi: thêm một mã `IMAGE_SLOT_DUPLICATE` để không tự chọn khi có hai đuôi.
- **Giữ enum `kind` hai giá trị (chọn) thay vì thêm `"ban-ve"` (loại):** V39 chỉ đòi hai cách hiện (không nhãn / C29); giá trị thứ ba không đổi hiển thị mà buộc sửa loader, ca qa, user-guide. Đổi lại: ghi rõ nghĩa `anh-dung-ai` trong comment.
- **Không đưa luật quét tên cấm vào contract ở lượt này:** danh sách tên là quyết định nội dung của admin, cần kịch bản pm để qa có ca; đề xuất ở design.md §6f "Đề xuất V38" (XQ-ADMIN-V38a).

Hệ quả tự lộ ra (design.md §6f, "Câu hỏi liên vai lượt 13"): (i) `keepTitleBlock` giữ nguyên khung tên bản vẽ ⇒ nếu khung tên bản vẽ GMS gửi ghi tên đơn vị thiết kế/thi công khác, chữ trong ảnh vẫn nêu tên công ty khác (trái V38) và không máy nào quét được chữ trong ảnh; (ii) `Figure.source` hiện trên trang (`build-site.ts:836`) ⇒ nguồn số ghi tên bên ngoài sẽ lên web.

**Chưa kiểm:** `tsc` chưa chạy trên bản lượt 13 (lệnh ngoài allowlist vai architect, thư mục không có `tsconfig.json`). — Lượt 14: admin đã chạy, xanh.

## Lượt 12 (06/11/2026): V30 "Nguồn công nghệ" + chốt bản đồ (XQ-37 appsec) — **phần V30 hết hiệu lực từ lượt 13** (bảng và lựa chọn về `TechSource` dưới đây chỉ còn là lịch sử; phần bản đồ còn hiệu lực)

`design_approved` chưa qua (project.yaml `gates_passed`) ⇒ sửa contract là việc của chặng design, không cần `change_api_contract`. Bản sao `contracts/` trong repo code **lệch** từ lượt này: frontend_web chép lại nguyên byte rồi sửa code theo (design.md §6f, §6d).

| File | Đổi | Vì sao |
|---|---|---|
| `content-model.ts` | `Partner` ⇒ `TechSource` = {name, legalName, description {vi,en} bắt buộc, permissionBasis, allowedAssets}, **bỏ `role`**, `.strict()`; `PARTNER_ASSET_TYPES` ⇒ `TECH_SOURCE_ASSET_TYPES`; `ImageMeta.partnerAsset` ⇒ `techSourceAsset {techSource, type}`; `ComparisonTable.partner` ⇒ `techSource`; `Company` bỏ `mapImage`, `mapUrl`; thêm `MAP_EMBED`, `parseMapPoint`, `mapEmbedSrc`, `mapOpenHref`; import `Locale` từ `./api` | V30 (ux-spec, technology.html khối 5); XQ-37 (b)(c) |
| `build.ts` §8 | `PARTNER_*` ⇒ `TECH_SOURCE_PERMISSION_MISSING` / `TECH_SOURCE_ASSET_NOT_ALLOWED` / `TECH_SOURCE_UNKNOWN`; chữ ngoài nháy đổi "đối tác" ⇒ "nguồn công nghệ", cụm trong nháy giữ; comment luật S33 (1)–(4) viết lại (không chip vai trò, không chữ "đối tác"/"partner" cho nguồn) | V30; ca qa so cụm trong nháy |
| `routes.ts` | tag `partners` bỏ khỏi `about`; `technology` thêm `techSources` | khối ở M4 |
| `safe-url.ts` | chỉ comment (bỏ `mapUrl`) | URL bản đồ dựng từ `mapPoint` |
| `content-model.md` | bảng + luật theo trên | — |

Lựa chọn khi có ≥ 2 phương án (để appsec soát):
- **Đổi tên kỹ thuật (B) thay vì giữ `Partner` (A):** giữ tên thì người viết nội dung/code tiếp tục thấy chữ "partner" ở tên tệp, mã lỗi, khoá ảnh và dễ lọt ra chữ hiển thị (đã lọt: tiêu đề `build-site.ts:1076`), trái ưu tiên 1 "không dẫn sai người đọc". `content/partners.yaml` chưa tồn tại ⇒ đổi tên tệp không phải di trú dữ liệu. Loại tên `source` trần vì trùng `ImageMeta.source`, `Figure.source`.
- **`legalName` là một chuỗi, `description` bắt buộc:** tên pháp lý không dịch (hiện giống nhau VI/EN); câu mô tả là câu duy nhất nói quan hệ ("áp dụng công nghệ tương tự") — để tuỳ chọn thì khối chỉ còn tên + tên pháp lý, người đọc tự đoán quan hệ.
- **`referrerpolicy="no-referrer"` (loại `strict-origin-when-cross-origin`):** dạng nhúng không khoá không dùng Referer **[suy luận]**; bỏ cả origin khỏi dữ liệu gửi Google. Lui về `strict-origin` chỉ khi qa đo khung hỏng (XQ-39).
- **`sandbox` 4 cờ (loại không sandbox):** thiếu `allow-top-navigation` ⇒ khung không điều hướng được trang GMS (M39 (5)). Lui khi qa đo kéo/phóng hoặc "Xem bản đồ lớn hơn" hỏng.
- **z=15 (loại z=16):** toạ độ chưa kiểm có đúng cổng nhà máy; khung rộng hơn còn mốc QL39/Phố Nối. Không phải việc bảo mật; đổi một hằng.

Hệ quả tự lộ ra (design.md "Câu hỏi liên vai lượt 12"): `allow-popups-to-escape-sandbox` ⇒ tab Google mở từ khung chạy không sandbox (chấp nhận, trang Google ở tab riêng); chữ "đối tác"/"Technology Partners" còn ở `vi.json:267`, `en.json:267`, `build-site.ts:1076` của repo code — việc frontend_web/qa, không phải finding bảo mật.

**Chưa kiểm:** `bun x tsc` trên `contracts/` chưa chạy (lệnh ngoài allowlist vai architect) — thư mục này không có `tsconfig.json`; cách kiểm là chép sang `contracts/` của repo code rồi chạy lệnh typecheck khai trong `project.yaml → code.commands`, trước `design_approved`.

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
