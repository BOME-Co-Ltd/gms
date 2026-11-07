// M5 Sản phẩm đầu ra — hai nhóm thẻ (Sàng tuyển / VPD).
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { CtaSection, pick, SubHero } from '../parts.tsx';

export function ProductsPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const group = (title: string, g: 'sang-tuyen' | 'vpd', mist: boolean) => (
    <section className={`sec${mist ? ' sec-mist' : ''}`} data-testid="output-group">
      <div className="wrap">
        <div className="sec-head">
          <h2>{title}</h2>
        </div>
        <ul className="tgrid t3">
          {content.outputLines
            .filter((l) => l.group === g)
            .map((item) => (
              <li key={item.name[locale]}>
                <article className="tcard" data-testid="output-row">
                  <h3>{item.name[locale]}</h3>
                  <p className="tag-line">
                    <span className="st">{item.state === 'da-co' ? L('Đã có', 'Available') : L('Định hướng', 'Planned')}</span>
                  </p>
                  <p>{item.desc[locale]}</p>
                </article>
              </li>
            ))}
        </ul>
      </div>
    </section>
  );
  return (
    <>
      <SubHero
        after="journey"
        eyebrow={L('Đầu ra định hướng', 'Planned outputs')}
        title={L('Sản phẩm đầu ra', 'Output Products')}
        lead={L(
          'Sáu dòng sản phẩm thu hồi từ quá trình sàng tuyển cơ học và công nghệ nhiệt phân VPD.',
          'Six recovered output lines from mechanical sorting and VPD pyrolysis technology.',
        )}
      />
      {group(L('Nhóm Sàng tuyển', 'Sorting Group (Sàng tuyển)'), 'sang-tuyen', false)}
      {group(L('Nhóm Công nghệ VPD', 'VPD Technology Group (Công nghệ VPD)'), 'vpd', true)}
      <CtaSection content={content} locale={locale} />
    </>
  );
}
