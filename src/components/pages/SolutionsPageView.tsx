import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

export function SolutionsPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.solutions;
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
        brandName={dict.brand.legalName}
        homeHref={ROUTES.home[locale]}
        viPath={ROUTES.solutions.vi}
        enPath={ROUTES.solutions.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="solutions"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="solutions-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block">
          <p className="eyebrow">{isVi ? 'Các giải pháp chủ lực' : 'Core Solutions'}</p>
          <h2>{isVi ? 'Quy trình giải pháp khép kín' : 'Integrated Solution Framework'}</h2>
          <div className="grid-cards">
            {t.items.map((item, i) => (
              <article key={item.title} className="card" data-testid="solution-item">
                <span className="card-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
                <p className="mt-4">
                  <a href={ROUTES.contact[locale]} className="btn btn-outline" data-testid="cta-contact">
                    {isVi ? 'Liên hệ tư vấn' : 'Inquire now'} →
                  </a>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block section-alt">
          <h2>{isVi ? 'Tìm hiểu sâu về công nghệ vận hành' : 'Explore Operational Technology'}</h2>
          <p>
            {isVi
              ? 'Xem chi tiết sơ đồ dòng vật chất và mô phỏng 8 bước nhiệt phân chân không VPD.'
              : 'Detailed mass flow diagrams and interactive 8-step simulation of the VPD pyrolysis process.'}
          </p>
          <p className="mt-4">
            <a href={ROUTES.technology[locale]} className="btn">
              {dict.home.ctaTech} →
            </a>
          </p>
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
