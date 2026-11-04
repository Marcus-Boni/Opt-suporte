import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, RotateCcw, PackageCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { CATEGORY, STATUS, STATUS_ORDER, fmtDate, fmtDateTime } from '@/lib/labels';
import type { RequestDetail } from '@/lib/types';
import { Avatar, Button, Dialog, ErrorState, Field, Skeleton, Textarea, cx } from '@/components/ui';
import { DetailSkeleton } from '@/components/skeletons';
import { StatusPill, RequestCode } from '@/components/status';
import { Timeline } from '@/components/timeline';
import { AttachmentList, UploadButton } from '@/components/attachments';
import { toast } from '@/lib/toast';

const STEPS = STATUS_ORDER.filter((s) => s !== 'cancelada');

export function PortalRequestDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.get<RequestDetail>(`/requests/${id}`) });
  const [body, setBody] = useState('');
  const [reopen, setReopen] = useState(false);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['request', id] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['metrics'] }); };
  const comment = useMutation({ mutationFn: () => api.post(`/requests/${id}/comments`, { body }), onSuccess: () => { setBody(''); invalidate(); toast.ok('Comentário enviado.'); }, onError: (e) => toast.bad(e.message) });
  const reopenM = useMutation({ mutationFn: (reason: string) => api.patch(`/requests/${id}`, { status: 'nova', reason }), onSuccess: () => { setReopen(false); invalidate(); toast.ok('Solicitação reaberta.'); }, onError: (e) => toast.bad(e.message) });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const r = q.data;
  const stepIdx = (STEPS as string[]).indexOf(r.status);

  return (
    <div className="rise">
      <div className="mb-4 text-sm text-ink-4 flex items-center gap-1.5"><Link to="/portal/solicitacoes" className="hover:text-ink">Solicitações</Link><span>/</span><RequestCode code={r.clientCode} number={r.number} /></div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start *:min-w-0">
        <div className="min-w-0 grid gap-6">
          <header>
            <div className="flex flex-wrap items-center gap-2 mb-2"><StatusPill status={r.status} /><span className="text-sm text-ink-4">{CATEGORY[r.category]} · {r.projectName}</span></div>
            <h1 className="text-4xl md:text-4xl font-semibold leading-[1.1] tracking-tight">{r.title}</h1>
            <p className="mt-2 text-base text-ink-3">{STATUS[r.status].hint}</p>
            {r.status !== 'cancelada' && (
              <ol className="mt-4 flex items-center gap-1" aria-label="Etapas">
                {STEPS.map((s, i) => <li key={s} className="flex-1" aria-current={i === stepIdx ? 'step' : undefined}><div className={cx('h-1.5 rounded-full', i < stepIdx ? 'bg-orange-300' : i === stepIdx ? 'bg-orange-500' : 'bg-paper-3')} /><span className={cx('block mt-1 text-2xs font-semibold uppercase tracking-wide truncate', i === stepIdx ? 'text-orange-700' : 'hidden sm:block', i === stepIdx ? 'text-orange-700' : 'text-ink-5')}>{STATUS[s].label}</span></li>)}
              </ol>
            )}
          </header>
          <section className="card p-5">
            <p className="text-md leading-relaxed text-ink-2 whitespace-pre-wrap">{r.description}</p>
            <p className="mt-3 text-sm text-ink-4">Aberta por {r.authorLabel} em {fmtDateTime(r.createdAt)}</p>
            <div className="mt-4 flex items-center justify-between"><h2 className="text-base font-semibold">Anexos</h2><UploadButton url={`/requests/${id}/attachments`} onDone={invalidate} /></div>
            {r.attachments.length ? <div className="mt-2"><AttachmentList items={r.attachments} /></div> : <p className="mt-1 text-sm text-ink-4">Nenhum anexo.</p>}
          </section>
          {r.deliveries.length > 0 && (
            <section className="rounded-2xl bg-orange-50 border border-orange-200 p-5">
              <h2 className="text-base font-semibold text-orange-800 flex items-center gap-1.5"><PackageCheck size={15} />Entregue</h2>
              <ul className="mt-2 grid gap-2">{r.deliveries.map((d) => <li key={d.id}><Link to={`/portal/novidades/${d.id}`} className="block"><span className="block text-md font-semibold hover:text-orange-700">{d.title}</span><span className="text-sm text-ink-3">{d.summary}</span><span className="block text-xs text-ink-4 mt-0.5">publicada em {fmtDate(d.publishedAt)}</span></Link></li>)}</ul>
            </section>
          )}
          <section>
            <h2 className="text-md font-semibold mb-3">Conversa com a equipe</h2>
            <ul className="grid gap-3">{r.comments.map((c) => <li key={c.id} className="card px-4 py-3"><div className="flex items-center gap-2 text-xs text-ink-4"><Avatar name={c.authorLabel} size={20} tone="orange" /><span className="font-semibold text-ink-2">{c.authorLabel}</span><span>{fmtDateTime(c.createdAt)}</span></div><p className="mt-1.5 text-base text-ink-2 whitespace-pre-wrap">{c.body}</p></li>)}{!r.comments.length && <li className="text-sm text-ink-4">Ainda sem mensagens. Escreva abaixo se quiser acrescentar algo.</li>}</ul>
            <form className="mt-3 card p-3" onSubmit={(e) => { e.preventDefault(); if (body.trim()) comment.mutate(); }}>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Escreva para a equipe Optsolv…" className="border-0 px-1 py-1 min-h-[72px]" />
              <div className="flex justify-end mt-2"><Button type="submit" size="sm" loading={comment.isPending} disabled={!body.trim()} icon={<Send />}>Enviar</Button></div>
            </form>
          </section>
        </div>
        <aside className="grid gap-4">
          {(r.status === 'concluida' || r.status === 'cancelada') && <section className="card p-4"><p className="text-sm text-ink-3">O problema voltou ou faltou algo?</p><Button variant="secondary" size="sm" className="mt-2 w-full" icon={<RotateCcw />} onClick={() => setReopen(true)}>Reabrir solicitação</Button></section>}
          <section className="card p-4"><h2 className="text-base font-semibold mb-3">Histórico</h2><Timeline events={r.events} compact /></section>
        </aside>
      </div>
      <Dialog open={reopen} onClose={() => setReopen(false)} title="Reabrir solicitação">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); reopenM.mutate(String(new FormData(e.currentTarget).get('reason'))); }}>
          <Field label="Conte o motivo" hint="Isso fica registrado no histórico e ajuda a equipe a retomar."><Textarea name="reason" required minLength={3} autoFocus /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setReopen(false)}>Cancelar</Button><Button type="submit" loading={reopenM.isPending}>Reabrir</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
