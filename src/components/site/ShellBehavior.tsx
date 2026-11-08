'use client';
// Hành vi khung trang (ux-spec V31–V34): ngăn kéo (khoá cuộn, bẫy Tab, Esc), nút về đầu trang chỉ hiện khi cuộn,
// viên trượt đổi ngôn ngữ. Không gọi mạng. Đứng sau markup đã prerender nên trang vẫn đọc/bấm được khi chưa có JS.
import { useEffect } from 'react';

export function ShellBehavior(): null {
  useEffect(() => {
    const d = document;
    d.documentElement.classList.add('js');
    const cleanups: Array<() => void> = [];

    const btn = d.getElementById('menu-btn');
    const dr = d.getElementById('drawer');
    const panel = dr?.querySelector<HTMLElement>('.drawer-panel');
    const closeB = d.getElementById('menu-close');
    const bg = dr?.querySelector<HTMLElement>('.drawer-bg');
    if (btn && dr && panel && closeB && bg) {
      const rm = matchMedia('(prefers-reduced-motion: reduce)');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(true);
          return;
        }
        if (e.key === 'Tab') {
          const f = panel.querySelectorAll<HTMLElement>('a[href],button');
          const first = f[0];
          const last = f[f.length - 1];
          if (e.shiftKey && d.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && d.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };
      const open = () => {
        clearTimeout(timer);
        dr.hidden = false;
        void dr.offsetWidth;
        dr.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        d.body.style.overflow = 'hidden';
        panel.querySelector<HTMLElement>('.d-main a')?.focus();
        d.addEventListener('keydown', onKey);
      };
      const close = (refocus: boolean) => {
        if (dr.hidden) return;
        dr.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        d.body.style.overflow = '';
        d.removeEventListener('keydown', onKey);
        timer = setTimeout(
          () => {
            dr.hidden = true;
          },
          rm.matches ? 0 : 200,
        );
        if (refocus) btn.focus();
      };
      const onOpen = () => open();
      const onClose = () => close(true);
      const onPanel = (e: Event) => {
        if ((e.target as HTMLElement).closest('a')) close(false);
      };
      btn.addEventListener('click', onOpen);
      closeB.addEventListener('click', onClose);
      bg.addEventListener('click', onClose);
      panel.addEventListener('click', onPanel);
      const wide = matchMedia('(min-width:1200px)');
      const onWide = (m: MediaQueryListEvent) => {
        if (m.matches) close(false);
      };
      wide.addEventListener('change', onWide);
      cleanups.push(() => {
        btn.removeEventListener('click', onOpen);
        closeB.removeEventListener('click', onClose);
        bg.removeEventListener('click', onClose);
        panel.removeEventListener('click', onPanel);
        wide.removeEventListener('change', onWide);
        d.removeEventListener('keydown', onKey);
        clearTimeout(timer);
        d.body.style.overflow = '';
      });
    }

    const toTop = d.querySelector<HTMLElement>('.to-top');
    const foot = d.querySelector('footer.ft');
    if (toTop) {
      if (!foot || !('IntersectionObserver' in window)) {
        toTop.classList.add('on');
      } else {
        const io = new IntersectionObserver((e) => {
          const x = e[0];
          if (x) toTop.classList.toggle('on', x.isIntersecting || x.boundingClientRect.top < 0);
        });
        io.observe(foot);
        cleanups.push(() => io.disconnect());
      }
    }

    // Sơ đồ dòng chảy (.board): vẽ đường nối + hiện nhãn khi cuộn tới (như wireframe). Không IO ⇒ hiện luôn.
    for (const board of d.querySelectorAll<HTMLElement>('.board')) {
      // V26/V28: giảm chuyển động ⇒ hiện tĩnh ngay, không chờ cuộn.
      if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        board.classList.add('live');
        continue;
      }
      const io = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            board.classList.add('live');
            io.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      io.observe(board);
      cleanups.push(() => io.disconnect());
    }

    // V21: khối dưới màn hình đầu mờ + dịch 12px, hiện dần khi cuộn tới. Không IO hoặc giảm chuyển động ⇒ không gắn .reveal (hiện sẵn).
    if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const targets = Array.from(d.querySelectorAll<HTMLElement>('main section ~ section, main article')).filter(
        (el) => el.getBoundingClientRect().top > window.innerHeight,
      );
      if (targets.length > 0) {
        const io = new IntersectionObserver(
          (es) => {
            for (const e of es) {
              if (e.isIntersecting) {
                e.target.classList.add('in');
                io.unobserve(e.target);
              }
            }
          },
          { threshold: 0.05 },
        );
        for (const el of targets) {
          el.classList.add('reveal');
          io.observe(el);
        }
        cleanups.push(() => {
          io.disconnect();
          for (const el of targets) el.classList.remove('reveal', 'in');
        });
      }
    }

    const nav = d.querySelector<HTMLElement>('nav.lang');
    const pill = nav?.querySelector<HTMLElement>('.lang-pill');
    if (nav && pill) {
      const put = (a: HTMLElement) => {
        pill.style.setProperty('--pill-x', `${a.offsetLeft}px`);
        pill.style.width = `${a.offsetWidth}px`;
      };
      const cur = () => nav.querySelector<HTMLAnchorElement>('a[aria-current="true"]');
      const c = cur();
      if (c) {
        // Đặt pill đúng ngôn ngữ hiện tại KHÔNG animation rồi mới hiện (tránh trượt VN→EN sau khi tải trang).
        pill.style.transition = 'none';
        put(c);
        void pill.offsetWidth;
        nav.classList.add('pill-on');
        requestAnimationFrame(() => {
          pill.style.transition = '';
        });
      }
      const onLang = (e: MouseEvent) => {
        const a = (e.target as HTMLElement).closest('a');
        if (!a || a === cur() || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
        e.preventDefault();
        const href = a.href;
        put(a);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) location.href = href;
        else
          setTimeout(() => {
            location.href = href;
          }, 320);
      };
      nav.addEventListener('click', onLang);
      cleanups.push(() => nav.removeEventListener('click', onLang));
    }
    return () => {
      for (const fn of cleanups) fn();
    };
  }, []);
  return null;
}
