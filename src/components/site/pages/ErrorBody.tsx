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
          <Icon name={is404 ? 'file-question' : 'server-crash'} size={48} className="ico ico-lg" />
          <h1 className="err-title" id="h1">
            {is404 ? L('Không tìm thấy trang này.', "We couldn't find this page.") : L('Có lỗi ở phía chúng tôi.', 'Something went wrong on our side.')}
          </h1>
          <p>
            {is404
              ? L('Trang có thể đã được gỡ hoặc đường dẫn chưa đúng.', 'It may have been removed or the link may be wrong.')
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
