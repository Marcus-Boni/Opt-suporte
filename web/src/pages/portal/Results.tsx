import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Play, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/labels';
import type { Presentation, PresentationRow } from '@/lib/types';
import { Button, ButtonLink, EmptyState, ErrorState, Skeleton, cx } from '@/components/ui';
import { CardsSkeleton, StageSkeleton } from '@/components/skeletons';
import { SlideView } from '@/components/slides';
import { useLenis } from '@/lib/lenis';

export function PortalResultsPage() {
  useLenis();
  const q = useQuery({ queryKey: ['presentations', 'portal'], queryFn: () => api.get<PresentationRow[]>('/presentations') });
  return (
    <div>
      <header className="rise mb-6"><h1 className="text-4xl font-semibold tracking-tight">Resultados</h1><p className="mt-1 text-md text-ink-3">Apresentações executivas compartilhadas pela Optsolv, com números calculados a partir do que foi registrado.</p></header>
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <CardsSkeleton variant="slide" count={2} /> : q.data?.length ? (
        <ul className="grid md:grid-cols-2 gap-4 rise-list">{q.data.map((p) => (
          <li key={p.id}><Link to={`/portal/resultados/${p.id}`} className="card block overflow-hidden card-interactive">
            <div className="grain-dark text-paper aspect-video p-6 flex flex-col"><span className="eyebrow text-orange-300">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</span><span className="mt-auto text-2xl font-semibold tracking-tight leading-tight text-balance">{p.title}</span></div>
            <div className="p-4 text-sm text-ink-4">{p.slideCount} slides · preparada por {p.createdByLabel}</div>
          </Link></li>
        ))}</ul>
      ) : <EmptyState icon={<BarChart3 />} title="Nenhum resultado compartilhado ainda" text="Quando a Optsolv compartilhar uma apresentação do período, ela fica disponível aqui." />}
    </div>
  );
}

export function PortalResultDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: ['presentation', id], queryFn: () => api.get<Presentation>(`/presentations/${id}`) });
  const [i, setI] = useState(0);
  useLenis();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, (q.data?.slides.length ?? 1) - 1)); if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1)); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [q.data]);
  if (q.isLoading) return <StageSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const p = q.data;
  const slide = p.slides[i];
  return (
    <div className="rise">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-ink-4 flex items-center gap-1.5"><Link to="/portal/resultados" className="hover:text-ink">Resultados</Link><span>/</span><span>{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</span></div>
        <div className="ml-auto flex gap-2"><ButtonLink to={`/portal/resultados/${id}/imprimir`} variant="secondary" size="sm" icon={<Printer />}>PDF</ButtonLink><ButtonLink to={`/portal/resultados/${id}/apresentar`} size="sm" icon={<Play />}>Apresentar</ButtonLink></div>
      </div>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">{p.title}</h1>
      <div className="rounded-2xl overflow-hidden shadow-pop border border-line"><SlideView slide={slide} index={i} total={p.slides.length} clientName={p.clientName} /></div>
      <div className="mt-3 flex items-center justify-between text-sm text-ink-4">
        <Button variant="ghost" size="sm" icon={<ChevronLeft />} disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</Button>
        <ol className="flex gap-0.5">{p.slides.map((s, idx) => <li key={s.id}><Button variant="ghost" size="icon" className="size-8 rounded-full hover:bg-transparent" onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} aria-current={idx === i}><span className={cx('block size-2.5 rounded-full', idx === i ? 'bg-orange-500' : 'bg-paper-3 hover:bg-ink-5')} /></Button></li>)}</ol>
        <Button variant="ghost" size="sm" disabled={i === p.slides.length - 1} onClick={() => setI(i + 1)}>Próximo <ChevronRight size={14} /></Button>
      </div>
    </div>
  );
}
