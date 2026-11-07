// M12/M13 Trang 404 và 500 (wireframe news-detail.html .err): tự chứa, đúng ngôn ngữ của URL.
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { Locale } from '../../../content/loader.ts';
import { Icon } from '../icons.tsx';
import { pick } from '../parts.tsx';

export function ErrorBody({ locale, kind }: { locale: Locale; kind: '404' | '500' }): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const is404 = kind === '404';
  return (
    <section className={`err err-${kind}`} aria-labelledby="h1" data-testid={`error-${kind}`}>
      <div className="wrap">
        <div className="col">
          {is404 ? <LostPathArt /> : <Icon name="server-crash" size={48} className="ico ico-lg" />}
          <h1 className="err-title" id="h1">
            {is404
              ? L('Không tìm thấy trang này.', "We couldn't find this page.")
              : L('Có lỗi ở phía chúng tôi.', 'Something went wrong on our side.')}
          </h1>
          <p>
            {is404
              ? L(
                  'Trang có thể đã được gỡ hoặc đường dẫn chưa đúng.',
                  'It may have been removed or the link may be wrong.',
                )
              : L('Mời bạn thử lại sau ít phút.', 'Please try again in a few minutes.')}
          </p>
          <div className="err-act">
            <a className="btn btn-primary" href={ROUTES.home[locale]}>
              {L('Về trang chủ', 'Back to home')}
              <Icon name="arrow-right" size={18} className="ico" />
            </a>
            {is404 ? (
              <a className="btn btn-outline" href={ROUTES.news[locale]}>
                {L('Tin tức / Hành trình', 'News / Journey')}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// Minh hoạ 404 tự vẽ: con đường dẫn tới nhà máy bị đứt, chiếc lá lạc và kính lúp.
function LostPathArt(): React.ReactElement {
  return (
    <svg className="err-art" viewBox="0 0 320 200" role="img" aria-hidden="true" focusable="false">
      <ellipse cx="160" cy="182" rx="140" ry="10" fill="var(--g900)" opacity=".08" />
      <path
        d="M20 170 C70 150 90 160 130 140"
        stroke="var(--g700, #2f6b3a)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="2 14"
      />
      <path
        d="M190 120 C230 100 260 110 300 80"
        stroke="var(--g700, #2f6b3a)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="2 14"
      />
      <g transform="translate(232 28)">
        <rect x="0" y="22" width="56" height="34" rx="4" fill="var(--g900)" opacity=".85" />
        <rect x="36" y="0" width="10" height="26" fill="var(--g900)" opacity=".85" />
        <circle cx="44" cy="-8" r="6" fill="var(--g900)" opacity=".2" />
        <circle cx="52" cy="-18" r="8" fill="var(--g900)" opacity=".12" />
        <rect x="8" y="32" width="10" height="10" rx="2" fill="#fff" opacity=".7" />
        <rect x="24" y="32" width="10" height="10" rx="2" fill="#fff" opacity=".7" />
      </g>
      <text x="160" y="108" textAnchor="middle" fontSize="64" fontWeight="800" fill="var(--g900)" opacity=".14">
        404
      </text>
      <g transform="translate(118 112) rotate(-18)">
        <path d="M0 0 C18 -26 52 -26 64 0 C52 26 18 26 0 0 Z" fill="#4caf50" />
        <path d="M2 0 L60 0" stroke="#fff" strokeWidth="2" opacity=".7" />
      </g>
      <g transform="translate(170 44)">
        <circle cx="0" cy="0" r="22" fill="#fff" opacity=".6" stroke="var(--g900)" strokeWidth="6" />
        <path d="M16 16 L34 34" stroke="var(--g900)" strokeWidth="8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
