import { useId } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTip } from '@/components/ui/chart';
import { cn as cx } from '@/lib/utils';

/*
 * Visualização de dados no espírito do Bklit: eixos discretos, grade só horizontal,
 * áreas com degradê suave e barras arredondadas; o valor que importa (entregas) em laranja.
 */

type Monthly = { label: string; created: number; concluded: number; published: number };
const SERIES = { created: 'Abertas', concluded: 'Concluídas', published: 'Entregas' };

function palette(dark?: boolean) {
  return dark
    ? { created: '#9E9B97', concluded: '#F4F3F1', published: '#FF6B3D' }
    : { created: 'var(--ink-4)', concluded: 'var(--ink)', published: '#FF6B3D' }; // var(): segue o tema claro/escuro
}

/** Abertas e concluídas como áreas, entregas publicadas como barras. `animate` só no modo apresentação. */
export function MonthlyTrend({ data, height = 190, dark, animate = false }: { data: Monthly[]; height?: number; dark?: boolean; animate?: boolean }) {
  const id = useId();
  const c = palette(dark);
  return (
    <div>
      <div className={cx('flex items-center gap-4 text-xs mb-2', dark ? 'text-paper-3' : 'text-ink-3')}>
        {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px]" style={{ background: c[k] }} />{SERIES[k]}</span>
        ))}
      </div>
      <ChartContainer dark={dark} style={{ height }} role="img" aria-label="Solicitações abertas, concluídas e entregas publicadas por mês">
        <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -22 }} barCategoryGap="38%">
          <defs>
            <linearGradient id={`${id}-created`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.created} stopOpacity={0.22} /><stop offset="100%" stopColor={c.created} stopOpacity={0} /></linearGradient>
            <linearGradient id={`${id}-concluded`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c.concluded} stopOpacity={0.16} /><stop offset="100%" stopColor={c.concluded} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 4" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} fontSize={11} />
          <YAxis axisLine={false} tickLine={false} allowDecimals={false} fontSize={11} width={40} />
          <Tooltip content={<ChartTip dark={dark} labels={SERIES} />} cursor={{ strokeDasharray: '3 4' }} isAnimationActive={false} />
          <Area type="monotone" dataKey="created" stroke={c.created} strokeWidth={2} fill={`url(#${id}-created)`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: dark ? '#0F0E0A' : 'var(--card)' }} isAnimationActive={animate} animationDuration={900} animationEasing="ease-out" />
          <Area type="monotone" dataKey="concluded" stroke={c.concluded} strokeWidth={2} fill={`url(#${id}-concluded)`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: dark ? '#0F0E0A' : 'var(--card)' }} isAnimationActive={animate} animationDuration={900} animationEasing="ease-out" />
          <Bar dataKey="published" fill={c.published} radius={[4, 4, 2, 2]} maxBarSize={22} isAnimationActive={animate} animationDuration={700} animationEasing="ease-out" />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

/** Linha de tendência minúscula para um cartão de indicador. */
export function Sparkline({ data, color = '#FF6B3D', className }: { data: number[]; color?: string; className?: string }) {
  const id = useId();
  const rows = data.map((v, i) => ({ i, v }));
  return (
    <ChartContainer className={cx('h-9 w-24', className)} aria-hidden>
      <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ChartContainer>
  );
}

/** Barra empilhada de proporções com legenda; cresce da esquerda na primeira pintura. */
export function Distribution({ items, total, dark }: { items: { label: string; value: number; color?: string }[]; total?: number; dark?: boolean }) {
  const sum = (total ?? items.reduce((a, b) => a + b.value, 0)) || 1;
  const palette = ['#FF6B3D', 'var(--ink)', 'var(--ink-4)', '#FFAB8A', 'var(--line-2)', 'var(--ink-3)'];
  return (
    <div>
      <div className={cx('flex h-2.5 rounded-full overflow-hidden bar-grow', dark ? 'bg-night-3' : 'bg-paper-3')}>
        {items.map((it, i) => it.value > 0 && <span key={it.label} style={{ width: `${(it.value / sum) * 100}%`, background: it.color ?? palette[i % palette.length] }} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((it, i) => (
          <li key={it.label} className={cx('flex items-center gap-2 text-sm', dark ? 'text-paper-3' : 'text-ink-3')}>
            <span className="size-2 rounded-[2px] shrink-0" style={{ background: it.color ?? palette[i % palette.length] }} />
            <span className="truncate">{it.label}</span>
            <span className={cx('ml-auto tnum', dark ? 'text-paper' : 'text-ink')}>{it.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
