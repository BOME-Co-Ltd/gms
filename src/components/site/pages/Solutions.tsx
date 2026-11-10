// Giải pháp khép kín — trước là trang riêng M3 (/giai-phap); từ 08/11/2026 là một section trong trang Công nghệ.
// /giai-phap và /en/solutions chuyển hướng 301 về #giai-phap / #solutions (public/_redirects).
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Html, PhotoFigure, type PhotoKey, pick } from '../parts.tsx';

// Ảnh minh hoạ theo thứ tự mục (ảnh dựng ⇒ nhãn "Ảnh minh hoạ").
const SOLUTION_PHOTOS: PhotoKey[] = ['sorting', 'vpd', 'rdf', 'scada'];

export function SolutionsSection({
  content,
  locale,
}: {
  content: LoadedSiteContent;
  locale: Locale;
}): React.ReactElement | null {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const items = content.solutionItems[locale];
  // Rỗng ⇒ ẩn cả khối, neo và chip (ux-spec XQ-5); bản build như vậy đỏ RETIRED_ANCHOR_MISSING (build/retired.ts).
  if (items.length === 0) return null;
  return (
    <section className="sec sec-mist" id={L('giai-phap', 'solutions')} aria-labelledby="h-sol">
      <div className="wrap">
        <div className="sec-head">
          <span className="eyebrow">{L('Giải pháp', 'Solutions')}</span>
          <h2 id="h-sol">
            {L('Giải pháp xử lý chất thải và tái tạo tài nguyên', 'Waste treatment and resource recovery solutions')}
          </h2>
          <p>
            {L(
              'Từ tiếp nhận, sàng tuyển đến xử lý bằng công nghệ VPD và hợp tác tiêu thụ đầu ra — một quy trình khép kín.',
              'From reception and sorting to VPD processing and output partnerships — one integrated process.',
            )}
          </p>
        </div>
        <ol className="tgrid t3 step-grid">
          {items.map((item, i) => {
            const photo = SOLUTION_PHOTOS[i];
            return (
              <li key={item.title}>
                <article className="icard step-card" data-testid="solution-item">
                  {photo ? <PhotoFigure photo={photo} locale={locale} alt="" className="step-fig" /> : null}
                  <div className="step-text">
                    <div className="stp-head">
                      <span className="step-badge" aria-hidden="true">
                        {i + 1}
                      </span>
                      <h3>
                        <span className="sr-only">
                          {L('Bước', 'Step')} {i + 1}:{' '}
                        </span>
                        {item.title}
                      </h3>
                    </div>
                    <Html html={item.bodyHtml} />
                    {/* S9: mỗi việc có lời mời liên hệ */}
                    <p className="step-cta">
                      <a href={ROUTES.contact[locale]}>
                        {L('Trao đổi về việc này', 'Talk to us about this')}
                        <span className="sr-only">: {item.title}</span>
                      </a>
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
