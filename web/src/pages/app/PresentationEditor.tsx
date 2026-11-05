import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Printer, Share2, Trash2, ExternalLink, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { SLIDE_KIND, fmtDate, fmtDateTime } from '@/lib/labels';
import type { Presentation } from '@/lib/types';
import { Badge, Button, ButtonLink, Confirm, Dialog, ErrorState, Field, Input, Skeleton, Textarea, cx } from '@/components/ui';
import { EditorSkeleton } from '@/components/skeletons';
import { SlideView } from '@/components/slides';
import { toast } from '@/lib/toast';

export function PresentationEditorPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['presentation', id], queryFn: () => api.get<Presentation>(`/presentations/${id}`) });
  const [i, setI] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const slide = q.data?.slides[i];
  // Rascunho por slide: trocar de slide não descarta texto ainda não salvo.
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const draft = slide ? drafts[slide.id] ?? { title: slide.title, body: slide.body } : { title: '', body: '' };
  const { title, body } = draft;
  const setTitle = (t: string) => slide && setDrafts((d) => ({ ...d, [slide.id]: { ...draft, title: t } }));
  const setBody = (b: string) => slide && setDrafts((d) => ({ ...d, [slide.id]: { ...draft, body: b } }));
  const unsaved = (s: { id: string; title: string; body: string }) => { const x = drafts[s.id]; return !!x && (x.title !== s.title || x.body !== s.body); };
  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch<Presentation>(`/presentations/${id}`, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['presentation', id] }); qc.invalidateQueries({ queryKey: ['presentations'] }); toast.ok('Apresentação salva.'); },
    onError: (e) => toast.bad(e.message),
  });
  const del = useMutation({ mutationFn: () => api.del(`/presentations/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['presentations'] }); toast.ok('Apresentação excluída.'); nav('/app/apresentacoes'); }, onError: (e) => toast.bad(e.message) });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return; if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, (q.data?.slides.length ?? 1) - 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [q.data]);

  if (q.isLoading) return <EditorSkeleton />;
  if (q.isError || !q.data || !slide) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const p = q.data;
  const dirty = title !== slide.title || body !== slide.body;
  const shared = p.status === 'compartilhada';

  return (
    <div className="rise">
      <Confirm open={confirmShare} onClose={() => setConfirmShare(false)} loading={save.isPending} danger={shared} confirmLabel={shared ? 'Parar de compartilhar' : 'Compartilhar'}
        title={shared ? 'Parar de compartilhar?' : `Compartilhar com ${p.clientName}?`}
        description={shared ? `A apresentação some de Resultados no portal de ${p.clientName} na hora, mesmo que alguém esteja com ela aberta. Você pode compartilhar de novo depois.` : `Todos os usuários de ${p.clientName} passam a ver esta apresentação em Resultados, com os ${p.slides.length} slides e o texto atual. Notas internas das solicitações não entram.`}
        onConfirm={() => save.mutate({ status: shared ? 'rascunho' : 'compartilhada' }, { onSuccess: () => setConfirmShare(false) })} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-ink-4 flex items-center gap-1.5"><Link to="/app/apresentacoes" className="hover:text-ink">Apresentações</Link><span>/</span><span>{p.clientName}</span></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {shared ? <Badge tone="orange"><Share2 size={11} />visível no portal do cliente</Badge> : <Badge tone="neutral">rascunho</Badge>}
          <Button variant="secondary" size="sm" icon={<Share2 />} onClick={() => setConfirmShare(true)}>{shared ? 'Parar de compartilhar' : 'Compartilhar com o cliente'}</Button>
          <ButtonLink to={`/app/apresentacoes/${id}/imprimir`} variant="secondary" size="sm" icon={<Printer />}>Exportar PDF</ButtonLink>
          <ButtonLink to={`/app/apresentacoes/${id}/apresentar`} size="sm" icon={<Play />}>Apresentar</ButtonLink>
        </div>
      </div>
      <header className="mb-5"><h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{p.title}</h1><p className="text-sm text-ink-4">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)} · {p.projects.map((x) => x.name).join(', ')} · gerada em {fmtDateTime(p.generatedAt)} por {p.createdByLabel}</p></header>

      <div className="grid grid-cols-1 lg:grid-cols-[150px_minmax(0,1fr)_320px] gap-5 items-start *:min-w-0">
        <ol className="flex lg:flex-col gap-2 overflow-auto lg:max-h-[70vh] pb-1" aria-label="Slides">
          {p.slides.map((s, idx) => (
            <li key={s.id} className="shrink-0">
              <Button variant="secondary" onClick={() => setI(idx)} className={cx('h-auto w-[120px] lg:w-full flex-col items-start text-left rounded-md p-2 gap-0 font-normal', idx === i ? 'border-orange-500 bg-orange-50 hover:bg-orange-50' : 'border-line')} aria-current={idx === i}>
                <span className="block text-2xs font-medium tnum text-ink-4">{idx + 1} · {SLIDE_KIND[s.kind] ?? s.kind}{unsaved(s) && <span className="text-orange-700"> · não salvo</span>}</span>
                <span className="block text-xs font-semibold leading-snug line-clamp-2 whitespace-normal">{s.title}</span>
              </Button>
            </li>
          ))}
        </ol>

        <div className="min-w-0">
          <div className="rounded-2xl overflow-hidden shadow-pop border border-line"><SlideView slide={slide} index={i} total={p.slides.length} clientName={p.clientName} /></div>
          <div className="mt-3 flex items-center justify-between text-sm text-ink-4">
            <Button variant="ghost" size="sm" icon={<ChevronLeft />} disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</Button>
            <span className="tnum">{i + 1} / {p.slides.length}</span>
            <Button variant="ghost" size="sm" disabled={i === p.slides.length - 1} onClick={() => setI(i + 1)}>Próximo <ChevronRight size={14} /></Button>
          </div>
        </div>

        <aside className="card p-4 grid gap-4 lg:sticky lg:top-20">
          <div><h2 className="text-base font-semibold">Narrativa deste slide</h2><p className="text-xs text-ink-4">Título e texto são editáveis; números e listas vêm do banco e não mudam aqui.</p></div>
          <Field label="Título"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Título do slide" /></Field>
          <Field label="Texto"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Texto do slide, em linguagem simples." /></Field>
          <div className="flex gap-2"><Button size="sm" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ slides: [{ id: slide.id, title, body }] }, { onSuccess: () => setDrafts((d) => { const n = { ...d }; delete n[slide.id]; return n; }) })}>Salvar texto</Button>{dirty && <Button size="sm" variant="ghost" onClick={() => { setTitle(slide.title); setBody(slide.body); }}>Desfazer</Button>}</div>
          {slide.refs?.length ? (
            <div className="border-t border-line pt-3">
              <div className="eyebrow text-ink-4 mb-1.5">Fontes internas</div>
              <ul className="grid gap-1">{slide.refs.map((r) => <li key={r.id}><Link to={r.type === 'request' ? `/app/solicitacoes/${r.id}` : `/app/entregas/${r.id}`} className="inline-flex items-start gap-1 text-sm text-orange-700 hover:underline"><ExternalLink size={12} className="mt-1 shrink-0" />{r.label}</Link></li>)}</ul>
            </div>
          ) : null}
          <div className="border-t border-line pt-3 flex items-center justify-between">
            <span className="text-xs text-ink-4 inline-flex items-center gap-1"><RefreshCw size={12} />Dados mudaram? Gere uma nova.</span>
            <Button size="sm" variant="ghost" className="text-bad" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>Excluir</Button>
          </div>
        </aside>
      </div>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir apresentação?">
        <p className="text-base text-ink-3">Esta ação não pode ser desfeita. Os dados de origem (solicitações e entregas) não são afetados.</p>
        <div className="flex justify-end gap-2 mt-5"><Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancelar</Button><Button variant="danger" onClick={() => del.mutate()} loading={del.isPending}>Excluir</Button></div>
      </Dialog>
    </div>
  );
}
