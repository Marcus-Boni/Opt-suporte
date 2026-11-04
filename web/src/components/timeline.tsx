import { EVENT_LABEL, fmtDateTime } from '@/lib/labels';
import type { RequestEvent } from '@/lib/types';
import { cx } from './ui';

export function Timeline({ events, compact }: { events: RequestEvent[]; compact?: boolean }) {
  if (!events.length) return <p className="text-sm text-ink-4">Sem histórico ainda.</p>;
  return (
    <ol className="relative pl-5">
      <span className="absolute left-[5px] top-1 bottom-1 w-px thread-line" aria-hidden />
      {events.map((e) => {
        const label = EVENT_LABEL[e.type]?.(e) ?? `${e.type}: ${e.toValue ?? ''}`;
        const strong = e.type === 'criada' || e.type === 'entrega_publicada' || e.type === 'reaberta';
        return (
          <li key={e.id} className={cx('relative', compact ? 'pb-3' : 'pb-4')}>
            <span className={cx('absolute -left-5 top-[5px] size-[11px] rounded-full border-2 border-paper', strong ? 'bg-orange-500' : 'bg-ink-5')} aria-hidden />
            <div className={cx('text-sm leading-snug', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</div>
            {e.note && e.type !== 'entrega_vinculada' && e.type !== 'entrega_publicada' && <div className="mt-0.5 text-sm text-ink-3">“{e.note}”</div>}
            <div className="mt-0.5 text-xs text-ink-4">{e.actorLabel} · {fmtDateTime(e.createdAt)}{!e.isPublic && <span className="ml-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-5">interno</span>}</div>
          </li>
        );
      })}
    </ol>
  );
}
