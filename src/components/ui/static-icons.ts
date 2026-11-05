// Biểu tượng toàn site (ux-spec §13b): lucide-react, dựng SVG inline LÚC BUILD bằng renderToStaticMarkup.
// Không font biểu tượng, không sprite/CDN, không tải gì lúc chạy; màu qua currentColor.
// Chỉ build-site.ts import module này (bản build tĩnh); mã Next dùng thẳng component lucide-react.
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  CircleAlert,
  Clock,
  ExternalLink,
  type LucideIcon,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ReceiptText,
  X,
} from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

export const ICONS = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  check: Check,
  circle: Circle,
  'circle-alert': CircleAlert,
  clock: Clock,
  'external-link': ExternalLink,
  mail: Mail,
  'map-pin': MapPin,
  menu: Menu,
  'message-circle': MessageCircle,
  phone: Phone,
  'receipt-text': ReceiptText,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export type IconOptions = { size?: number; strokeWidth?: number; className?: string };

const cache = new Map<string, string>();

/** SVG trang trí: aria-hidden="true" focusable="false", stroke currentColor, viewBox 24. Nghĩa nằm ở chữ hoặc aria-label của phần tử bấm. */
export function icon(name: IconName, opts: IconOptions = {}): string {
  const { size = 20, strokeWidth = 1.8, className } = opts;
  const key = `${name}|${size}|${strokeWidth}|${className ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const svg = renderToStaticMarkup(
    createElement(ICONS[name], {
      size,
      strokeWidth,
      className,
      'aria-hidden': 'true',
      focusable: 'false',
    }),
  );
  cache.set(key, svg);
  return svg;
}
