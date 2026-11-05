import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, X, Sparkles, Link2, ExternalLink, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { EVIDENCE, fmtDate, fmtDateTime, fromInputDate } from '@/lib/labels';
import type { DeliveryDetail, EvidenceKind } from '@/lib/types';
import { Badge, Button, Confirm, DatePicker, Dialog, ErrorState, Field, Input, Skeleton, Textarea, cx } from '@/components/ui';
import { DetailSkeleton } from '@/components/skeletons';
import { Tip } from '@/components/ui/tooltip';
import { StatusPill, RequestCode } from '@/components/status';
import { RequestPicker } from '@/components/request-picker';
import { AttachmentList, UploadButton } from '@/components/attachments';
import { toast } from '@/lib/toast';

export function DeliveryDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['delivery', id], queryFn: () => api.get<DeliveryDetail>(`/deliveries/${id}`) });
  const [linking, setLinking] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublish, setUnpublish] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [kind, setKind] = useState<EvidenceKind>('observado');
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['delivery', id] }); qc.invalidateQueries({ queryKey: ['deliveries'] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['metrics'] }); };
  const patch = useMutation({ mutationFn: (body: Record<string, unknown>) => api.patch<DeliveryDetail>(`/deliveries/${id}`, body), onSuccess: (d) => { invalidate(); setEditing(false); setPublishing(false); toast.ok(d.status === 'publicada' ? 'Entrega publicada. O cliente já pode ver.' : 'Entrega atualizada.'); }, onError: (e) => toast.bad(e.message) });
  const link = useMutation({ mutationFn: () => api.post(`/deliveries/${id}/requests`, { requestIds: pick }), onSuccess: () => { invalidate(); setLinking(false); setPick([]); toast.ok('Solicitações vinculadas.'); }, onError: (e) => toast.bad(e.message) });
  const unlink = useMutation({ mutationFn: (rid: string) => api.del(`/deliveries/${id}/requests/${rid}`), onSuccess: invalidate, onError: (e) => toast.bad(e.message) });
  const evidence = useMutation({ mutationFn: (body: Record<string, unknown>) => api.post(`/deliveries/${id}/evidences`, body), onSuccess: () => { invalidate(); setEvidenceOpen(false); toast.ok('Evidência registrada.'); }, onError: (e) => toast.bad(e.message) });

  if (q.isLoading) return <DetailSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const published = d.status === 'publicada';
  const groups = (['observado', 'esperado', 'medido'] as EvidenceKind[]).map((k) => ({ kind: k, items: d.evidences.filter((e) => e.kind === k) }));

  return (
    <div className="rise">
      <div className="mb-5 text-sm text-ink-4 flex items-center gap-1.5"><Link to="/app/entregas" className="hover:text-ink">Entregas</Link><span>/</span><span>{d.clientName}</span></div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start *:min-w-0">
        <div className="min-w-0 grid gap-6">
          <header>
            <div className="flex flex-wrap items-center gap-2 mb-2">{published ? <Badge tone="orange"><Eye size={12} />Publicada em {fmtDate(d.publishedAt)}</Badge> : <Badge tone="neutral"><EyeOff size={12} />Rascunho · invisível ao cliente</Badge>}<span className="text-xs text-ink-4">{d.projectName} · entregue em {fmtDate(d.deliveredAt)} · {d.ownerLabel}</span></div>
            {editing ? (
              <form className="grid gap-3" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); patch.mutate({ title: f.get('title'), summary: f.get('summary'), details: String(f.get('details') || ''), deliveredAt: fromInputDate(String(f.get('deliveredAt'))).toISOString() }); }}>
                <Input name="title" defaultValue={d.title} className="text-3xl font-semibold" maxLength={140} aria-label="Nome da entrega" placeholder="Nome da entrega" />
                <Field label="Resumo para o cliente"><Textarea name="summary" defaultValue={d.summary} rows={3} placeholder="Uma ou duas frases, sem jargão técnico." /></Field>
                <Field label="Detalhes"><Textarea name="details" defaultValue={d.details ?? ''} rows={5} placeholder="Como foi feito, limitações, o que muda no dia a dia." /></Field>
                <Field label="Data da entrega"><DatePicker name="deliveredAt" defaultValue={new Date(d.deliveredAt)} className="sm:w-60" /></Field>
                <div className="flex gap-2"><Button type="submit" size="sm" loading={patch.isPending}>Salvar</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>
              </form>
            ) : (
              <>
                <h1 className="text-4xl md:text-4xl font-semibold leading-[1.1] tracking-tight">{d.title}</h1>
                <p className="mt-3 text-xl leading-relaxed text-ink-2 max-w-[66ch]">{d.summary}</p>
                {d.details && <p className="mt-3 text-base leading-relaxed text-ink-3 whitespace-pre-wrap max-w-[72ch]">{d.details}</p>}
                <Button variant="link" size="sm" className="px-0 text-ink-4" icon={<Pencil />} onClick={() => setEditing(true)}>Editar</Button>
              </>
            )}
          </header>

          <section>
            <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold flex items-center gap-2"><Sparkles size={16} className="text-orange-500" />Evidências e benefícios</h2><Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setEvidenceOpen(true)}>Adicionar</Button></div>
            <div className="grid md:grid-cols-3 gap-3">
              {groups.map((g) => (
                <div key={g.kind} className={cx('rounded-xl p-4 border', !g.items.length ? 'border-dashed border-line-2 bg-paper-2/50' : g.kind === 'medido' ? 'bg-night text-paper border-night-3' : 'bg-card border-line')}>
                  <div className={cx('eyebrow', g.items.length && g.kind === 'medido' ? 'text-orange-300' : 'text-ink-4')}>{EVIDENCE[g.kind].label}</div>
                  <p className={cx('text-xs mt-0.5 mb-3', g.items.length && g.kind === 'medido' ? 'text-paper-3/70' : 'text-ink-4')}>{EVIDENCE[g.kind].hint}</p>
                  {g.items.length ? <ul className="grid gap-3">{g.items.map((e) => (
                    <li key={e.id}>
                      {e.kind === 'medido' && e.metricValue !== null && <div className="text-4xl font-semibold tracking-tighter tnum leading-none">{Number(e.metricValue).toLocaleString('pt-BR')} <span className="text-sm font-semibold text-paper-3/70 tracking-normal">{e.metricUnit}</span></div>}
                      <div className={cx('text-base font-semibold', e.kind === 'medido' && 'mt-1')}>{e.title}</div>
                      {e.description && <div className={cx('text-sm mt-0.5', g.kind === 'medido' ? 'text-paper-3/80' : 'text-ink-3')}>{e.description}</div>}
                      <div className={cx('text-xs mt-1 flex flex-wrap gap-x-2', g.kind === 'medido' ? 'text-paper-3/60' : 'text-ink-4')}>{e.sourceLabel && <span>Fonte: {e.sourceLabel}</span>}{e.linkUrl && <a href={e.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline"><ExternalLink size={11} />link</a>}{e.attachmentId && <a href={`/api/v1/attachments/${e.attachmentId}`} target="_blank" rel="noreferrer" className="underline">anexo</a>}</div>
                    </li>
                  ))}</ul> : <Button type="button" variant="secondary" size="sm" icon={<Plus />} onClick={() => { setKind(g.kind); setEvidenceOpen(true); }}>Adicionar</Button>}
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-5">Solicitação concluída ≠ resultado. Só “impacto medido” vira número na apresentação, sempre com a fonte.</p>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2"><h2 className="text-lg font-semibold">Arquivos de evidência</h2><UploadButton url={`/deliveries/${id}/attachments`} onDone={invalidate} /></div>
            {d.attachments.length ? <AttachmentList items={d.attachments} /> : <p className="text-sm text-ink-4">Prints, documentos ou planilhas que comprovem a entrega (até 5 MB).</p>}
          </section>
        </div>

        <Confirm open={unpublish} onClose={() => setUnpublish(false)} danger confirmLabel="Voltar para rascunho" loading={patch.isPending}
          title="Despublicar esta entrega?" description={`Ela some de Novidades no portal de ${d.clientName} e das apresentações geradas daqui em diante. Evidências e anexos continuam guardados; você pode publicar de novo.`}
          onConfirm={() => patch.mutate({ status: 'rascunho' }, { onSuccess: () => setUnpublish(false) })} />
        <aside className="grid gap-4 min-w-0 *:min-w-0 lg:sticky lg:top-20">
          <section className={cx('card p-4', !published && 'border border-orange-200')}>
            {published ? <p className="text-sm text-ink-3">Publicada em {fmtDateTime(d.publishedAt)}. Aparece em Novidades do portal e nas apresentações do período.</p> : (
              <>
                <p className="text-sm text-ink-3">Ao publicar, o cliente vê esta entrega em Novidades e nas solicitações vinculadas. Notas internas continuam protegidas.</p>
                <Button className="mt-3 w-full" onClick={() => setPublishing(true)} icon={<Eye />}>Publicar para o cliente</Button>
              </>
            )}
            {published && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setUnpublish(true)}>Voltar para rascunho</Button>}
          </section>
          <section className="card p-4">
            <div className="flex items-center justify-between mb-2"><h2 className="text-base font-semibold flex items-center gap-1.5"><Link2 size={15} className="text-ink-4" />Solicitações atendidas</h2><Button variant="link" size="sm" className="px-0 h-auto" onClick={() => setLinking(true)}>Vincular</Button></div>
            {d.requests.length ? <ul className="grid gap-1">{d.requests.map((r) => (
              <li key={r.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 -mx-1 hover:bg-paper-2">
                <Link to={`/app/solicitacoes/${r.id}`} className="flex-1 min-w-0 flex items-center gap-2"><RequestCode code={d.clientCode} number={r.number} /><span className="text-sm font-semibold truncate">{r.title}</span></Link>
                <StatusPill status={r.status} />
                <Tip label="Desvincular solicitação"><Button variant="ghost" size="icon-sm" className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-4 hover:text-bad" onClick={() => unlink.mutate(r.id)} aria-label="Desvincular"><X /></Button></Tip>
              </li>
            ))}</ul> : <p className="text-sm text-ink-4">Nenhuma solicitação vinculada ainda.</p>}
          </section>
        </aside>
      </div>

      <Dialog open={linking} onClose={() => setLinking(false)} title="Vincular solicitações" width={600}>
        <RequestPicker clientId={d.clientId} selected={pick} onToggle={(rid) => setPick((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]))} exclude={d.requests.map((r) => r.id)} />
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setLinking(false)}>Cancelar</Button><Button onClick={() => link.mutate()} loading={link.isPending} disabled={!pick.length}>Vincular {pick.length || ''}</Button></div>
      </Dialog>

      <Dialog open={publishing} onClose={() => setPublishing(false)} title="Publicar entrega?">
        <p className="text-base text-ink-3">“{d.title}” ficará visível para os usuários de {d.clientName}, com {d.requests.length} {d.requests.length === 1 ? 'solicitação' : 'solicitações'} vinculada{d.requests.length === 1 ? '' : 's'} e {d.evidences.length} evidência{d.evidences.length === 1 ? '' : 's'}.</p>
        {!d.evidences.length && <p className="mt-2 text-sm text-warn bg-warn-soft rounded-md px-3 py-2">Sem evidências a entrega aparece como “não informado” na apresentação. Você pode publicar mesmo assim.</p>}
        <div className="flex justify-end gap-2 mt-5"><Button variant="secondary" onClick={() => setPublishing(false)}>Agora não</Button><Button onClick={() => patch.mutate({ status: 'publicada' })} loading={patch.isPending}>Publicar</Button></div>
      </Dialog>

      <Dialog open={evidenceOpen} onClose={() => setEvidenceOpen(false)} title="Nova evidência">
        <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const mv = String(f.get('metricValue') || ''); evidence.mutate({ kind, title: f.get('title'), description: String(f.get('description') || '') || undefined, metricValue: mv ? Number(mv) : undefined, metricUnit: String(f.get('metricUnit') || '') || undefined, sourceLabel: String(f.get('sourceLabel') || '') || undefined, linkUrl: String(f.get('linkUrl') || '') || undefined }); }}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Natureza da evidência">{(['observado', 'esperado', 'medido'] as EvidenceKind[]).map((k) => <Button type="button" key={k} variant="secondary" aria-pressed={kind === k} onClick={() => setKind(k)} className={cx('h-auto flex-col items-start text-left rounded-lg px-3 py-2.5 gap-0.5 whitespace-normal font-normal', kind === k && 'border-orange-500 bg-orange-50 hover:bg-orange-50')}><span className="block text-sm font-semibold">{EVIDENCE[k].label}</span><span className="block text-2xs text-ink-4 leading-snug">{EVIDENCE[k].hint}</span></Button>)}</div>
          <Field label="Título"><Input name="title" required minLength={2} autoFocus placeholder={kind === 'medido' ? 'Ex.: Buscas por obra no primeiro mês' : 'Ex.: Cliente localiza visita sem rolar a lista'} /></Field>
          {kind === 'medido' && <div className="grid grid-cols-2 gap-3"><Field label="Valor"><Input name="metricValue" type="number" step="any" required placeholder="Ex.: 120" /></Field><Field label="Unidade"><Input name="metricUnit" placeholder="buscas em 30 dias" required /></Field></div>}
          <Field label="Descrição"><Textarea name="description" rows={3} placeholder="Contexto da evidência: o que mudou e para quem." /></Field>
          <Field label="Fonte" hint={kind === 'medido' ? 'Obrigatória: de onde veio o número.' : 'Quem observou ou onde foi demonstrado.'}><Input name="sourceLabel" required={kind === 'medido'} placeholder={kind === 'medido' ? 'Ex.: Relatório de uso do sistema' : 'Ex.: Coordenadora de obras'} /></Field>
          <Field label="Link (opcional)"><Input name="linkUrl" type="url" placeholder="https://" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEvidenceOpen(false)}>Cancelar</Button><Button type="submit" loading={evidence.isPending}>Registrar</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
