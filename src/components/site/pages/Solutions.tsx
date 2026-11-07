// M3 Giải pháp — các bước khép kín dạng thẻ (tgrid t3), ảnh minh hoạ theo thứ tự bước.
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { CtaSection, Html, pick, SubHero } from '../parts.tsx';

const SOLUTION_IMAGES: Record<number, string> = {
  0: '/img/sorting-trommel-screen.jpg',
  1: '/img/vpd-pyrolysis-facility.jpg',
  2: '/img/rdf-pellet-production.jpg',
  3: '/img/scada-control-room.jpg',
};
const SMALL = 640;
const MID = 960;
const MAX = 1280;

export function SolutionsPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const items = content.solutionItems[locale];
  return (
    <>
      <SubHero
        after="mist"
        eyebrow={L('Giải pháp', 'Solutions')}
        title={L('Giải pháp xử lý chất thải & Tái tạo tài nguyên', 'Waste Treatment & Resource Recovery Solutions')}
      />
      <section className="sec sec-mist" aria-labelledby="h-sol">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-sol">{L('Quy trình giải pháp khép kín', 'Integrated solution framework')}</h2>
          </div>
          <ol className="tgrid t3">
            {items.map((item, i) => {
              const img = SOLUTION_IMAGES[i];
              return (
                <li key={item.title}>
                  <div className="tcard step-card" data-testid="solution-item">
                    {img ? (
                      <figure className="step-fig">
                        <img
                          src={img}
                          srcSet={`${img.replace(/\.jpg$/, `-${SMALL}.jpg`)} ${SMALL}w, ${img.replace(/\.jpg$/, `-${MID}.jpg`)} ${MID}w, ${img} ${MAX}w`}
                          sizes="(min-width: 900px) 33vw, calc(100vw - 32px)"
                          alt=""
                          width={640}
                          height={360}
                          {...(i === 0 ? { fetchPriority: 'high' as const } : { loading: 'lazy' as const })}
                          decoding="async"
                        />
                      </figure>
                    ) : null}
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
                      <Html className="step-body" html={item.bodyHtml} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}
