// Phần dùng lại giữa các trang (markup lấy từ wireframe green v0.3.8).
import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../content/loader.ts';
import { formatPublicPhone } from '../../shared/contact/schema.ts';
import { Icon, type IconName } from './icons.tsx';

export const pick = (locale: Locale, vi: string, en: string): string => (locale === 'vi' ? vi : en);

/** HTML đã được loader/markdown dựng và lọc từ content/ (rule markdown ở build); không phải dữ liệu người dùng. */
export function Html({
  html,
  as: Tag = 'div',
  className,
}: {
  html: string;
  as?: 'div' | 'span';
  className?: string;
}): React.ReactElement {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Streaks({ variant }: { variant: 'home' | 'sub' | 'cta' }): React.ReactElement {
  if (variant === 'cta') {
    return (
      <svg className="hero-streaks" viewBox="0 0 1280 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <g fill="none" stroke="#9FB43B" strokeLinecap="round">
          <path d="M900 460L1140 -40" strokeOpacity=".22" strokeWidth="2" />
          <path d="M1010 460L1250 -40" strokeOpacity=".14" strokeWidth="2" />
        </g>
      </svg>
    );
  }
  if (variant === 'home') {
    return (
      <svg className="hero-streaks" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <g fill="none" stroke="#9FB43B" strokeLinecap="round">
          <path d="M640 760L1060 -40" strokeOpacity=".22" strokeWidth="2" />
          <path d="M760 760L1180 -40" strokeOpacity=".16" strokeWidth="2" />
          <path d="M880 760L1300 -40" strokeOpacity=".1" strokeWidth="2" />
          <path d="M-40 640C260 600 520 560 760 470" stroke="#A4B93A" strokeOpacity=".28" strokeWidth="2" strokeDasharray="2 14" />
        </g>
      </svg>
    );
  }
  return (
    <svg className="hero-streaks" viewBox="0 0 1280 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#9FB43B" strokeLinecap="round">
        <path d="M760 520L1060 -40" strokeOpacity=".22" strokeWidth="2" />
        <path d="M880 520L1180 -40" strokeOpacity=".16" strokeWidth="2" />
        <path d="M1000 520L1300 -40" strokeOpacity=".1" strokeWidth="2" />
      </g>
    </svg>
  );
}

/**
 * Đầu trang con M2–M13 (`.hero.hero-sub` của wireframe): nền gradient, đường cắt chéo, kicker. Đường cắt chéo lấy màu
 * của khối kế tiếp (mist / xanh dương hành trình / trắng).
 */
export function SubHero({
  eyebrow,
  title,
  lead,
  after,
  testId,
  crumbs,
  crumbLabel,
  jump,
}: {
  crumbLabel?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  after?: 'mist' | 'journey';
  testId?: string;
  crumbs?: Array<{ label: string; href?: string }>;
  jump?: { label: string; items: Array<{ href: string; text: string }> };
}): React.ReactElement {
  const afterVar = after === 'mist' ? 'var(--mist)' : after === 'journey' ? 'var(--b800)' : undefined;
  return (
    <section
      className="hero hero-sub on-dark"
      data-testid={testId}
      aria-labelledby="h1"
      style={afterVar ? ({ '--after-hero': afterVar } as React.CSSProperties) : undefined}
    >
      <Streaks variant="sub" />
      <div className="wrap">
        {crumbs ? <Crumb items={crumbs} label={crumbLabel ?? 'Breadcrumb'} /> : null}
        <div className="fade">
          {eyebrow ? <p className="kicker">{eyebrow}</p> : null}
          <h1 id="h1">{title}</h1>
          {lead ? <p className="hero-lead">{lead}</p> : null}
        </div>
        {jump ? (
          <ul className="jump fade" aria-label={jump.label}>
            {jump.items.map((j) => (
              <li key={j.href}>
                <a href={j.href}>
                  <Icon name="arrow-down" className="ico" />
                  {j.text}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** Đường dẫn trang (breadcrumb, C11): mục cuối là trang hiện tại. */
export function Crumb({ items, label }: { items: Array<{ label: string; href?: string }>; label: string }): React.ReactElement {
  return (
    <nav className="crumb" aria-label={label} data-testid="breadcrumb">
      <ol>
        {items.map((c, i) => (
          <li key={c.label}>
            {i < items.length - 1 ? (
              <>
                <a href={c.href}>{c.label}</a>
                <Icon name="chevron-right" size={16} className="ico" />
              </>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Khối mời liên hệ cuối trang (UI-V27): cùng markup và chữ với khối ở trang chủ. */
export function CtaSection({
  content,
  locale,
  id = 'h-cta',
  sectionId,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  id?: string;
  sectionId?: string;
}): React.ReactElement {
  const phoneRaw = content.company.phone?.trim() ?? '';
  return (
    <section className="sec sec-cta on-dark" id={sectionId} aria-labelledby={id}>
      <Streaks variant="cta" />
      <div className="wrap">
        <div>
          <h2 id={id}>{pick(locale, 'Bạn muốn hợp tác hoặc cần tư vấn?', 'Looking to partner or need advice?')}</h2>
          <p>{pick(locale, 'Hãy để lại thông tin, chúng tôi sẽ liên hệ lại.', 'Leave your details and we will get back to you.')}</p>
        </div>
        <div className="cta-act">
          <a className="btn btn-light" href={ROUTES.contact[locale]} data-testid={sectionId ? undefined : 'cta-contact'}>
            {pick(locale, 'Liên hệ hợp tác', 'Partner with us')}
            <Icon name="arrow-right" className="ico" />
          </a>
          {phoneRaw ? (
            <a className="alt" href={`tel:${phoneRaw}`}>
              <Icon name="phone" className="ico" />
              {pick(locale, 'Hoặc gọi', 'Or call')} {formatPublicPhone(phoneRaw, locale)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyBlock({ locale, icon, text }: { locale: Locale; icon: IconName; text: string }): React.ReactElement {
  return (
    <div className="empty" role="status" data-testid="empty-state">
      <Icon name={icon} size={40} className="ico" />
      <p>{text}</p>
      <a className="btn" href={ROUTES.contact[locale]}>
        {pick(locale, 'Liên hệ', 'Contact')}
        <Icon name="arrow-right" size={18} className="ico" />
      </a>
    </div>
  );
}

/** Sơ đồ hai nhánh (U12): dùng chung trang chủ và trang Công nghệ. */
export function BoardFigure({
  content,
  locale,
  outputsId,
  branchesId,
  anchors,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  outputsId: string;
  branchesId: string;
  anchors: boolean;
}): React.ReactElement {
  const isVi = locale === 'vi';
  const outputItem = (o: LoadedSiteContent['outputLines'][number]) => (
    <li className="o" data-testid="output-row" key={o.name[locale]}>
      <span className="o-name">{o.name[locale]}</span>
      <span className="tag">{o.state === 'da-co' ? pick(locale, 'Đã có', 'Available') : pick(locale, 'Định hướng', 'Planned')}</span>
    </li>
  );
  const ariaText = pick(
    locale,
    'Sơ đồ: chất thải đầu vào chia hai nhánh. Sàng tuyển ra nilon, mùn hữu cơ, RDF. Công nghệ VPD ra syngas, than hoạt tính, dầu tái chế.',
    'Diagram: incoming waste splits into two branches. Sorting yields plastic film, organic humus and RDF. VPD technology yields syngas, activated carbon and recycled oil.',
  );
  const down = (href: string, text: string) =>
    anchors ? (
      <a href={href}>
        {text}
        <Icon name="arrow-down" className="ico" />
      </a>
    ) : null;
  const railsA = ['M0 316C40 316 40 150 80 150', 'M0 316C40 316 40 482 80 482'];
  const railsB = [
    'M0 150C48 150 48 46 96 46',
    'M0 150H96',
    'M0 150C48 150 48 254 96 254',
    'M0 482C48 482 48 378 96 378',
    'M0 482H96',
    'M0 482C48 482 48 586 96 586',
  ];
  return (
    <figure>
      <div className="board" data-testid={outputsId}>
        <div className="dg" data-testid={branchesId} role="img" aria-label={ariaText}>
          <div className="node n-in">
            <strong>{pick(locale, 'Chất thải rắn đầu vào', 'Incoming solid waste')}</strong>
            <span>{pick(locale, 'Tiếp nhận và phân loại', 'Reception and classification')}</span>
          </div>
          <svg className="dg-conn conn-a" viewBox="0 0 80 632" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {railsA.map((d) => (
              <path key={`r${d}`} className="rail" pathLength={1} d={d} />
            ))}
            {railsA.map((d) => (
              <path key={`f${d}`} className="flow soft" d={d} />
            ))}
          </svg>
          <div className="grp grp1">
            <div className="node n-br b1">
              <span>{pick(locale, 'Nhánh 1', 'Branch 1')}</span>
              <strong>{pick(locale, 'Sàng tuyển', 'Sorting')}</strong>
            </div>
            <ul className="o-list o1">{content.outputLines.filter((o) => o.group === 'sang-tuyen').map(outputItem)}</ul>
          </div>
          <div className="grp grp2">
            <div className="node n-br b2">
              <span>{pick(locale, 'Nhánh 2', 'Branch 2')}</span>
              <strong>{pick(locale, 'Công nghệ VPD', 'VPD technology')}</strong>
            </div>
            <ul className="o-list o2">{content.outputLines.filter((o) => o.group === 'vpd').map(outputItem)}</ul>
          </div>
          <svg className="dg-conn conn-b" viewBox="0 0 96 632" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {railsB.map((d) => (
              <path key={`r${d}`} className="rail" pathLength={1} d={d} />
            ))}
            {railsB.map((d) => (
              <path key={`f${d}`} className="flow" d={d} />
            ))}
            <g className="end">
              {[46, 150, 254, 378, 482, 586].map((cy) => (
                <circle key={cy} cx="93" cy={cy} r="4" />
              ))}
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="dg-notes">
        <div>
          <h3>{pick(locale, 'Sàng tuyển', 'Sorting')}</h3>
          <p>{pick(locale, 'Phân tách các dòng vật chất phù hợp để tiếp tục xử lý hoặc khai thác giá trị.', 'Separates suitable material streams for further processing or value recovery.')}</p>
          {down('#sang-tuyen', pick(locale, 'Xem công đoạn sàng tuyển', 'See the sorting stages'))}
        </div>
        <div>
          <h3>{pick(locale, 'Công nghệ VPD', 'VPD technology')}</h3>
          <p>{pick(locale, 'Định hướng chuyển hoá một số dòng nguyên liệu phù hợp thành các sản phẩm đầu ra mới.', 'Aims to convert suitable feedstock streams into new output products.')}</p>
          {down('#vpd', pick(locale, 'Xem công đoạn VPD', 'See the VPD stages'))}
        </div>
        <div>
          <h3>{pick(locale, 'Sáu dòng ở mức định hướng', 'Six streams, planned direction')}</h3>
          <p>{pick(locale, 'Nhà máy đã đi vào hoạt động; các dòng đầu ra vẫn ở mức định hướng, chưa phải sản phẩm đang cung cấp.', 'The plant is in operation; the output streams remain a planned direction, not products currently supplied.')}</p>
          <a href={ROUTES.products[locale]}>
            {pick(locale, 'Xem sản phẩm đầu ra', 'See output products')}
            <Icon name="arrow-right" className="ico" />
          </a>
        </div>
      </figcaption>
    </figure>
  );
}
