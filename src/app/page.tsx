import type React from 'react';
import { ROUTES } from '../../contracts/routes.ts';
import { HeroSection } from '../components/sections/HeroSection.tsx';
import { JourneySection } from '../components/sections/JourneySection.tsx';
import { PillarsSection } from '../components/sections/PillarsSection.tsx';
import { TechSummarySection } from '../components/sections/TechSummarySection.tsx';
import { FigureStrip } from '../components/ui/FigureStrip.tsx';
import { Footer } from '../components/ui/Footer.tsx';
import { Header } from '../components/ui/Header.tsx';
import { OutputCard } from '../components/ui/OutputCard.tsx';
import { getDictionary, type Locale } from '../i18n/index.ts';

export function HomePageView({ locale }: { locale: Locale }): React.ReactElement {
  const dict = getDictionary(locale);
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

  const outputs =
    locale === 'vi'
      ? [
          { name: 'Nilon', desc: 'Phân tách dòng nilon từ chất thải rắn đầu vào.' },
          { name: 'Mùn hữu cơ', desc: 'Thành phần hữu cơ sau sàng lồng làm mùn cải tạo đất.' },
          { name: 'RDF', desc: 'Nhiên liệu tái chế phục vụ lò hơi công nghiệp.' },
          { name: 'Syngas', desc: 'Khí tổng hợp thu hồi từ buồng phân huỷ nhiệt VPD.' },
          { name: 'Than hoạt tính', desc: 'Phần rắn sau phân huỷ nhiệt thu hồi làm than hoạt tính.' },
          { name: 'Dầu tái chế', desc: 'Dầu ngưng tụ từ dòng khí nhiệt phân sau làm sạch.' },
        ]
      : [
          { name: 'Plastic film', desc: 'Separated plastic film stream from incoming solid waste.' },
          { name: 'Organic humus', desc: 'Organic fraction stabilised as soil-conditioning humus.' },
          { name: 'RDF', desc: 'Refuse-Derived Fuel pellets for industrial boilers.' },
          { name: 'Syngas', desc: 'Synthesis gas recovered from the VPD chamber.' },
          { name: 'Activated carbon', desc: 'Solid carbon fraction recovered after thermal decomposition.' },
          { name: 'Recycled oil', desc: 'Condensed pyrolysis oil separated during gas cleaning.' },
        ];

  return (
    <>
      <Header
        locale={locale}
        brandName={dict.brand.shortName}
        homeHref={ROUTES.home[locale]}
        viPath={ROUTES.home.vi}
        enPath={ROUTES.home.en}
        skipToMainText={dict.nav.skipToMain}
        mainNavAria={dict.nav.mainAria}
        langSwitcherAria={dict.nav.langAria}
        activeKey="home"
        navItems={navItems}
      />
      <main id="main-content" className="container">
        <HeroSection
          pillars={dict.home.pillars}
          title={dict.home.heroTitle}
          subtitle={dict.home.heroSub}
          ctaTechLabel={dict.home.ctaTech}
          ctaTechHref={ROUTES.technology[locale]}
          ctaContactLabel={dict.home.ctaContact}
          ctaContactHref={ROUTES.contact[locale]}
          coverSrc="/img/hero-plant.jpg"
          coverAlt={dict.home.heroTitle}
          photoBadgeLabel={dict.home.photoLabelAi}
        />
        <FigureStrip
          eyebrow={locale === 'vi' ? 'Số liệu chính' : 'Key figures'}
          title={dict.home.figuresTitle}
          ariaLabel={locale === 'vi' ? 'Số liệu chính' : 'Key figures'}
          figures={[
            {
              key: 'dien-tich',
              value: '5',
              unit: 'ha',
              label: locale === 'vi' ? 'Diện tích nhà máy' : 'Plant area',
              source: 'Hồ sơ dự án GMS Hưng Yên',
            },
          ]}
        />
        <PillarsSection
          eyebrow={dict.home.pillarsEyebrow}
          heading={dict.home.pillarsHeading}
          cards={dict.home.pillarCards}
        />
        <TechSummarySection
          locale={locale}
          eyebrow={dict.home.techEyebrow}
          heading={dict.home.techHeading}
          lead={dict.home.techLead}
          btnLabel={dict.home.techBtn}
          techHref={ROUTES.technology[locale]}
        />
        <section className="section-block" data-testid="home-outputs">
          <p className="eyebrow">{dict.home.outputsEyebrow}</p>
          <h2>{dict.home.outputsHeading}</h2>
          <ul className="grid-cards">
            {outputs.map((o) => (
              <OutputCard key={o.name} name={o.name} stateLabel={dict.home.statePlanned} description={o.desc} />
            ))}
          </ul>
        </section>
        <JourneySection
          eyebrow={dict.home.journeyEyebrow}
          heading={dict.home.journeyHeading}
          description={dict.home.journeyDesc}
          newsHref={ROUTES.news[locale]}
          btnLabel={locale === 'vi' ? 'Xem lộ trình 5 bước' : 'View the 5-step roadmap'}
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

export default function HomePage(): React.ReactElement {
  return <HomePageView locale="vi" />;
}
