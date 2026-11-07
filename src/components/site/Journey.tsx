// Lộ trình 5 bước (U13): dùng chung trang chủ và trang Tin tức; trạng thái lấy từ content/journey-steps.yaml.
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../content/loader.ts';
import { getDictionary } from '../../i18n/index.ts';
import { Icon } from './icons.tsx';
import { pick } from './parts.tsx';

// Mô tả ngắn theo wireframe (chỉ có tiếng Việt).
const JOURNEY_DESC = [
  'Đánh giá hạ tầng, rà soát thiết bị và các dòng vật chất tồn lưu.',
  'Tổ chức lại mặt bằng và các khu vực vận hành.',
  'Cải tạo hạ tầng và xử lý các dòng vật chất tồn lưu.',
  'Triển khai dây chuyền sàng tuyển và công nghệ VPD theo định hướng.',
  'Xây dựng hệ thống vận hành theo định hướng mới.',
];

export function JourneySection({
  content,
  locale,
  title,
  lead,
  sectionId,
  testId,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  title: string;
  lead?: string;
  sectionId: string;
  testId?: string;
}): React.ReactElement {
  const isVi = locale === 'vi';
  const defaults = isVi
    ? [
        'Đánh giá hiện trạng',
        'Tổ chức mặt bằng',
        'Cải tạo hạ tầng',
        'Triển khai công nghệ',
        'Hoàn thiện hệ thống vận hành',
      ]
    : [
        'Current-state assessment',
        'Site organisation',
        'Infrastructure upgrade',
        'Technology deployment',
        'Operating-system completion',
      ];
  const rows = content.journeySteps
    ? content.journeySteps.map((s) => ({ name: s.name[locale], status: s.status as string | null }))
    : defaults.map((name) => ({ name, status: null as string | null }));
  const labels: Record<string, string> = getDictionary(locale).journeyStatus;
  return (
    <section className="sec sec-journey on-dark" data-testid={testId} id={sectionId} aria-labelledby="h-journey">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="h-journey">{title}</h2>
          {lead ? <p>{lead}</p> : null}
        </div>
        <ol className="j-steps">
          {rows.map((s, i) => {
            const label = s.status ? (labels[s.status] ?? '') : '';
            const done = s.status === 'đã xong';
            const doing = s.status === 'đang làm';
            return (
              <li className="j-step now" data-testid="journey-step" data-status={s.status ?? ''} key={s.name}>
                <span className="step-n">
                  {pick(locale, 'Bước', 'Step')} {String(i + 1).padStart(2, '0')}
                </span>
                <h3>{s.name}</h3>
                {isVi && JOURNEY_DESC[i] ? <p>{JOURNEY_DESC[i]}</p> : null}
                {label ? (
                  <span
                    className={`badge badge-status badge-status--${done ? 'done' : doing ? 'doing' : 'upcoming'}`}
                    data-status={s.status ?? ''}
                  >
                    <Icon name={done ? 'check' : doing ? 'clock' : 'circle'} size={14} strokeWidth={2} />
                    {label}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
