/**
 * Página de apresentação do Optsolv Suporte (rota "/", pública).
 * Motion: GSAP conduz a narrativa da página (entrada do hero com SplitText, rolagem guiada com ScrollTrigger,
 * fixação da seção "Como funciona", contadores, botões magnéticos); anime.js anima as cenas da interface
 * (visuals.tsx). Tudo respeita prefers-reduced-motion: sem movimento, a página aparece completa e estática.
 * Conteúdo fiel ao produto: nada de números de resultado inventados nem promessas que a plataforma não cumpre.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ArrowRight, ArrowUpRight, Bot, ChartNoAxesCombined, Check, FileCheck2, Inbox, Layers, MessageSquareText, PackageCheck, Presentation, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Logo, Symbol } from '@/components/logo';
import { Orbit } from '@/components/status-screens';
import { cx } from '@/components/ui';
import { isInternalRole, useAuth } from '@/lib/auth';
import { useLenis } from '@/lib/lenis';
import { CaptureVisual, CodeVisual, DeckVisual, EvidenceVisual, HeroMockup, HubDiagram, StepperVisual, TenantVisual } from './visuals';
import './landing.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

const NAV = [{ id: 'como-funciona', label: 'Como funciona' }, { id: 'recursos', label: 'Recursos' }, { id: 'para-quem', label: 'Para quem' }, { id: 'integracoes', label: 'Integrações' }];
const MARQUEE = ['Portal do cliente', 'Captura de WhatsApp', 'Triagem e prioridades', 'Entregas publicadas', 'Evidências com fonte', 'Apresentações executivas', 'Exportação em PDF', 'API REST', 'Servidor MCP', 'Acesso por cliente', 'Histórico completo', 'Modo claro e escuro'];
const FLOW = [
  { icon: Inbox, title: 'Solicitação', text: 'Chega pelo portal, pelo WhatsApp colado pela equipe, pela API ou por um agente de IA. Tudo cai no mesmo lugar, com a origem registrada.' },
  { icon: Layers, title: 'Triagem', text: 'A equipe classifica, prioriza e define o responsável. O cliente acompanha o status em linguagem clara.' },
  { icon: PackageCheck, title: 'Entrega', text: 'Uma entrega atende várias solicitações e só aparece para o cliente quando é publicada.' },
  { icon: FileCheck2, title: 'Evidência', text: 'Benefício observado, esperado ou impacto medido. Número medido sempre acompanha a fonte.' },
  { icon: ChartNoAxesCombined, title: 'Valor comunicado', text: 'Painéis e apresentações executivas geradas a partir dos dados reais do período, prontas para PDF.' },
];
const FACTS = [
  { n: 5, label: 'canais de entrada', hint: 'portal, WhatsApp, equipe, API e MCP' },
  { n: 7, label: 'etapas rastreadas', hint: 'de nova a concluída, com histórico' },
  { n: 3, label: 'níveis de evidência', hint: 'observado, esperado e medido' },
  { n: 0, label: 'números inventados', hint: 'sem dado, aparece “não informado”', from: 99 },
];
const AUDIENCE = [
  { tab: 'Para o cliente', title: 'Clareza sem precisar perguntar.', points: ['Abre um pedido em segundos, com anexos', 'Vê cada etapa em linguagem simples', 'Recebe as novidades de cada entrega', 'Acompanha os resultados apresentados'], icon: Users },
  { tab: 'Para a equipe Optsolv', title: 'Operação organizada, valor visível.', points: ['Todos os canais numa fila só', 'Sem responsável e aguardando em destaque', 'Entregas ligadas às solicitações de origem', 'Apresentação executiva gerada em minutos'], icon: Sparkles },
];

/* ───────────────────────── Peças pequenas ───────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return <div data-reveal className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-400"><span className="h-px w-6 bg-gradient-to-r from-transparent to-orange-400" />{children}</div>;
}

function SectionTitle({ eyebrow, title, lead, center }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <div className={cx('max-w-3xl', center && 'mx-auto text-center')}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 data-split className="text-[clamp(32px,4.4vw,56px)] font-semibold leading-[1.04] tracking-tighter text-paper">{title}</h2>
      {lead && <p data-reveal className={cx('mt-5 max-w-2xl text-lg leading-relaxed text-paper-3/80', center && 'mx-auto')}>{lead}</p>}
    </div>
  );
}

function Cta({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'ghost' }) {
  const isAnchor = to.startsWith('#');
  const cls = cx('lp-btn group inline-flex h-12 items-center gap-2 rounded-full px-6 text-md font-semibold', variant === 'primary' ? 'lp-btn-primary text-white' : 'text-paper ring-1 ring-inset ring-white/15 hover:bg-white/[0.06]');
  const inner = <span data-magnetic-inner className="inline-flex items-center gap-2">{children}<ArrowRight size={17} className="transition-transform duration-200 ease-(--ease-out-strong) group-hover:translate-x-0.5" /></span>;
  return <span data-magnetic className="inline-block">{isAnchor ? <a href={to} className={cls}>{inner}</a> : <Link to={to} className={cls}>{inner}</Link>}</span>;
}

function BentoCard({ icon: Icon, title, text, children, className }: { icon: typeof Inbox; title: string; text: string; children: ReactNode; className?: string }) {
  return (
    <article data-reveal className={cx('lp-card spot group relative flex flex-col overflow-hidden rounded-3xl p-6 md:p-7', className)}>
      <div className="relative z-10 mb-6 min-h-0 flex-1">{children}</div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 text-paper"><Icon size={17} className="text-orange-400" /><h3 className="text-lg font-semibold tracking-tight">{title}</h3></div>
        <p className="mt-1.5 text-base leading-relaxed text-paper-3/75">{text}</p>
      </div>
    </article>
  );
}

/** Abas com troca de cor perfeita: uma cópia "ativa" da lista é recortada (clip-path) só sobre a aba escolhida. */
function AudienceTabs() {
  const [i, setI] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState('inset(0 100% 0 0 round 999px)');
  useLayoutEffect(() => {
    const el = list.current; const b = el?.querySelectorAll<HTMLElement>('[data-tab]')[i];
    if (!el || !b) return;
    const l = (b.offsetLeft / el.offsetWidth) * 100; const r = 100 - ((b.offsetLeft + b.offsetWidth) / el.offsetWidth) * 100;
    setClip(`inset(0 ${r.toFixed(2)}% 0 ${l.toFixed(2)}% round 999px)`);
  }, [i]);
  const a = AUDIENCE[i];
  const tabs = (active: boolean) => AUDIENCE.map((t, k) => (
    <button key={t.tab} type="button" data-tab tabIndex={active ? -1 : 0} role={active ? undefined : 'tab'} aria-selected={active ? undefined : k === i} onClick={() => setI(k)}
      className={cx('h-10 rounded-full px-5 text-base font-semibold', active ? 'text-[#111111]' : 'text-paper-3/70 hover:text-paper')}>{t.tab}</button>
  ));
  return (
    <div data-reveal className="lp-card mx-auto mt-14 max-w-5xl rounded-3xl p-3 md:p-4">
      <div className="relative mx-auto w-fit">
        <div ref={list} role="tablist" aria-label="Público" className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/[0.06]">{tabs(false)}</div>
        <div aria-hidden className="pointer-events-none absolute inset-0 flex rounded-full bg-paper p-1 transition-[clip-path] duration-500 ease-(--ease-out-strong) motion-reduce:transition-none" style={{ clipPath: clip }}>{tabs(true)}</div>
      </div>
      <div key={i} role="tabpanel" className="lp-panel grid items-center gap-8 p-5 md:grid-cols-[1.1fr_1fr] md:p-10">
        <div>
          <a.icon size={22} className="text-orange-400" />
          <h3 className="mt-4 text-4xl font-semibold leading-tight tracking-tighter text-paper">{a.title}</h3>
          <ul className="mt-6 grid gap-3">{a.points.map((p) => <li key={p} className="flex items-start gap-3 text-md text-paper-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/20 text-orange-300"><Check size={12} strokeWidth={3} /></span>{p}</li>)}</ul>
        </div>
        <div className="lp-card rounded-2xl p-5">{i === 0 ? <StepperVisual /> : <EvidenceVisual />}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

export function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const { me } = useAuth();
  const area = me ? (isInternalRole(me.actor.role) ? '/app' : '/portal') : '/entrar';
  useLenis();

  // Fundo do documento escuro enquanto a página está aberta (rolagem elástica não revela o claro).
  useEffect(() => { document.documentElement.classList.add('lp-html'); return () => document.documentElement.classList.remove('lp-html'); }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', wide: '(min-width: 1024px)', fine: '(hover: hover) and (pointer: fine)' }, (c) => {
        const { motion, wide, fine } = c.conditions as Record<string, boolean>;

        // Navegação vira "vidro" ao rolar (vale também sem movimento: é estado, não animação).
        ScrollTrigger.create({ start: 40, end: 'max', toggleClass: { targets: '[data-nav]', className: 'is-scrolled' } });
        if (!motion) return;

        // Hero: palavras sobem de dentro de uma máscara por linha, depois o resto em cascata.
        const title = SplitText.create('[data-hero-title]', { type: 'lines,words', mask: 'lines' });
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .from('[data-hero-badge]', { y: 14, opacity: 0, duration: 0.9 })
          .from(title.words, { yPercent: 115, duration: 1.25, stagger: 0.045 }, 0.1)
          .from('[data-hero-sub]', { y: 18, opacity: 0, filter: 'blur(8px)', duration: 1.1 }, 0.5)
          .from('[data-hero-cta] > *', { y: 14, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.65)
          .from('[data-hero-mock]', { y: 80, opacity: 0, duration: 1.6 }, 0.6)
          .from('[data-hero-tilt]', { rotateX: 28, scale: 0.92, duration: 1.8, transformPerspective: 1800 }, 0.6);

        // O mockup se endireita conforme a rolagem (Linear-like): inclinado → plano.
        gsap.fromTo('[data-hero-tilt]', { rotateX: 12, transformPerspective: 1800, transformOrigin: '50% 0%' }, { rotateX: 0, scale: 1.02, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '[data-hero-mock]', start: 'top 85%', end: 'top 15%', scrub: 0.6 } });
        gsap.to('[data-hero-glow]', { yPercent: 30, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });

        // Títulos de seção: palavras sobem da máscara ao entrar.
        gsap.utils.toArray<HTMLElement>('[data-split]').forEach((h) => {
          const s = SplitText.create(h, { type: 'lines,words', mask: 'lines' });
          gsap.from(s.words, { yPercent: 110, duration: 1.1, ease: 'expo.out', stagger: 0.035, scrollTrigger: { trigger: h, start: 'top 85%', once: true } });
        });

        // Blocos: entram em lotes (30–80ms entre itens), uma vez só.
        gsap.set('[data-reveal]', { opacity: 0, y: 28 });
        ScrollTrigger.batch('[data-reveal]', { start: 'top 88%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07, overwrite: true }) });

        // Frase-manifesto: cada palavra acende conforme a rolagem.
        const stmt = SplitText.create('[data-statement]', { type: 'words' });
        gsap.fromTo(stmt.words, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: '[data-statement]', start: 'top 78%', end: 'bottom 45%', scrub: true } });

        // Contadores dos fatos (o "0" desce de 99: nenhum número inventado).
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
          const to = Number(el.dataset.count); const from = Number(el.dataset.from ?? 0);
          gsap.fromTo(el, { textContent: from }, { textContent: to, duration: 1.8, ease: 'power3.out', snap: { textContent: 1 }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
        });

        // Como funciona: no desktop a seção fica fixa e a rolagem conduz a linha e as etapas.
        if (wide) {
          const steps = gsap.utils.toArray<HTMLElement>('[data-step]');
          const tl = gsap.timeline({ scrollTrigger: { trigger: '[data-flow]', start: 'top top', end: `+=${steps.length * 420}`, scrub: 0.8, pin: true, anticipatePin: 1 } });
          tl.fromTo('[data-flow-line]', { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: steps.length }, 0);
          steps.forEach((s, k) => {
            tl.fromTo(s, { opacity: 0.25, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, k * 0.9)
              .fromTo(s.querySelector('[data-step-dot]'), { scale: 0.7, backgroundColor: 'rgba(255,255,255,0.08)' }, { scale: 1, backgroundColor: '#D14318', duration: 0.4 }, k * 0.9);
          });
        } else {
          gsap.from('[data-step]', { opacity: 0, y: 24, duration: 1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: '[data-flow]', start: 'top 80%', once: true } });
        }

        // Botões magnéticos e luz do hero seguindo o ponteiro (decorativo, só com mouse).
        if (fine) {
          const cleanups: (() => void)[] = [];
          gsap.utils.toArray<HTMLElement>('[data-magnetic]').forEach((m) => {
            const inner = m.querySelector('[data-magnetic-inner]');
            const xTo = gsap.quickTo(m, 'x', { duration: 0.6, ease: 'expo.out' }); const yTo = gsap.quickTo(m, 'y', { duration: 0.6, ease: 'expo.out' });
            const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'expo.out' });
            const move = (e: PointerEvent) => { const r = m.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2); const dy = e.clientY - (r.top + r.height / 2); xTo(dx * 0.28); yTo(dy * 0.4); ixTo?.(dx * 0.1); };
            const leave = () => { xTo(0); yTo(0); ixTo?.(0); };
            m.addEventListener('pointermove', move); m.addEventListener('pointerleave', leave);
            cleanups.push(() => { m.removeEventListener('pointermove', move); m.removeEventListener('pointerleave', leave); });
          });
          const hero = root.current?.querySelector<HTMLElement>('[data-hero]');
          const light = hero?.querySelector('[data-hero-light]');
          if (hero && light) {
            const lx = gsap.quickTo(light, 'x', { duration: 1.2, ease: 'power3.out' }); const ly = gsap.quickTo(light, 'y', { duration: 1.2, ease: 'power3.out' });
            const move = (e: PointerEvent) => { const r = hero.getBoundingClientRect(); lx(e.clientX - r.left - r.width / 2); ly(e.clientY - r.top - r.height / 2); };
            hero.addEventListener('pointermove', move);
            cleanups.push(() => hero.removeEventListener('pointermove', move));
          }
          return () => cleanups.forEach((f) => f());
        }
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="dark lp-root relative min-h-dvh overflow-x-clip text-paper antialiased">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white">Pular para o conteúdo</a>

      {/* Navegação */}
      <header data-nav className="lp-nav fixed inset-x-0 top-0 z-50">
        <div className="lp-nav-inner mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/" aria-label="Optsolv Suporte, início" className="flex items-center gap-3"><Logo variant="claro" height={22} /><span className="hidden h-4 w-px bg-white/15 sm:block" /><span className="hidden text-sm font-medium text-paper-3/80 sm:block">Suporte</span></Link>
          <nav aria-label="Seções" className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => <a key={n.id} href={`#${n.id}`} className="rounded-full px-3.5 py-2 text-sm font-medium text-paper-3/70 transition-colors duration-150 hover:text-paper">{n.label}</a>)}
          </nav>
          <Link to={area} className="lp-btn lp-btn-primary ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-white md:ml-2">{me ? 'Abrir minha área' : 'Entrar'}<ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero */}
        <section data-hero className="relative isolate overflow-hidden pb-24 pt-36 md:pb-40 md:pt-44">
          <div aria-hidden className="lp-grid absolute inset-0 -z-10" />
          <div aria-hidden data-hero-glow className="lp-aurora absolute inset-x-0 top-0 -z-10 h-[720px]" />
          <div aria-hidden data-hero-light className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,107,61,0.16),transparent)]" />
          <div className="mx-auto max-w-6xl px-5 text-center">
            <div data-hero-badge className="lp-badge mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-paper-3">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-orange-500" /></span>
              A central de suporte dos clientes Optsolv
            </div>
            <h1 data-hero-title className="mx-auto mt-8 max-w-5xl text-[clamp(44px,7.4vw,96px)] font-semibold leading-[0.98] tracking-tighter text-paper">
              Do pedido ao <span className="whitespace-nowrap"><span className="lp-shine">resultado</span>,</span> tudo à vista.
            </h1>
            <p data-hero-sub className="mx-auto mt-7 max-w-2xl text-xl leading-relaxed text-paper-3/80">
              Solicitações, entregas e evidências de cada cliente em um só lugar. Você acompanha cada etapa e enxerga o valor de cada entrega, com números calculados, nunca inventados.
            </p>
            <div data-hero-cta className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Cta to={area}>{me ? 'Abrir minha área' : 'Acessar a plataforma'}</Cta>
              <Cta to="#como-funciona" variant="ghost">Ver como funciona</Cta>
            </div>
          </div>
          <div data-hero-mock className="mx-auto mt-20 max-w-6xl px-5 md:mt-24 [perspective:1800px]">
            <div data-hero-tilt className="will-change-transform"><HeroMockup /></div>
          </div>
        </section>

        {/* Faixa de capacidades */}
        <div className="lp-marquee relative border-y border-white/[0.06] py-5" aria-label="Capacidades">
          <div className="lp-marquee-track flex w-max gap-10">
            {[...MARQUEE, ...MARQUEE].map((m, k) => <span key={k} aria-hidden={k >= MARQUEE.length || undefined} className="flex items-center gap-10 whitespace-nowrap text-md font-medium text-paper-3/60"><span className="text-orange-500/80">✦</span>{m}</span>)}
          </div>
        </div>

        {/* Como funciona */}
        <section id="como-funciona" data-flow className="relative flex min-h-dvh flex-col justify-center py-24 md:py-32">
          <div className="mx-auto w-full max-w-6xl px-5">
            <SectionTitle eyebrow="Como funciona" title={<>Um fio contínuo,<br />do pedido ao valor.</>} lead="Cada etapa deixa rastro. Por isso dá para mostrar, com segurança, o que foi pedido, o que foi entregue e o que mudou." />
            <div className="relative mt-16">
              <div aria-hidden className="absolute left-0 right-0 top-[22px] hidden h-px bg-white/[0.08] lg:block"><div data-flow-line className="h-full origin-left bg-gradient-to-r from-orange-600 via-orange-500 to-orange-300 shadow-[0_0_12px_rgba(255,107,61,0.6)]" /></div>
              <ol className="grid gap-6 lg:grid-cols-5 lg:gap-5">
                {FLOW.map((s, k) => (
                  <li key={s.title} data-step className="relative">
                    <span data-step-dot className="relative z-10 grid size-11 place-items-center rounded-2xl bg-primary text-white ring-1 ring-inset ring-white/10"><s.icon size={19} /></span>
                    <div className="mt-5 text-xs font-semibold tnum text-orange-400">0{k + 1}</div>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-paper">{s.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-paper-3/70">{s.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Manifesto */}
        <section className="relative py-24 md:py-36">
          <p data-statement className="mx-auto max-w-5xl px-5 text-center text-[clamp(30px,4.6vw,60px)] font-semibold leading-[1.1] tracking-tighter text-paper">
            Solicitação não é entrega. Entrega não é resultado. <span className="text-orange-400">Aqui, cada número tem fonte</span> e cada entrega mostra de onde veio.
          </p>
        </section>

        {/* Recursos (bento) */}
        <section id="recursos" className="relative py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle eyebrow="Recursos" title={<>Tudo que o suporte precisa.<br />Nada que atrapalhe.</>} lead="Uma plataforma pensada para quem pede e para quem entrega, com a mesma base de dados e as mesmas regras de acesso." />
            <div className="mt-14 grid gap-4 md:grid-cols-6">
              <BentoCard className="md:col-span-4" icon={Users} title="Portal do cliente" text="O cliente abre pedidos, acompanha o status em linguagem simples e recebe as novidades de cada entrega publicada."><StepperVisual rich /></BentoCard>
              <BentoCard className="md:col-span-2" icon={MessageSquareText} title="Captura de WhatsApp" text="A equipe cola as mensagens; a plataforma sugere solicitações, aponta possíveis repetidas e só grava depois da revisão."><CaptureVisual /></BentoCard>
              <BentoCard className="md:col-span-2" icon={FileCheck2} title="Entregas com evidência" text="Separa benefício observado, esperado e impacto medido. Sem dado, aparece “não informado”."><EvidenceVisual /></BentoCard>
              <BentoCard className="md:col-span-2" icon={Presentation} title="Apresentações executivas" text="Escolha cliente, projetos e período: os slides saem dos dados reais, editáveis e prontos para PDF."><DeckVisual /></BentoCard>
              <BentoCard className="md:col-span-2" icon={ShieldCheck} title="Cada cliente no seu espaço" text="Permissões verificadas em toda operação. Cada cliente enxerga só o que é dele; notas internas ficam internas."><TenantVisual /></BentoCard>
            </div>
          </div>
        </section>

        {/* Fatos */}
        <section aria-label="A plataforma em números" className="relative border-y border-white/[0.06] py-20">
          <dl className="mx-auto grid max-w-6xl gap-10 px-5 sm:grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label} data-reveal className="text-center lg:text-left">
                <dd className="bg-gradient-to-b from-paper to-paper/40 bg-clip-text text-7xl font-semibold leading-none tracking-tighter text-transparent tnum" data-count={f.n} data-from={f.from}>{f.n}</dd>
                <dt className="mt-3 text-lg font-semibold text-paper">{f.label}</dt>
                <p className="mt-1 text-sm text-paper-3/60">{f.hint}</p>
              </div>
            ))}
          </dl>
        </section>

        {/* Para quem */}
        <section id="para-quem" className="relative py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-5">
            <SectionTitle center eyebrow="Para quem" title="Os dois lados da mesa, na mesma página." lead="O cliente ganha transparência; a equipe ganha organização. Ninguém precisa perguntar “como está aquele pedido?”." />
            <AudienceTabs />
          </div>
        </section>

        {/* Integrações */}
        <section id="integracoes" className="relative overflow-hidden py-24 md:py-32">
          <div aria-hidden className="lp-grid absolute inset-0 -z-10 opacity-60" />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <SectionTitle eyebrow="Integrações" title={<>Pronta para<br />agentes de IA.</>} lead="A interface, a API REST e o servidor MCP usam exatamente as mesmas regras. Um agente de IA abre e consulta solicitações com as permissões do cliente, e a origem fica registrada." />
              <div data-reveal className="mt-8"><CodeVisual /></div>
              <div data-reveal className="mt-6 flex flex-wrap gap-2">
                {[{ i: Bot, t: 'Ferramentas MCP concretas' }, { i: ShieldCheck, t: 'Token por cliente' }, { i: Layers, t: 'Mesma API da interface' }].map((x) => <span key={x.t} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm text-paper-3 ring-1 ring-inset ring-white/[0.08]"><x.i size={14} className="text-orange-400" />{x.t}</span>)}
              </div>
            </div>
            <div data-reveal className="lp-card rounded-3xl p-6 md:p-10"><HubDiagram /></div>
          </div>
        </section>

        {/* Chamada final */}
        <section className="relative isolate overflow-hidden py-28 md:py-40">
          <div aria-hidden className="lp-aurora lp-aurora-bottom absolute inset-0 -z-10" />
          <div className="mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
            <div data-reveal><Orbit /></div>
            <h2 data-split className="mt-10 text-[clamp(36px,5.4vw,72px)] font-semibold leading-[1.02] tracking-tighter text-paper">Seu suporte, visível do pedido ao resultado.</h2>
            <p data-reveal className="mt-6 max-w-xl text-lg text-paper-3/75">Entre com o acesso enviado pela Optsolv e acompanhe tudo o que sua equipe pediu e recebeu.</p>
            <div data-reveal className="mt-10"><Cta to={area}>{me ? 'Abrir minha área' : 'Acessar a plataforma'}</Cta></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center">
          <div className="flex items-center gap-3"><Symbol variant="laranja" height={20} /><span className="text-sm text-paper-3/60">© {new Date().getFullYear()} Optsolv · Optsolv Suporte</span></div>
          <nav aria-label="Rodapé" className="flex flex-wrap gap-5 text-sm text-paper-3/60 md:ml-auto">
            {NAV.map((n) => <a key={n.id} href={`#${n.id}`} className="transition-colors hover:text-paper">{n.label}</a>)}
            <a href="/docs" className="transition-colors hover:text-paper">Documentação da API</a>
            <Link to="/entrar" className="transition-colors hover:text-paper">Entrar</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
