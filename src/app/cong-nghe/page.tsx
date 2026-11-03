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
