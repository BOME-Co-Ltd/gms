import type React from 'react';
import { LangSwitcher } from './LangSwitcher.tsx';

export interface NavItem {
  key: string;
  label: string;
  href: string;
}

export interface HeaderProps {
  locale: 'vi' | 'en';
  brandName: string;
  homeHref: string;
  viPath: string;
  enPath: string;
  skipToMainText: string;
  mainNavAria: string;
  langSwitcherAria: string;
  activeKey?: string;
  navItems: NavItem[];
}

export function Header({
  locale,
  brandName,
  homeHref,
  viPath,
  enPath,
  skipToMainText,
  mainNavAria,
  langSwitcherAria,
  activeKey,
  navItems,
}: HeaderProps): React.ReactElement {
  return (
    <>
      <a href="#main-content" className="skip-link" data-testid="nav-menu">
        {skipToMainText}
      </a>
      <header className="site-header sticky top-0 z-50 border-b border-[#0f5838]/15 bg-white/95 py-2.5 backdrop-blur">
        <div className="container mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4">
          <a
            href={homeHref}
            className="brand-link inline-flex items-center gap-2.5 text-lg font-extrabold text-[#0F5838] no-underline"
            data-testid="nav-menu"
          >
            <img src="/brand/logo-gms-mark.svg" alt={brandName} width={104} height={28} />
            <span>{brandName}</span>
          </a>
          <nav data-testid="nav-main" aria-label={mainNavAria} className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.key}
                href={item.href}
                data-testid="nav-menu"
                aria-current={activeKey === item.key ? 'page' : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold no-underline ${
                  activeKey === item.key ? 'bg-[#0F5838] text-white' : 'text-[#0F5838] hover:bg-[#0F5838]/5'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <LangSwitcher locale={locale} viPath={viPath} enPath={enPath} ariaLabel={langSwitcherAria} />
        </div>
      </header>
    </>
  );
}
