import type React from 'react';

export interface LangSwitcherProps {
  locale: 'vi' | 'en';
  viPath: string;
  enPath: string;
  ariaLabel: string;
}

export function LangSwitcher({ locale, viPath, enPath, ariaLabel }: LangSwitcherProps): React.ReactElement {
  return (
    <fieldset
      className="lang-switcher inline-flex items-center gap-1 rounded-full border border-[#0f5838]/20 p-1"
      data-testid="lang-switcher"
      aria-label={ariaLabel}
    >
      <a
        href={viPath}
        hrefLang="vi"
        lang="vi"
        aria-current={locale === 'vi' ? 'true' : undefined}
        className={`rounded-full px-3 py-1 text-sm font-bold no-underline ${
          locale === 'vi' ? 'bg-[#0F5838] text-white' : 'text-[#0F5838]'
        }`}
      >
        Tiếng Việt
      </a>
      <a
        href={enPath}
        hrefLang="en"
        lang="en"
        aria-current={locale === 'en' ? 'true' : undefined}
        className={`rounded-full px-3 py-1 text-sm font-bold no-underline ${
          locale === 'en' ? 'bg-[#0F5838] text-white' : 'text-[#0F5838]'
        }`}
      >
        English
      </a>
    </fieldset>
  );
}
