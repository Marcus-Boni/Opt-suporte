import * as React from 'react';
import { ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

/**
 * Contêiner de gráfico (padrão shadcn/ui "chart", reduzido ao que o produto usa):
 * mede o espaço disponível e aplica a tipografia/cores do sistema aos elementos do Recharts.
 */
export function ChartContainer({ className, children, dark, ...props }: React.ComponentProps<'div'> & { dark?: boolean; children: React.ComponentProps<typeof ResponsiveContainer>['children'] }) {
  return (
    <div
      data-slot="chart"
      data-theme={dark ? 'dark' : 'light'}
      className={cn(
        'relative w-full text-2xs [&_.recharts-cartesian-axis-tick_text]:fill-ink-4 data-[theme=dark]:[&_.recharts-cartesian-axis-tick_text]:fill-ink-5 [&_.recharts-cartesian-grid_line]:stroke-line data-[theme=dark]:[&_.recharts-cartesian-grid_line]:stroke-night-3 [&_.recharts-tooltip-cursor]:stroke-line-2 data-[theme=dark]:[&_.recharts-tooltip-cursor]:stroke-night-3 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-paper-2/70 data-[theme=dark]:[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-night-3/60',
        className,
      )}
      {...props}
    >
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  );
}

type TipItem = { name?: string | number; value?: number | string | ReadonlyArray<number | string>; color?: string; dataKey?: string | number };

/** Tooltip escura, compacta, números no mono. Recebe o que o Recharts entrega ao `content`. */
export function ChartTip({ active, label, payload, dark, labels }: { active?: boolean; label?: React.ReactNode; payload?: ReadonlyArray<TipItem>; dark?: boolean; labels?: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn('rounded-lg px-3 py-2 shadow-pop text-xs min-w-[132px]', dark ? 'bg-paper text-ink' : 'bg-ink text-paper')}>
      {label !== undefined && <div className={cn('text-2xs font-medium tnum mb-1', dark ? 'text-ink-4' : 'text-ink-5')}>{label}</div>}
      <ul className="grid gap-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
            <span className="size-2 rounded-[2px] shrink-0" style={{ background: p.color }} />
            <span className="flex-1 truncate">{labels?.[String(p.dataKey)] ?? p.name}</span>
            <span className="tnum font-semibold">{Array.isArray(p.value) ? p.value.join('–') : String(p.value ?? '—')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
