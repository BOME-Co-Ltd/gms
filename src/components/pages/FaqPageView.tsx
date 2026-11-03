import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

export function FaqPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.faq;
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
        viPath={ROUTES.faq.vi}
        enPath={ROUTES.faq.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="faq"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="faq-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block" data-testid="faq-list">
          <div className="grid gap-4">
            {t.items.map((item) => (
              <details key={item.q} className="card rounded-xl p-4 open:bg-white" open>
                <summary className="cursor-pointer text-lg font-bold text-[#0F5838] hover:text-[#27673C]">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm text-[#40773F] leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section-block section-alt">
          <h2>{isVi ? 'Bạn còn câu hỏi khác?' : 'Still have questions?'}</h2>
          <p>
            {isVi
              ? 'Đội ngũ chuyên gia kỹ thuật và quản lý của GMS Hưng Yên sẵn sàng giải đáp chi tiết.'
              : 'Our engineering and management team is available to assist with inquiries.'}
          </p>
          <p className="mt-4">
            <a href={ROUTES.contact[locale]} className="btn" data-testid="cta-contact">
              {dict.home.ctaContact} →
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
