// M1 Trang chủ — wireframe home.html (green v0.3.8). Chữ từ content/ + i18n; không có chữ giả của wireframe.
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon } from '../icons.tsx';
import { JourneySection } from '../Journey.tsx';
import { formatDateLocale } from '../menu.ts';
import { BoardFigure, CtaSection, pick, Streaks } from '../parts.tsx';

const HERO_IMG = '/img/hero-plant.jpg';
const HERO_IMG_SMALL = '/img/hero-plant-512.jpg';

export function HomePage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const isVi = locale === 'vi';
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const sloganLines = isVi
    ? ['Giải pháp thông minh –', 'Kiến tạo giá trị xanh']
    : ['Smart solutions –', 'Creating green value'];
  const pillars = isVi
    ? ['Công nghệ VPD', 'Sàng tuyển', 'Tái tạo tài nguyên']
    : ['VPD technology', 'Sorting', 'Resource recovery'];

  const coverImg = content.images.get('images/hero-plant.jpg');
  // Ảnh dựng/AI (hoặc ảnh thay thế chưa phải ảnh thật) luôn có nhãn nhìn thấy trên ảnh (S17, ux-spec §7)
  const coverIsRender = !coverImg || coverImg.kind === 'anh-dung-ai';
  const coverSrc = coverImg?.allowedInBuild ? HERO_IMG : '/og/default.png';
  const coverAlt = coverImg
    ? coverImg.alt[locale]
    : L(
        'Phối cảnh nhà máy GMS dự kiến: mái pin mặt trời, hồ nước và cây xanh giữa khu công nghiệp sinh thái',
        "Artist's impression of the planned GMS plant: solar roof, retention ponds and green buffer belts",
      );
  const top3News = content.news[locale].slice(0, 3);

  const heroLead = L(
    'Công ty Cổ phần Môi trường Năng lượng Xanh Hưng Yên đã đưa nhà máy vào hoạt động, xử lý chất thải rắn theo hai nhánh Sàng tuyển và công nghệ VPD, định hướng thu hồi 6 dòng tài nguyên thay vì chỉ chôn lấp hay đốt.',
    'Green Energy Environment Joint Stock Company Hung Yen has put the plant into operation, treating solid waste along two branches, Sorting and VPD technology, aiming to recover 6 resource streams instead of only landfilling or burning.',
  );

  const values = [
    {
      cls: 'v1',
      icon: 'cpu',
      h: L('Công nghệ tiên tiến', 'Advanced technology'),
      p: L(
        'Kết hợp Sàng tuyển và công nghệ VPD để thu hồi tối đa các dòng tài nguyên từ chất thải.',
        'Combining Sorting and VPD technology to recover as many resource streams from waste as possible.',
      ),
    },
    {
      cls: 'v2',
      icon: 'recycle',
      h: L('Tái tạo tài nguyên', 'Resource recovery'),
      p: L(
        'Chuyển từ tư duy “xử lý chất thải” sang “thu hồi và tái tạo giá trị tài nguyên”.',
        'Shifting from “waste treatment” to “recovering and regenerating the value of resources”.',
      ),
    },
    {
      cls: 'v3',
      icon: 'sprout',
      h: L('Phát triển bền vững', 'Sustainable development'),
      p: L(
        'Từng bước đưa những nguồn tài nguyên có thể tái sử dụng trở lại chu trình sản xuất.',
        'Step by step returning reusable resources to the production cycle.',
      ),
    },
    { cls: 'v4', icon: 'heart-handshake', h: L('Vì cộng đồng xanh', 'For a green community'), p: '' },
  ] as const;

  return (
    <>
      <section className="hero" data-testid="home-hero" aria-labelledby="h1">
        <Streaks variant="home" />
        <div className="wrap">
          <div>
            <p className="kicker fade">{pillars.join(' · ')}</p>
            <h1 id="h1">
              {sloganLines.map((l) => (
                <span className="ln" key={l}>
                  <span>{l}</span>
                </span>
              ))}
            </h1>
            <p className="hero-lead fade">{heroLead}</p>
            <div className="hero-cta fade2">
              <a className="btn btn-light" data-testid="hero-primary" href={ROUTES.technology[locale]}>
                {L('Tìm hiểu công nghệ', 'Explore the technology')}
                <Icon name="arrow-right" className="ico" />
              </a>
              <a className="btn btn-ghost" data-testid="cta-contact" href={ROUTES.contact[locale]}>
                {L('Liên hệ hợp tác', 'Partner with us')}
              </a>
            </div>
          </div>
          <figure className="hero-art fade2" data-testid="home-cover">
            <div className="art-box">
              <img
                src={coverSrc}
                alt={coverAlt}
                width={1024}
                height={1024}
                {...(coverSrc === HERO_IMG
                  ? { srcSet: `${HERO_IMG_SMALL} 512w, ${HERO_IMG} 1024w`, sizes: '(min-width: 1024px) 520px, 100vw' }
                  : {})}
                fetchPriority="high"
                decoding="async"
              />
              {coverIsRender ? (
                <span className="pill" data-testid="photo-label">
                  {L('Phối cảnh dự kiến', "Artist's impression")}
                </span>
              ) : null}
            </div>
          </figure>
        </div>
      </section>

      <section className="sec" id="hai-nhanh" aria-labelledby="h-flow">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-flow">
              {L('Hai nhánh xử lý, sáu dòng tài nguyên', 'Two processing branches, six resource streams')}
            </h2>
            <p>
              {L(
                'Chất thải rắn đầu vào được chia thành hai nhánh. Mỗi nhánh hướng tới ba dòng đầu ra, thay vì chỉ chôn lấp hay đốt.',
                'Incoming solid waste is split into two branches. Each branch aims at three output streams, instead of only landfilling or burning.',
              )}
            </p>
          </div>
          <BoardFigure
            content={content}
            locale={locale}
            outputsId="home-outputs"
            branchesId="home-branches"
            anchors={false}
          />
        </div>
      </section>

      <JourneySection
        content={content}
        locale={locale}
        sectionId="hanh-trinh"
        testId="home-journey"
        title={L('Hành trình chuyển đổi', 'Transformation journey')}
        lead={L(
          'Năm bước GMS đã đi qua, từ đánh giá hiện trạng tới hệ thống vận hành hoàn chỉnh. Nhà máy đã đi vào hoạt động.',
          'Five steps GMS has completed, from assessing the current state to a fully operating system. The plant is in operation.',
        )}
      />

      {content.figures.length > 0 ? (
        <section className="sec sec-stats" data-testid="figures-strip" aria-label={L('Số liệu chính', 'Key figures')}>
          <div className="wrap stats">
            <div className="sec-head">
              <h2>{L('Năng lực nhà máy', 'Plant capacity')}</h2>
            </div>
            <dl className="stat-list">
              {content.figures.map((f) => (
                <div className="stat" key={f.label[locale]}>
                  <dt>{f.label[locale]}</dt>
                  <dd>
                    {f.value} {f.unit[locale]}
                    <small className="stat-src">({f.source})</small>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="sec sec-values on-dark" aria-labelledby="h-values">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-values">{L('Giá trị chúng tôi theo đuổi', 'Values we pursue')}</h2>
          </div>
          <ul className="bento">
            {values.map((v) => (
              <li className={`val ${v.cls}`} key={v.cls}>
                <Icon name={v.icon} className="vi" strokeWidth={1.8} />
                <h3>{v.h}</h3>
                {v.p ? <p>{v.p}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {top3News.length > 0 ? (
        <section className="sec sec-news" data-testid="home-news" aria-labelledby="h-news">
          <div className="wrap">
            <div className="news-head">
              <h2 id="h-news">{L('Tin mới nhất', 'Latest news')}</h2>
              <a className="more" href={ROUTES.news[locale]}>
                {L('Xem tất cả tin', 'See all news')}
                <Icon name="arrow-right" className="ico" />
              </a>
            </div>
            <ul className="news-grid">
              {top3News.map((n) => (
                <li key={n.slug}>
                  <a className="news" data-testid="news-item" href={`${ROUTES.news[locale]}/${n.slug}`}>
                    <div className="thumb">
                      <Icon name="image" className="ico" />
                    </div>
                    <div className="news-body">
                      <h3>{n.title}</h3>
                      <time dateTime={n.date}>{formatDateLocale(n.date, locale)}</time>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <CtaSection content={content} locale={locale} sectionId="hop-tac" />
    </>
  );
}
