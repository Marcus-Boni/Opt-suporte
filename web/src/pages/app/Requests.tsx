import { useEffect, useState, type FormEvent } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Plus, Search, UserRoundX, Paperclip, MessageCircle, PackageCheck } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { CATEGORY, PRIORITY, STATUS_ORDER, fmtRelative, statusLabel } from '@/lib/labels';
import type { Paged, Project, RequestRow, RequestDetail, TeamMember } from '@/lib/types';
import { Avatar, Button, Chip, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, SimpleSelect, Skeleton, Textarea, cx } from '@/components/ui';
import { RowsSkeleton } from '@/components/skeletons';
import { StatusPill, RequestCode, PriorityMark, SourceIcon } from '@/components/status';
import { toast } from '@/lib/toast';

const CATEGORY_OPTIONS = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY).map(([value, label]) => ({ value, label }));

export function RequestsPage() {
  const me = useMe();
  const { clientId } = useScope();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(false);
  const status = sp.get('status') ?? '';
  const search = sp.get('search') ?? '';
  const projectId = sp.get('projectId') ?? '';
  const category = sp.get('category') ?? '';
  const unassigned = sp.get('unassigned') === '1';
  const page = Number(sp.get('page') ?? 1);
  // Parte da URL atual, não do `sp` do render: o debounce da busca e cliques seguidos usariam parâmetros velhos e desfariam filtros.
  const patch = (p: Record<string, string>) => { const n = new URLSearchParams(window.location.search); for (const [k, v] of Object.entries(p)) { if (v) n.set(k, v); else n.delete(k); } if (!('page' in p)) n.delete('page'); setSp(n, { replace: true }); };
  const set = (k: string, v: string) => patch({ [k]: v });

  const q = useQuery({ queryKey: ['requests', { clientId, status, search, projectId, category, unassigned, page }], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ clientId, status, search, projectId, category, unassigned: unassigned || undefined, page, pageSize: 25 })}`) });
  const projects = useQuery({ queryKey: ['projects', clientId], queryFn: () => api.get<Project[]>(`/projects${qs({ clientId })}`) });
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamMember[]>('/team') });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  const OPEN = 'nova,em_triagem,planejada,em_andamento,aguardando_cliente';
  // Primeiro nível: as quatro perguntas do dia a dia. O resto (status fino, projeto, categoria) fica atrás de "Filtros".
  const chips: { value: string; label: string }[] = [{ value: OPEN, label: 'Abertas' }, { value: 'aguardando_cliente', label: 'Aguardando cliente' }, { value: 'concluida', label: 'Concluídas' }, { value: '', label: 'Todas' }];
  const fineStatus = status && !chips.some((c) => c.value === status) ? status : '';
  const activeCount = [fineStatus, projectId, category].filter(Boolean).length;
  const [more, setMore] = useState(activeCount > 0);
  const [term, setTerm] = useState(search);
  // Zera tudo (busca, chips e painel); o termo local também, senão o debounce recolocaria a busca.
  const clearAll = () => { setTerm(''); setSp({}, { replace: true }); toast.info('Filtros limpos.'); };
  useEffect(() => { const t = setTimeout(() => { if (term !== search) set('search', term); }, 300); return () => clearTimeout(t); }, [term]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <PageHeader title="Solicitações" lead="Tudo que chegou pelo portal, WhatsApp, API ou agentes, no escopo dos clientes que você atende." actions={<Button icon={<Plus />} onClick={() => setOpen(true)}>Nova solicitação</Button>} />
      <div className="rise mb-4 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" /><Input aria-label="Buscar" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por título ou nº" className="h-9 pl-9 text-sm" /></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situação">
            {chips.map((c) => <Chip key={c.value} active={status === c.value && !unassigned} onClick={() => patch({ status: c.value, unassigned: '' })}>{c.label}</Chip>)}
            <Chip active={unassigned} onClick={() => set('unassigned', unassigned ? '' : '1')}><UserRoundX size={14} />Sem responsável</Chip>
          </div>
          <Button variant={more ? 'dark' : 'secondary'} size="sm" className="ml-auto rounded-full" icon={<SlidersHorizontal />} onClick={() => setMore((m) => !m)} aria-expanded={more}>Filtros{activeCount > 0 && <span className="ml-1 font-mono">{activeCount}</span>}</Button>
        </div>
        {more && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 p-2">
            <div className="w-full sm:w-[200px]"><SimpleSelect size="sm" aria-label="Status detalhado" value={fineStatus} onValueChange={(v) => set('status', v || OPEN)} options={[{ value: '', label: 'Qualquer status' }, ...STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s, true) }))]} /></div>
            <div className="w-full sm:w-[220px]"><SimpleSelect size="sm" aria-label="Projeto" value={projectId} onValueChange={(v) => set('projectId', v)} options={[{ value: '', label: 'Todos os projetos' }, ...(projects.data ?? []).map((p) => ({ value: p.id, label: clientId ? p.name : `${p.clientName} · ${p.name}` }))]} /></div>
            <div className="w-full sm:w-[170px]"><SimpleSelect size="sm" aria-label="Categoria" value={category} onValueChange={(v) => set('category', v)} options={[{ value: '', label: 'Toda categoria' }, ...CATEGORY_OPTIONS]} /></div>
            {(activeCount > 0 || search || unassigned) && <Button variant="ghost" size="sm" onClick={clearAll}>Limpar filtros</Button>}
          </div>
        )}
      </div>

      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <RowsSkeleton rows={8} /> : q.data?.items.length ? (
        <div className="card overflow-hidden rise">
          <ul className="divide-y divide-line">
            {q.data.items.map((r) => (
              <li key={r.id}>
                <Link to={`/app/solicitacoes/${r.id}`} className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[72px_1fr_160px_120px_140px] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-paper-2/60 transition-colors">
                  <RequestCode code={r.clientCode} number={r.number} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0"><SourceIcon source={r.source} /><span className="text-base font-semibold truncate">{r.title}</span></div>
                    <div className="text-xs text-ink-4 truncate">{!clientId && <span className="font-semibold text-ink-3">{r.clientName} · </span>}{r.projectName} · {CATEGORY[r.category]} · atualizada {fmtRelative(r.updatedAt)}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-sm text-ink-3 min-w-0">{r.assigneeName ? <><Avatar name={r.assigneeName} size={22} /><span className="truncate">{r.assigneeName}</span></> : <span className="inline-flex items-center gap-1 text-ink-4"><UserRoundX size={14} />sem responsável</span>}</div>
                  <div className="hidden md:flex items-center gap-3 text-xs text-ink-4"><PriorityMark priority={r.priority} />{r.commentCount > 0 && <span className="inline-flex items-center gap-0.5"><MessageCircle size={13} />{r.commentCount}</span>}{r.attachmentCount > 0 && <span className="inline-flex items-center gap-0.5"><Paperclip size={13} />{r.attachmentCount}</span>}{r.deliveryCount > 0 && <span className="inline-flex items-center gap-0.5 text-orange-700"><PackageCheck size={13} />{r.deliveryCount}</span>}</div>
                  <div className="justify-self-end"><StatusPill status={r.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-ink-4">
            <span>{q.data.total} {q.data.total === 1 ? 'solicitação' : 'solicitações'}</span>
            {pages > 1 && <div className="flex items-center gap-2"><Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => set('page', String(page - 1))}>Anterior</Button><span className="tnum">{page} / {pages}</span><Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => set('page', String(page + 1))}>Próxima</Button></div>}
          </div>
        </div>
      ) : <EmptyState icon={<Inbox size={28} />} title="Nenhuma solicitação com esses filtros" text="Ajuste os filtros, registre uma nova solicitação ou capture mensagens do WhatsApp." action={<div className="flex gap-2"><Button variant="secondary" onClick={clearAll}>Limpar filtros</Button><Button onClick={() => setOpen(true)}>Nova solicitação</Button></div>} />}

      <NewRequestDialog open={open} onClose={() => setOpen(false)} projects={projects.data ?? []} team={team.data ?? []} clients={me.clients} defaultClientId={clientId} />
    </div>
  );
}

export function NewRequestDialog({ open, onClose, projects, clients, defaultClientId }: { open: boolean; onClose: () => void; projects: Project[]; team: TeamMember[]; clients: { id: string; name: string }[]; defaultClientId: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [cid, setCid] = useState(defaultClientId || clients[0]?.id || '');
  const [pid, setPid] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) setCid(defaultClientId || clients[0]?.id || ''); }, [open, defaultClientId, clients]);
  const list = projects.filter((p) => !cid || p.clientId === cid);
  const listKey = list.map((p) => p.id).join(',');
  useEffect(() => { if (!list.some((p) => p.id === pid)) setPid(list[0]?.id ?? ''); }, [listKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<RequestDetail>('/requests', body),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['metrics'] }); setError(null); onClose(); toast.ok(`${r.clientCode}-${r.number} registrada.`); nav(`/app/solicitacoes/${r.id}`); },
    onError: (e) => setError(e.message),
  });
  return (
    <Dialog open={open} onClose={onClose} title="Nova solicitação" width={560}>
      <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ projectId: pid, title: String(f.get('title') || '') || undefined, description: f.get('description'), category: f.get('category'), priority: f.get('priority'), source: 'admin' }); }}>
        {error && <p role="alert" className="text-sm text-bad bg-bad-soft rounded-md px-3 py-2">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Cliente"><SimpleSelect value={cid} onValueChange={setCid} options={clients.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Projeto"><SimpleSelect value={pid} onValueChange={setPid} options={list.map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o projeto" /></Field>
        </div>
        <Field label="Descrição" hint="O título é gerado a partir da primeira frase se ficar em branco."><Textarea name="description" required minLength={5} rows={4} autoFocus placeholder="O que precisa ser feito, onde acontece e qual o impacto." /></Field>
        <Field label="Título (opcional)"><Input name="title" maxLength={140} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria"><SimpleSelect name="category" defaultValue="melhoria" options={CATEGORY_OPTIONS} /></Field>
          <Field label="Prioridade"><SimpleSelect name="priority" defaultValue="media" options={PRIORITY_OPTIONS} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={create.isPending} disabled={!pid}>Registrar</Button></div>
      </form>
    </Dialog>
  );
}
