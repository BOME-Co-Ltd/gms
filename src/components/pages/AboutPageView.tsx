import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

export function AboutPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.about;
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
        viPath={ROUTES.about.vi}
        enPath={ROUTES.about.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="about"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="about-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block" data-testid="about-vision">
          <p className="eyebrow">{isVi ? 'Định hướng' : 'Strategic direction'}</p>
          <h2>{t.visionTitle}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-6">
            <div className="lg:col-span-5 overflow-hidden rounded-2xl border border-[#0f5838]/15 shadow-sm bg-white">
              <img
                src="/img/vision-mission.jpg"
                alt={isVi ? 'Tầm nhìn phát triển xanh GMS Hưng Yên' : 'GMS Hung Yen Green Development Vision'}
                width={600}
                height={500}
                className="w-full h-full object-cover min-h-[300px]"
                loading="lazy"
              />
            </div>
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              <article className="card m-0 flex-1">
                <span className="card-num" aria-hidden="true">
                  01
                </span>
                <h3>{isVi ? 'Tầm nhìn' : 'Vision'}</h3>
                <p>{t.visionDesc}</p>
              </article>
              <article className="card m-0 flex-1">
                <span className="card-num" aria-hidden="true">
                  02
                </span>
                <h3>{isVi ? 'Sứ mệnh' : 'Mission'}</h3>
                <p>{t.missionDesc}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section-block section-alt" data-testid="about-values">
          <p className="eyebrow">{isVi ? 'Giá trị' : 'Values'}</p>
          <h2>{t.valuesTitle}</h2>
          <ul className="grid-cards">
            {t.values.map((v, i) => (
              <li key={v.title} className="card" data-testid="value-card">
                <span className="card-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="section-block" data-testid="about-cta">
          <h2>{isVi ? 'Đồng hành cùng GMS Hưng Yên' : 'Partner with GMS Hung Yen'}</h2>
          <p>
            {isVi
              ? 'Chúng tôi luôn sẵn sàng đón tiếp các đơn vị, đối tác và nhà đầu tư cùng chia sẻ mục tiêu kinh tế xanh.'
              : 'We welcome municipal authorities, industrial partners, and sustainability advocates to connect with us.'}
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
