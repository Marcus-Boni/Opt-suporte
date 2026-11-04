import { useDeferredValue, useEffect, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Building2, Inbox, PackagePlus, Search } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { statusLabel } from '@/lib/labels';
import type { Paged, RequestRow } from '@/lib/types';
import { RequestCode } from '@/components/status';

export type Page = { to: string; label: string; icon: ComponentType<{ size?: number; className?: string }> };
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Paleta de comandos (Ctrl/⌘ K): ir para uma página, trocar o cliente em foco e achar uma solicitação
 * pela busca do servidor (título, descrição ou número). Aberta por teclado, por isso sem animação.
 */
export function CommandPalette({ pages, open, onOpenChange }: { pages: Page[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate();
  const me = useMe();
  const { clientId, setClientId } = useScope();
  const [q, setQ] = useState('');
  const term = useDeferredValue(q.trim());
  const search = useQuery({
    queryKey: ['requests', 'palette', term, clientId],
    queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ search: term, clientId, pageSize: 8 })}`),
    enabled: open && term.length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(!open); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  const run = (fn: () => void) => { onOpenChange(false); fn(); };
  const hit = (s: string) => !term || s.toLowerCase().includes(term.toLowerCase());
  const pagesHit = pages.filter((p) => hit(p.label));
  const clientsHit = me.clients.filter((c) => hit(c.name) || hit(c.shortCode));
  const results = search.data?.items ?? [];
  // Itens chegam depois da digitação (busca no servidor): a seleção segue o primeiro item disponível.
  const first = results[0] ? `req-${results[0].id}` : pagesHit[0] ? `page-${pagesHit[0].to}` : clientsHit[0] ? (term ? `scope-${clientsHit[0].id}` : 'scope-all') : '';
  const [sel, setSel] = useState('');
  useEffect(() => { setSel(first); }, [first]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} value={sel} onValueChange={setSel}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Buscar solicitação, página ou cliente…" autoFocus />
      <CommandList label="Resultados da busca">
        <CommandEmpty>{term.length >= 2 && search.isFetching ? 'Buscando…' : 'Nada encontrado.'}</CommandEmpty>
        {results.length > 0 && (
          <CommandGroup heading="Solicitações">
            {results.map((r) => (
              <CommandItem key={r.id} value={`req-${r.id}`} onSelect={() => run(() => nav(`/app/solicitacoes/${r.id}`))}>
                <Inbox />
                <RequestCode code={r.clientCode} number={r.number} className="shrink-0" />
                <span className="truncate">{r.title}</span>
                <CommandShortcut>{statusLabel(r.status, true)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pagesHit.length > 0 && (
          <CommandGroup heading="Ir para">
            {pagesHit.map((p) => <CommandItem key={p.to} value={`page-${p.to}`} onSelect={() => run(() => nav(p.to))}><p.icon size={16} />{p.label}</CommandItem>)}
            {hit('nova entrega') && <CommandItem value="page-nova-entrega" onSelect={() => run(() => nav('/app/entregas/nova'))}><PackagePlus />Nova entrega</CommandItem>}
          </CommandGroup>
        )}
        {clientsHit.length > 0 && (
          <CommandGroup heading="Cliente em foco">
            {!term && <CommandItem value="scope-all" onSelect={() => run(() => setClientId(''))}><Search />Todos os clientes{!clientId && <CommandShortcut>atual</CommandShortcut>}</CommandItem>}
            {clientsHit.map((c) => (
              <CommandItem key={c.id} value={`scope-${c.id}`} onSelect={() => run(() => setClientId(c.id))}>
                <Building2 />{c.name}<CommandShortcut>{c.id === clientId ? 'atual' : c.shortCode}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
