import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Globe, MessageSquareText, PackageCheck, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { CATEGORY, PRIORITY, SOURCE, STATUS_ORDER, fmtDate, fmtDateTime, statusLabel } from '@/lib/labels';
import type { Comment, RequestDetail, RequestStatus, TeamMember } from '@/lib/types';
import { Avatar, Badge, Button, Card, CardContent, Dialog, ErrorState, Field, Input, Segmented, SimpleSelect, Skeleton, Textarea, cx } from '@/components/ui';
import { DetailSkeleton } from '@/components/skeletons';
import { StatusPill, PriorityMark, SourceIcon } from '@/components/status';
import { Timeline } from '@/components/timeline';
import { AttachmentList, UploadButton } from '@/components/attachments';
import { toast } from '@/lib/toast';

const STATUS_OPTIONS = STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s, true) }));
const CATEGORY_OPTIONS = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY).map(([value, label]) => ({ value, label }));

export function RequestDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.get<RequestDetail>(`/requests/${id}`) });
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamMember[]>('/team') });
  // O modo (público/interno) fica lembrado por solicitação: um "Interno" esquecido não vira mensagem ao cliente.
  const modeKey = `osx.comment-mode.${id}`;
  const [visibility, setVisibilityState] = useState<'public' | 'internal'>(() => { try { return sessionStorage.getItem(modeKey) === 'internal' ? 'internal' : 'public'; } catch { return 'public'; } });
  const setVisibility = (v: 'public' | 'internal') => { setVisibilityState(v); try { sessionStorage.setItem(modeKey, v); } catch { /* sem persistência */ } };
  const [body, setBody] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [reopen, setReopen] = useState<RequestStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['metrics'] }); };

  const update = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<RequestDetail>(`/requests/${id}`, patch),
    onSuccess: () => { invalidate(); setReopen(null); setEditing(false); setUpdateError(null); toast.ok('Solicitação atualizada.'); },
    onError: (e) => { if (reopen || editing) setUpdateError(e.message); else toast.bad(e.message); },
  });
  const undo = useMutation({
    mutationFn: (commentId: string) => api.del(`/requests/${id}/comments/${commentId}`),
    onSuccess: () => { invalidate(); toast.info('Comentário desfeito.'); },
    onError: (e) => toast.bad(e.message),
  });
  const comment = useMutation({
    mutationFn: () => api.post<Comment>(`/requests/${id}/comments`, { body, visibility }),
    onSuccess: (c) => { setBody(''); setCommentError(null); invalidate(); if (visibility === 'internal') toast.ok('Nota interna registrada.'); else toast.undo('Comentário enviado ao cliente.', () => undo.mutate(c.id)); },
    onError: (e) => setCommentError(e.message),
  });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const r = q.data;
  const closed = r.status === 'concluida' || r.status === 'cancelada';
  const changeStatus = (s: RequestStatus) => { if (s === r.status) return; if (closed && !['concluida', 'cancelada'].includes(s)) setReopen(s); else update.mutate({ status: s }); };

  return (
    <div className="rise">
      <div className="mb-5 text-sm text-ink-4 flex items-center gap-1.5"><Link to="/app/solicitacoes" className="hover:text-ink">Solicitações</Link><span>/</span><span className="font-mono">{r.clientCode}-{r.number}</span></div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start *:min-w-0">
        <div className="min-w-0 grid gap-5">
          <header>
            <div className="flex flex-wrap items-center gap-2 mb-2"><StatusPill status={r.status} /><Badge tone="neutral">{CATEGORY[r.category]}</Badge><PriorityMark priority={r.priority} withLabel /><span className="inline-flex items-center gap-1 text-xs text-ink-4"><SourceIcon source={r.source} />{SOURCE[r.source]}</span></div>
            {editing ? (
              <form className="grid gap-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); update.mutate({ title: f.get('title'), description: f.get('description') }); }}>
                <Input name="title" defaultValue={r.title} className="h-12 text-3xl font-semibold" maxLength={140} aria-label="Título" />
                <Textarea name="description" defaultValue={r.description} rows={6} aria-label="Descrição" />
                <div className="flex gap-2"><Button type="submit" size="sm" loading={update.isPending}>Salvar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>
              </form>
            ) : (
              <>
                <h1 className="text-4xl md:text-4xl font-semibold leading-[1.1] tracking-tight">{r.title}</h1>
                {r.description.trim() !== r.title.trim() && <p className="mt-3 text-md leading-relaxed text-ink-2 whitespace-pre-wrap max-w-[72ch]">{r.description}</p>}
                <Button variant="link" size="sm" className="px-0 text-ink-4" onClick={() => setEditing(true)}>Editar texto</Button>
              </>
            )}
            <p className="mt-2 text-sm text-ink-4">Aberta por <span className="font-semibold text-ink-3">{r.authorLabel}</span> em {fmtDateTime(r.createdAt)} · {r.clientName} · {r.projectName}</p>
            {/* No celular a triagem (decidir status e dono) vem logo abaixo do título; no desktop fica na coluna lateral. */}
            <div className="lg:hidden mt-4 grid grid-cols-2 gap-3 rounded-xl bg-paper-2 p-3">
              <Field label="Status"><SimpleSelect size="sm" value={r.status} onValueChange={(v) => changeStatus(v as RequestStatus)} options={STATUS_OPTIONS} /></Field>
              <Field label="Responsável"><SimpleSelect size="sm" value={r.assigneeUserId ?? ''} onValueChange={(v) => update.mutate({ assigneeUserId: v || null })} options={[{ value: '', label: 'Sem responsável' }, ...(team.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} /></Field>
            </div>
          </header>

          {r.sourceExcerpt && r.sourceExcerpt.trim() !== r.description.trim() && (
            <section className="rounded-xl bg-paper-2 px-4 py-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-3 uppercase tracking-wide"><MessageSquareText size={13} />Trecho original do WhatsApp</div>
              <blockquote className="mt-1.5 text-base text-ink-2 whitespace-pre-wrap">{r.sourceExcerpt}</blockquote>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-2"><h2 className="text-md font-semibold">Anexos</h2><UploadButton url={`/requests/${id}/attachments`} onDone={invalidate} /></div>
            {r.attachments.length ? <AttachmentList items={r.attachments} /> : <p className="text-sm text-ink-4">Nenhum anexo. Até 5 MB por arquivo.</p>}
          </section>

          <section>
            <h2 className="text-md font-semibold mb-3">Conversa</h2>
            <ul className="grid gap-3">
              {r.comments.map((c) => (
                <li key={c.id} className={cx('rounded-xl px-4 py-3', c.visibility === 'internal' ? 'bg-warn-soft/70 border border-warn/20' : 'bg-card border border-line')}>
                  <div className="flex items-center gap-2 text-xs text-ink-4"><Avatar name={c.authorLabel} size={20} tone={c.visibility === 'internal' ? 'ink' : 'orange'} /><span className="font-semibold text-ink-2">{c.authorLabel}</span><span>{fmtDateTime(c.createdAt)}</span>{c.visibility === 'internal' && <span className="ml-auto inline-flex items-center gap-1 font-semibold text-warn"><Lock size={12} />Interno · o cliente não vê</span>}</div>
                  <p className="mt-1.5 text-base text-ink-2 whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
              {!r.comments.length && <li className="text-sm text-ink-4">Nenhum comentário ainda.</li>}
            </ul>
            <form className={cx('mt-3 rounded-xl border p-3 transition-colors', visibility === 'internal' ? 'border-warn/40 bg-warn-soft/60' : 'border-line-2 bg-card')} onSubmit={(e) => { e.preventDefault(); if (body.trim()) comment.mutate(); }}>
              {visibility === 'internal' && <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-warn"><Lock size={12} />Nota interna: o cliente não vê.</p>}
              {commentError && <p role="alert" className="mb-2 text-sm text-bad bg-bad-soft rounded-md px-3 py-2">{commentError}</p>}
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} aria-label="Comentário" placeholder={visibility === 'internal' ? 'Nota interna para a equipe…' : 'Resposta visível ao cliente…'} className="border-0 shadow-none px-1 py-1 min-h-[72px] focus-visible:ring-0 bg-transparent" />
              <div className="flex items-center justify-between gap-3 mt-2">
                <Segmented size="sm" value={visibility} onChange={setVisibility} options={[{ value: 'public', label: 'Público' }, { value: 'internal', label: 'Interno' }]} />
                <Button type="submit" size="sm" loading={comment.isPending} disabled={!body.trim()} icon={visibility === 'internal' ? <Lock /> : <Send />}>{visibility === 'internal' ? 'Registrar nota' : 'Enviar'}</Button>
              </div>
            </form>
          </section>
        </div>

        <aside className="grid gap-4 min-w-0 *:min-w-0 lg:sticky lg:top-20">
          <Card className="ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-4 grid gap-3">
            <div className="hidden lg:grid gap-3">
              <Field label="Status"><SimpleSelect value={r.status} onValueChange={(v) => changeStatus(v as RequestStatus)} options={STATUS_OPTIONS} /></Field>
              <Field label="Responsável"><SimpleSelect value={r.assigneeUserId ?? ''} onValueChange={(v) => update.mutate({ assigneeUserId: v || null })} options={[{ value: '', label: 'Sem responsável' }, ...(team.data ?? []).map((t) => ({ value: t.id, label: t.name }))]} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria"><SimpleSelect value={r.category} onValueChange={(v) => update.mutate({ category: v })} options={CATEGORY_OPTIONS} /></Field>
              <Field label="Prioridade"><SimpleSelect value={r.priority} onValueChange={(v) => update.mutate({ priority: v })} options={PRIORITY_OPTIONS} /></Field>
            </div>
            <dl className="text-xs text-ink-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-1 border-t border-line">
              <dt>Atualizada</dt><dd className="text-ink-2">{fmtDate(r.updatedAt)}</dd>
              {r.closedAt && <><dt>Encerrada</dt><dd className="text-ink-2">{fmtDate(r.closedAt)}</dd></>}
            </dl>
          </CardContent></Card>
          <Card className="ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="text-base font-semibold flex items-center gap-1.5"><PackageCheck size={15} className="text-orange-500" />Entregas</h2><Link to={`/app/entregas/nova?requestId=${r.id}`} className="text-xs font-semibold text-orange-700">Registrar entrega</Link></div>
            {r.deliveries.length ? <ul className="grid gap-1.5">{r.deliveries.map((d) => <li key={d.id}><Link to={`/app/entregas/${d.id}`} className="block rounded-md px-2.5 py-2 hover:bg-paper-2 -mx-1"><span className="block text-sm font-semibold">{d.title}</span><span className="text-xs text-ink-4">{d.status === 'publicada' ? `publicada em ${fmtDate(d.publishedAt)}` : 'rascunho'}</span></Link></li>)}</ul> : <p className="text-sm text-ink-4">Nenhuma entrega vinculada.</p>}
          </CardContent></Card>
          <Card className="ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-4">
            <h2 className="text-base font-semibold mb-3">Histórico</h2>
            <Timeline events={r.events} compact />
          </CardContent></Card>
        </aside>
      </div>

      <Dialog open={!!reopen} onClose={() => setReopen(null)} title="Reabrir solicitação">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); update.mutate({ status: reopen, reason: new FormData(e.currentTarget).get('reason') }); }}>
          <p className="text-base text-ink-3">A solicitação está {statusLabel(r.status, true).toLowerCase()}. Para voltar a <strong>{reopen && statusLabel(reopen, true)}</strong>, informe o motivo; ele fica no histórico visível ao cliente.</p>
          {updateError && <p role="alert" className="text-sm text-bad bg-bad-soft rounded-md px-3 py-2">{updateError}</p>}
          <Field label="Motivo"><Textarea name="reason" required minLength={3} autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setReopen(null)}>Cancelar</Button><Button type="submit" loading={update.isPending}>Reabrir</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
