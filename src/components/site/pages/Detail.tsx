// M7/M9/M11: trang chi tiết (tin, dự án, tuyển dụng) theo wireframe news-detail.html:
// hero có breadcrumb + h1 + hàng thông tin, cột bài ≤ 760px (ảnh đầu, thân `.prose`, nút quay lại), khối mời liên hệ.
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon } from '../icons.tsx';
import { Crumb, CtaSection, Html, pick, Streaks } from '../parts.tsx';

export interface LeadFigure {
  src: string;
  alt: string;
  label?: string;
}

export function DetailPage({
  content,
  locale,
  listLabel,
  listHref,
  title,
  meta,
  lead,
  bodyHtml,
  backLabel,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  listLabel: string;
  listHref: string;
  title: string;
  meta: React.ReactNode;
  lead?: LeadFigure;
  bodyHtml: string;
  backLabel: string;
}): React.ReactElement {
  return (
    <>
      <article aria-labelledby="h1">
        <header className="hero hero-sub hero-detail on-dark">
          <Streaks variant="sub" />
          <div className="wrap">
            <div className="col">
              <Crumb
                label={pick(locale, 'Đường dẫn trang', 'Breadcrumb')}
                items={[
                  { label: pick(locale, 'Trang chủ', 'Home'), href: ROUTES.home[locale] },
                  { label: listLabel, href: listHref },
                  { label: title },
                ]}
              />
              <div className="fade">
                <h1 id="h1">{title}</h1>
                <div className="meta">{meta}</div>
              </div>
            </div>
          </div>
        </header>
        <div className="art">
          <div className="wrap">
            <div className="col">
              {lead ? (
                <figure className="fig lead-fig">
                  <div className="frame-wf r169">
                    <img src={lead.src} alt={lead.alt} width={1200} height={675} />
                    {lead.label ? (
                      <figcaption className="photo-label" data-testid="photo-label">
                        {lead.label}
                      </figcaption>
                    ) : null}
                  </div>
                </figure>
              ) : null}
              <Html className="prose" html={bodyHtml} />
              <div className="art-end">
                <a className="btn-sec" href={listHref}>
                  <Icon name="arrow-left" size={18} className="ico" />
                  {backLabel}
                </a>
              </div>
            </div>
          </div>
        </div>
      </article>
      <CtaSection content={content} locale={locale} />
    </>
  );
}
