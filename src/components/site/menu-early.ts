// Mở/đóng ngăn kéo NGAY khi HTML đã hiện, không chờ React hydrate (đo 4G + CPU×4: nút menu chết ~2,3 s).
// Chuỗi này chạy inline ngay sau markup ngăn kéo (Shell.tsx); hash của nó vào CSP ở bước build (inlineScriptHashes).
// ShellBehavior (useEffect) gọi window.__gmsMenu.off() trước khi gắn listener của mình ⇒ không có hai bộ listener
// (mở rồi đóng ngay), rồi nối tiếp trạng thái đang mở bằng cách gắn lại phím Esc/Tab.
// Cùng hành vi với ShellBehavior: aria-expanded, khoá cuộn, focus link đầu, Esc, bẫy Tab, bấm link trong panel đóng.
export const MENU_EARLY_SCRIPT = `(function(){
var d=document,b=d.getElementById('menu-btn'),r=d.getElementById('drawer');
if(!b||!r)return;
var p=r.querySelector('.drawer-panel'),c=d.getElementById('menu-close'),g=r.querySelector('.drawer-bg');
if(!p||!c||!g)return;
var t;
function k(e){
if(e.key==='Escape'){e.preventDefault();x(true);return}
if(e.key==='Tab'){var f=p.querySelectorAll('a[href],button'),a=f[0],z=f[f.length-1];
if(e.shiftKey&&d.activeElement===a){e.preventDefault();z.focus()}
else if(!e.shiftKey&&d.activeElement===z){e.preventDefault();a.focus()}}}
function o(){clearTimeout(t);r.hidden=false;void r.offsetWidth;r.classList.add('open');
b.setAttribute('aria-expanded','true');d.body.style.overflow='hidden';
var l=p.querySelector('.d-main a');if(l)l.focus();d.addEventListener('keydown',k)}
function x(h){if(r.hidden)return;r.classList.remove('open');b.setAttribute('aria-expanded','false');
d.body.style.overflow='';d.removeEventListener('keydown',k);
t=setTimeout(function(){r.hidden=true},matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);
if(h)b.focus()}
function q(){x(true)}
function m(e){if(e.target.closest&&e.target.closest('a'))x(false)}
b.addEventListener('click',o);c.addEventListener('click',q);g.addEventListener('click',q);p.addEventListener('click',m);
window.__gmsMenu={off:function(){b.removeEventListener('click',o);c.removeEventListener('click',q);
g.removeEventListener('click',q);p.removeEventListener('click',m);d.removeEventListener('keydown',k);
delete window.__gmsMenu;return r.classList.contains('open')}};
})();`;
