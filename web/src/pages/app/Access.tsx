import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Copy, ShieldCheck, Bot } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { ROLE, fmtDateTime, fmtRelative } from '@/lib/labels';
import type { AuditRow, Credential, Role, UserRow } from '@/lib/types';
import { Badge, Button, Card, CardContent, Checkbox, Confirm, Dialog, ErrorState, Field, Input, Label, SimpleSelect, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cx } from '@/components/ui';
import { RowsSkeleton } from '@/components/skeletons';
import { Tip } from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';

const ROLE_OPTIONS = Object.entries(ROLE).map(([value, label]) => ({ value, label }));

export function AccessPage() {
  const me = useMe();
  const qc = useQueryClient();
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

  const createUser = useMutation({ mutationFn: (b: Record<string, unknown>) => api.post('/users', b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['audit'] }); setUserOpen(false); toast.ok('Usuário criado.'); }, onError: (e) => toast.bad(e.message) });
  const toggleUser = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/users/${id}`, { isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }), onError: (e) => toast.bad(e.message) });
  const createCred = useMutation({ mutationFn: (b: Record<string, unknown>) => api.post<{ token: string }>('/credentials', b), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['credentials'] }); qc.invalidateQueries({ queryKey: ['audit'] }); setCredOpen(false); setToken(r.token); }, onError: (e) => toast.bad(e.message) });
  const revoke = useMutation({ mutationFn: (id: string) => api.del(`/credentials/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['credentials'] }); toast.ok('Credencial revogada.'); }, onError: (e) => toast.bad(e.message) });

  if (me.actor.role !== 'admin_optsolv') return <ErrorState error={new Error('Área restrita a administradores.')} />;
  const section = 'ring-0 shadow-card rounded-2xl py-0';

  return (
    <div>
      <header className="rise mb-6 md:mb-8"><h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Acessos e API</h1><p className="mt-2 text-md text-ink-3 max-w-[64ch]">Usuários do backoffice e do portal, credenciais para API/MCP e trilha de auditoria. A documentação OpenAPI está em <a className="link" href="/docs" target="_blank" rel="noreferrer">/docs</a>.</p></header>

      <Card className={cx(section, 'rise')}><CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold">Usuários</h2><Button size="sm" icon={<Plus />} onClick={() => setUserOpen(true)}>Novo usuário</Button></div>
        {users.isLoading ? <RowsSkeleton bare rows={4} code={false} /> : (
          <Table className="text-sm min-w-[640px]">
            <TableHeader><TableRow className="text-xs uppercase tracking-wide text-ink-4 hover:bg-transparent"><TableHead>Nome</TableHead><TableHead>E-mail</TableHead><TableHead>Papel</TableHead><TableHead>Escopo</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{users.data?.map((u) => (
              <TableRow key={u.id} className={cx(!u.isActive && 'opacity-50')}>
                <TableCell className="font-semibold">{u.name}</TableCell><TableCell className="text-ink-3">{u.email}</TableCell><TableCell>{ROLE[u.role]}</TableCell>
                <TableCell className="text-ink-3">{u.role === 'admin_optsolv' ? 'todos os clientes' : u.clientIds.map(clientName).join(', ') || '—'}</TableCell>
                <TableCell className="text-right">{u.id !== me.actor.id && <Button variant="link" size="sm" className="text-ink-4 px-0" onClick={() => (u.isActive ? setConfirm({ kind: 'user', id: u.id, name: u.name }) : toggleUser.mutate({ id: u.id, isActive: true }))}>{u.isActive ? 'Desativar' : 'Reativar'}</Button>}</TableCell>
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

      <Dialog open={userOpen} onClose={() => setUserOpen(false)} title="Novo usuário">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); createUser.mutate({ name: f.get('name'), email: f.get('email'), password: f.get('password'), role, clientId: role === 'cliente' ? f.get('clientId') : undefined, clientIds: role === 'colaborador_optsolv' ? f.getAll('clientIds') : undefined }); }}>
          <Field label="Nome"><Input name="name" required minLength={2} autoFocus /></Field>
          <Field label="E-mail"><Input name="email" type="email" required /></Field>
          <Field label="Senha inicial" hint="Mínimo 8 caracteres."><Input name="password" type="text" required minLength={8} defaultValue="optsolv2026" /></Field>
          <Field label="Papel"><SimpleSelect value={role} onValueChange={(v) => setRole(v as Role)} options={ROLE_OPTIONS} /></Field>
          {role === 'cliente' && <Field label="Cliente"><SimpleSelect name="clientId" required defaultValue={me.clients[0]?.id} options={clientOptions} /></Field>}
          {role === 'colaborador_optsolv' && <div><span className="label">Clientes autorizados</span><div className="grid gap-2">{me.clients.map((c) => <Label key={c.id} className="flex items-center gap-2"><Checkbox name="clientIds" value={c.id} defaultChecked />{c.name}</Label>)}</div></div>}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setUserOpen(false)}>Cancelar</Button><Button type="submit" loading={createUser.isPending}>Criar</Button></div>
        </form>
      </Dialog>

      <Dialog open={credOpen} onClose={() => setCredOpen(false)} title="Nova credencial de agente">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); createCred.mutate({ name: f.get('name'), role: credRole, clientId: credRole === 'admin_optsolv' ? undefined : f.get('clientId') }); }}>
          <Field label="Nome" hint="Ex.: Agente de triagem · Cidade"><Input name="name" required minLength={2} autoFocus /></Field>
          <Field label="Papel"><SimpleSelect value={credRole} onValueChange={(v) => setCredRole(v as Role)} options={ROLE_OPTIONS} /></Field>
          {credRole !== 'admin_optsolv' && <Field label="Escopo (cliente)"><SimpleSelect name="clientId" required defaultValue={me.clients[0]?.id} options={clientOptions} /></Field>}
          <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setCredOpen(false)}>Cancelar</Button><Button type="submit" loading={createCred.isPending}>Gerar token</Button></div>
        </form>
      </Dialog>

      <Dialog open={!!token} onClose={() => setToken(null)} title="Token gerado" description="Copie agora: por segurança ele não será exibido de novo.">
        <div className="flex items-center gap-2 rounded-lg bg-night text-paper font-mono text-sm px-3.5 py-3 break-all">{token}<Tip label="Copiar token"><Button variant="ghost" size="icon-sm" className="ml-auto shrink-0 text-ink-5 hover:text-paper hover:bg-night-3" onClick={() => { navigator.clipboard?.writeText(token ?? ''); toast.ok('Token copiado.'); }} aria-label="Copiar"><Copy /></Button></Tip></div>
        <div className="flex justify-end mt-5"><Button onClick={() => setToken(null)}>Fechar</Button></div>
      </Dialog>
    </div>
  );
}
