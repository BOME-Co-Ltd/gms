// Biểu tượng toàn site (ux-spec §13b): lucide-react, SVG inline (prerender lúc build), màu qua currentColor.
// Không font biểu tượng, không sprite/CDN, không tải gì lúc chạy. Zalo/Messenger/Facebook là ngoại lệ thương hiệu (Q-UX-18).
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Clock,
  Cpu,
  ExternalLink,
  FileQuestionMark,
  FileText,
  HeartHandshake,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  MapPin,
  Menu,
  MoveHorizontal,
  Newspaper,
  Phone,
  ReceiptText,
  Recycle,
  ServerCrash,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import type React from 'react';

const ICONS = {
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  check: Check,
  'chevron-right': ChevronRight,
  circle: Circle,
  'circle-alert': CircleAlert,
  'circle-check': CircleCheck,
  clock: Clock,
  cpu: Cpu,
  'external-link': ExternalLink,
  'file-question': FileQuestionMark,
  'file-text': FileText,
  'heart-handshake': HeartHandshake,
  image: ImageIcon,
  info: Info,
  'loader-circle': LoaderCircle,
  mail: Mail,
  map: MapIcon,
  'map-pin': MapPin,
  menu: Menu,
  'move-horizontal': MoveHorizontal,
  newspaper: Newspaper,
  phone: Phone,
  'receipt-text': ReceiptText,
  recycle: Recycle,
  'server-crash': ServerCrash,
  'shield-check': ShieldCheck,
  sprout: Sprout,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** SVG trang trí: aria-hidden, stroke currentColor, viewBox 24. Nghĩa nằm ở chữ hoặc aria-label của phần tử bấm. */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}): React.ReactElement {
  const Cmp = ICONS[name];
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" focusable="false" />;
}

// Logo Zalo (ngoại lệ thương hiệu màu, ux-spec Q-UX-18): simple-icons, CC0-1.0. Nhãn hiệu Zalo thuộc VNG; cần khách/admin xác nhận.
const ZALO_BLUE = '#0068FF';
const ZALO_PATH =
  'M12.49 10.2722v-.4496h1.3467v6.3218h-.7704a.576.576 0 01-.5763-.5729l-.0006.0005a3.273 3.273 0 01-1.9372.6321c-1.8138 0-3.2844-1.4697-3.2844-3.2823 0-1.8125 1.4706-3.2822 3.2844-3.2822a3.273 3.273 0 011.9372.6321l.0006.0005zM6.9188 7.7896v.205c0 .3823-.051.6944-.2995 1.0605l-.03.0343c-.0542.0615-.1815.206-.2421.2843L2.024 14.8h4.8948v.7682a.5764.5764 0 01-.5767.5761H0v-.3622c0-.4436.1102-.6414.2495-.8476L4.8582 9.23H.1922V7.7896h6.7266zm8.5513 8.3548a.4805.4805 0 01-.4803-.4798v-7.875h1.4416v8.3548H15.47zM20.6934 9.6C22.52 9.6 24 11.0807 24 12.9044c0 1.8252-1.4801 3.306-3.3066 3.306-1.8264 0-3.3066-1.4808-3.3066-3.306 0-1.8237 1.4802-3.3044 3.3066-3.3044zm-10.1412 5.253c1.0675 0 1.9324-.8645 1.9324-1.9312 0-1.065-.865-1.9295-1.9324-1.9295s-1.9324.8644-1.9324 1.9295c0 1.0667.865 1.9312 1.9324 1.9312zm10.1412-.0033c1.0737 0 1.945-.8707 1.945-1.9453 0-1.073-.8713-1.9436-1.945-1.9436-1.0753 0-1.945.8706-1.945 1.9436 0 1.0746.8697 1.9453 1.945 1.9453z';

/** Logo Zalo dạng ô bo góc (wireframe `i-zalo`, V33): nền #0068FF, bóng thoại trắng, chữ Zalo. */
export function ZaloMark({
  size = 24,
  className = 'zalo-mark',
}: {
  size?: number;
  className?: string;
}): React.ReactElement {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="24" rx="6" fill={ZALO_BLUE} />
      <ellipse cx="12" cy="11.3" rx="9" ry="7.1" fill="#fff" />
      <path d="M5.2 15.4 4.3 19.8l4.6-2.6z" fill="#fff" />
      <path transform="translate(5.4 4.7) scale(.55)" fill={ZALO_BLUE} d={ZALO_PATH} />
    </svg>
  );
}

// Messenger và Facebook: simple-icons 13.21.0 (CC0-1.0), viewBox 24, tô bằng fill.
const MESSENGER_PATH =
  'M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z';
const FACEBOOK_PATH =
  'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z';

export function BrandMark({ name }: { name: 'messenger' | 'facebook' }): React.ReactElement {
  return (
    <svg
      className={name === 'facebook' ? 'brand-mark fb-mark' : 'brand-mark'}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={name === 'messenger' ? MESSENGER_PATH : FACEBOOK_PATH} />
    </svg>
  );
}

/** Định nghĩa gradient + symbol logo GMS (bản vẽ lại tạm từ fanpage, chờ file gốc: D1, D8). Đặt MỘT lần đầu <body>. */
export function LogoSprite(): React.ReactElement {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient
          id="gms-gm"
          gradientUnits="userSpaceOnUse"
          cx="690"
          cy="545"
          r="875"
          gradientTransform="translate(690 545) scale(1 0.643) translate(-690 -545)"
        >
          <stop offset="0" stopColor="#A4B93A" />
          <stop offset="0.34" stopColor="#90AC3C" />
          <stop offset="0.49" stopColor="#648F40" />
          <stop offset="0.66" stopColor="#40773F" />
          <stop offset="0.78" stopColor="#27673C" />
          <stop offset="0.86" stopColor="#22633B" />
          <stop offset="1" stopColor="#0F5838" />
        </radialGradient>
        <linearGradient id="gms-s" gradientUnits="userSpaceOnUse" x1="0" y1="545" x2="0" y2="1037">
          <stop offset="0.15" stopColor="#1C70B8" />
          <stop offset="0.315" stopColor="#2367B0" />
          <stop offset="0.5" stopColor="#2059A6" />
          <stop offset="0.7" stopColor="#204F9F" />
          <stop offset="0.84" stopColor="#244999" />
        </linearGradient>
        <symbol id="logo-gms" viewBox="60 530 1930 520">
          <path
            fill="url(#gms-gm)"
            d="M292,545 L653,545 A98 98 0 0 1 555,643 L310,643 A122 122 0 0 0 188,765 L188,817 A122 122 0 0 0 310,939 L527,939 Q537,939 537,929 L537,840 L322,840 A98 98 0 0 1 420,742 L595,742 A58 58 0 0 1 653,800 L653,922 A115 115 0 0 1 538,1037 L292,1037 C149,1037 72,960 72,817 L72,765 C72,622 149,545 292,545 Z"
          />
          <path
            fill="url(#gms-gm)"
            d="M732,1037 L732,605 A60 60 0 0 1 792,545 L848,545 L1023,693 L1198,545 L1254,545 A60 60 0 0 1 1314,605 L1314,981 A56 56 0 0 1 1258,1037 L1198,1037 L1198,697 L1053,818 Q1023,844 993,818 L848,697 L848,981 A56 56 0 0 1 792,1037 Z"
          />
          <path
            fill="url(#gms-s)"
            d="M1974,545 C1974,584.2 1915.2,643 1876,643 L1559,643 A49.5 49.5 0 0 0 1559,742 L1826.5,742 A147.5 147.5 0 0 1 1826.5,1037 L1393,1037 C1393,997.8 1451.8,939 1491,939 L1808,939 A49.5 49.5 0 0 0 1808,840 L1540,840 A147.5 147.5 0 0 1 1540,545 Z"
          />
        </symbol>
      </defs>
    </svg>
  );
}

/** Logo GMS dùng lại symbol ở LogoSprite. `label` rỗng ⇒ trang trí (aria-hidden). */
export function GmsLogo({ className, label = '' }: { className: string; label?: string }): React.ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 1930 520"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
      <use href="#logo-gms" />
    </svg>
  );
}
