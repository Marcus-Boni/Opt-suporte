import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Paperclip, X, Check } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { CATEGORY, fmtRelative } from '@/lib/labels';
import type { Paged, Project, RequestCategory, RequestDetail, RequestRow } from '@/lib/types';
import { Badge, Button, ButtonLink, Card, CardContent, Chip, EmptyState, ErrorState, Field, Input, SimpleSelect, Skeleton, Textarea } from '@/components/ui';
import { RowsSkeleton } from '@/components/skeletons';
import { Tip } from '@/components/ui/tooltip';
import { StatusPill, RequestCode } from '@/components/status';
import { ACCEPT, MAX_MB, uploadFile } from '@/components/attachments';
import { toast } from '@/lib/toast';

const FILTERS = [{ value: '', label: 'Todas' }, { value: 'abertas', label: 'Em aberto' }, { value: 'aguardando_cliente', label: 'Aguardando você' }, { value: 'concluida', label: 'Concluídas' }];

export function PortalRequestsPage() {
  const [sp, setSp] = useSearchParams();
  const filter = sp.get('status') ?? '';
  const status = filter === 'abertas' ? 'nova,em_triagem,planejada,em_andamento,aguardando_cliente' : filter;
  const q = useQuery({ queryKey: ['requests', 'portal', status], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ status, pageSize: 50 })}`) });
  return (
    <div>
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-semibold tracking-tight">Solicitações</h1><p className="mt-1 text-md text-ink-3">Tudo que sua equipe pediu, com a situação atual de cada item.</p></div><ButtonLink to="/portal/solicitacoes/nova">Nova solicitação</ButtonLink></header>
      <div className="rise flex flex-wrap gap-1.5 mb-4">{FILTERS.map((f) => <Chip key={f.value} active={filter === f.value} onClick={() => setSp(f.value ? { status: f.value } : {}, { replace: true })} className="h-9 px-4 text-sm">{f.label}</Chip>)}</div>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <RowsSkeleton rows={6} /> : q.data?.items.length ? (
        <ul className="card divide-y divide-line rise">{q.data.items.map((r) => (
          <li key={r.id}><Link to={`/portal/solicitacoes/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-paper-2/60">
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><RequestCode code={r.clientCode} number={r.number} /><span className="text-md font-semibold truncate">{r.title}</span></div><div className="mt-0.5 text-sm text-ink-4">{r.projectName} · {CATEGORY[r.category]} · {r.authorLabel} · atualizada {fmtRelative(r.updatedAt)}{r.attachmentCount > 0 && <span className="inline-flex items-center gap-0.5 ml-2"><Paperclip size={12} />{r.attachmentCount}</span>}</div></div>
            <StatusPill status={r.status} />
          </Link></li>
        ))}</ul>
      ) : <EmptyState icon={<Inbox size={28} />} title="Nenhuma solicitação aqui" text={filter ? 'Nenhuma solicitação com esse filtro.' : 'Conte para a gente o que precisa: um problema, uma melhoria, uma ideia ou uma dúvida.'} action={<ButtonLink to="/portal/solicitacoes/nova">Abrir solicitação</ButtonLink>} />}
    </div>
  );
}

export function PortalNewRequestPage() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ['projects', 'portal'], queryFn: () => api.get<Project[]>('/projects') });
  const [category, setCategory] = useState<RequestCategory>('problema');
  const [projectId, setProjectId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const effectiveProject = projectId || projects.data?.[0]?.id || '';
  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await api.post<RequestDetail>('/requests', body);
      for (const f of files) await uploadFile(`/requests/${r.id}/attachments`, f);
      return r;
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['metrics'] }); toast.ok(`Solicitação ${r.clientCode}-${r.number} registrada. Vamos avisar quando houver novidade.`); nav(`/portal/solicitacoes/${r.id}`); },
    onError: (e) => setError(e.message),
  });
  return (
    <div className="max-w-[640px]">
      <header className="rise mb-6"><h1 className="text-4xl font-semibold tracking-tight">Nova solicitação</h1><p className="mt-1 text-md text-ink-3">Descreva com suas palavras. Nossa equipe classifica e responde por aqui.</p></header>
      <Card className="rise ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-5 md:p-6">
        <form className="grid gap-5" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ projectId: effectiveProject, description: f.get('description'), title: String(f.get('title') || '') || undefined, category, source: 'portal' }); }}>
          {error && <p role="alert" className="text-sm text-bad bg-bad-soft rounded-md px-3 py-2">{error}</p>}
          <Field label="O que você precisa?" hint="Diga o que acontece, onde e qual o impacto para a equipe."><Textarea name="description" required minLength={5} rows={5} autoFocus placeholder="Ex.: No celular, o menu não abre quando toco no ícone…" /></Field>
          <div>
            <span className="label">Tipo</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label="Tipo">{(Object.keys(CATEGORY) as RequestCategory[]).map((k) => <Chip key={k} active={category === k} onClick={() => setCategory(k)} className="h-10 rounded-lg">{CATEGORY[k]}</Chip>)}</div>
          </div>
          <Field label="Sistema ou projeto"><SimpleSelect value={effectiveProject} onValueChange={setProjectId} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} placeholder="Carregando…" /></Field>
          <Field label="Título (opcional)" hint="Se deixar em branco, usamos a primeira frase."><Input name="title" maxLength={140} /></Field>
          <div>
            <span className="label">Anexos <span className="font-normal text-ink-4">(imagens, PDF, planilhas · até {MAX_MB} MB cada)</span></span>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple className="sr-only" aria-label="Escolher arquivos" onChange={(e) => { setFiles((f) => [...f, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
            <div className="flex flex-wrap items-center gap-2">
              {files.map((f, i) => <Badge key={i} tone="neutral" className="h-8 pl-3 pr-1.5 text-sm"><Paperclip size={13} />{f.name}<Tip label="Remover anexo"><Button type="button" variant="ghost" size="icon-sm" className="size-5 rounded-full hover:bg-card" onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} aria-label="Remover"><X className="size-3" /></Button></Tip></Badge>)}
              <Button type="button" variant="secondary" size="sm" icon={<Paperclip />} onClick={() => fileRef.current?.click()}>Adicionar arquivo</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1"><Button type="submit" size="lg" loading={create.isPending} disabled={!effectiveProject} icon={<Check />}>Enviar solicitação</Button><Button type="button" variant="ghost" onClick={() => nav(-1)}>Cancelar</Button></div>
          <p className="text-xs text-ink-4">Você está abrindo como {me.actor.label}. O histórico fica visível para toda a equipe de {me.clients[0]?.name}.</p>
        </form>
      </CardContent></Card>
    </div>
  );
}
