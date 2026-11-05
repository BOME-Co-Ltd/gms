import { describe, expect, it } from 'vitest';
import { ICONS, type IconName, icon } from './static-icons.ts';

describe('icon() — SVG lucide dựng lúc build (ux-spec §13b)', () => {
  it('mọi biểu tượng: SVG inline trang trí, nét currentColor, viewBox 24, aria-hidden + focusable=false', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const svg = icon(name);
      expect(svg.startsWith('<svg'), name).toBe(true);
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('fill="none"');
      expect(svg).toContain('stroke-linecap="round"');
      expect(svg).toContain('stroke-linejoin="round"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('focusable="false"');
    }
  });

  it('mặc định 20px nét 1.8; tham số đổi cỡ, nét, class; kết quả giống nhau khi gọi lại (cache)', () => {
    expect(icon('phone')).toContain('width="20"');
    expect(icon('phone')).toContain('stroke-width="1.8"');
    const small = icon('check', { size: 14, strokeWidth: 2, className: 'x' });
    expect(small).toContain('width="14"');
    expect(small).toContain('stroke-width="2"');
    expect(small).toContain('x');
    expect(icon('check', { size: 14, strokeWidth: 2, className: 'x' })).toBe(small);
  });

  it('không có emoji/ký tự hình và không tham chiếu tệp ngoài', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const svg = icon(name);
      expect(svg).not.toMatch(/[←-⇿☀-➿\u{1F300}-\u{1FAFF}]/u);
      expect(svg).not.toMatch(/<use|href=|<image|<script/);
    }
  });
});
