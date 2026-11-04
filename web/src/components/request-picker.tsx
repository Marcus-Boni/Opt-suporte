import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, qs } from '@/lib/api';
import type { Paged, RequestRow } from '@/lib/types';
import { Checkbox, Input, Label, Skeleton, cx } from './ui';
import { StatusPill, RequestCode } from './status';

/** Lista de solicitações do cliente para vincular a uma entrega (seleção múltipla). */
export function RequestPicker({ clientId, selected, onToggle, exclude = [] }: { clientId: string; selected: string[]; onToggle: (id: string) => void; exclude?: string[] }) {
  const [search, setSearch] = useState('');
  const q = useQuery({ queryKey: ['requests', 'picker', clientId, search], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ clientId, search, pageSize: 50 })}`), enabled: !!clientId });
  const items = (q.data?.items ?? []).filter((r) => !exclude.includes(r.id));
  return (
    <div className="rounded-xl border border-line-2 bg-card overflow-hidden">
      <div className="relative border-b border-line"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou número" className="border-0 rounded-none pl-9 focus-visible:ring-0" /></div>
      {/* relative: os inputs ocultos (absolutos) do Checkbox do Radix ficam presos ao recorte da lista; sem isso esticam a página. */}
      <ul className="relative max-h-[300px] overflow-auto overscroll-contain divide-y divide-line">
        {q.isLoading && <li className="p-3"><Skeleton className="h-5" /></li>}
        {items.map((r) => {
          const on = selected.includes(r.id);
          return (
            <li key={r.id}>
              <Label className={cx('flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-paper-2/60 font-normal', on && 'bg-orange-50/70')}>
                <Checkbox checked={on} onCheckedChange={() => onToggle(r.id)} aria-label={`Selecionar ${r.title}`} />
                <RequestCode code={r.clientCode} number={r.number} className="w-14 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold truncate">{r.title}</span>
                <StatusPill status={r.status} />
              </Label>
            </li>
          );
        })}
        {!q.isLoading && !items.length && <li className="p-4 text-sm text-ink-4 text-center">Nenhuma solicitação encontrada.</li>}
      </ul>
    </div>
  );
}
