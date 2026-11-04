# Thư mục nền cho ca `@kiem-luc-build` (XQ-21)

`tests/support/build.ts` chép thư mục này sang thư mục tạm, ghi `content/` (BASE_CONTENT + file của từng ca), rồi chạy `SITE_BUILD_CMD` với cwd là thư mục tạm.
`scripts/content/build-site.ts` đọc `public/` theo cwd (logo, ảnh OG, favicon) nên ở đây giữ bản chép của các file đó; không có `public/img` (ca nào cần ảnh thì tự thêm vào `content/images`).
Mặc định env đặt ở `tests/playwright.config.ts`. Đổi logo/OG/favicon ở `public/` thì chép lại vào đây.
