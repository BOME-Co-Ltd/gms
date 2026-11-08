// M2 Giới thiệu — viết lại 08/11/2026: giới thiệu + thông tin pháp nhân, tầm nhìn/sứ mệnh, hành trình 5 bước,
// bốn giá trị cốt lõi có ảnh, dải ảnh nhà máy (từ content/projects). Chỉ dùng dữ kiện đã có trong content/ và
// các câu đã duyệt ở trang chủ; không thêm số liệu mới (số liệu chỉ lấy từ figures.yaml có nguồn).
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon, type IconName } from '../icons.tsx';
import { JourneySection } from '../Journey.tsx';
import { CtaSection, Html, PhotoFigure, type PhotoKey, pick, SubHero } from '../parts.tsx';

export function AboutPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const customBody = content.pagesBody.about?.[locale]?.bodyHtml ?? '';
  const company = content.company;
  const address = company.address ? company.address[locale] || company.address.vi : '';
  const area = content.figures.find((f) => f.key === 'dien-tich');

  type Fact = { icon: IconName; label: string; value: string };
  const allFacts: Fact[] = [
    { icon: 'file-text', label: L('Pháp nhân', 'Legal entity'), value: company.legalName ?? '' },
    { icon: 'map-pin', label: L('Địa chỉ nhà máy', 'Plant address'), value: address },
  ];
  if (area) {
    allFacts.push({
      icon: 'map',
      label: area.label[locale],
      value: `${area.value} ${area.unit[locale]} (${area.source})`,
    });
  }
  allFacts.push({
    icon: 'recycle',
    label: L('Lĩnh vực', 'Field'),
    value: L('Xử lý chất thải rắn và tái tạo tài nguyên', 'Solid waste treatment and resource recovery'),
  });
  const facts = allFacts.filter((f) => f.value.trim() !== '');

  const values: Array<{ icon: IconName; photo: PhotoKey; h: string; p: string }> = [
    {
      icon: 'cpu',
      photo: 'vpd',
      h: L('Công nghệ tiên tiến', 'Advanced technology'),
      p: L(
        'Kết hợp Sàng tuyển và công nghệ VPD để thu hồi tối đa các dòng tài nguyên từ chất thải.',
        'Combining Sorting and VPD technology to recover as many resource streams from waste as possible.',
      ),
    },
    {
      icon: 'recycle',
      photo: 'rdf',
      h: L('Tái tạo tài nguyên', 'Resource recovery'),
      p: L(
        'Chuyển từ tư duy “xử lý chất thải” sang “thu hồi và tái tạo giá trị tài nguyên”.',
        'Shifting from “waste treatment” to “recovering and regenerating the value of resources”.',
      ),
    },
    {
      icon: 'sprout',
      photo: 'humus',
      h: L('Phát triển bền vững', 'Sustainable development'),
      p: L(
        'Từng bước đưa những nguồn tài nguyên có thể tái sử dụng trở lại chu trình sản xuất.',
        'Step by step returning reusable resources to the production cycle.',
      ),
    },
    {
      icon: 'heart-handshake',
      photo: 'sourceSort',
      h: L('Vì cộng đồng xanh', 'For a green community'),
      p: L(
        'Đồng hành cùng địa phương, từ phân loại tại nguồn đến vận hành nhà máy có trách nhiệm.',
        'Working with the local community, from sorting at source to responsible plant operation.',
      ),
    },
  ];

  const gallery = content.projects[locale].filter((p) => p.heroImage).slice(0, 5);

  return (
    <>
      <SubHero
        testId="about-who"
        photo="plant"
        locale={locale}
        eyebrow={L('Giới thiệu', 'About us')}
        title={L('Giới thiệu về GMS Hưng Yên', 'About GMS Hung Yen')}
        lead={L(
          'Công ty Cổ phần Môi Trường Năng Lượng Xanh Hưng Yên (GMS) phát triển tổ hợp xử lý chất thải rắn và tái tạo tài nguyên tại tỉnh Hưng Yên.',
          'Green Energy Environment Joint Stock Company Hung Yen (GMS) develops an integrated solid waste treatment and resource recovery complex in Hung Yen Province.',
        )}
      />

      <section className="sec" data-testid="about-intro" aria-labelledby="h-intro">
        <div className="wrap split">
          <div>
            <div className="sec-head">
              <span className="eyebrow">{L('Chúng tôi là ai', 'Who we are')}</span>
              <h2 id="h-intro">
                {L('Nhà máy xử lý chất thải rắn đã đi vào hoạt động', 'A solid waste plant now in operation')}
              </h2>
            </div>
            <div className="prose">
              <p>
                {L(
                  'GMS Hưng Yên vận hành nhà máy xử lý chất thải rắn tại thị xã Mỹ Hào. Chất thải rắn đầu vào được tiếp nhận rồi xử lý theo hai nhánh: Sàng tuyển để phân tách các dòng vật chất, và công nghệ VPD để chuyển hoá một số dòng nguyên liệu phù hợp.',
                  'GMS Hung Yen operates a solid waste treatment plant in My Hao town. Incoming solid waste is received and treated along two branches: Sorting to separate material streams, and VPD technology to convert suitable feedstock streams.',
                )}
              </p>
              <p>
                {L(
                  'Thay vì chỉ chôn lấp hay đốt, GMS định hướng thu hồi sáu dòng tài nguyên: nilon, mùn hữu cơ và RDF từ nhánh Sàng tuyển; syngas, than hoạt tính và dầu tái chế từ nhánh VPD.',
                  'Instead of only landfilling or burning, GMS aims to recover six resource streams: plastic film, organic humus and RDF from the Sorting branch; syngas, activated carbon and recycled oil from the VPD branch.',
                )}
              </p>
            </div>
            <ul className="facts" data-testid="about-facts">
              {facts.map((f) => (
                <li key={f.label}>
                  <Icon name={f.icon} className="ico" />
                  <div>
                    <strong>{f.label}</strong>
                    {f.value}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <PhotoFigure
            photo="sortingLine"
            locale={locale}
            alt={L('Dây chuyền sàng tuyển trong nhà xưởng', 'Sorting line inside the plant')}
          />
        </div>
      </section>

      {customBody ? (
        <section className="sec" aria-label={L('Giới thiệu chi tiết', 'Details')}>
          <div className="wrap">
            <Html className="sec-body prose" html={customBody} />
          </div>
        </section>
      ) : null}

      <section className="sec sec-mist" data-testid="about-mission" aria-labelledby="h-mission">
        <div className="wrap split rev">
          <div>
            <div className="sec-head">
              <span className="eyebrow">{L('Tầm nhìn & sứ mệnh', 'Vision & mission')}</span>
              <h2 id="h-mission">
                {L('Giải pháp thông minh – Kiến tạo giá trị xanh', 'Smart solutions – Creating green value')}
              </h2>
            </div>
            <div className="prose">
              <p>
                {L(
                  'Tầm nhìn của GMS là chuyển từ tư duy “xử lý chất thải” sang “thu hồi và tái tạo giá trị tài nguyên”.',
                  'Our vision is to shift from “waste treatment” to “recovering and regenerating the value of resources”.',
                )}
              </p>
              <p>
                {L(
                  'Sứ mệnh của chúng tôi là từng bước đưa những nguồn tài nguyên có thể tái sử dụng trở lại chu trình sản xuất, cùng địa phương và đối tác công nghiệp vận hành và tiêu thụ sản phẩm tái tạo.',
                  'Our mission is to return reusable resources to the production cycle step by step, working with local authorities and industrial partners on operations and recovered output supply.',
                )}
              </p>
            </div>
            <p className="more-row">
              <a className="btn" href={ROUTES.technology[locale]}>
                {L('Xem công nghệ & giải pháp', 'See technology & solutions')}
                <Icon name="arrow-right" className="ico" />
              </a>
            </p>
          </div>
          <PhotoFigure
            photo="control"
            locale={locale}
            alt={L('Phòng điều khiển trung tâm của nhà máy', 'Central control room of the plant')}
          />
        </div>
      </section>

      <JourneySection
        content={content}
        locale={locale}
        sectionId="hanh-trinh"
        testId="about-journey"
        photo="reception"
        title={L('Hành trình chuyển đổi', 'Transformation Journey')}
        lead={L(
          'Từ đánh giá hiện trạng, tổ chức lại mặt bằng, hạ tầng đã đi vào hoạt động đến triển khai dây chuyền sàng tuyển kết hợp nhiệt phân VPD.',
          'From current-state assessment and site organisation and infrastructure that is now in operation to deployment of sorting and VPD pyrolysis lines.',
        )}
      />

      <section className="sec" data-testid="about-values" aria-labelledby="h-values">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-values">{L('Bốn giá trị cốt lõi', 'Four Core Values')}</h2>
          </div>
          <ul className="tgrid t4">
            {values.map((v) => (
              <li key={v.h}>
                <article className="icard" data-testid="value-card">
                  <PhotoFigure photo={v.photo} locale={locale} alt="" />
                  <div className="icard-body">
                    <Icon name={v.icon} className="tc-ico" />
                    <h3>{v.h}</h3>
                    <p>{v.p}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {gallery.length > 0 ? (
        <section className="sec sec-mist" data-testid="about-gallery" aria-labelledby="h-gallery">
          <div className="wrap">
            <div className="news-head">
              <h2 id="h-gallery">{L('Hình ảnh nhà máy', 'Inside the plant')}</h2>
              <a className="more" href={ROUTES.projects[locale]}>
                {L('Xem tất cả dự án', 'See all projects')}
                <Icon name="arrow-right" className="ico" />
              </a>
            </div>
            <ul className="gallery">
              {gallery.map((p) => (
                <li key={p.slug}>
                  <a href={`${ROUTES.projects[locale]}/${p.slug}`}>
                    <figure className="photo-fig">
                      <img
                        src={`/img/${(p.heroImage ?? '').replace(/^images\//, '')}`}
                        alt=""
                        width={1200}
                        height={896}
                        loading="lazy"
                        decoding="async"
                      />
                      <figcaption className="cap">
                        {p.title}
                        {content.images.get(p.heroImage ?? '')?.kind === 'anh-dung-ai' ? (
                          <span className="sr-only"> ({L('ảnh minh hoạ', 'illustration')})</span>
                        ) : null}
                      </figcaption>
                    </figure>
                  </a>
                </li>
              ))}
            </ul>
            <p className="gallery-note">{L('Ảnh minh hoạ', 'Illustrations')}</p>
          </div>
        </section>
      ) : null}

      <CtaSection content={content} locale={locale} photo="sorting" />
    </>
  );
}
