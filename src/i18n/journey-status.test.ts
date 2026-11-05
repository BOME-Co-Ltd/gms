// ux-spec C34–C36: nhãn trạng thái lộ trình; content-model.ts:104-106 giao nhãn EN cho src/i18n.
import { describe, expect, it } from 'vitest';
import { JOURNEY_STATUSES } from '../../contracts/content-model.ts';
import { getDictionary } from './index.ts';

describe('journeyStatus (src/i18n)', () => {
  it('mỗi giá trị JOURNEY_STATUSES có nhãn ở cả vi và en, và không thừa khoá', () => {
    for (const locale of ['vi', 'en'] as const) {
      expect(Object.keys(getDictionary(locale).journeyStatus).sort()).toEqual([...JOURNEY_STATUSES].sort());
    }
  });

  it('vi: chữ thường đúng nguồn; en: Upcoming / In progress / Completed', () => {
    expect(getDictionary('vi').journeyStatus).toEqual({
      'chưa tới': 'chưa tới',
      'đang làm': 'đang làm',
      'đã xong': 'đã xong',
    });
    expect(getDictionary('en').journeyStatus).toEqual({
      'chưa tới': 'Upcoming',
      'đang làm': 'In progress',
      'đã xong': 'Completed',
    });
  });
});
