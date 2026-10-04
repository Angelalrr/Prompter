'use client';
import React, { useEffect, useRef } from 'react';
import { Sparkles, Compass, Bookmark } from 'lucide-react';
import { useLanguage } from '../i18n';

export type TabId = 'inicio' | 'buscar' | 'favoritos';

export interface LiquidGlassTabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const TAB_CONFIG: { id: TabId; labelKey: 'create' | 'explore' | 'saved'; icon: React.ComponentType<{ className?: string }> }[] = [
  {
    id: 'inicio',
    labelKey: 'create',
    icon: Sparkles,
  },
  {
    id: 'buscar',
    labelKey: 'explore',
    icon: Compass,
  },
  {
    id: 'favoritos',
    labelKey: 'saved',
    icon: Bookmark,
  },
];

/* ---------- Refracción: perfil squircle convexo + ley de Snell ---------- */
const SURF = (x: number) => Math.pow(1 - Math.pow(1 - x, 4), 0.25);

function profile(thick: number, bezel: number, ior: number, n: number) {
  const p = new Float64Array(n);
  const eta = 1 / ior;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    const y = SURF(x);
    const dx = x < 1 ? 1e-4 : -1e-4;
    const dv = (SURF(x + dx) - y) / dx;
    const mg = Math.sqrt(dv * dv + 1);
    const nx = -dv / mg;
    const ny = -1 / mg;
    const k = 1 - eta * eta * (1 - ny * ny);
    if (k < 0) continue;
    const sq = Math.sqrt(k);
    const rx = -(eta * ny + sq) * nx;
    const ry = eta - (eta * ny + sq) * ny;
    p[i] = rx * ((y * bezel + thick) / ry);
  }
  return p;
}

type Maps = { d: string; s: string; max: number };

/* Mapas de desplazamiento + especular desde un SDF de rectángulo redondeado */
function maps(w: number, h: number, r: number, bezel: number, ior: number, thick: number): Maps {
  const pr = profile(thick, bezel, ior, 64);
  let mx = 1;
  for (let i = 0; i < 64; i++) mx = Math.max(mx, Math.abs(pr[i]));
  const D = document.createElement('canvas');
  const S = document.createElement('canvas');
  D.width = S.width = w;
  D.height = S.height = h;
  const dc = D.getContext('2d');
  const sc = S.getContext('2d');
  if (!dc || !sc) return { d: '', s: '', max: 1 };
  const di = dc.createImageData(w, h);
  const si = sc.createImageData(w, h);
  const d = di.data;
  const s = si.data;
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const L = [Math.cos(Math.PI / 3), -Math.sin(Math.PI / 3)];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      const px = x + 0.5 - w / 2;
      const py = y + 0.5 - h / 2;
      const qx = Math.abs(px) - hx;
      const qy = Math.abs(py) - hy;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const ln = Math.hypot(ox, oy);
      const dist = r - (ln + Math.min(Math.max(qx, qy), 0));
      let nx = 0;
      let ny = 0;
      if (ln > 0) {
        nx = (ox / ln) * Math.sign(px);
        ny = (oy / ln) * Math.sign(py);
      } else if (qx > qy) nx = Math.sign(px);
      else ny = Math.sign(py);

      d[k] = 128;
      d[k + 1] = 128;
      d[k + 2] = 0;
      d[k + 3] = 255;
      if (dist < 0 || dist >= bezel) continue;

      const a = Math.min(1, dist + 0.5);
      const m = pr[Math.min(63, ((dist / bezel) * 64) | 0)] / mx;
      d[k] = 128 - nx * m * 127 * a;
      d[k + 1] = 128 - ny * m * 127 * a;
      const dot = Math.abs(nx * L[0] + ny * L[1]);
      const f = Math.pow(1 - Math.min(dist / (bezel * 0.55), 1), 2.2) * dot;
      s[k] = s[k + 1] = s[k + 2] = 255;
      s[k + 3] = 255 * f * a;
    }
  }
  dc.putImageData(di, 0, 0);
  sc.putImageData(si, 0, 0);
  return { d: D.toDataURL(), s: S.toDataURL(), max: mx };
}

/* Filtro con aberración cromática (R/G/B) + especular */
function filter(id: string, m: Maps, w: number, h: number, scale: number, blur: number, spec: number) {
  const ch = (c: number, sc: number, res: string) => {
    const v = new Array(20).fill(0);
    v[18] = 1;
    v[c * 5 + c] = 1;
    return (
      `<feDisplacementMap in="b" in2="dm" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="d${res}"/>` +
      `<feColorMatrix in="d${res}" type="matrix" values="${v.join(' ')}" result="c${res}"/>`
    );
  };
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/>` +
    `<feImage href="${m.d}" x="0" y="0" width="${w}" height="${h}" result="dm"/>` +
    ch(0, scale * 1.07, 'r') + ch(1, scale, 'g') + ch(2, scale * 0.93, 'b') +
    '<feBlend in="cr" in2="cg" mode="screen" result="rg"/><feBlend in="rg" in2="cb" mode="screen" result="rgb"/>' +
    '<feColorMatrix in="rgb" type="saturate" values="1.7" result="sat"/>' +
    `<feImage href="${m.s}" x="0" y="0" width="${w}" height="${h}" result="sp"/>` +
    `<feComponentTransfer in="sp" result="sf"><feFuncA type="linear" slope="${spec}"/></feComponentTransfer>` +
    '<feBlend in="sf" in2="sat"/></filter>'
  );
}

export function LiquidGlassTabBar({ activeTab, onTabChange }: LiquidGlassTabBarProps) {
  const navRef = useRef<HTMLElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);

  const { language } = useLanguage();

  // Refs para que el efecto principal NO se reconstruya en cada render
  const activeRef = useRef(activeTab);
  const onChangeRef = useRef(onTabChange);
  activeRef.current = activeTab;
  onChangeRef.current = onTabChange;
  const syncRef = useRef<(anim: boolean) => void>(() => {});

  const getLabel = (id: TabId) => {
    if (language === 'es') {
      if (id === 'inicio') return 'Crear';
      if (id === 'buscar') return 'Explorar';
      return 'Guardados';
    }
    if (id === 'inicio') return 'Create';
    if (id === 'buscar') return 'Explore';
    return 'Saved';
  };

  useEffect(() => {
    const nav = navRef.current;
    const lens = lensRef.current;
    const spec = specRef.current;
    if (!nav || !lens || !spec) return;

    const count = TAB_CONFIG.length;
    let pad = 3.5;
    const DRAG_THRESHOLD = 8;
    const chromium = /Chrome|Chromium|Edg/.test(navigator.userAgent) && !/OPR|Firefox/.test(navigator.userAgent);
    const indexOf = (t: TabId) => Math.max(0, TAB_CONFIG.findIndex((x) => x.id === t));

    let tw = 0;
    let idx = indexOf(activeRef.current);

    const setX = (x: number, anim: boolean) => {
      if (!anim) lens.style.transition = 'none';
      lens.style.transform = `translateX(${x}px)`;
      if (!anim) {
        void lens.offsetWidth;
        lens.style.transition = '';
      }
    };
    const clamp = (x: number) => Math.max(0, Math.min((count - 1) * tw, x));
    const indexAt = (clientX: number) => {
      const r = nav.getBoundingClientRect();
      return Math.max(0, Math.min(count - 1, Math.floor((clientX - r.left - pad) / tw)));
    };

    function build() {
      const w = nav!.offsetWidth;
      const h = nav!.offsetHeight;
      if (w < 2) return;
      pad = parseFloat(window.getComputedStyle(nav!).paddingLeft) || 3.5;
      tw = (w - pad * 2) / count;
      lens!.style.width = tw + 'px';
      const lw = Math.round(tw);
      const lh = h - pad * 2;
      lens!.style.setProperty('--sx', String(1 + 6 / tw));
      lens!.style.setProperty('--sy', String(1 + 6 / lh));

      const m1 = maps(w, h, h / 2, 18, 1.5, 60);
      if (m1.s) spec!.style.backgroundImage = `url(${m1.s})`;

      if (chromium && m1.d) {
        const m2 = maps(lw, lh, lh / 2, 16, 1.5, 40);
        let host = document.getElementById('lg-defs') as Element | null;
        if (!host) {
          host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          host.id = 'lg-defs';
          (host as SVGElement).style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
          document.body.appendChild(host);
        }
        host.innerHTML =
          '<defs>' +
          filter('lg-bar', m1, w, h, Math.min(m1.max * 0.55, 30), 2.2, 0.4) +
          filter('lg-lens', m2, lw, lh, Math.min(m2.max * 0.5, 22), 1, 0.5) +
          '</defs>';
        nav!.style.setProperty('--f', 'url(#lg-bar)');
        nav!.style.setProperty('--fl', 'url(#lg-lens)');
        nav!.classList.add('fx');
      }
      idx = indexOf(activeRef.current);
      setX(idx * tw, false);
    }

    syncRef.current = (anim) => {
      idx = indexOf(activeRef.current);
      setX(idx * tw, anim);
    };

    build();
    let rt = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(rt);
      rt = window.setTimeout(build, 150);
    });
    ro.observe(nav);

    let down = false;
    let dragging = false;
    let lastDragEnd = 0;
    let sx = 0;
    let sy = 0;
    let curX = 0;

    const reset = () => {
      down = false;
      dragging = false;
      lens.classList.remove('press', 'drag');
    };

    function selectTab(i: number) {
      idx = Math.max(0, Math.min(count - 1, i));
      setX(idx * tw, true);
      const next = TAB_CONFIG[idx].id;
      if (next !== activeRef.current) onChangeRef.current(next);
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = true;
      dragging = false;
      sx = e.clientX;
      sy = e.clientY;
      lens.classList.add('press');
      curX = idx * tw;
    };

    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;

      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (Math.abs(dx) < Math.abs(dy)) {
          reset();
          setX(idx * tw, true);
          return;
        }
        dragging = true;
        try { nav.setPointerCapture(e.pointerId); } catch {}
        lens.classList.add('drag');
      }

      const r = nav.getBoundingClientRect();
      curX = clamp(e.clientX - r.left - pad - tw / 2);
      setX(curX, false);
    };

    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const wasDragging = dragging;
      reset();
      try {
        if (nav.hasPointerCapture(e.pointerId)) nav.releasePointerCapture(e.pointerId);
      } catch {}

      if (wasDragging) {
        lastDragEnd = Date.now();
        const targetIdx = Math.max(0, Math.min(count - 1, Math.round(curX / tw)));
        selectTab(targetIdx);
      } else {
        // If not dragged, lens rests at current active tab or the clicked tab will update it
        setX(idx * tw, true);
      }
    };

    const onCancel = () => {
      reset();
      setX(idx * tw, true);
    };

    // Keyboard navigation (Enter / Space triggers click)
    const keyHandlers = Array.from(nav.querySelectorAll<HTMLButtonElement>('.tab')).map((tab: HTMLButtonElement, i: number) => {
      const fn = (e: MouseEvent) => {
        if (Date.now() - lastDragEnd < 250) return;
        selectTab(i);
      };
      tab.addEventListener('click', fn);
      return () => tab.removeEventListener('click', fn);
    });

    nav.addEventListener('pointerdown', onDown);
    nav.addEventListener('pointermove', onMove);
    nav.addEventListener('pointerup', onUp);
    nav.addEventListener('pointercancel', onCancel);

    return () => {
      ro.disconnect();
      window.clearTimeout(rt);
      nav.removeEventListener('pointerdown', onDown);
      nav.removeEventListener('pointermove', onMove);
      nav.removeEventListener('pointerup', onUp);
      nav.removeEventListener('pointercancel', onCancel);
      keyHandlers.forEach((rm) => rm());
    };
  }, []);

  // Si el padre cambia activeTab (p. ej. navegación por código), mueve la lente
  useEffect(() => {
    syncRef.current(true);
  }, [activeTab]);

  return (
    <nav ref={navRef} className="nav" role="tablist" aria-label="Navegación principal">
      <div className="glass">
        <div className="spec" ref={specRef} />
      </div>
      <div className="lens" ref={lensRef} />
      {TAB_CONFIG.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={(e) => {
              e.stopPropagation();
              onTabChange(t.id);
            }}
          >
            <Icon className="w-5 h-5 stroke-[1.75]" />
            <span>{getLabel(t.id)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default LiquidGlassTabBar;
