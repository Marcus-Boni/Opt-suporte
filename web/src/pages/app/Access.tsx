import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Copy, ShieldCheck, Bot, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { ROLE, fmtDateTime, fmtRelative } from '@/lib/labels';
import type { AuditRow, Credential, Role, UserRow } from '@/lib/types';
import { Badge, Button, Card, CardContent, Checkbox, Confirm, Dialog, ErrorState, Field, Input, Label, SimpleSelect, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cx } from '@/components/ui';
import { RowsSkeleton } from '@/components/skeletons';
import { Tip } from '@/components/ui/tooltip';
import { PasswordField } from '@/components/password-field';
import { Link } from 'react-router';
import { toast } from '@/lib/toast';

const ROLE_OPTIONS = Object.entries(ROLE).map(([value, label]) => ({ value, label }));

export function AccessPage() {
  const me = useMe();
  const qc = useQueryClient();
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: () => api.get<{ entra: boolean }>('/auth/providers'), staleTime: Infinity, retry: false });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<UserRow[]>('/users') });
  const creds = useQuery({ queryKey: ['credentials'], queryFn: () => api.get<Credential[]>('/credentials') });
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api.get<AuditRow[]>('/audit?limit=40') });
  const [userOpen, setUserOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'user' | 'cred'; id: string; name: string } | null>(null);
  const [role, setRole] = useState<Role>('cliente');
  const [credRole, setCredRole] = useState<Role>('colaborador_optsolv');
  const [token, setToken] = useState<string | null>(null);
  const clientName = (id: string | null) => me.clients.find((c) => c.id === id)?.name ?? '—';
  const clientOptions = me.clients.map((c) => ({ value: c.id, label: c.name }));
  const [who, setWho] = useState({ name: '', email: '' });
  const hints = useMemo(() => [who.name, who.email.split('@')[0]], [who]);
  const noClients = me.clients.length === 0;
  const addClient = <Link to="/app/clientes" className="link">Cadastrar cliente</Link>;
  // Papel que exige cliente sem nenhum cadastrado: o formulário explica e não envia.
  const userBlocked = noClients && role !== 'admin_optsolv';
  const credBlocked = noClients && credRole !== 'admin_optsolv';

  const createUser = useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/users', b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['audit'] }); setUserOpen(false); toast.ok('Usuário criado.'); }, onError: (e) => toast.bad(e.message) });
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [draftRole, setDraftRole] = useState<Role>('colaborador_optsolv');
  const [draftClients, setDraftClients] = useState<string[]>([]);
  const openEdit = (u: UserRow) => { setEditing(u); setDraftRole(u.role); setDraftClients(u.clientIds); };
  const saveAccess = useMutation({
    mutationFn: () => api.patch(`/users/${editing!.id}`, { role: draftRole, ...(draftRole === 'colaborador_optsolv' ? { clientIds: draftClients } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['audit'] }); toast.ok(`Acesso de ${editing?.name} atualizado.`); setEditing(null); },
    onError: (e) => toast.bad(e.message),
  });
  const pending = (users.data ?? []).filter((u) => u.isActive && u.role === 'colaborador_optsolv' && !u.clientIds.length);
  const toggleUser = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/users/${id}`, { isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }), onError: (e) => toast.bad(e.message) });
  const createCred = useMutation({ mutationFn: (b: Record<string, unknown>) => api.post<{ token: string }>('/credentials', b), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['credentials'] }); qc.invalidateQueries({ queryKey: ['audit'] }); setCredOpen(false); setToken(r.token); }, onError: (e) => toast.bad(e.message) });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/credentials/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['credentials'] }); toast.ok('Credencial revogada.'); }, onError: (e) => toast.bad(e.message) });

  if (me.actor.role !== 'admin_optsolv') return <ErrorState error={new Error('Área restrita a administradores.')} />;
  const section = 'ring-0 shadow-card rounded-2xl py-0';

  return (
    <div>
      <header className="rise mb-6 md:mb-8"><h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Acessos e API</h1><p className="mt-2 text-md text-ink-3 max-w-[64ch]">Usuários do backoffice e do portal, credenciais para API/MCP e trilha de auditoria. A documentação OpenAPI está em <a className="link" href="/docs" target="_blank" rel="noreferrer">/docs</a>.</p></header>

      {providers.data?.entra && me.user && !me.user.microsoft && (
        <div className="rise mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card px-5 py-4 shadow-card">
          <ShieldCheck size={18} className="shrink-0 text-orange-700" />
          <span className="min-w-0 flex-1 text-sm text-ink-3"><b className="font-semibold text-ink">Vincule sua conta Microsoft.</b> Depois disso você entra com a conta corporativa; a senha fica só para emergência.</span>
          <a href="/api/v1/auth/entra/login?link=1&next=%2Fapp%2Facessos" className="pressable inline-flex h-9 items-center gap-2 rounded-lg border border-line-2 bg-card px-3.5 text-sm font-semibold text-ink transition-colors hover:border-ink-5 hover:bg-paper-2">Vincular conta Microsoft</a>
        </div>
      )}

      <Card className={cx(section, 'rise')}><CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Usuários</h2><Button size="sm" icon={<Plus />} onClick={() => { setWho({ name: '', email: '' }); setUserOpen(true); }}>Novo usuário</Button></div>
        {pending.length > 0 && (
          <div role="status" className="fade-in mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <UserPlus size={16} className="shrink-0 text-orange-700" />
            <span className="min-w-0 flex-1"><b className="font-semibold">{pending.length === 1 ? '1 pessoa da equipe aguarda' : `${pending.length} pessoas da equipe aguardam`} liberação de clientes:</b> {pending.map((u) => u.name).join(', ')}.</span>
            {pending.length === 1 && <Button size="sm" variant="secondary" onClick={() => openEdit(pending[0])}>Liberar acesso</Button>}
          </div>
        )}
        {users.isLoading ? <RowsSkeleton bare rows={4} code={false} /> : (
          <Table className="text-sm min-w-[640px]">
            <TableHeader><TableRow className="text-xs uppercase tracking-wide text-ink-4 hover:bg-transparent"><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead>Escopo</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{users.data?.map((u) => (
              <TableRow key={u.id} className={cx(!u.isActive && 'opacity-50')}>
                <TableCell className="font-semibold"><span className="inline-flex items-center gap-2">{u.name}{u.microsoft && <Tip label="Entra com a conta Microsoft da Optsolv"><span><Badge tone="info">Microsoft</Badge></span></Tip>}</span></TableCell><TableCell className="text-ink-3">{u.email}</TableCell><TableCell>{ROLE[u.role]}</TableCell>
                <TableCell className="text-ink-3">{u.role === 'admin_optsolv' ? 'todos os clientes' : u.clientIds.map(clientName).join(', ') || '—'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{u.role !== 'cliente' && u.isActive && <Button variant="link" size="sm" className="mr-4 px-0" onClick={() => openEdit(u)}>Editar acesso</Button>}{u.id !== me.actor.id && <Button variant="link" size="sm" className="text-ink-4 px-0" onClick={() => (u.isActive ? setConfirm({ kind: 'user', id: u.id, name: u.name }) : toggleUser.mutate({ id: u.id, isActive: true }))}>{u.isActive ? 'Desativar' : 'Reativar'}</Button>}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Confirm open={confirm?.kind === 'user'} onClose={() => setConfirm(null)} danger confirmLabel="Desativar" loading={toggleUser.isPending}
        title={`Desativar ${confirm?.name}?`} description="A pessoa perde o acesso imediatamente e as sessões abertas deixam de valer. Você pode reativar depois."
        onConfirm={() => confirm && toggleUser.mutate({ id: confirm.id, isActive: false }, { onSuccess: () => setConfirm(null) })} />
      <Confirm open={confirm?.kind === 'cred'} onClose={() => setConfirm(null)} danger confirmLabel="Revogar" loading={revoke.isPending}
        title={`Revogar “${confirm?.name}”?`} description="Toda integração ou agente que usa este token deixa de autenticar na hora. Não dá para desfazer: será preciso criar uma credencial nova."
        onConfirm={() => confirm && revoke.mutate(confirm.id, { onSuccess: () => setConfirm(null) })} />

      <Card className={cx(section, 'mt-6 rise')} style={{ animationDelay: '80ms' }}><CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-1"><h2 className="text-lg font-semibold flex items-center gap-2"><KeyRound size={16} className="text-ink-4" />Credenciais de API e MCP</h2><Button size="sm" icon={<Plus />} onClick={() => setCredOpen(true)}>Nova credencial</Button></div>
        <p className="text-sm text-ink-4 mb-3">Use como <span className="font-mono">Authorization: Bearer osk_…</span> na API ou em <span className="font-mono">OPTSOLV_API_TOKEN</span> para o servidor MCP. O token aparece uma única vez; o banco guarda só o hash.</p>
        {creds.isLoading ? <RowsSkeleton bare rows={2} code={false} /> : (
          <ul className="divide-y divide-line">{creds.data?.map((c) => (
            <li key={c.id} className={cx('py-2.5 flex flex-wrap items-center gap-3 text-sm', c.revokedAt && 'opacity-50')}>
              <Bot size={16} className="text-ink-4" /><span className="font-semibold">{c.name}</span><span className="font-mono text-xs text-ink-4">{c.prefix}…</span>
              <Badge tone="neutral">{ROLE[c.role]}</Badge><span className="text-ink-3">{c.clientId ? clientName(c.clientId) : 'todos os clientes'}</span>
              <span className="ml-auto text-xs text-ink-4">{c.revokedAt ? 'revogada' : c.lastUsedAt ? `usada ${fmtRelative(c.lastUsedAt)}` : 'nunca usada'}</span>
              {!c.revokedAt && <Button variant="link" size="sm" className="text-bad px-0" onClick={() => setConfirm({ kind: 'cred', id: c.id, name: c.name })}>Revogar</Button>}
            </li>
          ))}</ul>
        )}
      </CardContent></Card>

      <Card className={cx(section, 'mt-6 rise')} style={{ animationDelay: '160ms' }}><CardContent className="p-5 md:p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3"><ShieldCheck size={16} className="text-ink-4" />Auditoria recente</h2>
        {audit.isLoading ? <RowsSkeleton bare rows={4} code={false} /> : (
          <ul className="divide-y divide-line text-sm">{audit.data?.map((a) => (
            <li key={a.id} className="py-2 flex flex-wrap gap-x-3 gap-y-0.5"><span className="tnum text-xs text-ink-4 w-32 shrink-0">{fmtDateTime(a.createdAt)}</span><span className="font-semibold">{a.actorLabel}</span><span className="font-mono text-xs text-orange-700">{a.action}</span><span className="text-ink-3">{a.entityType}{a.clientId ? ` · ${clientName(a.clientId)}` : ''}</span>{a.meta && <span className="text-ink-4 truncate max-w-[40ch]">{JSON.stringify(a.meta)}</span>}</li>
          ))}</ul>
        )}
      </CardContent></Card>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Acesso de ${editing?.name ?? ''}`} description="Vale na próxima ação da pessoa, sem precisar sair e entrar de novo.">
        <form className="grid gap-4" onSubmit={(e: FormEvent) => { e.preventDefault(); saveAccess.mutate(); }}>
          <Field label="Papel" hint={editing?.id === me.actor.id ? 'Você não pode tirar o próprio papel de administrador.' : 'Administradores enxergam todos os clientes e gerenciam acessos.'}>
            <SimpleSelect value={draftRole} onValueChange={(v) => setDraftRole(v as Role)} disabled={editing?.id === me.actor.id}
              options={[{ value: 'colaborador_optsolv', label: ROLE.colaborador_optsolv }, { value: 'admin_optsolv', label: ROLE.admin_optsolv }]} />
          </Field>
          {draftRole === 'colaborador_optsolv' && (
            <div>
              <span className="label">Clientes liberados <span className="font-normal text-ink-4">({draftClients.length} de {me.clients.length})</span></span>
              {noClients ? <p className="rounded-lg border border-dashed border-line-2 bg-paper-2/60 px-3.5 py-2.5 text-sm text-ink-4">Nenhum cliente cadastrado ainda.</p> : (
                <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1">{me.clients.map((c) => (
                  <Label key={c.id} className="flex items-center gap-2"><Checkbox checked={draftClients.includes(c.id)} onCheckedChange={(v) => setDraftClients((s) => (v === true ? [...s, c.id] : s.filter((x) => x !== c.id)))} />{c.name}</Label>
                ))}</div>
              )}
              {!draftClients.length && <p className="mt-2 text-sm text-ink-4">Sem clientes, a pessoa entra mas não vê nenhum dado.</p>}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={saveAccess.isPending}>Salvar acesso</Button></div>
        </form>
      </Dialog>

      <Dialog open={userOpen} onClose={() => setUserOpen(false)} title="Novo usuário">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); createUser.mutate({ name: f.get('name'), email: f.get('email'), password: f.get('password'), role, clientId: role === 'cliente' ? f.get('clientId') : undefined, clientIds: role === 'colaborador_optsolv' ? f.getAll('clientIds') : undefined }); }}>
          <Field label="Nome"><Input name="name" required minLength={2} autoFocus autoComplete="off" placeholder="Ex.: Maria Souza" onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} /></Field>
          <Field label="E-mail"><Input name="email" type="email" required autoComplete="off" placeholder="nome@empresa.com.br" onChange={(e) => setWho((w) => ({ ...w, email: e.target.value }))} /></Field>
          <Field label="Senha inicial" hint="Envie à pessoa por um canal seguro; ela poderá trocar depois."><PasswordField name="password" label="Senha inicial" hints={hints} /></Field>
          <Field label="Papel"><SimpleSelect value={role} onValueChange={(v) => setRole(v as Role)} options={ROLE_OPTIONS} /></Field>
          {role === 'cliente' && <Field label="Cliente"><SimpleSelect name="clientId" required defaultValue={me.clients[0]?.id} options={clientOptions} placeholder="Escolha o cliente" empty="Nenhum cliente cadastrado" emptyAction={addClient} /></Field>}
          {role === 'colaborador_optsolv' && <div><span className="label">Clientes autorizados</span>{noClients
            ? <p className="fade-in flex items-center justify-between gap-3 rounded-lg border border-dashed border-line-2 bg-paper-2/60 px-3.5 py-2.5 text-sm text-ink-4">Nenhum cliente cadastrado ainda.<span className="font-semibold">{addClient}</span></p>
            : <div className="grid gap-2">{me.clients.map((c) => <Label key={c.id} className="flex items-center gap-2"><Checkbox name="clientIds" value={c.id} defaultChecked />{c.name}</Label>)}</div>}</div>}
          {userBlocked && <p role="status" className="text-sm text-ink-3">Para criar {role === 'cliente' ? 'um usuário de cliente' : 'um colaborador'}, cadastre antes o cliente que ele vai acessar.</p>}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setUserOpen(false)}>Cancelar</Button><Button type="submit" loading={createUser.isPending} disabled={userBlocked}>Criar</Button></div>
        </form>
      </Dialog>

      <Dialog open={credOpen} onClose={() => setCredOpen(false)} title="Nova credencial de agente">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); createCred.mutate({ name: f.get('name'), role: credRole, clientId: credRole === 'admin_optsolv' ? undefined : f.get('clientId') }); }}>
          <Field label="Nome" hint="Identifica quem usa o token na auditoria."><Input name="name" required minLength={2} autoFocus placeholder="Ex.: Agente de triagem · Cidade" /></Field>
          <Field label="Papel"><SimpleSelect value={credRole} onValueChange={(v) => setCredRole(v as Role)} options={ROLE_OPTIONS} /></Field>
          {credRole !== 'admin_optsolv' && <Field label="Escopo (cliente)"><SimpleSelect name="clientId" required defaultValue={me.clients[0]?.id} options={clientOptions} placeholder="Escolha o cliente" empty="Nenhum cliente cadastrado" emptyAction={addClient} /></Field>}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setCredOpen(false)}>Cancelar</Button><Button type="submit" loading={createCred.isPending} disabled={credBlocked}>Gerar token</Button></div>
        </form>
      </Dialog>

      <Dialog open={!!token} onClose={() => setToken(null)} title="Token gerado" description="Copie agora: por segurança ele não será exibido de novo.">
        <div className="flex items-center gap-2 rounded-lg bg-night text-paper font-mono text-sm px-3.5 py-3 break-all">{token}<Tip label="Copiar token"><Button variant="ghost" size="icon-sm" className="ml-auto shrink-0 text-ink-5 hover:text-paper hover:bg-night-3" onClick={() => { navigator.clipboard?.writeText(token ?? ''); toast.ok('Token copiado.'); }} aria-label="Copiar"><Copy /></Button></Tip></div>
        <div className="flex justify-end mt-5"><Button onClick={() => setToken(null)}>Fechar</Button></div>
      </Dialog>
    </div>
  );
}
