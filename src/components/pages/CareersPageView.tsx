import { ArrowRight, MapPin } from 'lucide-react';
import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

export function CareersPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.careers;
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
        viPath={ROUTES.careers.vi}
        enPath={ROUTES.careers.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="careers"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="careers-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block" data-testid="careers-culture">
          <p className="eyebrow">{isVi ? 'Văn hoá' : 'Culture'}</p>
          <h2>{t.cultureTitle}</h2>
          <p>{t.cultureDesc}</p>
        </section>

        <section className="section-block" data-testid="careers-positions">
          <p className="eyebrow">{isVi ? 'Vị trí tuyển dụng' : 'Open Positions'}</p>
          <h2>{isVi ? 'Các cơ hội nghề nghiệp hiện tại' : 'Current Job Openings'}</h2>
          <div className="grid-cards">
            {t.openPositions.map((pos) => (
              <article key={pos.title} className="card" data-testid="job-card">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="text-lg font-bold text-[#0F5838] leading-snug">{pos.title}</h3>
                  <span className="badge bg-[#9FB43B]/20 text-[#0F5838] font-semibold">{pos.type}</span>
                </div>
                <p className="text-xs font-semibold text-[#1D6FB6] mb-3">
                  <MapPin size={14} aria-hidden="true" focusable="false" className="inline-block align-[-2px]" />{' '}
                  {pos.location}
                </p>
                <p className="text-sm leading-relaxed text-[#40773F] mb-5">{pos.desc}</p>
                <div className="mt-auto pt-2">
                  <a href={ROUTES.contact[locale]} className="btn btn-outline" data-testid="cta-contact">
                    {isVi ? 'Ứng tuyển ngay' : 'Apply now'}{' '}
                    <ArrowRight size={18} aria-hidden="true" focusable="false" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
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
