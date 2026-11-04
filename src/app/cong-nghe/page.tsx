import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { Footer } from '../../components/ui/Footer.tsx';
import { Header } from '../../components/ui/Header.tsx';
import { TechFlowSvg } from '../../components/ui/TechFlowSvg.tsx';
import { VpdStepper } from '../../components/ui/VpdStepper.tsx';
import { getDictionary, type Locale } from '../../i18n/index.ts';

export function TechnologyPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.technology;
  const isVi = locale === 'vi';
  const navItems = [
    { key: 'home', label: dict.nav.home, href: ROUTES.home[locale] },
    { key: 'about', label: dict.nav.about, href: ROUTES.about[locale] },
    { key: 'solutions', label: dict.nav.solutions, href: ROUTES.solutions[locale] },
    { key: 'technology', label: dict.nav.technology, href: ROUTES.technology[locale] },
    { key: 'products', label: dict.nav.products, href: ROUTES.products[locale] },
    { key: 'news', label: dict.nav.news, href: ROUTES.news[locale] },
    { key: 'projects', label: dict.nav.projects, href: ROUTES.projects[locale] },
    { key: 'careers', label: dict.nav.careers, href: ROUTES.careers[locale] },
    { key: 'faq', label: dict.nav.faq, href: ROUTES.faq[locale] },
    { key: 'contact', label: dict.nav.contact, href: ROUTES.contact[locale] },
    { key: 'privacy', label: dict.nav.privacy, href: ROUTES.privacy[locale] },
  ];

  return (
    <>
      <Header
        locale={locale}
        brandName={dict.brand.shortName}
        homeHref={ROUTES.home[locale]}
        viPath={ROUTES.technology.vi}
        enPath={ROUTES.technology.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="technology"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.sub}</p>
        </section>

        <section className="section-block">
          <p className="eyebrow">{t.overviewEyebrow}</p>
          <h2>{t.overviewTitle}</h2>
          <TechFlowSvg locale={locale} ariaLabel={t.diagramAria} />
          <p className="mt-4">
            <a href={`${ROUTES.contact[locale]}?from=technology`} className="btn" data-testid="cta-contact">
              {dict.home.ctaContact}
            </a>
          </p>
        </section>

        <section className="section-block section-alt" data-testid="tech-drawing">
          <p className="eyebrow">{t.drawingBadge}</p>
          <h2>{t.drawingTitle}</h2>
          <figure className="card">
            <img src="/img/sorting-line-3d.png" alt={t.drawingAlt} width={1600} height={900} loading="lazy" />
            <figcaption>
              <span className="badge">{t.drawingBadge}</span> · {t.drawingCaption}
            </figcaption>
          </figure>
        </section>

        <section className="section-block">
          <p className="eyebrow">{isVi ? 'Kiểm chuẩn & Giám sát' : 'Quality Assurance & SCADA'}</p>
          <h2>
            {isVi ? 'Hạ tầng kiểm chuẩn và trung tâm điều khiển' : 'Quality Control Laboratory & SCADA Center'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <figure className="card overflow-hidden rounded-2xl border border-[#0f5838]/20 shadow-md bg-white p-0">
              <img
                src="/img/scada-control-room.jpg"
                alt={
                  isVi ? 'Trung tâm điều khiển SCADA và giám sát khí thải CEMS' : 'SCADA control room and CEMS monitoring'
                }
                width={800}
                height={500}
                className="w-full h-64 object-cover"
                loading="lazy"
              />
              <figcaption className="p-4 bg-white">
                <strong className="block text-base font-bold text-[#0f5838] mb-1">
                  {isVi ? 'Trung tâm điều hành SCADA 24/7' : '24/7 Central SCADA Room'}
                </strong>
                <p className="text-xs text-[#1b4332]/80 leading-relaxed m-0">
                  {isVi
                    ? 'Hệ thống tự động hoá giám sát áp suất buồng chân không, nhiệt độ và truyền dữ liệu quan trắc CEMS trực tiếp về Sở TN&MT.'
                    : 'Automated monitoring of chamber negative pressure, thermal gradient, and real-time CEMS telemetry to authorities.'}
                </p>
              </figcaption>
            </figure>
            <figure className="card overflow-hidden rounded-2xl border border-[#0f5838]/20 shadow-md bg-white p-0">
              <img
                src="/img/lab-quality-control.jpg"
                alt={isVi ? 'Phòng thí nghiệm kiểm chuẩn chất lượng' : 'Quality control testing laboratory'}
                width={800}
                height={500}
                className="w-full h-64 object-cover"
                loading="lazy"
              />
              <figcaption className="p-4 bg-white">
                <strong className="block text-base font-bold text-[#0f5838] mb-1">
                  {isVi ? 'Phòng kiểm nghiệm chất lượng sản phẩm' : 'Product Quality Testing Lab'}
                </strong>
                <p className="text-xs text-[#1b4332]/80 leading-relaxed m-0">
                  {isVi
                    ? 'Đo đạc nhiệt trị RDF, thành phần khí Syngas và độ xốp than hoạt tính Biochar đảm bảo tiêu chuẩn khắt khe trước khi xuất xưởng.'
                    : 'Calorific testing of RDF, syngas composition chromatography, and biochar porosity verification.'}
                </p>
              </figcaption>
            </figure>
          </div>
        </section>

        <VpdStepper
          eyebrow={t.vpdEyebrow}
          title={t.vpdTitle}
          lead={t.vpdLead}
          prevLabel={t.stepPrev}
          playLabel={t.stepPlay}
          stopLabel={t.stepStop}
          nextLabel={t.stepNext}
          steps={t.vpdSteps}
        />
      </main>
      <Footer
        locale={locale}
        brandName={dict.brand.legalName}
        slogan={dict.brand.slogan}
        address={dict.brand.address}
        phone={dict.brand.phone}
        phoneDisplay={dict.brand.phoneDisplay}
        zalo={dict.brand.zalo}
        privacyHref={ROUTES.privacy[locale]}
        privacyLabel={dict.nav.privacy}
        contactHref={ROUTES.contact[locale]}
        contactLabel={dict.nav.contact}
      />
    </>
  );
}

export default function TechnologyPage(): React.ReactElement {
  return <TechnologyPageView locale="vi" />;
}
