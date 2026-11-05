'use client';

import Link from 'next/link';
import React, { useState } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);

  // Focus only on core primary items (Remove 'home' because logo links home, remove 'privacy' & 'faq' which belong in footer)
  const focusedNavItems = navItems.filter(
    (item) => item.key !== 'home' && item.key !== 'privacy' && item.key !== 'faq',
  );

  return (
    <>
      <a href="#main-content" className="skip-link" data-testid="nav-menu">
        {skipToMainText}
      </a>
      <header className="site-header sticky top-0 z-50 border-b border-[#0f5838]/15 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="container mx-auto max-w-[1200px] px-4">
          {/* Hàng 1: Logo cùng hàng với Bộ chuyển ngôn ngữ & Nút Hamburger mobile */}
          <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#0f5838]/10 header-top">
            <Link
              href={homeHref}
              className="brand-link inline-flex items-center gap-2.5 text-base md:text-lg font-extrabold text-[#0F5838] no-underline transition-transform hover:scale-[1.02]"
              data-testid="nav-menu"
              title={locale === 'vi' ? 'Về Trang chủ' : 'Go to Home'}
            >
              <img
                src="/brand/logo-gms-mark.svg"
                alt={brandName}
                width={96}
                height={26}
                className="h-6 md:h-7 w-auto"
              />
              <span className="font-bold tracking-tight">{brandName}</span>
            </Link>

            <div className="flex items-center gap-2 md:gap-3">
              <LangSwitcher locale={locale} viPath={viPath} enPath={enPath} ariaLabel={langSwitcherAria} />

              {/* Hamburger Button for Mobile (<1024px) */}
              <button
                type="button"
                className="mobile-menu-btn lg:hidden inline-flex items-center justify-center p-2 rounded-lg border border-[#0f5838]/20 text-[#0f5838] hover:bg-[#0f5838]/5 transition-colors"
                aria-expanded={mobileOpen}
                aria-label={
                  mobileOpen
                    ? locale === 'vi'
                      ? 'Đóng menu'
                      : 'Close menu'
                    : locale === 'vi'
                      ? 'Mở menu'
                      : 'Open menu'
                }
                onClick={() => setMobileOpen((prev) => !prev)}
              >
                {mobileOpen ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Hàng 2: Menu điều hướng chính tập trung (8 mục), sử dụng Link chuyển trang không nhấp nháy */}
          <div className={`header-nav py-2 transition-all ${mobileOpen ? 'is-mobile-open' : ''}`}>
            <nav
              data-testid="nav-main"
              aria-label={mainNavAria}
              className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-1 overflow-x-auto no-scrollbar"
            >
              {focusedNavItems.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    data-testid="nav-menu"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-lg px-2.5 xl:px-3 py-1.5 text-xs xl:text-sm font-semibold no-underline whitespace-nowrap transition-all duration-200 text-center ${
                      isActive
                        ? 'bg-[#0F5838] text-white shadow-xs font-bold'
                        : 'text-[#0F5838] hover:bg-[#0F5838]/10 hover:text-[#0a3e27]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
