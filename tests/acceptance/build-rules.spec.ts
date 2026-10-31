// Luật kiểm lúc build của design.md §6f KHÔNG có kịch bản .feature riêng (spec nói ở mức "build đỏ khi…" chỉ cho vài luật).
// BUILD-01..02 là ca QA thêm theo design.md; không đổi nghĩa .feature. Lệnh build + thư mục fixture: XQ-21 (test-plan.md §9).
// Định dạng content/slugs.lock CHƯA có contract ⇒ đề xuất của qa: YAML phẳng "<loại>/<key>.<locale>": "<slug>".
import { test, expect } from '@playwright/test';
import { buildSite, newsFiles } from '../support/build';
import { pageFile } from '../support/fixtures';

test('BUILD-01 Slug đổi so với content/slugs.lock thì build đỏ, nêu slug cũ và mới (@S32 @kiem-luc-build) [qa thêm: design.md §6f]', () => {
  const files = {
    ...newsFiles('k1', { vi: { slug: 'tin-moi' }, en: { slug: 'news-new' } }),
    'slugs.lock': 'news/k1.vi: "tin-cu"\nnews/k1.en: "news-new"\n',
  };
  const r = buildSite(files);
  expect(r.ok).toBe(false);
  expect(r.log).toContain('tin-cu');
  expect(r.log).toContain('tin-moi');
  expect(r.log).toMatch(/slug/i);
  // đối chứng xanh: slug trùng bản khoá thì build xanh
  const ok = buildSite({ ...files, 'slugs.lock': 'news/k1.vi: "tin-moi"\nnews/k1.en: "news-new"\n' });
  expect(ok.ok, ok.log).toBe(true);
});

test('BUILD-02 Liên kết nội bộ gãy trong nội dung thì build đỏ (@S32 @kiem-luc-build) [qa thêm: design.md §6f]', () => {
  const broken = buildSite({ ...pageFile('about', 'vi', 'Xem [trang này](/khong-ton-tai-xyz).'), ...pageFile('about', 'en', 'See [this](/en/does-not-exist-xyz).') });
  expect(broken.ok).toBe(false);
  expect(broken.log).toMatch(/khong-ton-tai-xyz|does-not-exist-xyz/);
  const fine = buildSite({ ...pageFile('about', 'vi', 'Xem [liên hệ](/lien-he).'), ...pageFile('about', 'en', 'See [contact](/en/contact).') });
  expect(fine.ok, fine.log).toBe(true);
});
