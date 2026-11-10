// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShellBehavior } from '../../../src/components/site/ShellBehavior.tsx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HTML = `
<button id="menu-btn" aria-expanded="false">Menu</button>
<div id="drawer" hidden>
  <div class="drawer-bg"></div>
  <div class="drawer-panel">
    <button id="menu-close">Đóng</button>
    <div class="d-main"><a href="/a">A</a><a href="/b">B</a></div>
  </div>
</div>
<nav class="lang"><span class="lang-pill"></span><a href="/vi/" aria-current="true">VI</a><a href="/en/">EN</a></nav>
<div class="board" id="b1"></div>
<a class="to-top" href="#top">Lên</a>
<footer class="ft"></footer>
<div id="react-host"></div>`;

type MQ = { matches: boolean; listeners: Array<(e: { matches: boolean }) => void> };
let mqs: Record<string, MQ>;
let ioInstances: Array<{ cb: (e: unknown[]) => void; observed: unknown[]; disconnect: ReturnType<typeof vi.fn> }>;
let root: Root;

function setupMedia(reduced: boolean) {
  mqs = {
    reduce: { matches: reduced, listeners: [] },
    wide: { matches: false, listeners: [] },
  };
  vi.stubGlobal('matchMedia', (q: string) => {
    const m = q.includes('reduced-motion') ? mqs.reduce : mqs.wide;
    return {
      get matches() {
        return m.matches;
      },
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => m.listeners.push(fn),
      removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        m.listeners = m.listeners.filter((x) => x !== fn);
      },
    };
  });
}
function setupIO() {
  ioInstances = [];
  class IO {
    cb: (e: unknown[]) => void;
    observed: unknown[] = [];
    disconnect = vi.fn();
    constructor(cb: (e: unknown[]) => void) {
      this.cb = cb;
      ioInstances.push(this);
    }
    observe(el: unknown) {
      this.observed.push(el);
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
}
async function mount() {
  root = createRoot(document.getElementById('react-host') as HTMLElement);
  await act(async () => root.render(createElement(ShellBehavior)));
}
const $ = (s: string) => document.querySelector(s) as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = HTML;
  document.documentElement.className = '';
  document.body.style.overflow = '';
  setupMedia(false);
  setupIO();
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ShellBehavior: ngăn kéo', () => {
  it('thêm class js; mở ngăn kéo khoá cuộn, focus link đầu, aria-expanded', async () => {
    await mount();
    expect(document.documentElement.classList.contains('js')).toBe(true);
    await act(async () => $('#menu-btn').click());
    expect($('#drawer').hidden).toBe(false);
    expect($('#drawer').classList.contains('open')).toBe(true);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.getAttribute('href')).toBe('/a');
  });

  it('nút đóng: trả focus nút menu, mở khoá cuộn, ẩn sau 200ms (không giảm chuyển động)', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    await act(async () => $('#menu-close').click());
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('false');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement?.id).toBe('menu-btn');
    expect($('#drawer').hidden).toBe(false);
    vi.advanceTimersByTime(199);
    expect($('#drawer').hidden).toBe(false);
    vi.advanceTimersByTime(1);
    expect($('#drawer').hidden).toBe(true);
  });

  it('giảm chuyển động: ẩn ngay (timer 0)', async () => {
    mqs.reduce.matches = true;
    await mount();
    await act(async () => $('#menu-btn').click());
    await act(async () => $('.drawer-bg').click());
    vi.advanceTimersByTime(0);
    expect($('#drawer').hidden).toBe(true);
  });

  it('Esc đóng và trả focus; đóng khi đã ẩn thì không làm gì', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect(document.activeElement?.id).toBe('menu-btn');
    // sau khi gỡ listener, Esc không còn bị chặn
    const ev2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(false);
  });

  it('bẫy Tab: Tab ở phần tử cuối quay về đầu, Shift+Tab ở đầu nhảy về cuối', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    const els = $('.drawer-panel').querySelectorAll<HTMLElement>('a[href],button');
    const first = els[0];
    const last = els[els.length - 1];
    last.focus();
    const t1 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(t1);
    expect(t1.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const t2 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(t2);
    expect(t2.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // giữa chừng: không chặn
    els[1].focus();
    const t3 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(t3);
    expect(t3.defaultPrevented).toBe(false);
    const k = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    document.dispatchEvent(k);
    expect(k.defaultPrevented).toBe(false);
  });

  it('bấm link trong panel đóng ngăn kéo không cướp focus; bấm chỗ khác thì giữ mở', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    await act(async () => $('#menu-close').parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect($('#drawer').classList.contains('open')).toBe(true);
    await act(async () => ($('.d-main a') as HTMLElement).click());
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect(document.activeElement?.id).not.toBe('menu-btn');
  });

  it('chuyển sang màn rộng tự đóng ngăn kéo', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    for (const l of mqs.wide.listeners) l({ matches: false });
    expect($('#drawer').classList.contains('open')).toBe(true);
    for (const l of mqs.wide.listeners) l({ matches: true });
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('thiếu thành phần ngăn kéo: không lỗi', async () => {
    document.getElementById('menu-close')?.remove();
    await mount();
    await act(async () => $('#menu-btn').click());
    expect($('#drawer').hidden).toBe(true);
  });

  it('gỡ component dọn listener và trả overflow', async () => {
    await mount();
    await act(async () => $('#menu-btn').click());
    await act(async () => root.unmount());
    expect(document.body.style.overflow).toBe('');
    expect(mqs.wide.listeners.length).toBe(0);
    root = createRoot(document.getElementById('react-host') as HTMLElement);
  });
});

describe('ShellBehavior: nút về đầu trang', () => {
  it('hiện theo chân trang: giao nhau hoặc đã cuộn qua', async () => {
    await mount();
    const io = ioInstances.find((i) => i.observed.includes($('footer.ft'))) as (typeof ioInstances)[number];
    expect(io).toBeTruthy();
    io.cb([{ isIntersecting: false, boundingClientRect: { top: 500 } }]);
    expect($('.to-top').classList.contains('on')).toBe(false);
    io.cb([{ isIntersecting: true, boundingClientRect: { top: 500 } }]);
    expect($('.to-top').classList.contains('on')).toBe(true);
    io.cb([{ isIntersecting: false, boundingClientRect: { top: -10 } }]);
    expect($('.to-top').classList.contains('on')).toBe(true);
    io.cb([{ isIntersecting: false, boundingClientRect: { top: 10 } }]);
    expect($('.to-top').classList.contains('on')).toBe(false);
    io.cb([]);
    await act(async () => root.unmount());
    expect(io.disconnect).toHaveBeenCalled();
    root = createRoot(document.getElementById('react-host') as HTMLElement);
  });

  it('không có footer: hiện luôn', async () => {
    $('footer.ft').remove();
    await mount();
    expect($('.to-top').classList.contains('on')).toBe(true);
  });

  it('không có IntersectionObserver: nút hiện luôn và board live', async () => {
    vi.unstubAllGlobals();
    setupMedia(false);
    const saved = (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
    await mount();
    expect($('.to-top').classList.contains('on')).toBe(true);
    expect($('.board').classList.contains('live')).toBe(true);
    (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver = saved;
  });
});

describe('ShellBehavior: board', () => {
  it('cuộn tới (giao nhau) thì thêm live và ngắt quan sát; chưa tới thì chưa live', async () => {
    await mount();
    expect($('.board').classList.contains('live')).toBe(false);
    const io = ioInstances.find((i) => i.observed.includes($('.board'))) as (typeof ioInstances)[number];
    io.cb([{ isIntersecting: false }]);
    expect($('.board').classList.contains('live')).toBe(false);
    io.cb([{ isIntersecting: true }]);
    expect($('.board').classList.contains('live')).toBe(true);
    expect(io.disconnect).toHaveBeenCalled();
  });

  it('giảm chuyển động: board live ngay, không quan sát board', async () => {
    mqs.reduce.matches = true;
    await mount();
    expect($('.board').classList.contains('live')).toBe(true);
    expect(ioInstances.some((i) => i.observed.includes($('.board')))).toBe(false);
  });
});

describe('ShellBehavior: chuyển ngôn ngữ', () => {
  const links = () => document.querySelectorAll<HTMLAnchorElement>('nav.lang a');
  function stubLocation() {
    const loc = { href: 'http://localhost/vi/' };
    vi.stubGlobal('location', loc);
    return loc;
  }

  it('đặt pill theo ngôn ngữ hiện tại không animation rồi bật pill-on', async () => {
    const [vi_] = links();
    Object.defineProperty(vi_, 'offsetLeft', { value: 12, configurable: true });
    Object.defineProperty(vi_, 'offsetWidth', { value: 40, configurable: true });
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => fn());
    await mount();
    const pill = $('.lang-pill');
    expect(pill.style.getPropertyValue('--pill-x')).toBe('12px');
    expect(pill.style.width).toBe('40px');
    expect($('nav.lang').classList.contains('pill-on')).toBe(true);
    expect(pill.style.transition).toBe('');
  });

  it('trỏ vào ngôn ngữ khác: chèn link prefetch một lần; ngôn ngữ hiện tại thì không', async () => {
    await mount();
    const [cur, en] = links();
    await act(async () => {
      cur.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
      en.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
      en.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    });
    const pf = document.head.querySelectorAll('link[rel="prefetch"]');
    expect(pf.length).toBe(1);
    expect((pf[0] as HTMLLinkElement).href).toBe(en.href);
    pf[0].remove();
  });

  it('bấm ngôn ngữ khác: chặn mặc định, trượt pill rồi điều hướng sau 100ms', async () => {
    const loc = stubLocation();
    await mount();
    const [, en] = links();
    Object.defineProperty(en, 'offsetLeft', { value: 60, configurable: true });
    Object.defineProperty(en, 'offsetWidth', { value: 44, configurable: true });
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      en.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect($('.lang-pill').style.getPropertyValue('--pill-x')).toBe('60px');
    expect(loc.href).toBe('http://localhost/vi/');
    vi.advanceTimersByTime(99);
    expect(loc.href).toBe('http://localhost/vi/');
    vi.advanceTimersByTime(1);
    expect(loc.href).toBe(en.href);
  });

  it('giảm chuyển động: điều hướng ngay', async () => {
    mqs.reduce.matches = true;
    const loc = stubLocation();
    await mount();
    const [, en] = links();
    await act(async () => {
      en.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(loc.href).toBe(en.href);
  });

  it('bấm ngôn ngữ đang chọn: chặn mặc định, không điều hướng (không tải lại)', async () => {
    const loc = stubLocation();
    await mount();
    const [cur] = links();
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      cur.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(loc.href).toBe('http://localhost/vi/');
  });

  it('phím bổ trợ hoặc chuột giữa: để trình duyệt xử lý', async () => {
    const loc = stubLocation();
    await mount();
    const [, en] = links();
    const evs = [
      [en, { ctrlKey: true }],
      [en, { metaKey: true }],
      [en, { shiftKey: true }],
      [en, { button: 1 }],
    ] as const;
    for (const [a, init] of evs) {
      const ev = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
      await act(async () => {
        a.dispatchEvent(ev);
      });
      expect(ev.defaultPrevented).toBe(false);
    }
    // bấm vào phần không phải link
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      $('.lang-pill').dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(loc.href).toBe('http://localhost/vi/');
  });

  it('không có ngôn ngữ hiện tại: không bật pill-on', async () => {
    links()[0].removeAttribute('aria-current');
    await mount();
    expect($('nav.lang').classList.contains('pill-on')).toBe(false);
  });
});

describe('ShellBehavior: bấm liên kết trang đang xem', () => {
  function addLink(href: string) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = 'x';
    document.body.appendChild(a);
    return a;
  }
  const click = (a: HTMLElement, init: MouseEventInit = {}) => {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
    a.dispatchEvent(ev);
    return ev;
  };

  it('cùng đường dẫn, không #: chặn tải lại và cuộn về đầu', async () => {
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    await mount();
    const ev = click(addLink(location.pathname));
    expect(ev.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
  });

  it('trang khác, có #, hoặc có phím bổ trợ: để trình duyệt xử lý', async () => {
    vi.stubGlobal('scrollTo', vi.fn());
    await mount();
    expect(click(addLink('/trang-khac')).defaultPrevented).toBe(false);
    expect(click(addLink(`${location.pathname}#muc`)).defaultPrevented).toBe(false);
    expect(click(addLink(location.pathname), { metaKey: true }).defaultPrevented).toBe(false);
  });
});
