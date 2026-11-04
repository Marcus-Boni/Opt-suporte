import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import gsap from 'gsap';
import { X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import type { Presentation } from '@/lib/types';
import { SlideView } from '@/components/slides';
import { Logo } from '@/components/logo';
import { Button, cx } from '@/components/ui';
import { Tip } from '@/components/ui/tooltip';
import { useAuth, isInternalRole } from '@/lib/auth';
import { useLenis } from '@/lib/lenis';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Modo apresentação: tela cheia, escuro, navegação por teclado, toque e botões.
 * Coreografia com GSAP: o slide anterior sai rápido (160 ms), o novo entra e revela
 * título, texto, cartões e números em cascata; números sobem até o valor.
 * Com prefers-reduced-motion só há um fade curto.
 */
export function PresentPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ['presentation', id], queryFn: () => api.get<Presentation>(`/presentations/${id}`) });
  const [i, setI] = useState(0);
  const dir = useRef(1);
  const frame = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const pending = useRef<number | null>(null);
  const total = q.data?.slides.length ?? 0;
  const back = isInternalRole(me?.actor.role) ? `/app/apresentacoes/${id}` : `/portal/resultados/${id}`;

  const go = (n: number) => {
    const t = Math.max(0, Math.min(total - 1, n));
    if (t === i) return;
    if (leaving.current) { pending.current = t; return; } // tecla repetida durante a saída: vai para o último alvo
    dir.current = t > i ? 1 : -1;
    const el = frame.current;
    if (!el || reduced()) { setI(t); return; }
    leaving.current = true;
    gsap.to(el, { opacity: 0, x: dir.current * -24, filter: 'blur(4px)', duration: 0.16, ease: 'power1.in', onComplete: () => { leaving.current = false; const next = pending.current ?? t; pending.current = null; setI(next); } });
  };
  // O ouvinte de teclado é registrado uma vez; lê o slide atual por ref para não ficar com um índice velho.
  const cur = useRef({ go, i, total }); cur.current = { go, i, total };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { go, i, total } = cur.current;
      if (['ArrowRight', ' ', 'PageDown', 'Enter'].includes(e.key)) { e.preventDefault(); go(i + 1); }
      if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(i - 1); }
      if (e.key === 'Escape') nav(back);
      if (e.key === 'Home') go(0);
      if (e.key === 'End') go(total - 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [back, nav]);
  useEffect(() => { document.documentElement.requestFullscreen?.().catch(() => {}); return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }; }, []);

  // Entrada do slide atual: roda antes da pintura para o estado inicial nunca piscar.
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      if (reduced()) { gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15 }); return; }
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      tl.fromTo(el, { opacity: 0, x: dir.current * 40, filter: 'blur(6px)' }, { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.45, clearProps: 'filter' });
      tl.fromTo(el.querySelectorAll('[data-reveal]'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.055 }, '-=0.3');
      el.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => {
        const to = Number(n.dataset.count);
        if (!Number.isFinite(to)) return;
        const o = { v: 0 };
        n.textContent = '0';
        tl.to(o, { v: to, duration: 0.9, ease: 'power2.out', onUpdate: () => { n.textContent = Math.round(o.v).toLocaleString('pt-BR'); } }, '<+0.1');
      });
    }, el);
    return () => ctx.revert();
  }, [i, q.data]);

  if (!q.data) return <div className="min-h-dvh grain-dark grid place-items-center"><Logo variant="claro" height={28} className="opacity-60" /></div>;
  const p = q.data;
  const slide = p.slides[i];
  return (
    <div className="min-h-dvh grain-dark text-paper flex flex-col select-none" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; go(i + 1); }}>
      <div className="flex-1 grid place-items-center p-[2vmin]">
        <div className="w-full max-w-[min(100vw-4vmin,calc((100vh-10vmin)*16/9))] relative">
          <div key={slide.id} ref={frame} className="rounded-[1.2vmin] overflow-hidden shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/5 will-change-transform">
            <SlideView slide={slide} index={i} total={p.slides.length} clientName={p.clientName} dark animate />
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">Slide {i + 1} de {p.slides.length}: {slide.title}</p>
      <div className="h-[3px] bg-night-3"><div className="h-full bg-orange-500 transition-[width] duration-500 ease-(--ease-out-strong)" style={{ width: `${((i + 1) / p.slides.length) * 100}%` }} /></div>
      <div className="no-print flex items-center gap-2 px-4 py-2.5 text-xs text-dusk">
        <span className="tnum">{i + 1} / {p.slides.length}</span>
        <span className="hidden sm:inline">· setas, espaço ou clique para avançar · Esc para sair</span>
        <div className="ml-auto flex items-center gap-1">
          <Tip label="Anterior · ←"><Button variant="ghost" size="sm" className="text-paper-3 hover:bg-night-3" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Anterior"><ChevronLeft size={16} /></Button></Tip>
          <Tip label="Próximo · →"><Button variant="ghost" size="sm" className="text-paper-3 hover:bg-night-3" onClick={() => go(i + 1)} disabled={i === p.slides.length - 1} aria-label="Próximo"><ChevronRight size={16} /></Button></Tip>
          <Button variant="ghost" size="sm" className="text-paper-3 hover:bg-night-3" onClick={() => nav(back)} icon={<X />}>Sair</Button>
        </div>
      </div>
    </div>
  );
}

/** Exportação PDF: todos os slides empilhados, um por página A4 paisagem, com a impressão do navegador. */
export function PrintPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ['presentation', id], queryFn: () => api.get<Presentation>(`/presentations/${id}`) });
  const [auto, setAuto] = useState(true);
  const back = isInternalRole(me?.actor.role) ? `/app/apresentacoes/${id}` : `/portal/resultados/${id}`;
  useLenis();
  useEffect(() => {
    if (!q.data || !auto) return;
    const t = setTimeout(() => { window.print(); setAuto(false); }, 700);
    return () => clearTimeout(t);
  }, [q.data, auto]);
  if (!q.data) return <div className="min-h-dvh grid place-items-center bg-paper"><Logo height={26} className="opacity-60" /></div>;
  const p = q.data;
  return (
    <div className="bg-paper-3 min-h-dvh">
      <div className="no-print sticky top-0 z-10 bg-card border-b border-line px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">{p.title}</span><span className="text-ink-4">{p.slides.length} páginas · escolha “Salvar como PDF” na impressão, orientação paisagem.</span>
        <div className="ml-auto flex gap-2"><Button size="sm" variant="secondary" onClick={() => nav(back)}>Voltar</Button><Button size="sm" icon={<Printer />} onClick={() => window.print()}>Imprimir / salvar PDF</Button></div>
      </div>
      <div className="flex flex-col items-center gap-6 py-6 print:gap-0 print:py-0">
        {p.slides.map((s, i) => (
          <div key={s.id} className={cx('print-slide bg-white shadow-card w-[min(100vw-2rem,1100px)] print:w-[297mm] print:shadow-none')}>
            <SlideView slide={s} index={i} total={p.slides.length} clientName={p.clientName} />
          </div>
        ))}
      </div>
    </div>
  );
}
