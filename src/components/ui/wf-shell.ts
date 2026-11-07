// Khung giao diện theo wireframe v0.3.8 (ux-spec V26, V27, V31–V34): thanh trên, header logo lớn, cờ ngôn ngữ,
// ngăn kéo "Mở menu", cụm nút nổi (về đầu trang · Zalo · Messenger · Gọi). Thuần chuỗi HTML + CSS, chỉ build-site.ts import (FE-ATOMIC).
// CSS chép từ 02-design/ux/wireframes/home.html (phần không phải .wf-*) và gộp hiệu ứng bóng loáng V28, hover V25 (chỉ scale).
import { brandMark, gmsLogo, icon, zaloMark } from './static-icons.ts';

export type WfLocale = 'vi' | 'en';

export type WfLink = { href: string; label: string; current?: boolean };

export type WfShellInput = {
  locale: WfLocale;
  homeHref: string;
  /** Menu chính (7 mục: Trang chủ … Dự án / Thư viện). */
  main: WfLink[];
  /** Menu phụ (Tuyển dụng · FAQ · Chính sách bảo mật · Liên hệ). */
  sub: WfLink[];
  viPath: string;
  enPath: string;
  phone: { href: string; text: string } | null;
  zaloHref: string | null;
  /** Địa chỉ Messenger suy từ fanpage (m.me/<tên>); null ⇒ ẩn nút. */
  messengerHref: string | null;
  /** Nhãn aria của logo/brand. */
  brandLabel: string;
};

const T = {
  vi: {
    hotline: 'Đường dây nóng: ',
    hotlineShort: 'Đường dây nóng',
    topSub: 'Menu phụ',
    navMain: 'Menu chính',
    navDrawerMain: 'Menu chính (di động)',
    navDrawerSub: 'Menu phụ (di động)',
    langLabel: 'Đổi ngôn ngữ. Đang xem: ',
    langVi: 'Tiếng Việt',
    langEn: 'English',
    openMenu: 'Mở menu',
    closeMenu: 'Đóng menu',
    drawerTitle: 'Menu',
    toTop: 'Về đầu trang',
    zaloAria: 'Chat Zalo',
    zaloTitle: 'Chat Zalo',
    msgAria: 'Nhắn tin Messenger (mở cửa sổ mới)',
    msgTitle: 'Nhắn tin Messenger',
    call: 'Gọi',
    newTab: '(mở cửa sổ mới)',
    quick: 'Liên hệ nhanh',
  },
  en: {
    hotline: 'Hotline: ',
    hotlineShort: 'Hotline',
    topSub: 'Secondary menu',
    navMain: 'Main menu',
    navDrawerMain: 'Main menu (mobile)',
    navDrawerSub: 'Secondary menu (mobile)',
    langLabel: 'Change language. Viewing: ',
    langVi: 'Vietnamese',
    langEn: 'English',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    drawerTitle: 'Menu',
    toTop: 'Back to top',
    zaloAria: 'Chat on Zalo',
    zaloTitle: 'Chat on Zalo',
    msgAria: 'Message on Messenger (opens in a new window)',
    msgTitle: 'Message on Messenger',
    call: 'Call',
    newTab: '(opens in a new window)',
    quick: 'Quick contact',
  },
} as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Cờ Việt Nam và Anh vẽ lại từ wireframe (viewBox 30x20 / 60x40); trang trí, nghĩa nằm ở aria-label của liên kết.
const FLAG_VI =
  '<svg class="flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="30" height="20" fill="#DA251D"/><path fill="#FFFF00" d="M15 4.2l1.35 4.15h4.37l-3.53 2.57 1.35 4.15L15 12.5l-3.54 2.57 1.35-4.15-3.53-2.57h4.37z"/></svg>';
const FLAG_EN =
  '<svg class="flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><clipPath id="uk-c"><rect width="60" height="40"/></clipPath><g clip-path="url(#uk-c)"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="7"/></g></svg>';

function links(items: WfLink[], withTestId: boolean): string {
  const tid = withTestId ? ' data-testid="nav-menu"' : '';
  return items
    .map((l) => `<li><a href="${esc(l.href)}"${tid}${l.current ? ' aria-current="page"' : ''}>${esc(l.label)}</a></li>`)
    .join('');
}

/** Thanh trên (≥ 1200px) + header + ngăn kéo. Thứ tự tab: hotline → menu phụ → logo → menu chính → ngôn ngữ → Mở menu. */
export function buildHeaderHtml(i: WfShellInput): string {
  const t = T[i.locale];
  const top = `<div class="top"><div class="wrap">${
    i.phone
      ? `<a href="${esc(i.phone.href)}" data-testid="nav-menu">${icon('phone', { className: 'ico' })}${t.hotline}${esc(i.phone.text)}</a>`
      : '<span></span>'
  }<nav aria-label="${t.topSub}"><ul>${links(i.sub, true)}</ul></nav></div></div>`;

  const viCur = i.locale === 'vi';
  const lang = `<nav class="lang" data-testid="lang-switcher" aria-label="${t.langLabel}${viCur ? t.langVi : t.langEn}"><span class="lang-pill" aria-hidden="true"></span><a href="${esc(i.viPath)}" hreflang="vi" lang="vi" aria-label="${t.langVi}" title="${t.langVi}"${viCur ? ' aria-current="true"' : ''}>${FLAG_VI}</a><a href="${esc(i.enPath)}" hreflang="en" lang="en" aria-label="${t.langEn}" title="${t.langEn}"${viCur ? '' : ' aria-current="true"'}>${FLAG_EN}</a></nav>`;

  const header = `<header class="hdr"><div class="wrap">
    <a class="brand" href="${esc(i.homeHref)}" aria-label="${esc(i.brandLabel)}" data-testid="nav-menu">${gmsLogo('logo-gms')}</a>
    <nav class="nav" data-testid="nav-main" aria-label="${t.navMain}"><ul>${links(i.main, true)}</ul></nav>
    <div class="hdr-end">${lang}
      <button class="menu-btn" id="menu-btn" type="button" aria-controls="drawer" aria-expanded="false">${icon('menu', { size: 24, className: 'ico' })}<span class="t">${t.openMenu}</span></button>
    </div></div></header>`;

  const hot = i.phone
    ? `<div class="d-hot"><span>${t.hotlineShort}</span><a href="${esc(i.phone.href)}">${icon('phone', { size: 24, className: 'ico' })}${esc(i.phone.text)}</a></div>`
    : '';
  const drawer = `<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden>
    <div class="drawer-bg" aria-hidden="true"></div>
    <div class="drawer-panel">
      <div class="drawer-top"><span id="drawer-title">${t.drawerTitle}</span><button class="close-btn" id="menu-close" type="button">${icon('x', { className: 'ico' })}${t.closeMenu}</button></div>
      <nav aria-label="${t.navDrawerMain}"><ul class="d-main">${links(i.main, false)}</ul></nav>
      <nav aria-label="${t.navDrawerSub}"><ul class="d-sub">${links(i.sub, false)}</ul></nav>
      ${hot}
    </div></div>`;
  return `${top}${header}${drawer}`;
}

/** Cụm nút nổi góc phải dưới: về đầu trang · Zalo · Messenger · Gọi (V31–V32). */
export function buildFabsHtml(i: WfShellInput): string {
  const t = T[i.locale];
  const phoneShown = i.phone?.text ?? '';
  const toTop = `<a class="fab to-top" href="#top" aria-label="${t.toTop}" title="${t.toTop}" data-testid="back-to-top">${icon('arrow-up', { size: 26, strokeWidth: 2, className: 'ico' })}</a>`;
  const zalo = i.zaloHref
    ? `<a class="fab fab-zalo floating-circle-btn" href="${esc(i.zaloHref)}" target="_blank" rel="noopener noreferrer" aria-label="${t.zaloAria}${phoneShown ? ` ${esc(phoneShown)}` : ''} ${t.newTab}" title="${t.zaloTitle}" data-testid="fab-zalo">${zaloMark({ size: 36 })}</a>`
    : '';
  const msg = i.messengerHref
    ? `<a class="fab fab-msg floating-circle-btn" href="${esc(i.messengerHref)}" target="_blank" rel="noopener noreferrer" aria-label="${t.msgAria}" title="${t.msgTitle}" data-testid="fab-messenger">${brandMark('messenger')}</a>`
    : '';
  const tel = i.phone
    ? `<a class="fab fab-tel floating-circle-btn" href="${esc(i.phone.href)}" aria-label="${t.call} ${esc(phoneShown)}" title="${t.call} ${esc(phoneShown)}" data-testid="fab-call">${icon('phone', { size: 26, strokeWidth: 2, className: 'ico' })}</a>`
    : '';
  return `<div class="fabs floating-contact-group" role="group" aria-label="${t.quick}" data-testid="floating-contact">${toTop}${zalo}${msg}${tel}</div>`;
}

/** Script nội tuyến: ngăn kéo (khoá cuộn, bẫy Tab, Esc), nút về đầu trang, viên trượt đổi ngôn ngữ (V34). Không gọi mạng. */
export const WF_SCRIPT = `<script>
(function(){
var d=document,btn=d.getElementById('menu-btn'),dr=d.getElementById('drawer');
if(btn&&dr){var panel=dr.querySelector('.drawer-panel'),closeB=d.getElementById('menu-close'),bg=dr.querySelector('.drawer-bg'),rm=matchMedia('(prefers-reduced-motion: reduce)'),t;
function onKey(e){if(e.key==='Escape'){e.preventDefault();close(true);return}
if(e.key==='Tab'){var f=panel.querySelectorAll('a[href],button'),a=f[0],z=f[f.length-1];
if(e.shiftKey&&d.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&d.activeElement===z){e.preventDefault();a.focus()}}}
function open(){clearTimeout(t);dr.hidden=false;void dr.offsetWidth;dr.classList.add('open');btn.setAttribute('aria-expanded','true');d.body.style.overflow='hidden';var f=panel.querySelector('.d-main a');if(f)f.focus();d.addEventListener('keydown',onKey)}
function close(refocus){if(dr.hidden)return;dr.classList.remove('open');btn.setAttribute('aria-expanded','false');d.body.style.overflow='';d.removeEventListener('keydown',onKey);t=setTimeout(function(){dr.hidden=true},rm.matches?0:200);if(refocus)btn.focus()}
btn.addEventListener('click',open);closeB.addEventListener('click',function(){close(true)});bg.addEventListener('click',function(){close(true)});
panel.addEventListener('click',function(e){if(e.target.closest('a'))close(false)});
var wide=matchMedia('(min-width:1200px)');function h(m){if(m.matches)close(false)}
if(wide.addEventListener)wide.addEventListener('change',h);else wide.addListener(h)}
var b=d.querySelector('.to-top'),f=d.querySelector('footer.ft');
if(b){if(!f||!('IntersectionObserver' in window)){b.classList.add('on')}else{new IntersectionObserver(function(e){var x=e[0];b.classList.toggle('on',x.isIntersecting||x.boundingClientRect.top<0)}).observe(f)}}
var n=d.querySelector('nav.lang'),p=n&&n.querySelector('.lang-pill');
if(p){var put=function(a){p.style.setProperty('--pill-x',a.offsetLeft+'px');p.style.width=a.offsetWidth+'px'};
var cur=function(){return n.querySelector('a[aria-current="true"]')};if(cur())put(cur());
n.addEventListener('click',function(e){var a=e.target.closest('a');if(!a||a===cur()||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;e.preventDefault();
var href=a.href,go=function(){location.href=href};put(a);if(matchMedia('(prefers-reduced-motion: reduce)').matches)go();else setTimeout(go,320)})}
})();
</script>`;

export const WF_CSS = `
/* ===== Khung wireframe v0.3.8 (V26/V27): token, header, ngăn kéo, nút, hero, khối chung ===== */
:root {
  --g800: #27673C; --ink: #14221B; --muted: #4A5A52; --paper: #FFFFFF; --leaf2: #A4B93A;
  --line: #D5DED7; --grad: linear-gradient(118deg, #0F5838 0%, #244999 100%);
  --ease-out-expo: cubic-bezier(.16, 1, .3, 1); --ease-snappy: cubic-bezier(.22, 1, .36, 1); --ease-spring: cubic-bezier(.34, 1.56, .64, 1);
  --shadow: 0 1px 2px rgba(15, 88, 56, .08), 0 10px 24px -10px rgba(15, 88, 56, .22), 0 28px 56px -28px rgba(36, 73, 153, .3);
  --max: 1200px; color-scheme: light;
}
@media (min-width: 1024px) { :root { --pad: 32px; } }
html { scroll-behavior: smooth; scroll-padding-top: 88px; scrollbar-color: var(--g900) var(--mist); scrollbar-width: thin; }
body { font-size: 17px; line-height: 1.65; color: var(--ink); overflow-x: clip; }
::selection { background: var(--b600); color: #fff; }
.hero :focus-visible, .top :focus-visible { outline-color: #fff !important; }
.ico { width: 20px; height: 20px; flex: none; }
.brand, .more, .dg-notes a, .cta-act .alt, .news, .lang a, .fab, .d-main a, .d-sub a, .d-hot a, .close-btn, .menu-btn, .top a, .nav a { padding: 0; }
.hero p, .sec p, .ft p, .err p, .art p { margin: 0; }
.hero li, .sec li, .ft li, .top li, .nav li, .drawer li, .crumb li { margin: 0; }
.hero h1, .hero h2, .sec h1, .sec h2, .sec h3, .err h1, .err h2, .ft h2, .art h1 { margin: 0; }
.hero ul, .sec ul, .sec ol, .ft ul, .top ul, .nav ul, .drawer ul, .crumb ol { margin: 0; padding: 0; }
.on-dark, .hero { color: #fff; }
.on-dark h1, .on-dark h2, .on-dark h3, .hero h1, .hero h2 { color: inherit; }
.on-dark a, .hero a { color: inherit; }

.slot { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 2px 10px; border: 1.5px dashed #6B7A72; border-radius: 8px; background: #fff; color: var(--muted); font-size: 14px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }

/* Thanh trên (≥ 1200px) */
.top { display: none; background: var(--g900); color: #fff; font-size: 15px; }
.top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.top a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 6px; color: #fff; text-decoration: none; transform-origin: center; transition: transform .16s var(--ease-spring); }
.top a .ico { width: 18px; height: 18px; }
.top ul { display: flex; list-style: none; gap: 8px; }
@media (min-width: 1200px) { .top { display: block; } }

/* Header */
.hdr { position: sticky; top: 0; z-index: 50; background: rgba(255, 255, 255, .97); border-bottom: 1px solid var(--line); }
.hdr .wrap { display: flex; align-items: center; gap: 12px; min-height: 72px; }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--g900); min-height: 44px; }
.logo-gms { display: block; height: 34px; width: auto; aspect-ratio: 1930/520; flex: none; }
.nav { display: none; margin-left: auto; }
.nav ul { display: flex; list-style: none; gap: 2px; }
.nav a { display: flex; align-items: center; min-height: 48px; padding: 0 9px; font-size: 15px; font-weight: 500; color: var(--ink); text-decoration: none; white-space: nowrap; text-underline-offset: 9px; transition: transform .16s var(--ease-spring); }
.nav a[aria-current="page"], .drawer a[aria-current="page"] { font-weight: 700; color: var(--g900); text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 9px; }
.hdr-end { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.lang { position: relative; display: inline-flex; align-items: center; gap: 2px; height: 44px; border: 1px solid var(--line); border-radius: 999px; background: #fff; padding: 3px; }
.lang a { position: relative; z-index: 1; display: inline-grid; place-items: center; min-width: 44px; height: 36px; border-radius: 999px; text-decoration: none; transition: transform .16s var(--ease-spring), background-color .16s ease; }
.lang a[aria-current="true"] { background: var(--g900) linear-gradient(120deg, #A4B93A 0%, #40773F 50%, #1C70B8 100%); }
.lang a::after { content: ""; position: absolute; inset: -4px -1px; }
.lang-pill { display: none; position: absolute; top: 3px; left: 0; width: 44px; height: 36px; border-radius: 999px; background: var(--g900) linear-gradient(120deg, #A4B93A 0%, #40773F 50%, #1C70B8 100%); pointer-events: none; transform: translateX(var(--pill-x, 3px)); transition: transform .32s var(--ease-spring), width .2s ease; }
.js .lang-pill { display: block; }
.js .lang a[aria-current="true"] { background: transparent; }
.lang .flag { display: block; width: 24px; height: 16px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .08); }
.menu-btn { white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; min-width: 44px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--g900); color: #fff; font: 600 15px/1 var(--font); cursor: pointer; transition: transform .16s var(--ease-spring); }
.menu-btn .ico { width: 24px; height: 24px; }
@media (max-width: 479px) { .menu-btn .t { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); } }
@media (min-width: 480px) { .menu-btn { padding: 0 18px; } }
@media (min-width: 1200px) { .nav { display: block; } .menu-btn { display: none; } .hdr-end { margin-left: 8px; } }

/* Ngăn kéo */
.drawer { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: flex-end; }
.drawer[hidden] { display: none; }
.drawer-bg { position: absolute; inset: 0; background: rgba(8, 28, 20, .55); opacity: 0; transition: opacity .2s var(--ease-snappy); }
.drawer-panel { position: relative; width: min(400px, 100%); height: 100%; overflow-y: auto; background: #fff; padding: 12px 20px 32px; display: flex; flex-direction: column; gap: 24px; transform: translateX(100%); transition: transform .2s var(--ease-out-expo); box-shadow: -24px 0 48px -24px rgba(15, 88, 56, .4); }
.drawer.open .drawer-bg { opacity: 1; }
.drawer.open .drawer-panel { transform: none; }
.drawer-top { display: flex; align-items: center; justify-content: space-between; min-height: 56px; border-bottom: 1px solid var(--line); }
.drawer-top span { font-weight: 800; font-size: 20px; color: var(--g900); }
.close-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: 1.5px solid var(--g900); border-radius: 999px; background: #fff; color: var(--g900); font: 600 15px/1 var(--font); cursor: pointer; transition: transform .16s var(--ease-spring); }
.close-btn .ico { width: 18px; height: 18px; }
.drawer ul { list-style: none; }
.d-main a { display: flex; align-items: center; min-height: 52px; font-size: 19px; font-weight: 600; color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--line); text-underline-offset: 8px; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.d-sub { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0 16px; }
.d-sub a { display: flex; align-items: center; min-height: 44px; font-size: 16px; color: var(--muted); text-decoration: none; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.d-hot { display: grid; gap: 4px; padding: 16px; border-radius: 14px; background: var(--mist); }
.d-hot span { font-size: 15px; color: var(--muted); }
.d-hot a { display: inline-flex; align-items: center; gap: 10px; min-height: 48px; font-size: 24px; font-weight: 800; color: var(--g900); text-decoration: none; font-variant-numeric: tabular-nums; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.d-hot .ico { width: 24px; height: 24px; }

/* Nút (V28: bóng loáng; V25: hover chỉ phóng to) */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 0 24px; border: 0; border-radius: 999px; font: 700 16px/1.2 var(--font); text-decoration: none; position: relative; cursor: pointer; transition: transform .16s var(--ease-spring); overflow: hidden; isolation: isolate; box-shadow: none; }
.btn .ico, .btn > svg { width: 18px; height: 18px; }
.btn-light { background: #fff; color: var(--g900); box-shadow: 0 12px 28px -12px rgba(0, 0, 0, .45), inset 0 1px 0 0 rgba(255, 255, 255, .18); }
.btn-ghost { color: #fff; border: 2px solid #fff; background: transparent; }
.btn-primary { background: var(--g800); color: #fff; }
.btn-outline { background: #fff; color: var(--g900); border: 1.5px solid var(--g900); }
.btn::before { content: ""; position: absolute; top: -25%; bottom: -25%; left: 0; width: 45%; z-index: -1; pointer-events: none; opacity: 0; transform: translateX(-120%) skewX(-20deg); background: linear-gradient(90deg, rgba(164, 185, 58, 0) 0%, rgba(164, 185, 58, .75) 22%, rgba(255, 255, 255, .95) 50%, rgba(28, 112, 184, .75) 78%, rgba(28, 112, 184, 0) 100%); }
@keyframes gms-gloss { 0% { opacity: 1; transform: translateX(-120%) skewX(-20deg); } 100% { opacity: 1; transform: translateX(330%) skewX(-20deg); } }
@media (prefers-reduced-motion: no-preference) {
  .btn:hover::before, .btn:focus-visible::before, .btn:active::before { animation: gms-gloss .85s cubic-bezier(.3, .7, .3, 1); }
}

/* Hero */
.hero { position: relative; overflow: clip; background: var(--grad); color: #fff; padding: 48px 0 96px; }
.hero::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 45px; background: var(--after-hero, var(--paper)); clip-path: polygon(100% 0, 100% 100%, 0 100%); pointer-events: none; }
.hero-streaks { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; pointer-events: none; }
.hero .wrap { position: relative; display: grid; gap: 40px; align-items: center; }
@media (min-width: 1024px) { .hero { padding: 80px 0 136px; } .hero .wrap { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 48px; } }
.kicker { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 16px; font-weight: 600; margin: 0 0 20px; }
.kicker::before { content: ""; width: 28px; height: 3px; border-radius: 3px; background: var(--leaf2); }
.hero h1 { font-size: clamp(32px, 4.2vw + 14px, 50px); font-weight: 800; line-height: 1.18; letter-spacing: -.01em; }
.hero h1 .ln { display: block; overflow: hidden; padding-block: .1em; margin-block: -.1em; }
.hero h1 .ln > span { display: block; }
.js .hero h1 .ln > span { animation: rise 1s var(--ease-out-expo) both; }
.js .hero h1 .ln:nth-child(2) > span { animation-delay: .12s; }
.js .hero .fade { animation: fadeUp .9s var(--ease-out-expo) .35s both; }
.js .hero .fade2 { animation: fadeUp .9s var(--ease-out-expo) .5s both; }
@keyframes rise { from { transform: translateY(105%); } to { transform: none; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.hero-lead { font-size: 18px; max-width: 34em; margin-top: 20px !important; }
.hero-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
@media (max-width: 400px) { .hero-cta .btn { width: 100%; } }
.hero-art { display: grid; gap: 14px; margin: 0; }
.art-box { position: relative; aspect-ratio: 4/3; border-radius: 20px; background: rgba(255, 255, 255, .05); box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, .18), 0 30px 60px -30px rgba(0, 0, 0, .5); overflow: hidden; }
.art-box > img { width: 100%; height: 100%; object-fit: cover; }
.cap { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 15px; margin: 0; color: inherit; font-weight: 400; }
.pill { position: absolute; left: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 8px; min-height: 30px; padding: 2px 12px; border-radius: 999px; background: var(--g900); border: 1px solid rgba(255, 255, 255, .6); color: #fff; font-size: 14px; font-weight: 700; white-space: nowrap; }
.pill::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--leaf2); }
/* Đầu trang con: thấp hơn trang chủ, một cột (news-list.html / technology.html) */
.hero-sub { padding: 32px 0 72px; }
.hero-sub .wrap { display: block; }
.hero-sub::after { height: 37px; }
.hero-sub h1 { font-size: clamp(28px, 2.6vw + 18px, 44px); line-height: 1.2; overflow-wrap: anywhere; }
.hero-sub .hero-lead { margin-top: 16px !important; }
@media (min-width: 1024px) { .hero-sub { padding: 48px 0 96px; } }
.js .hero-sub .fade { animation: fadeUp .3s cubic-bezier(.2, .8, .2, 1) both; }
.crumb { margin-bottom: 20px; }
.crumb ol { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; list-style: none; font-size: 15px; }
.crumb li { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
.crumb a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; color: inherit; text-underline-offset: 4px; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.crumb .ico { width: 16px; height: 16px; opacity: .8; }
.crumb [aria-current="page"] { font-weight: 700; padding: 0 4px; overflow-wrap: anywhere; }

/* Khối chung */
.sec { padding: 72px 0; }
@media (min-width: 1024px) { .sec { padding: 104px 0; } }
.sec-head { display: grid; gap: 14px; max-width: 760px; margin-bottom: 40px; }
.sec-head h2 { font-size: clamp(28px, 2.2vw + 20px, 44px); font-weight: 800; color: var(--g900); }
.sec-head p { font-size: 18px; color: var(--muted); }
.on-dark .sec-head h2, .on-dark .sec-head p { color: #fff; }
main { padding: 0; }
main:focus { outline: none; }
.legacy { padding-block: 40px 72px; }

/* Sơ đồ hai nhánh */
.board { position: relative; overflow: clip; border-radius: 24px; background: var(--g900); color: #fff; padding: 24px 16px 28px; box-shadow: var(--shadow); }
.board::before { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, .18); pointer-events: none; }
.dg { display: block; }
.dg-conn { display: none; }
.node { border: 1px solid rgba(255, 255, 255, .3); border-radius: 14px; padding: 12px 16px; }
.n-in { background: var(--g800); }
.n-in strong { display: block; font-size: 20px; line-height: 1.3; }
.n-in span { display: block; font-size: 15px; margin-top: 4px; }
.n-br { position: relative; height: 64px; display: flex; flex-direction: column; justify-content: center; padding: 8px 16px; background: var(--b800); border-color: rgba(255, 255, 255, .4); }
.n-br span { font-size: 14px; line-height: 1.3; }
.n-br strong { font-size: 19px; line-height: 1.3; }
.grp { position: relative; padding: 28px 0 0 24px; }
.grp::before { content: ""; position: absolute; left: 10px; top: 0; bottom: 0; width: 2px; background: rgba(255, 255, 255, .35); }
.grp2::before { bottom: auto; height: 60px; }
.n-br::before { content: ""; position: absolute; left: -15px; top: 31px; width: 14px; height: 2px; background: rgba(255, 255, 255, .35); }
.o-list { list-style: none; position: relative; padding: 12px 0 0 20px; display: grid; gap: 10px; }
.o-list::before { content: ""; position: absolute; left: 8px; top: 0; bottom: 30px; width: 2px; background: rgba(255, 255, 255, .35); }
.o { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 10px 14px; border: 1px solid rgba(255, 255, 255, .28); border-radius: 12px; box-shadow: inset 3px 0 0 0 var(--leaf2); }
.o::before { content: ""; position: absolute; left: -12px; top: 50%; width: 12px; height: 2px; background: rgba(255, 255, 255, .35); }
.o::after { content: ""; position: absolute; left: -14px; top: calc(50% - 3px); width: 8px; height: 8px; border-radius: 50%; background: var(--leaf2); opacity: 0; animation: tick 1.8s var(--ease-out-expo) infinite; }
.o:nth-child(2)::after { animation-delay: .3s; } .o:nth-child(3)::after { animation-delay: .6s; }
@keyframes tick { 0% { opacity: 0; transform: translate(0, -1px); } 30% { opacity: 1; } 80% { opacity: 1; transform: translate(12px, -1px); } 100% { opacity: 0; transform: translate(12px, -1px); } }
.o-name { font-size: 18px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.tag { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, .6); font-size: 14px; font-weight: 600; line-height: 1; }
.rail { fill: none; stroke: rgba(255, 255, 255, .32); stroke-width: 2; vector-effect: non-scaling-stroke; }
.flow { fill: none; stroke: var(--leaf2); stroke-width: 5; stroke-linecap: round; stroke-dasharray: 0 18; animation: flow 1.5s linear infinite; transition: opacity .6s var(--ease-out-expo); }
.flow.soft { stroke-width: 4; opacity: .75; animation-duration: 2.2s; }
.flow:nth-of-type(2n) { animation-delay: -.5s; } .flow:nth-of-type(3n) { animation-delay: -1s; }
@keyframes flow { to { stroke-dashoffset: -18; } }
@keyframes blink { 50% { opacity: .25; } }
.end { fill: var(--leaf2); animation: blink 1.8s ease-in-out infinite; }
.js .board .rail { stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 1s var(--ease-out-expo); }
.js .board .conn-b .rail { transition-delay: .45s; }
.js .board .flow, .js .board .end { opacity: 0; transition: opacity .8s var(--ease-out-expo) 1.1s; }
.js .board.live .rail { stroke-dashoffset: 0; }
.js .board.live .flow { opacity: 1; } .js .board.live .flow.soft { opacity: .75; }
.js .board.live .end { opacity: 1; }
@media (min-width: 1024px) {
  .board { padding: 40px; }
  .dg { display: grid; grid-template-columns: minmax(0, 1fr) 80px minmax(0, 1fr) 96px minmax(0, 1.5fr); grid-template-rows: 300px 32px 300px; }
  .grp { display: contents; }
  .grp::before, .n-br::before, .o::before, .o::after, .o-list::before { content: none; }
  .n-in { grid-column: 1; grid-row: 1/4; align-self: center; }
  .dg-conn { display: block; grid-row: 1/4; width: 100%; height: 632px; max-width: none; overflow: visible; }
  .conn-a { grid-column: 2; } .conn-b { grid-column: 4; }
  .b1 { grid-column: 3; grid-row: 1; align-self: center; }
  .b2 { grid-column: 3; grid-row: 3; align-self: center; }
  .o1 { grid-column: 5; grid-row: 1; } .o2 { grid-column: 5; grid-row: 3; }
  .o-list { padding: 0; grid-template-rows: repeat(3, 92px); gap: 12px; }
  .o { height: 92px; align-content: center; padding: 8px 16px; }
}
.dg-notes { display: grid; gap: 20px; margin-top: 32px; font-weight: 400; color: var(--ink); font-size: 17px; }
@media (min-width: 768px) { .dg-notes { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px; } }
.dg-notes > div { border-top: 3px solid var(--g900); padding-top: 14px; }
.dg-notes > div:nth-child(2) { border-color: var(--b800); }
.dg-notes > div:nth-child(3) { border-color: var(--line); }
.dg-notes h3 { font-size: 19px; color: var(--g900); margin: 0 0 6px; }
.dg-notes > div:nth-child(2) h3 { color: var(--b800); }
.dg-notes p { color: var(--muted); font-size: 16px; }
.dg-notes a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 4px; font-weight: 700; color: var(--g900); text-underline-offset: 5px; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.dg-notes a .ico { width: 18px; height: 18px; }

/* Hành trình (V40: cả 5 bước "đã xong") */
.sec-journey { background: var(--b800); }
.j-steps { list-style: none; display: grid; gap: 0; }
.j-step { position: relative; padding: 0 0 28px 36px; }
.j-step::before { content: ""; position: absolute; left: 9px; top: 10px; bottom: -10px; border-left: 3px dashed rgba(255, 255, 255, .45); }
.j-step.now::before { border-left-style: solid; border-color: var(--leaf2); }
.j-step:last-child::before { display: none; }
.j-step::after { content: ""; position: absolute; left: 2px; top: 6px; width: 17px; height: 17px; border-radius: 50%; background: var(--b800); border: 3px solid rgba(255, 255, 255, .7); }
.j-step.now::after { background: var(--leaf2); border-color: var(--leaf2); }
.step-n { display: block; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; margin-bottom: 2px; }
.j-step h3 { font-size: 20px; font-weight: 700; margin: 0; }
.j-step p { font-size: 16px; margin-top: 6px; max-width: 30em; }
.badge-status { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; min-height: 28px; padding: 2px 12px; border-radius: 999px; font-size: .9rem; font-weight: 700; line-height: 1.2; white-space: nowrap; }
.badge-status svg { width: 14px; height: 14px; flex: none; }
.badge-status--done { background: var(--g900); color: #fff; border: 2px solid var(--g900); box-shadow: 0 0 0 1px rgba(255, 255, 255, .7); }
@media (min-width: 1024px) {
  .j-steps { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 24px; }
  .j-step { padding: 36px 0 0; }
  .j-step::before { left: 0; right: -24px; top: 8px; bottom: auto; border-left: 0; border-top: 3px dashed rgba(255, 255, 255, .45); }
  .j-step.now::before { border-top-style: solid; border-color: var(--leaf2); }
  .j-step:last-child::before { display: block; right: 0; }
  .j-step::after { left: 0; top: 0; }
}
.pair { display: grid; gap: 16px; margin-top: 56px; align-items: start; }
@media (min-width: 768px) { .pair { grid-template-columns: minmax(0, 1fr) 56px minmax(0, 1fr); gap: 0; } }
.frame { display: grid; gap: 14px; margin: 0; }
.frame-img { position: relative; aspect-ratio: 4/3; border-radius: 18px; overflow: hidden; box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, .18), 0 24px 48px -28px rgba(0, 0, 0, .6); }
.frame-img > img { width: 100%; height: 100%; object-fit: cover; }
.frame .cap { font-size: 16px; }
.pill-plain { display: inline-flex; align-items: center; min-height: 30px; padding: 2px 12px; border-radius: 999px; border: 1px dashed #fff; font-size: 14px; font-weight: 700; white-space: nowrap; }
.pair-arrow { display: grid; place-items: center; height: 48px; color: var(--leaf2); }
.pair-arrow svg { width: 40px; height: 40px; transform: rotate(90deg); }
@media (min-width: 768px) { .pair-arrow { height: auto; align-self: stretch; padding-bottom: 48px; } .pair-arrow svg { transform: none; } }

/* Giá trị (bento) */
.sec-values { background: var(--g900); }
.bento { list-style: none; display: grid; gap: 16px; }
@media (min-width: 640px) { .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); } .v1, .v4 { grid-column: span 2; } }
@media (min-width: 1024px) { .bento { grid-template-columns: repeat(3, minmax(0, 1fr)); } .v1 { grid-column: span 2; } .v4 { grid-column: 2/span 2; } }
.val { position: relative; border: 1px solid rgba(255, 255, 255, .3); border-radius: 20px; padding: 28px 24px; display: grid; gap: 12px; align-content: start; box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, .18); }
.val .vi { width: 48px; height: 48px; color: var(--leaf2); stroke-width: 1.8; }
.val h3 { font-size: 22px; font-weight: 700; margin: 0; }
.val p { font-size: 17px; max-width: 36em; }
@media (min-width: 1024px) {
  .v1 { grid-template-columns: auto minmax(0, 1fr); column-gap: 28px; padding: 40px; }
  .v1 .vi { width: 72px; height: 72px; grid-row: span 2; }
  .v1 h3 { font-size: 28px; }
  .v4 { grid-template-columns: auto minmax(0, 1fr); column-gap: 24px; }
  .v4 .vi { grid-row: span 2; }
}

/* Tin mới nhất */
.news-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 12px 24px; margin-bottom: 32px; }
.news-head h2 { font-size: clamp(28px, 2.2vw + 20px, 44px); font-weight: 800; color: var(--g900); }
.more { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 700; color: var(--g900); text-underline-offset: 6px; transform-origin: left center; transition: transform .16s var(--ease-spring); }
.more .ico { width: 18px; height: 18px; }
.news-grid { list-style: none; display: grid; gap: 20px; }
@media (min-width: 900px) { .news-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.news { display: grid; grid-template-rows: auto 1fr; height: 100%; text-decoration: none; color: var(--ink); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; background: #fff; box-shadow: var(--shadow); transition: transform .16s var(--ease-spring); }
.thumb { aspect-ratio: 16/10; display: grid; place-items: center; background: repeating-linear-gradient(135deg, #E3ECE5 0 12px, #F2F6F1 12px 24px); }
.news-grid li:nth-child(2) .thumb { background: repeating-linear-gradient(135deg, #E1E8F3 0 12px, #F1F4F9 12px 24px); }
.thumb .ico { width: 48px; height: 48px; color: #6B7A72; stroke-width: 1.5; }
.thumb > img { width: 100%; height: 100%; object-fit: cover; }
.news-body { display: grid; gap: 10px; align-content: start; padding: 20px; }
.series { justify-self: start; display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; border: 1.5px solid var(--g900); color: var(--g900); font-size: 14px; font-weight: 700; }
.news h3 { font-size: 19px; font-weight: 700; color: var(--ink); margin: 0; }
.news time, .news .date { font-size: 15px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* Lời mời liên hệ */
.sec-cta { position: relative; overflow: clip; background: var(--grad); }
.sec-cta .wrap { position: relative; display: grid; gap: 28px; align-items: center; }
@media (min-width: 1024px) { .sec-cta .wrap { grid-template-columns: minmax(0, 1.4fr) auto; } }
.sec-cta h2 { font-size: clamp(28px, 2.2vw + 20px, 44px); font-weight: 800; }
.sec-cta p { font-size: 19px; margin-top: 12px; max-width: 34em; }
.cta-act { display: grid; gap: 12px; justify-items: start; }
.cta-act .alt { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; font-weight: 600; text-underline-offset: 5px; font-variant-numeric: tabular-nums; transform-origin: left center; transition: transform .16s var(--ease-spring); }

/* Trang lỗi 404 / 5xx */
.err { padding: 72px 0 96px; background: var(--mist); }
.col { max-width: 760px; margin-inline: auto; }
.err .col { display: grid; gap: 16px; justify-items: start; }
.err .ico-lg { width: 48px; height: 48px; color: var(--g900); }
.err h1, .err .err-title { font-size: clamp(28px, 2.2vw + 20px, 40px); font-weight: 800; color: var(--g900); }
.err p { font-size: 18px; max-width: 34em; }
.err-act { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }

/* Cụm nút nổi (V31–V32) */
.fabs { position: fixed; right: 16px; bottom: 16px; z-index: 70; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.fab { position: relative; display: grid; place-items: center; width: 52px; height: 52px; min-width: 52px; border-radius: 999px; color: #fff; text-decoration: none; overflow: hidden; isolation: isolate; box-shadow: 0 8px 20px rgba(20, 34, 27, .22); transition: transform .24s var(--ease-spring); }
.fab .ico { width: 26px; height: 26px; stroke-width: 2; }
.fab .zalo-mark { position: relative; width: 36px; height: 36px; }
.fab .brand-mark { position: relative; width: 28px; height: 28px; fill: #fff; }
.fab-zalo { background: #0068FF; }
.fab-msg { background: #0099FF linear-gradient(45deg, #0099FF 0%, #A033FF 60%, #FF5280 90%, #FF7061 100%); }
.fab-tel { background: var(--g900); }
.to-top { background: #40773F; }
.js .to-top:not(.on) { display: none; }
@keyframes fab-in { from { opacity: 0; transform: translateY(10px) scale(.8); } to { opacity: 1; transform: none; } }
.fab:focus-visible { outline: 3px solid var(--b600) !important; outline-offset: 3px !important; }
.fab::before { content: ""; position: absolute; top: -25%; bottom: -25%; left: 0; width: 55%; z-index: 2; pointer-events: none; opacity: 0; transform: translateX(-120%) skewX(-20deg); background: linear-gradient(90deg, rgba(164, 185, 58, 0) 0%, rgba(164, 185, 58, .9) 22%, rgba(255, 255, 255, .9) 50%, rgba(28, 112, 184, .9) 78%, rgba(28, 112, 184, 0) 100%); }
@keyframes fab-gloss-idle { 0% { opacity: 1; transform: translateX(-120%) skewX(-20deg); } 14%, 100% { opacity: 1; transform: translateX(330%) skewX(-20deg); } }
@media (prefers-reduced-motion: no-preference) {
  .to-top.on { animation: fab-in .28s var(--ease-spring); }
  .fab-zalo::before, .fab-msg::before, .fab-tel::before { animation: fab-gloss-idle 6s cubic-bezier(.3, .7, .3, 1) 1.5s infinite; }
  .fab-msg::before { animation-delay: 1.75s; }
  .fab-tel::before { animation-delay: 2s; }
  .fab:hover::before, .fab:focus-visible::before, .fab:active::before { animation: gms-gloss .85s cubic-bezier(.3, .7, .3, 1); }
}
@media (min-width: 900px) { .fabs { right: 24px; bottom: 24px; gap: 12px; } .fab { width: 56px; height: 56px; } }

/* Hover V25: CHỈ phóng to; không đổi màu/viền/gạch chân/bóng. Chỉ máy có chuột, không reduced-motion */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .btn:hover, .menu-btn:hover, .close-btn:hover, .lang a:hover { transform: scale(1.08); }
  .nav a:hover, .top a:hover, .d-main a:hover, .d-sub a:hover, .d-hot a:hover, .more:hover, .dg-notes a:hover, .cta-act .alt:hover, .crumb a:hover { transform: scale(1.05); }
  .news:hover { transform: scale(1.03); }
  .fab:hover { transform: scale(1.08); }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .flow, .end, .o::after { display: none; }
  .js .board .rail { stroke-dashoffset: 0; }
  .js .hero h1 .ln > span, .js .hero .fade, .js .hero .fade2 { animation: none !important; }
}
@media (forced-colors: active) { .badge-status { border-color: CanvasText; } }
`;
