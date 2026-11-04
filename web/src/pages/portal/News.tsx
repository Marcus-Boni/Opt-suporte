import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, ExternalLink } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { EVIDENCE, fmtDate } from '@/lib/labels';
import type { DeliveryDetail, DeliveryRow, EvidenceKind, Paged } from '@/lib/types';
import { EmptyState, ErrorState, Skeleton, cx } from '@/components/ui';
import { CardsSkeleton, DetailSkeleton } from '@/components/skeletons';
import { StatusPill, RequestCode } from '@/components/status';
import { AttachmentList } from '@/components/attachments';

export function PortalNewsPage() {
  const q = useQuery({ queryKey: ['deliveries', 'portal'], queryFn: () => api.get<Paged<DeliveryRow>>(`/deliveries${qs({ pageSize: 50 })}`) });
  return (
    <div>
      <header className="rise mb-6"><h1 className="text-4xl font-semibold tracking-tight">Novidades</h1><p className="mt-1 text-md text-ink-3">Entregas publicadas pela Optsolv para a sua equipe, da mais recente para a mais antiga.</p></header>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <CardsSkeleton variant="news" count={3} /> : q.data?.items.length ? (
        <ol className="relative pl-6 rise-list">
          <span className="absolute left-[7px] top-2 bottom-2 w-px thread-line" aria-hidden />
          {q.data.items.map((d) => (
            <li key={d.id} className="relative pb-6">
              <span className="absolute -left-6 top-1.5 size-[15px] rounded-full bg-orange-500 border-[3px] border-paper" aria-hidden />
              <Link to={`/portal/novidades/${d.id}`} className="card block p-5 card-interactive">
                <div className="text-xs text-ink-4">{fmtDate(d.publishedAt)} · {d.projectName}</div>
                <h2 className="mt-1 text-2xl font-semibold leading-snug">{d.title}</h2>
                <p className="mt-1.5 text-base text-ink-3">{d.summary}</p>
                <div className="mt-3 text-xs text-ink-4">{d.requestCount} {d.requestCount === 1 ? 'solicitação' : 'solicitações'} atendida{d.requestCount === 1 ? '' : 's'}{d.evidenceCount > 0 && <span className="text-orange-700 font-semibold"> · {d.evidenceCount} evidência{d.evidenceCount === 1 ? '' : 's'}</span>}</div>
              </Link>
            </li>
          ))}
        </ol>
      ) : <EmptyState icon={<Sparkles size={28} />} title="Nenhuma novidade publicada" text="Quando a equipe concluir e publicar uma entrega, ela aparece aqui com o que mudou para você." />}
    </div>
  );
}

export function PortalNewsDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['delivery', id], queryFn: () => api.get<DeliveryDetail>(`/deliveries/${id}`) });
  if (q.isLoading) return <DetailSkeleton aside={false} />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const d = q.data;
  const groups = (['observado', 'esperado', 'medido'] as EvidenceKind[]).map((k) => ({ kind: k, items: d.evidences.filter((e) => e.kind === k) })).filter((g) => g.items.length);
  return (
    <article className="rise max-w-[760px]">
      <div className="mb-4 text-sm text-ink-4 flex items-center gap-1.5"><Link to="/portal/novidades" className="hover:text-ink">Novidades</Link><span>/</span><span>{fmtDate(d.publishedAt)}</span></div>
      <p className="eyebrow text-orange-600">{d.projectName} · publicada em {fmtDate(d.publishedAt)}</p>
      <h1 className="mt-2 text-4xl md:text-5xl font-semibold tracking-tighter text-balance">{d.title}</h1>
      <p className="mt-4 text-xl leading-relaxed text-ink-2">{d.summary}</p>
      {d.details && <p className="mt-3 text-md leading-relaxed text-ink-3 whitespace-pre-wrap">{d.details}</p>}
      {groups.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-3">O que isso trouxe</h2>
          <div className="grid gap-3">{groups.map((g) => (
            <div key={g.kind} className={cx('rounded-xl p-4', g.kind === 'medido' ? 'bg-night text-paper' : 'card')}>
              <div className={cx('eyebrow', g.kind === 'medido' ? 'text-orange-300' : 'text-ink-4')}>{EVIDENCE[g.kind].label}</div>
              <ul className="mt-2 grid gap-3">{g.items.map((e) => <li key={e.id}>{e.metricValue !== null && <div className="text-4xl font-semibold tracking-tighter tnum leading-none">{Number(e.metricValue).toLocaleString('pt-BR')} <span className="text-sm font-semibold tracking-normal opacity-70">{e.metricUnit}</span></div>}<div className={cx('text-md font-semibold', e.metricValue !== null && 'mt-1')}>{e.title}</div>{e.description && <div className={cx('text-sm mt-0.5', g.kind === 'medido' ? 'text-paper-3/80' : 'text-ink-3')}>{e.description}</div>}<div className={cx('text-xs mt-1 flex gap-2', g.kind === 'medido' ? 'text-paper-3/60' : 'text-ink-4')}>{e.sourceLabel && <span>Fonte: {e.sourceLabel}</span>}{e.linkUrl && <a href={e.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline"><ExternalLink size={11} />link</a>}{e.attachmentId && <a href={`/api/v1/attachments/${e.attachmentId}`} target="_blank" rel="noreferrer" className="underline">anexo</a>}</div></li>)}</ul>
            </div>
          ))}</div>
        </section>
      )}
      {d.attachments.length > 0 && <section className="mt-8"><h2 className="text-lg font-semibold mb-3">Arquivos</h2><AttachmentList items={d.attachments} /></section>}
      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Solicitações atendidas</h2>
        {d.requests.length ? <ul className="card divide-y divide-line">{d.requests.map((r) => <li key={r.id}><Link to={`/portal/solicitacoes/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-2/60"><RequestCode code={d.clientCode} number={r.number} /><span className="flex-1 text-base font-semibold truncate">{r.title}</span><StatusPill status={r.status} /></Link></li>)}</ul> : <p className="text-base text-ink-4">Não informado.</p>}
      </section>
    </article>
  );
}
