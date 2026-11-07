// M6–M10: danh sách tin (có phân trang), dự án, tuyển dụng, FAQ. Thẻ tin theo `.news` của wireframe news-list.html.
import type React from 'react';
import { PAGE_SIZE, ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon } from '../icons.tsx';
import { JourneySection } from '../Journey.tsx';
import { formatDateLocale } from '../menu.ts';
import { CtaSection, EmptyBlock, pick, SubHero } from '../parts.tsx';

export function NewsListPage({
  content,
  locale,
  pageNum,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  pageNum: number;
}): React.ReactElement {
  const isVi = locale === 'vi';
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const all = content.news[locale];
  const items = all.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const pos = isVi ? `Trang ${pageNum} / ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
  const pageHref = (p: number) =>
    p === 1 ? ROUTES.news[locale] : `${ROUTES.news[locale]}/${isVi ? 'trang' : 'page'}/${p}`;
  const newsLabel = L('Tin tức / Hành trình', 'News / Journey');
  const first = pageNum === 1;
  return (
    <>
      <SubHero
        after="journey"
        crumbLabel={L('Đường dẫn trang', 'Breadcrumb')}
        crumbs={
          first
            ? undefined
            : [
                { label: L('Trang chủ', 'Home'), href: ROUTES.home[locale] },
                { label: newsLabel, href: ROUTES.news[locale] },
                { label: pos },
              ]
        }
        eyebrow={L('Hành trình chuyển đổi', 'Transformation journey')}
        title={first ? newsLabel : `${newsLabel} — ${pos}`}
        lead={
          first
            ? L(
                'Lộ trình năm bước GMS đã hoàn thành và các bài viết về quá trình chuyển đổi, mới nhất trước.',
                'The five-step roadmap GMS has completed and articles on the transformation, newest first.',
              )
            : undefined
        }
        jump={
          first
            ? {
                label: L('Trên trang này', 'On this page'),
                items: [
                  { href: '#lo-trinh', text: L('Lộ trình 5 bước', '5-step roadmap') },
                  { href: '#danh-sach', text: L('Bài viết', 'Articles') },
                ],
              }
            : undefined
        }
      />
      <JourneySection
        content={content}
        locale={locale}
        sectionId="lo-trinh"
        title={L('Hành trình chuyển đổi', 'Transformation journey')}
        lead={L(
          'Năm bước GMS đã đi qua, từ đánh giá hiện trạng tới hệ thống vận hành hoàn chỉnh. Nhà máy đã đi vào hoạt động.',
          'Five steps GMS has completed, from assessing the current state to a fully operating system. The plant is in operation.',
        )}
      />
      <section className="sec" id="danh-sach" aria-labelledby="h-list">
        <div className="wrap">
          <div className="news-head">
            <h2 id="h-list">{L('Bài viết', 'Articles')}</h2>
            {totalPages > 1 ? <p className="count">{pos}</p> : null}
          </div>
          {items.length > 0 ? (
            <ul className="news-grid">
              {items.map((n) => (
                <li key={n.slug}>
                  <article className="news" data-testid="news-item">
                    <div className="thumb">
                      {n.heroImage ? (
                        <>
                          <img
                            src={`/img/${n.heroImage.replace(/^images\//, '')}`}
                            alt=""
                            width={1200}
                            height={900}
                            loading="lazy"
                          />
                          <span className="photo-label">{L('Ảnh minh hoạ', 'Illustration')}</span>
                        </>
                      ) : (
                        <Icon name="image" className="ico" />
                      )}
                    </div>
                    <div className="news-body">
                      <time className="date" dateTime={n.date}>
                        {formatDateLocale(n.date, locale)}
                      </time>
                      <h3>
                        <a href={`${ROUTES.news[locale]}/${n.slug}`}>{n.title}</a>
                      </h3>
                      <p className="sum">{n.summary}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              locale={locale}
              icon="newspaper"
              text={L(
                'Chưa có bài viết nào. Mời bạn quay lại sau, hoặc liên hệ để biết thêm về GMS.',
                'There are no articles yet. Please check back later, or contact us to learn more about GMS.',
              )}
            />
          )}
          {totalPages > 1 ? (
            <nav className="pager" aria-label={L('Phân trang tin tức', 'News pagination')}>
              {pageNum > 1 ? (
                <a className="pg" href={pageHref(pageNum - 1)} rel="prev">
                  <Icon name="arrow-left" size={18} className="ico" />
                  {L('Trang trước', 'Previous page')}
                </a>
              ) : null}
              <span className="pos" aria-current="page">
                {pos}
              </span>
              {pageNum < totalPages ? (
                <a className="pg" href={pageHref(pageNum + 1)} rel="next">
                  {L('Trang sau', 'Next page')}
                  <Icon name="arrow-right" size={18} className="ico" />
                </a>
              ) : null}
            </nav>
          ) : null}
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}

export function ProjectsListPage({
  content,
  locale,
}: {
  content: LoadedSiteContent;
  locale: Locale;
}): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const items = content.projects[locale];
  return (
    <>
      <SubHero
        eyebrow={L('Dự án / Thư viện', 'Projects / Gallery')}
        title={L('Dự án & Thư viện hình ảnh', 'Projects & Visual Gallery')}
      />
      <section className="sec">
        <div className="wrap">
          {items.length > 0 ? (
            <ul className="news-grid">
              {items.map((p) => (
                <li key={p.slug}>
                  <article className="news" data-testid="list-item">
                    <div className="thumb">
                      {p.heroImage ? (
                        <>
                          <img
                            src={`/img/${p.heroImage.replace(/^images\//, '')}`}
                            alt=""
                            width={1200}
                            height={900}
                            loading="lazy"
                          />
                          <span className="photo-label">{L('Ảnh minh hoạ', 'Illustration')}</span>
                        </>
                      ) : (
                        <Icon name="image" className="ico" />
                      )}
                    </div>
                    <div className="news-body">
                      <time className="date" dateTime={p.date}>
                        {formatDateLocale(p.date, locale)}
                      </time>
                      <p className="il">{p.category}</p>
                      <h3>
                        <a href={`${ROUTES.projects[locale]}/${p.slug}`}>{p.title}</a>
                      </h3>
                      <p className="sum">{p.summary}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              locale={locale}
              icon="image"
              text={L(
                'Thư viện dự án đang được cập nhật. Mời bạn quay lại sau.',
                'The project gallery is being updated. Please check back later.',
              )}
            />
          )}
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}

export function CareersListPage({
  content,
  locale,
}: {
  content: LoadedSiteContent;
  locale: Locale;
}): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const items = content.jobs[locale];
  // Tin tuyển dụng chưa có trường địa điểm riêng: nơi làm việc là địa chỉ công ty (cùng nguồn JSON-LD JobPosting).
  const place = content.company.address?.[locale]?.trim() || content.company.address?.vi?.trim() || '';
  return (
    <>
      <SubHero eyebrow={L('Cơ hội nghề nghiệp', 'Career opportunities')} title={L('Tuyển dụng', 'Careers')} />
      <section className="sec">
        <div className="wrap">
          {items.length > 0 ? (
            <ul className="news-grid">
              {items.map((j) => (
                <li key={j.slug}>
                  <article className="news" data-testid="list-item">
                    <div className="news-body">
                      <h3>
                        <a href={`${ROUTES.careers[locale]}/${j.slug}`}>{j.title}</a>
                      </h3>
                      {place ? (
                        <p className="il">
                          <Icon name="map-pin" className="ico" />
                          <span>
                            <span className="sr-only">{L('Địa điểm', 'Location')}: </span>
                            {place}
                          </span>
                        </p>
                      ) : null}
                      <p className="il">
                        <Icon name="circle-alert" className="ico" />
                        <span>
                          <span className="sr-only">{L('Hạn nộp', 'Deadline')}: </span>
                          {formatDateLocale(j.validThrough, locale)}
                        </span>
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              locale={locale}
              icon="file-text"
              text={L(
                'Hiện chưa có vị trí tuyển dụng. Mời bạn theo dõi trang này hoặc liên hệ với chúng tôi.',
                'There are no open positions at the moment. Please check this page again or contact us.',
              )}
            />
          )}
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}

export function FaqPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const items = content.faq[locale];
  return (
    <>
      <SubHero eyebrow="FAQ" title={L('Câu hỏi thường gặp (FAQ)', 'Frequently Asked Questions (FAQ)')} />
      <section className="sec">
        <div className="wrap">
          {items.length > 0 ? (
            <ul className="tgrid">
              {items.map((f) => (
                <li key={f.question}>
                  <article className="tcard" data-testid="list-item">
                    <h2 data-testid="faq-question">{f.question}</h2>
                    <p>{f.answer}</p>
                  </article>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock
              locale={locale}
              icon="file-question"
              text={L(
                'Chưa có câu hỏi thường gặp. Nếu cần hỗ trợ, mời bạn liên hệ với chúng tôi.',
                'No frequently asked questions yet. If you need help, please contact us.',
              )}
            />
          )}
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}
