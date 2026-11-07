// NEXT-1: một đường duy nhất cho giao diện web: `next build` (output: export ⇒ out/).
// Mỗi trang Next gọi `<SitePage path=... />` + `siteMetadata(path)`; danh sách trang, tiêu đề, noindex, ảnh og
// suy từ content/ lúc build. Thân trang là thành phần React trong ./pages (markup theo wireframe green v0.3.8).
import type { Metadata } from 'next';
import type React from 'react';
import { PAGE_SIZE, ROUTES } from '../../../contracts/routes.ts';
import { type LoadedSiteContent, type Locale, loadSiteContent } from '../../content/loader.ts';
import { buildOrgJsonLd, currentFormStatus, loadSocial, type SiteConfig, siteConfigFromEnv } from './build/config.ts';
import { Icon } from './icons.tsx';
import { formatDateLocale, MENU_LABELS, MENU_ORDER, PAGE_DESCRIPTIONS, type StaticPageKey } from './menu.ts';
import { AboutPage } from './pages/About.tsx';
import { ContactPage } from './pages/Contact.tsx';
import { DetailPage } from './pages/Detail.tsx';
import { ErrorBody } from './pages/ErrorBody.tsx';
import { HomePage } from './pages/Home.tsx';
import { CareersListPage, FaqPage, NewsListPage, ProjectsListPage } from './pages/Lists.tsx';
import { PrivacyPage } from './pages/Privacy.tsx';
import { ProductsPage } from './pages/Products.tsx';
import { SolutionsPage } from './pages/Solutions.tsx';
import { TechnologyPage } from './pages/Technology.tsx';
import { type ShellCompany, SiteFrame } from './Shell.tsx';

export type PageSpec = {
  path: string;
  locale: Locale;
  viPath: string;
  enPath: string;
  title: string;
  description: string;
  noindex: boolean;
  ogImageRel: string;
  activeKey?: StaticPageKey;
  render: () => React.ReactElement;
};

type Site = {
  cfg: SiteConfig;
  loaded: LoadedSiteContent;
  company: ShellCompany;
  specs: Map<string, PageSpec>;
};

let cached: Site | null = null;

const brand = (locale: Locale): string => (locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen');

function build(): Site {
  const cfg = siteConfigFromEnv();
  const loaded = loadSiteContent(cfg.contentDir, cfg.dateOverride);
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.map((e) => `[${e.code}] ${e.message}`).join('\n'));
  }
  const company: ShellCompany = { ...loaded.company, social: loadSocial(cfg.contentDir) };
  const isStaging = cfg.siteEnv === 'staging';
  const formOpen = currentFormStatus(loaded.company).open;
  const hasRecipient = cfg.contactRecipient.trim() !== '';
  const specs = new Map<string, PageSpec>();
  const add = (s: PageSpec) => specs.set(s.path, s);

  for (const locale of ['vi', 'en'] as Locale[]) {
    const isVi = locale === 'vi';
    for (const key of MENU_ORDER) {
      const isEmptyList =
        (key === 'projects' && loaded.projects[locale].length === 0) ||
        (key === 'careers' && loaded.jobs[locale].length === 0) ||
        (key === 'faq' && loaded.faq[locale].length === 0);
      const renderers: Record<StaticPageKey, () => React.ReactElement> = {
        home: () => <HomePage content={loaded} locale={locale} />,
        about: () => <AboutPage content={loaded} locale={locale} />,
        solutions: () => <SolutionsPage content={loaded} locale={locale} />,
        technology: () => <TechnologyPage content={loaded} locale={locale} />,
        products: () => <ProductsPage content={loaded} locale={locale} />,
        news: () => <NewsListPage content={loaded} locale={locale} pageNum={1} />,
        projects: () => <ProjectsListPage content={loaded} locale={locale} />,
        careers: () => <CareersListPage content={loaded} locale={locale} />,
        faq: () => <FaqPage content={loaded} locale={locale} />,
        contact: () => (
          <ContactPage
            content={loaded}
            locale={locale}
            company={company}
            formOpen={formOpen}
            hasRecipient={hasRecipient}
          />
        ),
        privacy: () => <PrivacyPage content={loaded} locale={locale} />,
      };
      add({
        path: ROUTES[key][locale],
        locale,
        viPath: ROUTES[key].vi,
        enPath: ROUTES[key].en,
        title: `${MENU_LABELS[locale][key]} — ${brand(locale)}`,
        description: PAGE_DESCRIPTIONS[locale][key],
        noindex: isStaging || isEmptyList,
        ogImageRel: 'og/default.png',
        activeKey: key,
        render: renderers[key],
      });
    }

    const totalNewsPages = Math.ceil(loaded.news[locale].length / PAGE_SIZE);
    for (let p = 2; p <= totalNewsPages; p++) {
      const viPath = `${ROUTES.news.vi}/trang/${p}`;
      const enPath = `${ROUTES.news.en}/page/${p}`;
      add({
        path: isVi ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${MENU_LABELS[locale].news} (${p}) — ${brand(locale)}`,
        description: PAGE_DESCRIPTIONS[locale].news,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'news',
        render: () => <NewsListPage content={loaded} locale={locale} pageNum={p} />,
      });
    }

    for (const n of loaded.news[locale]) {
      const viSlug = isVi ? n.slug : (n.counterpartSlug ?? n.slug);
      const enSlug = !isVi ? n.slug : (n.counterpartSlug ?? n.slug);
      const viPath = `${ROUTES.news.vi}/${viSlug}`;
      const enPath = `${ROUTES.news.en}/${enSlug}`;
      let lead: { src: string; alt: string; label?: string } | undefined;
      let ogImageRel = 'og/default.png';
      if (n.heroImage) {
        const imgObj = loaded.images.get(n.heroImage);
        if (imgObj?.allowedInBuild) {
          const publicImg = `img/${n.heroImage.replace(/^images\//, '')}`;
          if (imgObj.allowedForOg) ogImageRel = publicImg;
          lead = {
            src: `/${publicImg}`,
            alt: imgObj.alt[locale],
            label: imgObj.kind === 'anh-dung-ai' ? (isVi ? 'Phối cảnh dự kiến' : "Artist's impression") : undefined,
          };
        }
      }
      add({
        path: isVi ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${n.title} — ${brand(locale)}`,
        description: n.summary || PAGE_DESCRIPTIONS[locale].news,
        noindex: isStaging,
        ogImageRel,
        activeKey: 'news',
        render: () => (
          <DetailPage
            content={loaded}
            locale={locale}
            listLabel={isVi ? 'Tin tức / Hành trình' : 'News / Journey'}
            listHref={ROUTES.news[locale]}
            title={n.title}
            meta={<time dateTime={n.date}>{formatDateLocale(n.date, locale)}</time>}
            lead={lead}
            bodyHtml={n.bodyHtml}
            backLabel={isVi ? 'Tất cả tin tức' : 'All news'}
          />
        ),
      });
    }

    for (const p of loaded.projects[locale]) {
      const viSlug = isVi ? p.slug : (p.counterpartSlug ?? p.slug);
      const enSlug = !isVi ? p.slug : (p.counterpartSlug ?? p.slug);
      const viPath = `${ROUTES.projects.vi}/${viSlug}`;
      const enPath = `${ROUTES.projects.en}/${enSlug}`;
      add({
        path: isVi ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${p.title} — ${brand(locale)}`,
        description: p.summary || PAGE_DESCRIPTIONS[locale].projects,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'projects',
        render: () => (
          <DetailPage
            content={loaded}
            locale={locale}
            listLabel={isVi ? 'Dự án / Thư viện' : 'Projects / Gallery'}
            listHref={ROUTES.projects[locale]}
            title={p.title}
            meta={
              <>
                <time dateTime={p.date}>{formatDateLocale(p.date, locale)}</time>
                <span>{p.category}</span>
              </>
            }
            bodyHtml={p.bodyHtml}
            backLabel={isVi ? 'Tất cả dự án' : 'All projects'}
          />
        ),
      });
    }

    for (const j of loaded.jobs[locale]) {
      const viSlug = isVi ? j.slug : (j.counterpartSlug ?? j.slug);
      const enSlug = !isVi ? j.slug : (j.counterpartSlug ?? j.slug);
      const viPath = `${ROUTES.careers.vi}/${viSlug}`;
      const enPath = `${ROUTES.careers.en}/${enSlug}`;
      const deadlineLabel = `${isVi ? 'Hạn nộp' : 'Deadline'}: ${formatDateLocale(j.validThrough, locale)}`;
      add({
        path: isVi ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${j.title} — ${brand(locale)}`,
        description: PAGE_DESCRIPTIONS[locale].careers,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'careers',
        render: () => (
          <DetailPage
            content={loaded}
            locale={locale}
            listLabel={isVi ? 'Tuyển dụng' : 'Careers'}
            listHref={ROUTES.careers[locale]}
            title={j.title}
            meta={
              <p className="il">
                <Icon name="circle-alert" className="ico" />
                <strong>{deadlineLabel}</strong>
              </p>
            }
            bodyHtml={j.bodyHtml}
            backLabel={isVi ? 'Tất cả vị trí tuyển dụng' : 'All open positions'}
          />
        ),
      });
    }

    // M13: 404/500. Đường dẫn giả (`/404`, `/en/404`) chỉ để tra cứu; tệp ra là 404.html / 500.html.
    for (const kind of ['404', '500'] as const) {
      const path = isVi ? `/${kind}` : `/en/${kind}`;
      add({
        path,
        locale,
        viPath: `/${kind}`,
        enPath: `/en/${kind}`,
        title:
          kind === '404'
            ? isVi
              ? 'Không tìm thấy trang — GMS Hưng Yên'
              : 'Page not found — GMS Hung Yen'
            : isVi
              ? 'Có lỗi ở phía chúng tôi — GMS Hưng Yên'
              : 'Something went wrong — GMS Hung Yen',
        description:
          kind === '404'
            ? isVi
              ? 'Không tìm thấy trang này. Trang có thể đã được gỡ hoặc đường dẫn chưa đúng.'
              : "We couldn't find this page. It may have been removed or the link may be wrong."
            : isVi
              ? 'Mời bạn thử lại sau ít phút.'
              : 'Please try again in a few minutes.',
        noindex: true,
        ogImageRel: 'og/default.png',
        render: () => <ErrorBody locale={locale} kind={kind} />,
      });
    }
  }
  return { cfg, loaded, company, specs };
}

function site(): Site {
  if (!cached) cached = build();
  return cached;
}

function specOf(path: string): PageSpec {
  let s = site().specs.get(path);
  // Giữ chỗ cho tuyến động rỗng (Next export cấm generateStaticParams rỗng); bước kiểm sau build xoá file `_.html` này.
  if (!s && path.endsWith('/_')) s = site().specs.get(path.startsWith('/en') ? '/en/404' : '/404');
  if (!s) throw new Error(`Không có trang cho đường dẫn ${path}`);
  return s;
}

/** Tham số tĩnh cho trang chi tiết / phân trang: giá trị của đoạn cuối theo từng locale. */
export function lastSegments(prefix: string): string[] {
  const out: string[] = [];
  for (const p of site().specs.keys()) {
    if (p.startsWith(`${prefix}/`)) {
      const rest = p.slice(prefix.length + 1);
      if (!rest.includes('/')) out.push(rest);
    }
  }
  return out.length > 0 ? out : ['_'];
}

export function siteMetadata(path: string): Metadata {
  const s = specOf(path);
  const { siteUrl } = site().cfg;
  const url = `${siteUrl}${s.path}`;
  const viUrl = `${siteUrl}${s.viPath}`;
  return {
    title: s.title,
    description: s.description,
    robots: s.noindex ? { index: false, follow: false } : { index: true, follow: true },
    alternates: {
      canonical: url,
      languages: { vi: viUrl, en: `${siteUrl}${s.enPath}`, 'x-default': viUrl },
    },
    openGraph: {
      type: 'website',
      title: s.title,
      description: s.description,
      locale: s.locale === 'vi' ? 'vi_VN' : 'en_US',
      url,
      images: [{ url: `${siteUrl}/${s.ogImageRel.replace(/^\//, '')}` }],
    },
  };
}

export function SitePage({ path }: { path: string }): React.ReactElement {
  const s = specOf(path);
  const { cfg, company } = site();
  return (
    <>
      <SiteFrame locale={s.locale} viPath={s.viPath} enPath={s.enPath} company={company} active={s.activeKey}>
        {s.render()}
      </SiteFrame>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildOrgJsonLd(company, cfg.siteUrl, s.locale) }}
      />
    </>
  );
}
