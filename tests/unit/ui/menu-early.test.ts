// @vitest-environment happy-dom
// Menu mở được TRƯỚC hydrate (script inline menu-early) và không bị hai bộ listener khi ShellBehavior gắn vào.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MENU_EARLY_SCRIPT } from '../../../src/components/site/menu-early.ts';
import { ShellBehavior } from '../../../src/components/site/ShellBehavior.tsx';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HTML = `
<button id="menu-btn" aria-controls="drawer" aria-expanded="false">Menu</button>
<div id="drawer" hidden>
  <div class="drawer-bg"></div>
  <div class="drawer-panel">
    <button id="menu-close">Đóng</button>
    <div class="d-main"><a href="/a">A</a><a href="/b">B</a></div>
  </div>
</div>
<div id="react-host"></div>`;

const $ = (s: string) => document.querySelector(s) as HTMLElement;
let root: Root | undefined;

function runEarly() {
  // Chạy chuỗi như trình duyệt chạy script inline.
  new Function(MENU_EARLY_SCRIPT)();
}
async function hydrate() {
  root = createRoot($('#react-host'));
  await act(async () => root?.render(createElement(ShellBehavior)));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = HTML;
  document.body.style.overflow = '';
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  delete (window as unknown as { __gmsMenu?: unknown }).__gmsMenu;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('menu-early: trước hydrate', () => {
  it('bấm nút mở ngay khi chưa có React: aria-expanded, khoá cuộn, focus link đầu', () => {
    runEarly();
    $('#menu-btn').click();
    expect($('#drawer').hidden).toBe(false);
    expect($('#drawer').classList.contains('open')).toBe(true);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.getAttribute('href')).toBe('/a');
  });

  it('Esc và nút đóng đóng lại, trả focus; bấm link trong panel đóng không cướp focus', () => {
    runEarly();
    $('#menu-btn').click();
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement?.id).toBe('menu-btn');
    vi.advanceTimersByTime(200);
    expect($('#drawer').hidden).toBe(true);
    $('#menu-btn').click();
    $('#menu-close').click();
    expect($('#drawer').classList.contains('open')).toBe(false);
    $('#menu-btn').click();
    ($('.d-main a') as HTMLElement).click();
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect(document.activeElement?.id).not.toBe('menu-btn');
    expect(document.body.style.overflow).toBe('');
  });
});

describe('menu-early + hydrate: không trùng listener', () => {
  it('hydrate xong, một lần bấm vẫn chỉ mở một lần (không mở rồi đóng ngay)', async () => {
    runEarly();
    await hydrate();
    expect((window as unknown as { __gmsMenu?: unknown }).__gmsMenu).toBeUndefined();
    await act(async () => $('#menu-btn').click());
    expect($('#drawer').classList.contains('open')).toBe(true);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('true');
    await act(async () => $('#menu-btn').click());
    expect($('#drawer').classList.contains('open')).toBe(true);
  });

  it('mở trước hydrate rồi hydrate: vẫn mở, Esc đóng một lần và trả focus', async () => {
    runEarly();
    $('#menu-btn').click();
    await hydrate();
    expect($('#drawer').classList.contains('open')).toBe(true);
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect($('#drawer').classList.contains('open')).toBe(false);
    expect($('#menu-btn').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement?.id).toBe('menu-btn');
    await act(async () => $('#menu-btn').click());
    expect($('#drawer').classList.contains('open')).toBe(true);
  });

  it('thiếu thành phần ngăn kéo: script không lỗi, không gắn gì', () => {
    $('#menu-close').remove();
    runEarly();
    $('#menu-btn').click();
    expect($('#drawer').hidden).toBe(true);
  });
});
