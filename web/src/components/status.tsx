import { Badge, cx } from './ui';
import { CATEGORY, PRIORITY, SOURCE, STATUS, statusLabel } from '@/lib/labels';
import { isInternalRole, useMe } from '@/lib/auth';
import type { RequestCategory, RequestPriority, RequestSource, RequestStatus } from '@/lib/types';
import { MessageSquareText, Globe, Bot, Code2, UserRound } from 'lucide-react';

export function StatusPill({ status, className }: { status: RequestStatus; className?: string }) {
  const me = useMe();
  const s = STATUS[status];
  return <Badge tone={s.tone} className={className}><span className="size-1.5 rounded-full bg-current opacity-80" />{statusLabel(status, isInternalRole(me.actor.role))}</Badge>;
}

export function PriorityMark({ priority, withLabel }: { priority: RequestPriority; withLabel?: boolean }) {
  const bars = { baixa: 1, media: 2, alta: 3, critica: 4 }[priority];
  const color = priority === 'critica' ? 'bg-bad' : priority === 'alta' ? 'bg-orange-500' : priority === 'media' ? 'bg-ink-4' : 'bg-ink-5';
  return (
    <span className="inline-flex items-center gap-1.5" title={`Prioridade ${PRIORITY[priority]}`}>
      <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={cx('w-[3px] rounded-sm', i <= bars ? color : 'bg-paper-3')} style={{ height: 3 + i * 2.5 }} />)}
      </span>
      {withLabel ? <span className="text-xs font-semibold text-ink-3">{PRIORITY[priority]}</span> : <span className="sr-only">Prioridade {PRIORITY[priority]}</span>}
    </span>
  );
}

export function SourceIcon({ source, size = 14 }: { source: RequestSource; size?: number }) {
  const I = { portal: Globe, admin: UserRound, captura_whatsapp: MessageSquareText, api: Code2, mcp: Bot }[source];
  return <span className="inline-flex items-center gap-1 text-ink-4" title={SOURCE[source]}><I size={size} aria-hidden /><span className="sr-only">Origem: {SOURCE[source]}</span></span>;
}

export function RequestCode({ code, number, className }: { code: string; number: number; className?: string }) {
  return <span className={cx('font-mono text-xs text-ink-4 tracking-tight', className)}>{code}-{number}</span>;
}
