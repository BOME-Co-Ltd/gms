// M2 Giới thiệu — dùng khung đầu trang con và lưới thẻ của wireframe green v0.3.8; chữ từ content/ + i18n.
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { Icon, type IconName } from '../icons.tsx';
import { CtaSection, Html, pick, SubHero } from '../parts.tsx';

const VALUE_ICONS: IconName[] = ['cpu', 'recycle', 'sprout', 'heart-handshake'];

export function AboutPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const customBody = content.pagesBody.about?.[locale]?.bodyHtml ?? '';
  const values =
    locale === 'vi'
      ? ['Công nghệ tiên tiến', 'Tái tạo tài nguyên', 'Phát triển bền vững', 'Vì cộng đồng xanh']
      : ['Advanced technology', 'Resource recovery', 'Sustainable development', 'For a green community'];
  return (
    <>
      <SubHero
        testId="about-who"
        after={customBody ? undefined : 'mist'}
        eyebrow={L('Giới thiệu', 'About us')}
        title={L('Giới thiệu về GMS Hưng Yên', 'About GMS Hung Yen')}
        lead={L(
          'Công ty Cổ phần Môi Trường Năng Lượng Xanh Hưng Yên (GMS) phát triển tổ hợp xử lý chất thải rắn và tái tạo tài nguyên tại tỉnh Hưng Yên.',
          'Green Energy Environment Joint Stock Company Hung Yen (GMS) develops an integrated solid waste treatment and resource recovery complex in Hung Yen Province.',
        )}
      />
      {customBody ? (
        <section className="sec" aria-label={L('Giới thiệu chi tiết', 'Details')}>
          <div className="wrap">
            <Html className="sec-body prose" html={customBody} />
          </div>
        </section>
      ) : null}
      <section className="sec sec-mist" data-testid="about-journey" aria-labelledby="h-journey">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-journey">{L('Hành trình chuyển đổi', 'Transformation Journey')}</h2>
            <p>
              {L(
                'Từ đánh giá hiện trạng, tổ chức lại mặt bằng, hạ tầng đã đi vào hoạt động đến triển khai dây chuyền sàng tuyển kết hợp nhiệt phân VPD.',
                'From current-state assessment and site organisation and infrastructure that is now in operation to deployment of sorting and VPD pyrolysis lines.',
              )}
            </p>
          </div>
        </div>
      </section>
      <section className="sec" data-testid="about-values" aria-labelledby="h-values">
        <div className="wrap">
          <div className="sec-head">
            <h2 id="h-values">{L('Bốn giá trị cốt lõi', 'Four Core Values')}</h2>
          </div>
          <ul className="tgrid t4">
            {values.map((v, i) => (
              <li key={v}>
                <div className="tcard" data-testid="value-card">
                  <Icon name={VALUE_ICONS[i] ?? 'check'} className="tc-ico" />
                  <h3>{v}</h3>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaSection content={content} locale={locale} />
    </>
  );
}
