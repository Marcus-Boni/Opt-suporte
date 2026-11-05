import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, FolderKanban, Users, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { ROLE, fmtDate } from '@/lib/labels';
import type { Client, ClientDetail } from '@/lib/types';
import { Badge, Button, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, Skeleton, Textarea } from '@/components/ui';
import { CardsSkeleton, DetailSkeleton } from '@/components/skeletons';
import { toast } from '@/lib/toast';

export function ClientsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const { setClientId } = useScope();
  const [open, setOpen] = useState(false);
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get<Client[]>('/clients') });
  const isAdmin = me.actor.role === 'admin_optsolv';
  const create = useMutation({
    mutationFn: (body: { name: string; shortCode?: string; segment?: string; description?: string }) => api.post<Client>('/clients', body),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['clients'] }); qc.invalidateQueries({ queryKey: ['me'] }); setOpen(false); toast.ok(`Cliente ${c.name} criado.`); },
    onError: (e) => toast.bad(e.message),
  });

  return (
    <div>
      <PageHeader title="Clientes" lead="Cada cliente é um espaço isolado: seus usuários só enxergam o que pertence a ele." actions={isAdmin && <Button icon={<Plus />} onClick={() => setOpen(true)}>Novo cliente</Button>} />
      {clients.isError && <ErrorState error={clients.error} retry={() => clients.refetch()} />}
      {clients.isLoading ? <CardsSkeleton variant="client" count={2} /> : clients.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4 rise-list">
          {clients.data.map((c) => (
            <Link key={c.id} to={`/app/clientes/${c.id}`} onClick={() => setClientId(c.id)} className="card p-5 card-interactive group">
              <div className="flex items-start gap-4">
                <span className="grid place-items-center size-12 rounded-xl bg-ink text-paper text-md font-semibold tracking-tight">{c.shortCode}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold group-hover:text-orange-700 transition-colors">{c.name}</h2>
                  <p className="text-sm text-ink-3">{c.segment ?? 'Segmento não informado'}</p>
                </div>
                <ArrowUpRight size={18} className="text-ink-5 group-hover:text-orange-600" />
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <div><dt className="text-ink-4">Projetos</dt><dd className="text-2xl font-semibold tnum">{c.projectCount}</dd></div>
                <div><dt className="text-ink-4">Abertas</dt><dd className="text-2xl font-semibold tnum">{c.openRequests}</dd></div>
                <div><dt className="text-ink-4">Entregas</dt><dd className="text-2xl font-semibold tnum text-orange-600">{c.publishedDeliveries}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      ) : <EmptyState icon={<Building2 />} title="Nenhum cliente ainda" text="Crie o primeiro cliente para começar a registrar projetos e solicitações." action={isAdmin && <Button onClick={() => setOpen(true)}>Criar cliente</Button>} />}

      <Dialog open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ name: String(f.get('name')), shortCode: String(f.get('shortCode') || '') || undefined, segment: String(f.get('segment') || '') || undefined, description: String(f.get('description') || '') || undefined }); }} className="grid gap-4">
          <Field label="Nome"><Input name="name" required minLength={2} placeholder="Ex.: Construtora Horizonte" autoFocus /></Field>
          <div className="grid grid-cols-[100px_1fr] gap-3">
            <Field label="Sigla" hint="Prefixo dos códigos"><Input name="shortCode" maxLength={4} placeholder="CH" className="uppercase font-mono" /></Field>
            <Field label="Segmento"><Input name="segment" placeholder="Ex.: Construção civil" /></Field>
          </div>
          <Field label="Descrição"><Textarea name="description" placeholder="Contexto do cliente e dos sistemas atendidos." /></Field>
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={create.isPending}>Criar cliente</Button></div>
        </form>
      </Dialog>
    </div>
  );
}

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { setClientId } = useScope();
  const client = useQuery({ queryKey: ['client', id], queryFn: () => api.get<ClientDetail>(`/clients/${id}`) });
  const createProject = useMutation({
    mutationFn: (body: { name: string; code?: string; description?: string }) => api.post('/projects', { clientId: id, ...body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['client', id] }); qc.invalidateQueries({ queryKey: ['projects'] }); qc.invalidateQueries({ queryKey: ['clients'] }); setOpen(false); toast.ok('Projeto criado.'); },
    onError: (e) => toast.bad(e.message),
  });
  if (client.isLoading) return <DetailSkeleton aside={false} />;
  if (client.isError || !client.data) return <ErrorState error={client.error} retry={() => client.refetch()} />;
  const c = client.data;
  return (
    <div>
      <PageHeader
        crumbs={<><Link to="/app/clientes" className="hover:text-ink">Clientes</Link><span>/</span><span className="font-mono">{c.shortCode}</span></>}
        title={c.name} lead={c.description ?? c.segment ?? undefined}
        actions={<>
          <Button variant="secondary" onClick={() => setClientId(c.id)}>Usar como contexto</Button>
          <Button icon={<Plus />} onClick={() => setOpen(true)}>Novo projeto</Button>
        </>}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 *:min-w-0">
        <section className="card p-5 md:p-6 rise">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><FolderKanban size={16} className="text-ink-4" />Projetos</h2>
          {c.projects.length ? (
            <ul className="divide-y divide-line">
              {c.projects.map((p) => (
                <li key={p.id} className="py-3 flex items-center gap-4">
                  <span className="font-mono text-xs text-ink-4 w-16 shrink-0">{p.code}</span>
                  <div className="min-w-0 flex-1"><div className="text-base font-semibold">{p.name}</div>{p.description && <div className="text-sm text-ink-3">{p.description}</div>}</div>
                  <Link to={`/app/solicitacoes?projectId=${p.id}`} onClick={() => setClientId(c.id)} className="text-sm font-semibold text-orange-700 shrink-0">Solicitações</Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sem projetos" text="Solicitações e entregas sempre pertencem a um projeto. Crie o primeiro." action={<Button size="sm" onClick={() => setOpen(true)}>Criar projeto</Button>} />}
        </section>
        <section className="card p-5 md:p-6 rise" style={{ animationDelay: '80ms' }}>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><Users size={16} className="text-ink-4" />Usuários do portal</h2>
          {c.users.length ? (
            <ul className="grid gap-2">
              {c.users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-base">
                  <span className="grid place-items-center size-8 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">{u.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold truncate">{u.name}</span><span className="block text-xs text-ink-4 truncate">{u.email}</span></span>
                  {!u.isActive ? <Badge tone="neutral">inativo</Badge> : <span className="text-xs text-ink-4">{ROLE[u.role]}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-base text-ink-4">Nenhum usuário do cliente. Crie em <Link className="link" to="/app/acessos">Acessos</Link>.</p>}
          <p className="mt-5 text-xs text-ink-5">Cliente desde {fmtDate(c.createdAt)}.</p>
        </section>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Novo projeto em ${c.name}`}>
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); createProject.mutate({ name: String(f.get('name')), code: String(f.get('code') || '') || undefined, description: String(f.get('description') || '') || undefined }); }} className="grid gap-4">
          <Field label="Nome do projeto"><Input name="name" required minLength={2} placeholder="Ex.: Portal de Fornecedores" autoFocus /></Field>
          <Field label="Código" hint="Curto, sem espaços"><Input name="code" maxLength={12} placeholder="FORNEC" className="uppercase font-mono" /></Field>
          <Field label="Descrição"><Textarea name="description" placeholder="O que o sistema faz e quem usa." /></Field>
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" loading={createProject.isPending}>Criar projeto</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
