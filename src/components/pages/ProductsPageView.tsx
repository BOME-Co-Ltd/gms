import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { getDictionary, type Locale } from '../../i18n/index.ts';
import { Footer } from '../ui/Footer.tsx';
import { Header } from '../ui/Header.tsx';

const PRODUCT_IMAGES: Record<number, string> = {
  0: '/img/output-plastic-film.jpg',
  1: '/img/output-organic-humus.jpg',
  2: '/img/output-rdf.jpg',
  3: '/img/output-syngas.jpg',
  4: '/img/output-biochar.jpg',
  5: '/img/output-pyrolysis-oil.jpg',
};

export function ProductsPageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
  const t = dict.products;
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
        viPath={ROUTES.products.vi}
        enPath={ROUTES.products.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="products"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <section className="hero-banner on-dark" data-testid="products-hero">
          <p className="eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.lead}</p>
        </section>

        <section className="section-block" data-testid="products-grid">
          <p className="eyebrow">{isVi ? 'Danh mục đầu ra' : 'Product Portfolio'}</p>
          <h2>{isVi ? 'Sản phẩm từ chu trình sàng tuyển và nhiệt phân' : 'Products from Sorting & Pyrolysis'}</h2>
          <div className="grid-cards">
            {t.items.map((item, i) => (
              <article key={item.name} className="card" data-testid="product-card">
                <figure className="mb-3 overflow-hidden rounded-lg">
                  <img
                    src={PRODUCT_IMAGES[i] || '/og/default.png'}
                    alt={item.name}
                    width={400}
                    height={260}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                  />
                </figure>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-bold">{item.name}</h3>
                  <span
                    className={`badge ${item.state === 'Đã có' || item.state === 'Available' ? 'bg-[#067647]/15 text-[#067647]' : 'bg-[#1D6FB6]/15 text-[#1D6FB6]'}`}
                  >
                    {item.state}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#40773F]">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-block section-alt">
          <h2>{isVi ? 'Hợp tác tiêu thụ & Phân phối sản phẩm' : 'Off-take & Distribution Partnerships'}</h2>
          <p>
            {isVi
              ? 'GMS Hưng Yên sẵn sàng ký kết hợp đồng nguyên tắc cung ứng dài hạn nilon, RDF và các sản phẩm đầu ra cho quý doanh nghiệp.'
              : 'GMS Hung Yen enters long-term off-take agreements for RDF, recycled plastic film, and secondary raw materials.'}
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
