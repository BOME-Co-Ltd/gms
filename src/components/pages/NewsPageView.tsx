import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

export function NewsPageView({
  locale,
  stepNames,
}: {
  locale: Locale;
  /** Tên bước từ content/journey-steps.yaml; thiếu/lỗi ⇒ dùng dict. */
  stepNames?: string[] | null;
}): React.ReactElement {
  const dict = getDictionary(locale);
  const steps = stepNames && stepNames.length > 0 ? stepNames : dict.home.journeySteps;
  const t = dict.news;
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
        viPath={ROUTES.news.vi}
        enPath={ROUTES.news.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="news"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="news-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block" data-testid="news-roadmap">
          <p className="eyebrow">{isVi ? 'Lộ trình' : 'Roadmap'}</p>
          <h2>{t.roadmapTitle}</h2>
          <div className="grid-cards">
            {steps.map((step, i) => (
              <div key={step} className="card">
                <span className="card-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{isVi ? `Bước ${i + 1}` : `Step ${i + 1}`}</h3>
                <p className="font-semibold text-[#0F5838]">{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block" data-testid="news-articles">
          <p className="eyebrow">{isVi ? 'Bản tin' : 'Articles'}</p>
          <h2>{isVi ? 'Hoạt động & Sự kiện' : 'Activities & Milestones'}</h2>
          <div className="grid-cards">
            {t.articles.map((art) => (
              <article key={art.title} className="card" data-testid="news-card">
                <p className="text-xs font-bold text-[#1D6FB6]">{art.date}</p>
                <h3 className="my-2 text-lg font-bold text-[#0F5838]">{art.title}</h3>
                <p className="text-sm text-[#40773F]">{art.summary}</p>
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
