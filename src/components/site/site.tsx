// NEXT-1: một đường duy nhất cho giao diện web — `next build` (output: export ⇒ out/).
// Mỗi trang Next gọi `<SitePage path=... />` + `siteMetadata(path)`; danh sách trang, tiêu đề, noindex, ảnh og
// suy từ content/ tại thời điểm build (cùng quy tắc build-site.ts cũ). Markup thân trang vẫn là bản đã khớp wireframe
// v0.3.8 (chuỗi HTML trong scripts/content/build-site.ts).
// shortcut: thân trang chèn qua dangerouslySetInnerHTML (một nguồn markup, không JS client riêng); nâng cấp: chuyển
// từng renderXxx sang thành phần JSX theo trang (NEXT-2), mỗi lượt một trang.
import type { Metadata } from 'next';
import type React from 'react';
import { PAGE_SIZE, ROUTES } from '../../../contracts/routes.ts';
import {
  currentFormStatus,
  detailPage,
  escHtml,
  formatDateLocale,
  loadSocial,
  MENU_LABELS,
  MENU_ORDER,
  PAGE_DESCRIPTIONS,
  renderAboutPage,
  renderCareersListPage,
  renderContactPage,
  renderErrorBody,
  renderFaqPage,
  renderHomePage,
  renderNewsListPage,
  renderPrivacyPage,
  renderProductsPage,
  renderProjectsListPage,
  renderShell,
  renderSolutionsPage,
  renderTechnologyPage,
  type SiteConfig,
  type StaticPageKey,
  siteConfigFromEnv,
} from '../../../scripts/content/build-site.ts';
import { type LoadedSiteContent, type Locale, loadSiteContent } from '../../content/loader.ts';
import { icon } from '../ui/static-icons.ts';

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
  render: () => string;
};

type Site = {
  cfg: SiteConfig;
  loaded: LoadedSiteContent;
  company: LoadedSiteContent['company'] & { social: ReturnType<typeof loadSocial> };
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
  const company = { ...loaded.company, social: loadSocial(cfg.contentDir) };
  const isStaging = cfg.siteEnv === 'staging';
  const formOpen = currentFormStatus(loaded.company).open;
  const specs = new Map<string, PageSpec>();
  const add = (s: PageSpec) => specs.set(s.path, s);

  for (const locale of ['vi', 'en'] as Locale[]) {
    for (const key of MENU_ORDER) {
      const isEmptyList =
        (key === 'projects' && loaded.projects[locale].length === 0) ||
        (key === 'careers' && loaded.jobs[locale].length === 0) ||
        (key === 'faq' && loaded.faq[locale].length === 0);
      const renderers: Record<StaticPageKey, () => string> = {
        home: () => renderHomePage(loaded, locale),
        about: () => renderAboutPage(loaded, locale),
        solutions: () => renderSolutionsPage(loaded, locale),
        technology: () => renderTechnologyPage(loaded, locale),
        products: () => renderProductsPage(loaded, locale),
        news: () => renderNewsListPage(loaded, locale, 1),
        projects: () => renderProjectsListPage(loaded, locale),
        careers: () => renderCareersListPage(loaded, locale),
        faq: () => renderFaqPage(loaded, locale),
        contact: () => renderContactPage(loaded, locale, cfg.contactRecipient, formOpen),
        privacy: () => renderPrivacyPage(loaded, locale),
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
        path: locale === 'vi' ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${MENU_LABELS[locale].news} (${p}) — ${brand(locale)}`,
        description: PAGE_DESCRIPTIONS[locale].news,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'news',
        render: () => renderNewsListPage(loaded, locale, p),
      });
    }

    for (const n of loaded.news[locale]) {
      const viSlug = locale === 'vi' ? n.slug : (n.counterpartSlug ?? n.slug);
      const enSlug = locale === 'en' ? n.slug : (n.counterpartSlug ?? n.slug);
      const viPath = `${ROUTES.news.vi}/${viSlug}`;
      const enPath = `${ROUTES.news.en}/${enSlug}`;
      let heroHtml = '';
      let ogImageRel = 'og/default.png';
      if (n.heroImage) {
        const imgObj = loaded.images.get(n.heroImage);
        if (imgObj?.allowedInBuild) {
          const publicImg = `img/${n.heroImage.replace(/^images\//, '')}`;
          if (imgObj.allowedForOg) ogImageRel = publicImg;
          const caption =
            imgObj.kind === 'anh-dung-ai'
              ? `<figcaption class="photo-label" data-testid="photo-label">${locale === 'vi' ? 'Phối cảnh dự kiến' : "Artist's impression"}</figcaption>`
              : '';
          heroHtml = `<figure class="fig lead-fig"><div class="frame-wf r169"><img src="/${publicImg}" alt="${escHtml(imgObj.alt[locale])}" width="1200" height="675" />${caption}</div></figure>`;
        }
      }
      add({
        path: locale === 'vi' ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${n.title} — ${brand(locale)}`,
        description: n.summary || PAGE_DESCRIPTIONS[locale].news,
        noindex: isStaging,
        ogImageRel,
        activeKey: 'news',
        render: () =>
          detailPage(loaded, locale, {
            listLabel: locale === 'vi' ? 'Tin tức / Hành trình' : 'News / Journey',
            listHref: ROUTES.news[locale],
            title: n.title,
            metaHtml: `<time datetime="${escHtml(n.date)}">${escHtml(formatDateLocale(n.date, locale))}</time>`,
            leadFigureHtml: heroHtml,
            bodyHtml: n.bodyHtml,
            backLabel: locale === 'vi' ? 'Tất cả tin tức' : 'All news',
          }),
      });
    }

    for (const p of loaded.projects[locale]) {
      const viSlug = locale === 'vi' ? p.slug : (p.counterpartSlug ?? p.slug);
      const enSlug = locale === 'en' ? p.slug : (p.counterpartSlug ?? p.slug);
      const viPath = `${ROUTES.projects.vi}/${viSlug}`;
      const enPath = `${ROUTES.projects.en}/${enSlug}`;
      add({
        path: locale === 'vi' ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${p.title} — ${brand(locale)}`,
        description: p.summary || PAGE_DESCRIPTIONS[locale].projects,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'projects',
        render: () =>
          detailPage(loaded, locale, {
            listLabel: locale === 'vi' ? 'Dự án / Thư viện' : 'Projects / Gallery',
            listHref: ROUTES.projects[locale],
            title: p.title,
            metaHtml: `<time datetime="${escHtml(p.date)}">${escHtml(formatDateLocale(p.date, locale))}</time><span>${escHtml(p.category)}</span>`,
            bodyHtml: p.bodyHtml,
            backLabel: locale === 'vi' ? 'Tất cả dự án' : 'All projects',
          }),
      });
    }

    for (const j of loaded.jobs[locale]) {
      const viSlug = locale === 'vi' ? j.slug : (j.counterpartSlug ?? j.slug);
      const enSlug = locale === 'en' ? j.slug : (j.counterpartSlug ?? j.slug);
      const viPath = `${ROUTES.careers.vi}/${viSlug}`;
      const enPath = `${ROUTES.careers.en}/${enSlug}`;
      const deadlineLabel =
        locale === 'vi'
          ? `Hạn nộp: ${formatDateLocale(j.validThrough, 'vi')}`
          : `Deadline: ${formatDateLocale(j.validThrough, 'en')}`;
      add({
        path: locale === 'vi' ? viPath : enPath,
        locale,
        viPath,
        enPath,
        title: `${j.title} — ${brand(locale)}`,
        description: PAGE_DESCRIPTIONS[locale].careers,
        noindex: isStaging,
        ogImageRel: 'og/default.png',
        activeKey: 'careers',
        render: () =>
          detailPage(loaded, locale, {
            listLabel: locale === 'vi' ? 'Tuyển dụng' : 'Careers',
            listHref: ROUTES.careers[locale],
            title: j.title,
            metaHtml: `<p class="il">${icon('circle-alert', { className: 'ico' })}<strong>${escHtml(deadlineLabel)}</strong></p>`,
            bodyHtml: j.bodyHtml,
            backLabel: locale === 'vi' ? 'Tất cả vị trí tuyển dụng' : 'All open positions',
          }),
      });
    }

    // M13: 404/500. Đường dẫn giả (`/404`, `/en/404`) chỉ để tra cứu; tệp ra là 404.html / 500.html.
    for (const kind of ['404', '500'] as const) {
      const isVi = locale === 'vi';
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
        render: () => renderErrorBody(locale, kind),
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
  // Giữ chỗ cho tuyến động rỗng (Next export cấm generateStaticParams rỗng); postBuild xoá file `_.html` này.
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
  const parts = renderShell({
    locale: s.locale,
    viPath: s.viPath,
    enPath: s.enPath,
    siteUrl: cfg.siteUrl,
    company,
    activePageKey: s.activeKey,
    bodyHtml: s.render(),
  });
  const contents = { display: 'contents' } as const;
  return (
    <>
      <div style={contents} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: parts.before }} />
      <main id="noi-dung" tabIndex={-1} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: parts.main }} />
      <div style={contents} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: parts.after }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: parts.orgJsonLd }} />
    </>
  );
}
