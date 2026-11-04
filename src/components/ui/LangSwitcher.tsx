import type React from 'react';

export interface LangSwitcherProps {
  locale: 'vi' | 'en';
  viPath: string;
  enPath: string;
  ariaLabel: string;
}

export function VietnamFlagIcon({ className = 'w-6 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 30 20" width="22" height="15" className={className} aria-hidden="true">
      <clipPath id="vn-clip-main">
        <rect width="30" height="20" rx="3" />
      </clipPath>
      <g clipPath="url(#vn-clip-main)">
        <rect width="30" height="20" fill="#DA251D" />
        <polygon
          points="15,4 16.35,8.15 20.71,8.15 17.18,10.71 18.53,14.85 15,12.29 11.47,14.85 12.82,10.71 9.29,8.15 13.65,8.15"
          fill="#FFCD00"
        />
      </g>
    </svg>
  );
}

export function UKFlagIcon({ className = 'w-6 h-4' }: { className?: string }): React.ReactElement {
  return (
    <svg viewBox="0 0 30 20" width="22" height="15" className={className} aria-hidden="true">
      <clipPath id="uk-clip-main">
        <rect width="30" height="20" rx="3" />
      </clipPath>
      <g clipPath="url(#uk-clip-main)">
        <rect width="30" height="20" fill="#012169" />
        <path d="M0 0 L30 20 M30 0 L0 20" stroke="#ffffff" strokeWidth="3.5" />
        <path d="M0 0 L15 10 M30 20 L15 10" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M30 0 L15 10 M0 20 L15 10" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M15 0 v20 M0 10 h30" stroke="#ffffff" strokeWidth="6" />
        <path d="M15 0 v20 M0 10 h30" stroke="#C8102E" strokeWidth="3.6" />
      </g>
    </svg>
  );
}

export function LangSwitcher({ locale, viPath, enPath, ariaLabel }: LangSwitcherProps): React.ReactElement {
  return (
    <fieldset
      className="lang-switcher inline-flex items-center gap-1 rounded-full border border-[#0f5838]/20 p-1 bg-white shadow-xs"
      data-testid="lang-switcher"
      aria-label={ariaLabel}
    >
      <a
        href={viPath}
        hrefLang="vi"
        lang="vi"
        title="Tiếng Việt"
        aria-label="Tiếng Việt"
        aria-current={locale === 'vi' ? 'true' : undefined}
        className={`inline-flex items-center justify-center w-9 h-8 rounded-full no-underline transition-all duration-200 cursor-pointer ${
          locale === 'vi'
            ? 'bg-[#0F5838] shadow-sm ring-1 ring-[#0F5838]'
            : 'hover:bg-[#0f5838]/10 hover:scale-105 opacity-80 hover:opacity-100'
        }`}
      >
        <VietnamFlagIcon className="w-[22px] h-[15px] rounded-[3px] shadow-xs flex-shrink-0" />
        <span className="sr-only">Tiếng Việt</span>
      </a>
      <a
        href={enPath}
        hrefLang="en"
        lang="en"
        title="English"
        aria-label="English"
        aria-current={locale === 'en' ? 'true' : undefined}
        className={`inline-flex items-center justify-center w-9 h-8 rounded-full no-underline transition-all duration-200 cursor-pointer ${
          locale === 'en'
            ? 'bg-[#0F5838] shadow-sm ring-1 ring-[#0F5838]'
            : 'hover:bg-[#0f5838]/10 hover:scale-105 opacity-80 hover:opacity-100'
        }`}
      >
        <UKFlagIcon className="w-[22px] h-[15px] rounded-[3px] shadow-xs flex-shrink-0" />
        <span className="sr-only">English</span>
      </a>
    </fieldset>
  );
}
