import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Bug, Check, ChevronDown, CircleHelp, Copy, Lightbulb, Loader2, MessageCircleQuestion, Paperclip, Sparkles, X, LifeBuoy, ArrowUpRight, Search, Bell } from 'lucide-react';
import { cx } from '@/components/ui';
import { toast } from '@/lib/toast';

/**
 * Pré-visualização do widget de suporte dentro de uma solução Optsolv fictícia.
 * Segue a especificação publicada em /integracoes/skills/optsolv-suporte-widget/especificacao.md.
 * Nada é gravado: o envio é simulado.
 */
const KINDS = [
  { value: 'problema', label: 'Problema', icon: Bug, hint: 'O que aconteceu, onde e o que você esperava que acontecesse.' },
  { value: 'duvida', label: 'Dúvida', icon: MessageCircleQuestion, hint: 'Qual é a sua dúvida sobre o sistema?' },
  { value: 'melhoria', label: 'Melhoria', icon: Sparkles, hint: 'O que poderia funcionar melhor no dia a dia?' },
  { value: 'nova_funcionalidade', label: 'Nova função', icon: Lightbulb, hint: 'O que você precisa que o sistema ainda não faz?' },
] as const;
const URGENCY = [
  { value: 'pode_esperar', label: 'Posso esperar' },
  { value: 'atrapalha', label: 'Atrapalha' },
  { value: 'impede', label: 'Impede meu trabalho' },
] as const;
const MAX = 4000;

type Props = { solution: string; clientCode: string; dark: boolean };

export function WidgetPreview({ solution, clientCode, dark }: Props) {
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState<'form' | 'sending' | 'done'>('form');
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('problema');
  const [text, setText] = useState('');
  const [urgency, setUrgency] = useState<(typeof URGENCY)[number]['value']>('atrapalha');
  const [files, setFiles] = useState<string[]>([]);
  const [withContext, setWithContext] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [protocol, setProtocol] = useState('');
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const k = KINDS.find((x) => x.value === kind)!;
  const valid = text.trim().length >= 5;

  // Abre com foco no primeiro campo; Esc fecha e devolve o foco ao inicializador.
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }); }, [open, stage]);
  const close = () => { setOpen(false); requestAnimationFrame(() => launcher.current?.focus({ preventScroll: true })); };
  const reset = () => { setStage('form'); setText(''); setFiles([]); setKind('problema'); setUrgency('atrapalha'); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setStage('sending');
    window.setTimeout(() => { setProtocol(`${clientCode}-${100 + Math.floor(Math.random() * 900)}`); setStage('done'); }, 900);
  };

  const context = `Tela: /visitas/nova\nVersão: 2.4.1\nNavegador: ${navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Chrome'} · ${navigator.platform || 'Desktop'}\nTela: ${window.screen.width}×${window.screen.height}\nRegistrado em: ${new Date().toLocaleString('pt-BR')}`;

  return (
    <div className={cx('relative isolate h-[620px] overflow-hidden rounded-2xl border border-line bg-paper text-ink', dark ? 'dark' : 'theme-light')}>
      <HostApp solution={solution} />

      {/* Painel */}
      <div ref={panel} role="dialog" aria-modal="false" aria-labelledby={titleId} hidden={!open}
        onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        className={cx('wg-panel absolute bottom-24 right-5 z-20 flex max-h-[calc(100%-7.5rem)] w-[min(380px,calc(100%-2.5rem))] flex-col overflow-hidden rounded-[20px] bg-card shadow-pop ring-1 ring-line')}>
        <header className="relative flex items-center gap-3 overflow-hidden px-4 pb-3.5 pt-4 text-white" style={{ background: 'linear-gradient(135deg, #D14318 0%, #A8340F 100%)' }}>
          <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><LifeBuoy className="size-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="truncate text-md font-semibold leading-tight">Suporte · {solution}</h3>
            <p className="text-xs text-white/80">Equipe Optsolv · responde em horário comercial</p>
          </div>
          <button type="button" onClick={close} aria-label="Fechar suporte" className="grid size-8 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"><X className="size-4" /></button>
        </header>

        {stage === 'done' ? (
          <div className="wg-step flex flex-1 flex-col items-center px-6 py-8 text-center" aria-live="polite">
            <span className="wg-pop grid size-14 place-items-center rounded-full bg-ok-soft text-ok"><Check className="size-7" strokeWidth={2.5} /></span>
            <h4 className="mt-4 text-xl font-semibold tracking-tight">Recebemos sua solicitação</h4>
            <p className="mt-1 max-w-[30ch] text-sm text-ink-3">A equipe Optsolv vai analisar e responder por aqui e pelo portal.</p>
            <button type="button" data-autofocus onClick={() => { navigator.clipboard?.writeText(protocol); toast.ok('Protocolo copiado.'); }}
              className="group mt-5 inline-flex items-center gap-2 rounded-xl border border-line-2 bg-paper-2 px-4 py-2.5 font-mono text-lg font-semibold tracking-wide text-ink transition-colors hover:border-ink-5">
              {protocol}<Copy className="size-3.5 text-ink-4 transition-colors group-hover:text-ink" aria-label="Copiar protocolo" />
            </button>
            <div className="mt-6 grid w-full gap-2">
              <span className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#D14318] text-sm font-semibold text-white">Acompanhar no portal <ArrowUpRight className="size-4" /></span>
              <button type="button" onClick={reset} className="h-10 rounded-xl text-sm font-semibold text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink">Abrir outra solicitação</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="wg-step flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-4">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-2">O que aconteceu?</legend>
                <div className="grid grid-cols-4 gap-1.5">
                  {KINDS.map((o, i) => {
                    const on = kind === o.value;
                    return (
                      <label key={o.value} className={cx('relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-center text-2xs font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#FF6B3D]',
                        on ? 'border-[#D14318] bg-orange-50 text-orange-800' : 'border-line-2 text-ink-3 hover:border-ink-5 hover:text-ink')}>
                        <input type="radio" name="wg-kind" value={o.value} checked={on} onChange={() => setKind(o.value)} className="sr-only" {...(i === 0 ? { 'data-autofocus': true } : {})} />
                        <o.icon className="size-[18px]" aria-hidden />{o.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="grid gap-1.5">
                <span className="flex items-baseline justify-between text-sm font-semibold text-ink-2">Descreva <span className={cx('text-2xs font-normal tnum', text.length > MAX * 0.9 ? 'text-warn' : 'text-ink-5')}>{text.length}/{MAX}</span></span>
                <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX))} rows={4} required minLength={5}
                  placeholder={k.hint} className="min-h-[104px] resize-none rounded-xl border border-line-2 bg-card px-3 py-2.5 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-5 hover:border-ink-5 focus:border-[#FF6B3D] focus:ring-4 focus:ring-orange-100" />
              </label>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-ink-2">Quanto isso afeta seu trabalho?</legend>
                <div className="relative grid grid-cols-3 rounded-xl bg-paper-2 p-1">
                  <span aria-hidden className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-card shadow-card transition-transform duration-200 ease-out motion-reduce:transition-none"
                    style={{ transform: `translateX(${URGENCY.findIndex((u) => u.value === urgency) * 100}%)` }} />
                  {URGENCY.map((u) => (
                    <label key={u.value} className={cx('relative z-10 cursor-pointer rounded-lg px-1 py-1.5 text-center text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#FF6B3D]', urgency === u.value ? 'text-ink' : 'text-ink-4 hover:text-ink-2')}>
                      <input type="radio" name="wg-urgency" value={u.value} checked={urgency === u.value} onChange={() => setUrgency(u.value)} className="sr-only" />{u.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt,.csv,.json,.xlsx,.docx" className="sr-only" aria-label="Anexar arquivos"
                  onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? []).map((x) => x.name)].slice(0, 3)); e.target.value = ''; }} />
                <div className="flex flex-wrap items-center gap-1.5">
                  {files.map((f, i) => (
                    <span key={i} className="wg-pop inline-flex h-7 max-w-[160px] items-center gap-1.5 rounded-lg bg-paper-2 pl-2 pr-1 text-xs text-ink-2">
                      <Paperclip className="size-3 shrink-0 text-ink-4" /><span className="truncate">{f}</span>
                      <button type="button" onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} aria-label={`Remover ${f}`} className="grid size-5 place-items-center rounded-md text-ink-4 hover:bg-paper-3 hover:text-ink"><X className="size-3" /></button>
                    </span>
                  ))}
                  {files.length < 3 && (
                    <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-dashed border-line-2 px-2.5 text-xs font-semibold text-ink-3 transition-colors hover:border-ink-5 hover:text-ink">
                      <Paperclip className="size-3.5" />Anexar captura ou arquivo
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-paper-2/60 px-3 py-2.5">
                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-ink-2">
                  <span className="relative inline-flex">
                    <input type="checkbox" checked={withContext} onChange={(e) => setWithContext(e.target.checked)} className="peer sr-only" />
                    <span className="h-5 w-9 rounded-full bg-line-2 transition-colors peer-checked:bg-[#D14318] peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF6B3D]" />
                    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 peer-checked:translate-x-4 motion-reduce:transition-none" />
                  </span>
                  Incluir contexto técnico
                  <button type="button" onClick={() => setShowContext((v) => !v)} aria-expanded={showContext} className="ml-auto inline-flex items-center gap-0.5 font-semibold text-ink-4 hover:text-ink">
                    Ver o que vai <ChevronDown className={cx('size-3.5 transition-transform duration-200', showContext && 'rotate-180')} />
                  </button>
                </label>
                <div className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none" style={{ gridTemplateRows: showContext ? '1fr' : '0fr' }}>
                  <pre className={cx('overflow-hidden whitespace-pre-wrap font-mono text-2xs leading-relaxed text-ink-3', showContext && 'mt-2', !withContext && 'line-through opacity-50')}>{context}</pre>
                </div>
              </div>
            </div>

            <footer className="flex items-center gap-3 border-t border-line px-4 py-3">
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-2xs text-ink-4"><CircleHelp className="size-3.5 shrink-0" />Sem dados de senha ou formulários.</span>
              <button type="submit" disabled={!valid || stage === 'sending'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#D14318] px-4 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(209,67,24,0.6)] transition-[background-color,transform,opacity] duration-150 hover:bg-[#BC3C15] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none">
                {stage === 'sending' ? <><Loader2 className="size-4 animate-spin" />Enviando…</> : 'Enviar'}
              </button>
            </footer>
          </form>
        )}
      </div>

      {/* Inicializador */}
      <button ref={launcher} type="button" onClick={() => (open ? close() : setOpen(true))} aria-expanded={open} aria-label={open ? 'Fechar suporte' : 'Abrir suporte'}
        className="group absolute bottom-5 right-5 z-20 inline-flex h-14 items-center gap-2 rounded-full bg-[#D14318] pl-4 pr-5 text-white shadow-[0_12px_30px_-8px_rgba(209,67,24,0.65)] transition-[transform,background-color] duration-150 ease-out hover:bg-[#BC3C15] active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF6B3D]">
        <span className="relative grid size-6 place-items-center">
          <LifeBuoy className={cx('absolute size-[22px] transition-[transform,opacity] duration-200', open ? 'rotate-90 scale-50 opacity-0' : 'opacity-100')} />
          <X className={cx('absolute size-[22px] transition-[transform,opacity] duration-200', open ? 'opacity-100' : '-rotate-90 scale-50 opacity-0')} />
        </span>
        <span className="text-sm font-semibold">Suporte</span>
      </button>
    </div>
  );
}

/** Tela de uma solução Optsolv fictícia, só para dar contexto ao widget. */
function HostApp({ solution }: { solution: string }) {
  const rows = [
    ['Vistoria · Bloco B', 'Carla Nunes', 'Hoje, 09:40', 'Concluída'],
    ['Medição de fundação', 'Rafael Lima', 'Hoje, 11:15', 'Em campo'],
    ['Entrega de chaves · 304', 'Ana Prates', 'Amanhã, 08:00', 'Agendada'],
    ['Inspeção elétrica', 'Bruno Sá', 'Amanhã, 14:30', 'Agendada'],
    ['Visita técnica · Torre 2', 'Lia Moraes', 'Sex, 10:00', 'Agendada'],
  ];
  const tone: Record<string, string> = { Concluída: 'bg-ok-soft text-ok', 'Em campo': 'bg-orange-50 text-orange-800', Agendada: 'bg-info-soft text-info' };
  return (
    <div aria-hidden className="pointer-events-none flex h-full select-none">
      <aside className="hidden w-48 shrink-0 flex-col gap-1 border-r border-line bg-card p-3 sm:flex">
        <div className="mb-3 flex items-center gap-2 px-1"><span className="grid size-7 place-items-center rounded-lg bg-ink text-xs font-bold text-paper">{solution.slice(0, 1)}</span><span className="truncate text-sm font-semibold">{solution}</span></div>
        {['Painel', 'Visitas', 'Obras', 'Equipe', 'Relatórios'].map((n, i) => (
          <span key={n} className={cx('rounded-lg px-2.5 py-1.5 text-sm', i === 1 ? 'bg-paper-2 font-semibold text-ink' : 'text-ink-4')}>{n}</span>
        ))}
      </aside>
      <main className="min-w-0 flex-1 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-ink-5"><Search className="size-4" />Buscar visitas</div>
          <Bell className="size-4 text-ink-4" /><span className="size-8 rounded-full bg-paper-3" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Visitas de campo</h2>
        <p className="text-sm text-ink-4">Semana de 3 a 7 de novembro</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
          {rows.map(([t, who, when, st]) => (
            <div key={t} className="flex items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate font-medium">{t}</span>
              <span className="hidden w-28 truncate text-ink-4 md:block">{who}</span>
              <span className="hidden w-28 text-ink-4 lg:block">{when}</span>
              <span className={cx('rounded-full px-2 py-0.5 text-2xs font-semibold', tone[st])}>{st}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
