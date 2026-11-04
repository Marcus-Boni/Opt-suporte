import { Logo } from './logo';
import { MonthlyTrend, Distribution } from './charts';
import { CATEGORY, fmtDate } from '@/lib/labels';
import type { Slide, RequestCategory } from '@/lib/types';
import { cx } from './ui';

type Ev = { title: string; description: string | null; value: number | null; unit: string | null; source: string | null; link: string | null };
type Props = { slide: Slide; index: number; total: number; clientName: string; dark?: boolean; animate?: boolean };

/**
 * Renderiza um slide 16:9. `dark` = modo apresentação (cinematográfico); claro = editor/impressão.
 * Todo conteúdo vem de `slide.data`, calculado no servidor; aqui só há composição.
 * `data-reveal` marca o que o modo apresentação revela em cascata; `data-count` marca números que sobem.
 * Fora da apresentação esses atributos não fazem nada, então editor e PDF mostram tudo de imediato.
 */
/** Capa "Cliente · Resultados…": quebra no separador e a segunda parte vira a linha secundária (dois tons). */
function coverTitle(title: string, soft: string) {
  const i = title.indexOf(' · ');
  if (i < 0) return title;
  return <>{title.slice(0, i)}{' '}<span className={cx('block', soft)}>{title.slice(i + 3)}</span></>;
}

export function SlideView({ slide, index, total, clientName, dark = false, animate = false }: Props) {
  const d = (slide.data ?? {}) as Record<string, never>;
  const tone = dark ? { bg: 'grain-dark text-paper', muted: 'text-paper-3/70', soft: 'text-dusk', line: 'border-night-3', card: 'bg-night-2/80 border border-night-3' } : { bg: 'theme-light bg-white text-ink', muted: 'text-ink-3', soft: 'text-ink-4', line: 'border-line', card: 'bg-paper-2 border border-line' };
  const frame = (children: React.ReactNode, extra?: string) => (
    <div className={cx('relative w-full aspect-video overflow-hidden flex flex-col', tone.bg, extra)} style={{ containerType: 'inline-size' }}>
      <div className="flex-1 flex flex-col px-[6cqw] py-[5cqw]">{children}</div>
      <footer className={cx('flex items-center justify-between px-[6cqw] pb-[3cqw] text-[1.3cqw]', tone.soft)}>
        <span>{clientName} · Optsolv Suporte</span>
        <span className="tnum">{index + 1} / {total}</span>
      </footer>
    </div>
  );
  const H = ({ children, big }: { children: React.ReactNode; big?: boolean }) => <h2 data-reveal className={cx('font-semibold tracking-tighter text-balance', big ? 'text-[6.4cqw]' : 'text-[4.2cqw]', 'leading-[1.06]')}>{children}</h2>;
  const P = ({ children, className }: { children: React.ReactNode; className?: string }) => <p data-reveal className={cx('mt-[1.6cqw] text-[1.75cqw] max-w-[62ch]', 'leading-[1.45]', tone.muted, className)}>{children}</p>;
  const count = (v: number | null | undefined) => (typeof v === 'number' && Number.isInteger(v) ? v : undefined);

  switch (slide.kind) {
    case 'capa':
      return frame(<>
        <div data-reveal className="self-start"><Logo variant={dark ? 'claro' : 'laranja'} height={0} className="h-[3.2cqw] w-auto" /></div>
        <div className="my-auto">
          <H big>{coverTitle(slide.title, tone.soft)}</H>
          <P>{slide.body}</P>
        </div>
      </>);
    case 'contexto': {
      const nums = [
        { label: 'Solicitações registradas', v: d.requestsCreated as number }, { label: 'Concluídas', v: d.requestsConcluded as number },
        { label: 'Entregas publicadas', v: d.deliveriesPublished as number, accent: true }, { label: 'Evidências', v: d.evidences as number },
        { label: 'Tempo mediano (dias)', v: d.medianLeadDays as number | null }, { label: 'Abertas hoje', v: d.requestsOpen as number },
      ];
      const cat = Object.entries((d.byCategory as Record<string, number>) ?? {}).map(([k, v]) => ({ label: CATEGORY[k as RequestCategory] ?? k, value: v }));
      return frame(<>
        <H>{slide.title}</H>
        <P>{slide.body}</P>
        <div className="mt-auto grid grid-cols-6 gap-[1.5cqw]">
          {nums.map((n) => (
            <div key={n.label} data-reveal className={cx('rounded-[1.2cqw] p-[1.6cqw]', tone.card)}>
              <div data-count={count(n.v)} className={cx('text-[4.4cqw] font-semibold tracking-tighter tnum leading-none', n.accent ? 'text-orange-500' : '')}>{n.v === null || n.v === undefined ? '—' : n.v.toLocaleString('pt-BR')}</div>
              <div className={cx('mt-[0.8cqw] text-[1.2cqw] leading-snug', tone.muted)}>{n.label}{n.v === null && <span className="block">não informado</span>}</div>
            </div>
          ))}
        </div>
        {cat.length > 0 && <div data-reveal className="mt-[2cqw] text-[1.3cqw] w-[48%]"><Distribution items={cat} dark={dark} /></div>}
      </>);
    }
    case 'solicitacoes': {
      const items = (d.items as { id: string; code: string; title: string; status: string; category: string; closedAt: string | null }[]) ?? [];
      return frame(<>
        <H>{slide.title}</H>
        <P>{slide.body}</P>
        <ul className="mt-[2.4cqw] grid grid-cols-2 gap-x-[4cqw] gap-y-[1.1cqw]">
          {items.map((it) => <li key={it.id} data-reveal className={cx('flex items-baseline gap-[1cqw] border-b pb-[0.9cqw]', tone.line)}><span className="font-mono text-[1.3cqw] text-orange-500 shrink-0">{it.code}</span><span className="text-[1.7cqw] font-semibold leading-snug flex-1">{it.title}</span><span className={cx('text-[1.2cqw] shrink-0', tone.soft)}>{it.status}</span></li>)}
        </ul>
      </>);
    }
    case 'entrega': {
      if (d.empty) return frame(<><H>{slide.title}</H><P>{slide.body}</P></>);
      const groups = [['observado', 'Observado'], ['esperado', 'Esperado'], ['medido', 'Medido']] as const;
      const reqs = (d.requests as string[]) ?? [];
      return frame(<>
        <H>{slide.title}</H>
        <p data-reveal className="mt-[1cqw] text-[1.2cqw] font-semibold uppercase tracking-widest text-orange-500">Entrega publicada em {fmtDate(String(d.publishedAt))}</p>
        <P>{slide.body}</P>
        <div className="mt-auto grid grid-cols-[1.1fr_2fr] gap-[3cqw] items-start">
          <div data-reveal>
            <div className={cx('text-[1.15cqw] uppercase tracking-wide font-semibold mb-[0.8cqw]', tone.soft)}>Solicitações atendidas</div>
            {reqs.length ? <ul className="grid gap-[0.6cqw]">{reqs.map((r) => <li key={r} className="text-[1.35cqw] leading-snug">{r}</li>)}</ul> : <p className={cx('text-[1.3cqw]', tone.soft)}>Não informado</p>}
          </div>
          <div className="grid grid-cols-3 gap-[1.2cqw]">
            {groups.map(([k, label]) => {
              const evs = (d[k] as Ev[]) ?? [];
              return (
                <div key={k} data-reveal className={cx('rounded-[1.2cqw] p-[1.4cqw]', k === 'medido' ? (dark ? 'bg-primary text-primary-foreground' : 'bg-ink text-paper') : tone.card)}>
                  <div className={cx('text-[1.05cqw] uppercase tracking-wide font-semibold', k === 'medido' ? (dark ? 'text-ink/80' : 'text-white/80') : tone.soft)}>{label}</div>
                  {evs.length ? <ul className="mt-[0.8cqw] grid gap-[1cqw]">{evs.map((e, i) => <li key={i}>{e.value !== null && <div className="text-[3.2cqw] font-semibold tracking-tighter tnum leading-none"><span data-count={count(e.value)}>{e.value.toLocaleString('pt-BR')}</span> <span className="text-[1.1cqw] font-semibold tracking-normal opacity-80">{e.unit}</span></div>}<div className="text-[1.35cqw] font-semibold leading-snug mt-[0.3cqw]">{e.title}</div>{e.source && <div className="text-[1.05cqw] opacity-70 mt-[0.2cqw]">Fonte: {e.source}</div>}</li>)}</ul> : <p className={cx('mt-[0.8cqw] text-[1.2cqw]', k === 'medido' ? (dark ? 'text-ink/70' : 'text-white/60') : tone.soft)}>Não informado</p>}
                </div>
              );
            })}
          </div>
        </div>
      </>);
    }
    case 'evolucao': {
      const monthly = (d.monthly as { label: string; created: number; concluded: number; published: number }[]) ?? [];
      return frame(<>
        <H>{slide.title}</H>
        <P>{slide.body}</P>
        <div data-reveal className="mt-auto text-[1.4cqw]">{monthly.length ? <MonthlyTrend data={monthly} height={210} dark={dark} animate={animate} /> : <p className={tone.soft}>Não informado</p>}</div>
      </>);
    }
    case 'proximos': {
      const items = (d.items as { id: string; code: string; title: string; status: string }[]) ?? [];
      return frame(<>
        <H>{slide.title}</H>
        <P>{slide.body}</P>
        <ol className="mt-[2.4cqw] grid gap-[1.2cqw]">
          {items.map((it, i) => <li key={it.id} data-reveal className="flex items-center gap-[1.6cqw]"><span className="grid place-items-center size-[3.4cqw] rounded-full bg-primary text-primary-foreground text-[1.5cqw] font-semibold shrink-0">{i + 1}</span><span className="text-[1.9cqw] font-semibold leading-snug flex-1">{it.title}</span><span className={cx('text-[1.25cqw]', tone.soft)}>{it.code} · {it.status}</span></li>)}
        </ol>
      </>);
    }
    case 'encerramento':
      return frame(<>
        <div className="my-auto text-center flex flex-col items-center">
          <H big>{coverTitle(slide.title, tone.soft)}</H>
          <P className="mx-auto text-center">{slide.body}</P>
          <div data-reveal className="mt-[4cqw]"><Logo variant={dark ? 'claro' : 'laranja'} height={0} className="h-[4cqw] w-auto" /></div>
        </div>
      </>);
  }
}
