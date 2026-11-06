import { join } from 'node:path';
import { loadJourneySteps } from '../../content/loader.ts';
import type { Locale } from '../../i18n/index.ts';

/**
 * Tên 5 bước lộ trình từ content/journey-steps.yaml (chỉ gọi ở server component).
 * Yaml thiếu, lỗi hoặc có tên rỗng ⇒ null: trang lùi về dict.home.journeySteps.
 */
export function loadJourneyNames(locale: Locale): string[] | null {
  try {
    const { steps, errors } = loadJourneySteps(join(process.cwd(), 'content'));
    if (!steps || errors.length > 0 || steps.length === 0) return null;
    const names = steps.map((s) => s.name[locale].trim());
    return names.every((n) => n.length > 0) ? names : null;
  } catch {
    return null;
  }
}
