import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PackageCheck, Plus, Link2, Sparkles } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { fmtDate, fromInputDate } from '@/lib/labels';
import type { DeliveryDetail, DeliveryRow, Paged, Project, RequestDetail } from '@/lib/types';
import { Badge, Button, ButtonLink, Card, CardContent, DatePicker, EmptyState, ErrorState, Field, Input, PageHeader, Segmented, SimpleSelect, Skeleton, Textarea, cx } from '@/components/ui';
import { CardsSkeleton } from '@/components/skeletons';
import { RequestPicker } from '@/components/request-picker';
import { toast } from '@/lib/toast';

export function DeliveriesPage() {
  const { clientId } = useScope();
  const [status, setStatus] = useState<'' | 'rascunho' | 'publicada'>('');
  const q = useQuery({ queryKey: ['deliveries', clientId, status], queryFn: () => api.get<Paged<DeliveryRow>>(`/deliveries${qs({ clientId, status, pageSize: 50 })}`) });
  return (
    <div>
      <PageHeader title="Entregas" lead="O que foi realizado, com as solicitações atendidas e as evidências de valor. O cliente só vê o que está publicado." actions={<><Segmented value={status} onChange={setStatus} options={[{ value: '', label: 'Todas' }, { value: 'publicada', label: 'Publicadas' }, { value: 'rascunho', label: 'Rascunhos' }]} /><ButtonLink to="/app/entregas/nova" icon={<Plus />}>Nova entrega</ButtonLink></>} />
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <CardsSkeleton variant="delivery" /> : q.data?.items.length ? (
        <ul className="grid md:grid-cols-2 gap-4 rise-list">
          {q.data.items.map((d) => (
            <li key={d.id}>
              <Link to={`/app/entregas/${d.id}`} className={cx('card block p-5 h-full card-interactive border-t-[3px]', d.status === 'publicada' ? 'border-orange-500' : 'border-line-2')}>
                <div className="flex items-center justify-between gap-3 text-xs text-ink-4"><span>{!clientId && <span className="font-semibold text-ink-3">{d.clientName} · </span>}{d.projectName}</span>{d.status === 'publicada' ? <Badge tone="orange">publicada {fmtDate(d.publishedAt)}</Badge> : <Badge tone="neutral">rascunho</Badge>}</div>
                <h2 className="mt-2 text-xl font-semibold leading-snug">{d.title}</h2>
                <p className="mt-1.5 text-base text-ink-3 line-clamp-2">{d.summary}</p>
                <div className="mt-4 flex items-center gap-4 text-xs text-ink-4"><span className="inline-flex items-center gap-1"><Link2 size={13} />{d.requestCount} {d.requestCount === 1 ? 'solicitação' : 'solicitações'}</span><span className={cx('inline-flex items-center gap-1', d.evidenceCount > 0 && 'text-orange-700 font-semibold')}><Sparkles size={13} />{d.evidenceCount} evidência{d.evidenceCount === 1 ? '' : 's'}</span><span className="ml-auto">{d.ownerLabel}</span></div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<PackageCheck size={28} />} title="Nenhuma entrega registrada" text="Registre o que foi feito, vincule as solicitações atendidas e anexe evidências antes de publicar." action={<ButtonLink to="/app/entregas/nova">Registrar entrega</ButtonLink>} />}
    </div>
  );
}

export function NewDeliveryPage() {
  const me = useMe();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { clientId: scoped, setClientId: setScoped } = useScope();
  const preset = sp.get('requestId');
  const presetReq = useQuery({ queryKey: ['request', preset], queryFn: () => api.get<RequestDetail>(`/requests/${preset}`), enabled: !!preset });
  const [clientId, setClientId] = useState(scoped || me.clients[0]?.id || '');
  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<string[]>(preset ? [preset] : []);
  useEffect(() => { if (presetReq.data) { setClientId(presetReq.data.clientId); setProjectId(presetReq.data.projectId); } }, [presetReq.data]);
  const projects = useQuery({ queryKey: ['projects', clientId], queryFn: () => api.get<Project[]>(`/projects${qs({ clientId })}`), enabled: !!clientId });
  useEffect(() => { if (projects.data && !projects.data.some((p) => p.id === projectId)) setProjectId(projects.data[0]?.id ?? ''); }, [projects.data, projectId]);
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<DeliveryDetail>('/deliveries', body),
    onSuccess: (d) => { setScoped(clientId); toast.ok('Entrega registrada como rascunho.'); nav(`/app/entregas/${d.id}`); },
    onError: (e) => toast.bad(e.message),
  });
  return (
    <div>
      <PageHeader crumbs={<><Link to="/app/entregas" className="hover:text-ink">Entregas</Link><span>/</span><span>Nova</span></>} title="Registrar entrega" lead="Descreva em linguagem simples o que mudou para o cliente. Evidências e publicação vêm depois." />
      <form className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ projectId, title: f.get('title'), summary: f.get('summary'), details: String(f.get('details') || '') || undefined, deliveredAt: fromInputDate(String(f.get('deliveredAt'))).toISOString(), requestIds: selected }); }}>
        <Card className="rise ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-5 md:p-6 grid gap-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Cliente"><SimpleSelect value={clientId} onValueChange={(v) => { setClientId(v); setSelected([]); }} options={me.clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Escolha o cliente" empty="Nenhum cliente cadastrado" emptyAction={me.actor.role === 'admin_optsolv' && <Link to="/app/clientes" className="link">Cadastrar</Link>} /></Field>
            <Field label="Projeto"><SimpleSelect value={projectId} onValueChange={setProjectId} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o projeto" loading={!!clientId && projects.isLoading} empty={clientId ? 'Nenhum projeto' : 'Escolha o cliente'} emptyAction={!!clientId && <Link to={`/app/clientes/${clientId}`} className="link">Criar</Link>} /></Field>
          </div>
          <Field label="Nome da entrega"><Input name="title" required minLength={2} maxLength={140} placeholder="Ex.: Busca e ordenação de visitas" autoFocus /></Field>
          <Field label="Resumo para o cliente" hint="Uma ou duas frases, sem jargão técnico."><Textarea name="summary" required minLength={5} rows={3} placeholder="Ex.: Agora dá para buscar visitas por obra e ordenar pela data." /></Field>
          <Field label="Detalhes (opcional)"><Textarea name="details" rows={5} placeholder="Como foi feito, limitações, o que muda no dia a dia." /></Field>
          <Field label="Data da entrega"><DatePicker name="deliveredAt" required defaultValue={new Date()} className="sm:w-60" /></Field>
          <div className="flex items-center gap-2 pt-1"><Button type="submit" loading={create.isPending} disabled={!projectId}>Salvar rascunho</Button><Button type="button" variant="ghost" onClick={() => nav(-1)}>Cancelar</Button></div>
        </CardContent></Card>
        <section className="rise" style={{ animationDelay: '80ms' }}>
          <h2 className="text-md font-semibold mb-2">Solicitações atendidas <span className="text-ink-4 font-semibold">({selected.length})</span></h2>
          <p className="text-sm text-ink-4 mb-3">Uma entrega pode atender várias solicitações, e uma solicitação pode aparecer em várias entregas.</p>
          {clientId && <RequestPicker clientId={clientId} selected={selected} onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />}
        </section>
      </form>
    </div>
  );
}
