/**
 * Visuais vivos da página de apresentação: pequenas cenas da interface real animadas com anime.js.
 * Cada cena roda em loop só enquanto está visível (IntersectionObserver) e para fora da tela.
 * O HTML estático já é a cena completa: com movimento reduzido nada anima e nada falta.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createTimeline, stagger, svg, type Timeline } from 'animejs';
import { Bot, Check, CheckCheck, Code2, FileText, Globe, Inbox, LayoutDashboard, Lock, MessageSquareText, PackageCheck, Presentation, Sparkles, UserRound } from 'lucide-react';
import { Symbol } from '@/components/logo';
import { cx } from '@/components/ui';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Monta um timeline (autoplay: false) e o toca/pausa conforme a cena entra/sai da tela. */
function useLoop<T extends HTMLElement>(build: (q: (sel: string) => NodeListOf<Element>, root: T) => Timeline) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || reducedMotion()) return;
    const tl = build((sel) => root.querySelectorAll(sel), root);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) tl.play(); else tl.pause(); }, { threshold: 0.2 });
    io.observe(root);
    return () => { io.disconnect(); tl.revert(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

const loop = () => createTimeline({ autoplay: false, loop: true, defaults: { ease: 'outExpo', duration: 700 } });
const blurIn = { opacity: [0, 1], filter: ['blur(6px)', 'blur(0px)'] };
const blurOut = { opacity: [1, 0], filter: ['blur(0px)', 'blur(6px)'] };

function Pill({ tone, children, className, style }: { tone: 'ink' | 'info' | 'ok' | 'warn' | 'orange'; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const t = { ink: 'bg-paper text-[#111111]', info: 'bg-info-soft text-info', ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', orange: 'bg-orange-100 text-orange-800' }[tone];
  return <span style={style} className={cx('inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full px-2 text-2xs font-semibold', t, className)}><span className="size-1.5 rounded-full bg-current opacity-80" />{children}</span>;
}

/* ───────────────────────── Hero: a plataforma trabalhando ───────────────────────── */

const ROWS = [
  { code: 'CE-17', title: 'Exportar agenda de visitas em PDF', who: 'Ana R.', tone: 'info' as const, status: 'Em triagem' },
  { code: 'MA-8', title: 'Relatório mensal de coletas', who: 'João P.', tone: 'ok' as const, status: 'Concluída' },
  { code: 'CE-12', title: 'Login expira rápido no celular', who: 'Ana R.', tone: 'warn' as const, status: 'Aguardando você' },
];

export function HeroMockup() {
  const ref = useLoop<HTMLDivElement>((q) => loop()
    .add(q('[data-a=msg]'), { opacity: [0, 1], translateY: [14, 0], scale: [0.96, 1], delay: stagger(420) }, 200)
    .add(q('[data-a=parse]'), { opacity: [0, 1], scaleX: [0.2, 1], duration: 600 }, 1150)
    .add(q('[data-a=new]'), { opacity: [0, 1], translateX: [-18, 0] }, 1450)
    .add(q('[data-a=glow]'), { opacity: [0, 1], duration: 400 }, 1450)
    .add(q('[data-a=s1]'), { ...blurOut, duration: 380 }, 2500)
    .add(q('[data-a=s2]'), { ...blurIn, duration: 380 }, 2500)
    .add(q('[data-a=s2]'), { ...blurOut, duration: 380 }, 3600)
    .add(q('[data-a=s3]'), { ...blurIn, duration: 380 }, 3600)
    .add(q('[data-a=glow]'), { opacity: [1, 0], duration: 900, ease: 'outQuad' }, 3700)
    .add(q('[data-a=toast]'), { opacity: [0, 1], translateY: [24, 0], scale: [0.96, 1] }, 4100)
    .add(q('[data-a=bar]'), { scaleX: [0, 1], duration: 1700, ease: 'linear' }, 4300)
    .add(q('[data-a=chip]'), { scale: [1, 1.06, 1], duration: 500, ease: 'outQuad' }, 4400)
    .add(q('[data-a=msg], [data-a=parse], [data-a=new], [data-a=toast]'), { opacity: [1, 0], duration: 450, ease: 'outQuad' }, 7000)
    .add(q('[data-a=s3]'), { opacity: [1, 0], duration: 1 }, 7450)
    .add(q('[data-a=s1]'), { opacity: [0, 1], filter: ['blur(0px)', 'blur(0px)'], duration: 1 }, 7450)
    .add({ duration: 500 }, 7500));

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[1040px]" aria-hidden>
      {/* Janela do produto */}
      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#121211]/90 shadow-[0_40px_120px_-40px_rgba(209,67,24,0.45),0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" /><span className="size-2.5 rounded-full bg-white/15" />
          <span className="mx-auto flex items-center gap-2 rounded-md bg-white/[0.04] px-3 py-1 text-2xs text-dusk"><Lock size={10} />Optsolv Suporte</span>
        </div>
        <div className="grid grid-cols-[56px_1fr] md:grid-cols-[200px_1fr]">
          <div className="sidebar-surface on-night flex flex-col gap-1 border-r border-white/[0.05] p-2.5 md:p-3">
            {[LayoutDashboard, MessageSquareText, Inbox, PackageCheck, Presentation].map((I, i) => (
              <div key={i} className={cx('flex h-8 items-center gap-2.5 rounded-lg px-2 text-xs', i === 2 ? 'bg-white/[0.07] text-paper ring-1 ring-inset ring-white/[0.06]' : 'text-dusk/70')}>
                <I size={15} className={i === 2 ? 'text-orange-400' : ''} /><span className="hidden md:inline">{['Visão geral', 'Captura WhatsApp', 'Solicitações', 'Entregas', 'Apresentações'][i]}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div><div className="text-lg font-semibold tracking-tight text-paper md:text-2xl">Solicitações</div><div className="mt-0.5 text-2xs text-dusk md:text-xs">Portal, WhatsApp, API e agentes, num só lugar</div></div>
              <span data-a="chip" className="hidden items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-2xs font-semibold text-ok sm:inline-flex"><CheckCheck size={12} />13 concluídas no mês</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <div data-a="new" className="relative flex items-center gap-3 border-b border-white/[0.05] px-3 py-2.5">
                <span data-a="glow" className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-orange-500/5 to-transparent" style={{ opacity: 0 }} />
                <span className="relative font-mono text-2xs text-dusk">CE-18</span>
                <span className="relative flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs font-semibold text-paper"><MessageSquareText size={12} className="shrink-0 text-dusk" /><span className="truncate">Foto não anexa no app de campo</span></span>
                <span className="relative grid">
                  <span data-a="s1" className="col-start-1 row-start-1"><Pill tone="ink">Nova</Pill></span>
                  <span data-a="s2" className="col-start-1 row-start-1" style={{ opacity: 0 }}><Pill tone="info">Em andamento</Pill></span>
                  <span data-a="s3" className="col-start-1 row-start-1" style={{ opacity: 0 }}><Pill tone="ok">Concluída</Pill></span>
                </span>
              </div>
              {ROWS.map((r) => (
                <div key={r.code} className="flex items-center gap-3 border-b border-white/[0.05] px-3 py-2.5 last:border-0">
                  <span className="font-mono text-2xs text-dusk">{r.code}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-paper-3">{r.title}</span>
                  <span className="hidden text-2xs text-dusk md:inline">{r.who}</span>
                  <Pill tone={r.tone}>{r.status}</Pill>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[['Abertas', '15'], ['Em andamento', '6'], ['Entregas', '4']].map(([l, v], i) => (
                <div key={l} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-2xs uppercase tracking-wide text-dusk">{l}</div>
                  <div className={cx('mt-1 text-xl font-semibold tracking-tight tnum md:text-2xl', i === 2 ? 'text-orange-400' : 'text-paper')}>{v}</div>
                  <svg viewBox="0 0 100 24" className="mt-1.5 h-5 w-full" preserveAspectRatio="none"><path d={['M0 18 L20 14 L40 16 L60 9 L80 11 L100 5', 'M0 20 L20 18 L40 12 L60 14 L80 8 L100 9', 'M0 22 L20 20 L40 17 L60 12 L80 7 L100 3'][i]} fill="none" stroke={i === 2 ? '#FF6B3D' : 'rgba(255,255,255,0.28)'} strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mensagens coladas do WhatsApp */}
      <div className="absolute -left-20 top-24 hidden w-60 flex-col gap-2 xl:flex">
        <div data-a="msg" className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#1a1a19]/95 p-3 text-xs text-paper-3 shadow-2xl backdrop-blur"><span className="mb-1 block text-2xs font-semibold text-ok">Cliente · 09:42</span>A foto da vistoria não anexa no app de campo 😕</div>
        <div data-a="msg" className="ml-6 rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#1a1a19]/95 p-3 text-xs text-paper-3 shadow-2xl backdrop-blur"><span className="mb-1 block text-2xs font-semibold text-ok">Cliente · 09:43</span>Dá erro no Android, versão nova</div>
        <div data-a="parse" className="ml-6 flex origin-left items-center gap-2 rounded-xl bg-orange-500/15 px-3 py-2 text-2xs font-semibold text-orange-300 ring-1 ring-inset ring-orange-500/30"><Sparkles size={12} />Virou sugestão revisável</div>
      </div>

      {/* Entrega publicada */}
      <div data-a="toast" className="absolute -bottom-6 right-4 hidden w-72 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#1a1a19]/95 shadow-2xl backdrop-blur sm:block xl:-right-10">
        <div className="flex items-start gap-3 p-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-white"><PackageCheck size={16} /></span>
          <div className="min-w-0"><div className="text-xs font-semibold text-paper">Entrega publicada ao cliente</div><div className="mt-0.5 text-2xs text-dusk">Atende 2 solicitações · com evidência</div></div>
        </div>
        <div className="h-0.5 bg-white/[0.05]"><div data-a="bar" className="h-full origin-left bg-gradient-to-r from-orange-500 to-orange-300" /></div>
      </div>
    </div>
  );
}

/* ───────────────────────── Bento: cenas pequenas ───────────────────────── */

const STEPS = ['Nova', 'Triagem', 'Planejada', 'Andamento', 'Concluída'];
export function StepperVisual({ rich }: { rich?: boolean }) {
  const ref = useLoop<HTMLDivElement>((q) => {
    const tl = loop();
    tl.add(q('[data-a=fill]'), { scaleX: [0, 1], duration: 3600, ease: 'inOutQuad' }, 300);
    q('[data-a=dot]').forEach((d, i) => tl.add(d, { scale: [0.6, 1], backgroundColor: ['rgba(255,255,255,0.12)', '#FF6B3D'], duration: 500 }, 300 + i * 880));
    q('[data-a=lbl]').forEach((d, i) => tl.add(d, { opacity: [0.35, 1], duration: 400 }, 300 + i * 880));
    return tl.add(q('[data-a=done]'), { opacity: [0, 1], translateY: [8, 0] }, 4000).add({ duration: 1800 }, 4400);
  });
  return (
    <div ref={ref} className="px-1">
      <div className="relative mx-3 h-0.5 rounded-full bg-white/[0.08]"><div data-a="fill" className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-orange-600 to-orange-400" /></div>
      <div className="-mt-[7px] flex justify-between">
        {STEPS.map((s) => (
          <div key={s} className="flex w-12 flex-col items-center gap-2">
            <span data-a="dot" className="size-3 rounded-full bg-orange-500 ring-4 ring-[#151514]" />
            <span data-a="lbl" className="text-2xs font-medium text-paper-3">{s}</span>
          </div>
        ))}
      </div>
      <div data-a="done" className="mt-5 flex items-center gap-2 rounded-xl bg-white/[0.04] p-3 text-xs text-paper-3 ring-1 ring-inset ring-white/[0.06]">
        <Check size={14} className="text-ok" />O cliente vê cada etapa em linguagem clara, sem jargão.
      </div>
      {rich && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div data-a="done" className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-inset ring-orange-500/25">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-2xs text-dusk">CE-12</span><Pill tone="warn">Aguardando você</Pill></div>
            <div className="mt-2 text-xs font-semibold text-paper">Login expira rápido no celular</div>
            <div className="mt-1 text-2xs text-dusk">A equipe precisa da sua resposta para seguir.</div>
          </div>
          <div data-a="done" className="rounded-xl border-l-2 border-orange-500 bg-white/[0.03] p-3 ring-1 ring-inset ring-white/[0.06]">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-orange-300"><Sparkles size={11} />Novidade publicada</div>
            <div className="mt-2 text-xs font-semibold text-paper">Busca e ordenação de visitas</div>
            <div className="mt-1 text-2xs text-dusk">Atende 2 pedidos seus · com evidência</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CaptureVisual() {
  const ref = useLoop<HTMLDivElement>((q) => loop()
    .add(q('[data-a=b]'), { opacity: [0, 1], translateY: [10, 0], delay: stagger(260) }, 200)
    .add(q('[data-a=scan]'), { translateY: ['-10%', '1000%'], opacity: [0, 1, 0], duration: 1100, ease: 'inOutSine' }, 1150)
    .add(q('[data-a=s]'), { opacity: [0, 1], translateX: [-10, 0], delay: stagger(200) }, 2100)
    .add(q('[data-a=ck]'), { scale: [0.4, 1], opacity: [0, 1], delay: stagger(200), ease: 'outBack(1.6)' }, 2500)
    .add({ duration: 2400 }, 2900));
  return (
    <div ref={ref} className="grid grid-cols-2 gap-3">
      <div className="relative flex flex-col gap-1.5 overflow-hidden">
        <span data-a="scan" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-transparent via-orange-500/25 to-transparent" style={{ opacity: 0 }} />
        {['Relatório não abre desde ontem', 'Podem incluir filtro por obra?', 'Relatório ainda sem abrir 🙏'].map((t, i) => (
          <div key={t} data-a="b" className={cx('rounded-xl rounded-tl-sm bg-white/[0.05] px-2.5 py-2 text-2xs leading-snug text-paper-3', i === 1 && 'ml-3')}>{t}</div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {[{ t: 'Relatório não abre', b: <Pill tone="warn">possível repetida</Pill> }, { t: 'Filtro por obra', b: <Pill tone="info">melhoria</Pill> }].map((s) => (
          <div key={s.t} data-a="s" className="rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-inset ring-white/[0.07]">
            <div className="flex items-center gap-2 text-xs font-semibold text-paper"><span data-a="ck" className="grid size-3.5 place-items-center rounded bg-primary text-white"><Check size={10} strokeWidth={3} /></span>{s.t}</div>
            <div className="mt-1.5">{s.b}</div>
          </div>
        ))}
        <div className="mt-auto text-2xs text-dusk">Só grava depois da sua revisão.</div>
      </div>
    </div>
  );
}

export function EvidenceVisual() {
  const rows = [{ l: 'Benefício observado', w: 0.62, c: 'from-white/30 to-white/10' }, { l: 'Benefício esperado', w: 0.48, c: 'from-orange-300/60 to-orange-300/20' }, { l: 'Impacto medido', w: 0.8, c: 'from-orange-500 to-orange-600' }];
  const ref = useLoop<HTMLDivElement>((q) => loop()
    .add(q('[data-a=bar]'), { scaleX: [0, 1], delay: stagger(220), duration: 1100 }, 200)
    .add(q('[data-a=src]'), { opacity: [0, 1], translateY: [6, 0] }, 1300)
    .add({ duration: 2600 }, 1900));
  return (
    <div ref={ref} className="grid gap-3">
      {rows.map((r) => (
        <div key={r.l}>
          <div className="mb-1.5 flex justify-between text-2xs font-medium text-paper-3"><span>{r.l}</span></div>
          <div className="h-2 rounded-full bg-white/[0.05]"><div data-a="bar" className={cx('h-full origin-left rounded-full bg-gradient-to-r', r.c)} style={{ width: `${r.w * 100}%` }} /></div>
        </div>
      ))}
      <div data-a="src" className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-2xs text-paper-3 ring-1 ring-inset ring-white/[0.07]"><FileText size={11} className="text-orange-400" />Todo número medido traz a fonte</div>
    </div>
  );
}

export function DeckVisual() {
  // Leque: abre (expo-out, rápido) e fecha (in-out, movimento em tela). Cada carta tem seu destino.
  const FAN = [{ r: -9, x: -46, y: 8 }, { r: 0, x: 0, y: -6 }, { r: 9, x: 46, y: 8 }];
  const ref = useLoop<HTMLDivElement>((q) => {
    const tl = loop();
    q('[data-a=card]').forEach((c, i) => {
      const f = FAN[i];
      tl.add(c, { rotate: [0, f.r], translateX: [0, f.x], translateY: [0, f.y], duration: 1100 }, 300 + i * 60)
        .add(c, { rotate: [f.r, 0], translateX: [f.x, 0], translateY: [f.y, 0], duration: 900, ease: 'inOutCubic' }, 3200);
    });
    return tl.add({ duration: 600 }, 4100);
  });
  return (
    <div ref={ref} className="relative grid h-36 place-items-center">
      {['Números do período', 'Entregas', 'Resultados de jun. a out.'].map((t, i) => (
        <div key={t} data-a="card" className={cx('absolute w-44 rounded-xl border p-3 shadow-2xl', i === 2 ? 'grain-dark border-white/10' : 'border-white/[0.07] bg-[#1c1c1b]')} style={{ zIndex: i }}>
          <span className="eyebrow text-[9px] text-orange-300">Optsolv Suporte</span>
          <div className="mt-4 text-sm font-semibold leading-tight text-paper">{t}</div>
          <div className="mt-3 flex gap-1">{[0.5, 0.8, 0.35, 0.65].map((h, j) => <span key={j} className="w-2 rounded-sm bg-orange-500/70" style={{ height: 22 * h }} />)}</div>
        </div>
      ))}
    </div>
  );
}

const CODE = [
  ['$ ', 'curl', ' /api/v1/requests \\'],
  ['  ', '-H', ' "Authorization: Bearer osk_…"'],
  ['  ', '-d', ' \'{"title":"Filtro por obra"}\''],
  ['', '→', ' 201 · CE-19 criada via API'],
];
export function CodeVisual() {
  const ref = useLoop<HTMLDivElement>((q) => loop()
    .add(q('[data-a=ch]'), { opacity: [0, 1], duration: 1, delay: stagger(16) }, 200)
    .add(q('[data-a=ok]'), { opacity: [0, 1], translateY: [6, 0] }, '+=200')
    .add({ duration: 2600 }, '+=0'));
  return (
    <div ref={ref} className="rounded-xl bg-[#0b0b0a] p-4 font-mono text-[11.5px] leading-6 ring-1 ring-inset ring-white/[0.06]">
      {CODE.map((l, i) => (
        <div key={i} className={cx('whitespace-pre', i === 3 && 'mt-1')} data-a={i === 3 ? 'ok' : undefined}>
          {l.map((part, j) => <span key={j} className={j === 1 ? (i === 3 ? 'text-ok' : 'text-orange-400') : i === 3 ? 'text-ok' : 'text-paper-3'}>{i === 3 ? part : [...part].map((c, k) => <span key={k} data-a="ch">{c}</span>)}</span>)}
        </div>
      ))}
    </div>
  );
}

const TENANTS = ['Cidade Engenharia', 'Marca Ambiental', 'Seu próximo cliente'];
export function TenantVisual() {
  const ref = useLoop<HTMLDivElement>((q) => {
    const tl = loop();
    [0, 1, 0].forEach((k, n) => {
      const at = 200 + n * 1500;
      q('[data-a=t]').forEach((el, i) => tl.add(el, { opacity: i === k ? 1 : 0.28, scale: i === k ? 1.04 : 0.98, duration: 500 }, at));
    });
    return tl.add({ duration: 800 }, 4700);
  });
  return (
    <div ref={ref} className="flex items-center gap-4">
      <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-white/[0.1] to-white/[0.02] ring-1 ring-inset ring-white/10"><Lock size={20} className="text-orange-400" /><span className="absolute inset-0 rounded-2xl shadow-[0_0_30px_rgba(255,107,61,0.25)]" /></span>
      <div className="flex flex-col gap-1.5">
        {TENANTS.map((t) => <span key={t} data-a="t" className="w-fit rounded-full bg-white/[0.05] px-2.5 py-1 text-2xs font-medium text-paper ring-1 ring-inset ring-white/[0.08]">{t}</span>)}
      </div>
    </div>
  );
}

/* ───────────────────────── Integrações: hub com dados viajando ───────────────────────── */

const NODES = [
  { x: 70, y: 60, label: 'Portal do cliente', icon: Globe },
  { x: 70, y: 180, label: 'Captura WhatsApp', icon: MessageSquareText },
  { x: 70, y: 300, label: 'Equipe Optsolv', icon: UserRound },
  { x: 530, y: 110, label: 'API REST', icon: Code2 },
  { x: 530, y: 250, label: 'Agente de IA (MCP)', icon: Bot },
];
const CX = 300, CY = 180; // núcleo do hub: os pacotes de dados ficam parados aqui (sob o símbolo) entre um trajeto e outro
const pathFor = (n: { x: number; y: number }) => { const dx = (CX - n.x) * 0.55; return `M${n.x} ${n.y} C${n.x + dx} ${n.y}, ${CX - dx} ${CY}, ${CX} ${CY}`; };

export function HubDiagram() {
  const ref = useLoop<HTMLDivElement>((q) => {
    const tl = createTimeline({ autoplay: false, loop: true, defaults: { ease: 'inOutSine' } });
    tl.add(svg.createDrawable(q('[data-a=line]')), { draw: ['0 0', '0 1'], duration: 1200, delay: stagger(140), ease: 'inOutCubic' }, 0)
      .add(q('[data-a=node]'), { opacity: [0, 1], scale: [0.9, 1], delay: stagger(140), duration: 600, ease: 'outExpo' }, 200);
    q('[data-a=dot]').forEach((d, i) => {
      const p = q('[data-a=line]')[i];
      tl.add(d, { ...svg.createMotionPath(p), opacity: [0, 1, 1, 0], duration: 1600 }, 1500 + i * 260);
      tl.add(d, { ...svg.createMotionPath(p), opacity: [0, 1, 1, 0], duration: 1600 }, 3600 + ((i * 3) % 5) * 220);
    });
    return tl.add(q('[data-a=core]'), { scale: [1, 1.08, 1], duration: 700, ease: 'outQuad' }, 3000).add({ duration: 400 }, 6000);
  });
  return (
    <div ref={ref} className="relative mx-auto aspect-[600/360] w-full max-w-[600px]" aria-hidden>
      <svg viewBox="0 0 600 360" className="absolute inset-0 size-full overflow-visible">
        <defs><linearGradient id="hub-l" x1="0" x2="1"><stop offset="0" stopColor="rgba(255,255,255,0.12)" /><stop offset="1" stopColor="#FF6B3D" /></linearGradient></defs>
        {NODES.map((n, i) => <path key={i} data-a="line" d={pathFor(n)} fill="none" stroke="url(#hub-l)" strokeWidth="1.5" />)}
        {NODES.map((_, i) => <circle key={i} data-a="dot" r="3.5" fill="#FFAB8A" style={{ opacity: 0, transform: `translate(${CX}px, ${CY}px)`, filter: 'drop-shadow(0 0 6px #FF6B3D)' }} />)}
      </svg>
      <div data-a="core" className="absolute grid size-[19%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl bg-gradient-to-b from-white/[0.12] to-white/[0.02] ring-1 ring-inset ring-white/15 shadow-[0_0_60px_rgba(255,107,61,0.35)]" style={{ left: `${(CX / 600) * 100}%`, top: '50%' }}>
        <Symbol variant="laranja" height={34} />
      </div>
      {NODES.map((n) => (
        <div key={n.label} data-a="node" className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#171716]/95 px-3 py-1.5 text-2xs font-medium text-paper ring-1 ring-inset ring-white/10 shadow-xl md:text-xs" style={{ left: `${(n.x / 600) * 100}%`, top: `${(n.y / 360) * 100}%` }}>
          <n.icon size={13} className="text-orange-400" />{n.label}
        </div>
      ))}
    </div>
  );
}
