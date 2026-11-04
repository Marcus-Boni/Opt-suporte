import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles, Inbox, Plus, BarChart3 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { STATUS, fmtDate, fmtRelative } from '@/lib/labels';
import type { DeliveryRow, Metrics, Paged, PresentationRow, RequestRow } from '@/lib/types';
import { ButtonLink, ErrorState, Skeleton, cx } from '@/components/ui';
import { CardsSkeleton, RowsSkeleton, StatsSkeleton } from '@/components/skeletons';
import { StatusPill, RequestCode } from '@/components/status';
import { CountUp } from '@/components/count-up';

export function PortalHomePage() {
  const me = useMe();
  const metrics = useQuery({ queryKey: ['metrics', 'portal'], queryFn: () => api.get<Metrics>('/metrics') });
  const requests = useQuery({ queryKey: ['requests', 'portal-home'], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ pageSize: 6 })}`) });
  const news = useQuery({ queryKey: ['deliveries', 'portal-home'], queryFn: () => api.get<Paged<DeliveryRow>>(`/deliveries${qs({ pageSize: 3 })}`) });
  const results = useQuery({ queryKey: ['presentations', 'portal'], queryFn: () => api.get<PresentationRow[]>('/presentations') });
  const first = me.actor.label.split(' ')[0];
  const m = metrics.data;
  const waitingQ = useQuery({ queryKey: ['requests', 'portal-waiting'], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ status: 'aguardando_cliente', pageSize: 10 })}`) });
  const waiting = waitingQ.data?.items ?? [];

  return (
    <div>
      <header className="rise mb-8">
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter">Olá, {first}.</h1>
        <p className="mt-3 text-lg text-ink-3 max-w-[52ch]">Aqui você acompanha o que pediu, o que já foi entregue e os resultados do trabalho da Optsolv com a sua equipe.</p>
      </header>
      {metrics.isError && <ErrorState error={metrics.error} retry={() => metrics.refetch()} />}

      <section className="rise grid sm:grid-cols-3 gap-3" style={{ animationDelay: '60ms' }}>
        {!m ? <StatsSkeleton count={3} className="contents" /> : (
          <>
            <Link to="/portal/solicitacoes?status=abertas" className="card p-5 card-interactive"><div className="eyebrow text-ink-4">Em aberto</div><div className="mt-1 text-5xl font-semibold tracking-tighter tnum leading-none"><CountUp to={m.totals.requestsOpen} /></div><div className="mt-2 text-sm text-ink-3">solicitações sendo tratadas</div></Link>
            <Link to="/portal/solicitacoes?status=aguardando_cliente" className={cx('card p-5 card-interactive', m.totals.waitingClient > 0 && 'bg-primary text-primary-foreground')}><div className={cx('eyebrow', m.totals.waitingClient > 0 ? 'text-primary-foreground' : 'text-ink-4')}>Aguardando você</div><div className="mt-1 text-5xl font-semibold tracking-tighter tnum leading-none"><CountUp to={m.totals.waitingClient} /></div><div className={cx('mt-2 text-sm', m.totals.waitingClient > 0 ? 'text-primary-foreground' : 'text-ink-3')}>{m.totals.waitingClient > 0 ? 'a equipe precisa da sua resposta' : 'nada pendente do seu lado'}</div></Link>
            <Link to="/portal/novidades" className="card p-5 card-interactive"><div className="eyebrow text-ink-4">Entregas publicadas</div><div className="mt-1 text-5xl font-semibold tracking-tighter tnum leading-none text-orange-600"><CountUp to={m.totals.deliveriesPublished} /></div><div className="mt-2 text-sm text-ink-3">nos últimos 6 meses · {m.totals.requestsConcluded} solicitações concluídas</div></Link>
          </>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="rise mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5" style={{ animationDelay: '100ms' }}>
          <h2 className="text-md font-semibold text-orange-800">Precisamos de você</h2>
          <ul className="mt-2 grid gap-1.5">{waiting.map((r) => <li key={r.id}><Link to={`/portal/solicitacoes/${r.id}`} className="flex items-center gap-3 text-base font-semibold text-ink hover:text-orange-700"><RequestCode code={r.clientCode} number={r.number} /><span className="flex-1 truncate">{r.title}</span><ArrowRight size={15} /></Link></li>)}</ul>
        </section>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-6 *:min-w-0">
        <section className="rise" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles size={18} className="text-orange-500" />Novidades</h2><Link to="/portal/novidades" className="text-sm font-semibold text-orange-700">Ver todas</Link></div>
          {news.isLoading ? <CardsSkeleton variant="news" count={2} /> : news.data?.items.length ? (
            <ul className="grid gap-3">{news.data.items.map((d) => (
              <li key={d.id}><Link to={`/portal/novidades/${d.id}`} className="card block p-5 card-interactive border-l-[3px] border-l-orange-500">
                <div className="text-xs text-ink-4">{fmtDate(d.publishedAt)} · {d.projectName}</div>
                <h3 className="mt-1 text-xl font-semibold leading-snug">{d.title}</h3>
                <p className="mt-1 text-base text-ink-3 line-clamp-2">{d.summary}</p>
              </Link></li>
            ))}</ul>
          ) : <p className="card p-5 text-base text-ink-4">Nenhuma entrega publicada ainda. Assim que algo for concluído e publicado, aparece aqui.</p>}
        </section>
        <section className="rise" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold flex items-center gap-2"><Inbox size={18} className="text-ink-4" />Suas solicitações</h2><Link to="/portal/solicitacoes" className="text-sm font-semibold text-orange-700">Ver todas</Link></div>
          {requests.isLoading ? <RowsSkeleton rows={4} code={false} /> : requests.data?.items.length ? (
            <ul className="card divide-y divide-line">{requests.data.items.map((r) => (
              <li key={r.id}><Link to={`/portal/solicitacoes/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper-2/60"><div className="min-w-0 flex-1"><div className="text-base font-semibold truncate">{r.title}</div><div className="text-xs text-ink-4">{STATUS[r.status].hint} · {fmtRelative(r.updatedAt)}</div></div><StatusPill status={r.status} /></Link></li>
            ))}</ul>
          ) : <div className="card p-5 text-base text-ink-4">Você ainda não abriu nenhuma solicitação. <Link to="/portal/solicitacoes/nova" className="link">Abrir a primeira</Link>.</div>}
          <ButtonLink to="/portal/solicitacoes/nova" className="mt-3 w-full" icon={<Plus />}>Nova solicitação</ButtonLink>
        </section>
      </div>

      {results.data && results.data.length > 0 && (
        <section className="rise mt-8" style={{ animationDelay: '220ms' }}>
          <div className="flex items-center justify-between mb-3"><h2 className="text-xl font-semibold flex items-center gap-2"><BarChart3 size={18} className="text-orange-500" />Resultados compartilhados</h2><Link to="/portal/resultados" className="text-sm font-semibold text-orange-700">Ver todos</Link></div>
          <Link to={`/portal/resultados/${results.data[0].id}`} className="card block overflow-hidden card-interactive md:grid md:grid-cols-[320px_1fr]">
            <div className="grain-dark text-paper p-6 aspect-video md:aspect-auto flex flex-col"><span className="eyebrow text-orange-300">{fmtDate(results.data[0].periodStart)} – {fmtDate(results.data[0].periodEnd)}</span><span className="mt-auto text-2xl font-semibold tracking-tight leading-tight">{results.data[0].title}</span></div>
            <div className="p-6 flex flex-col justify-center"><p className="text-md text-ink-3">Apresentação executiva com solicitações, entregas e evidências do período, preparada pela Optsolv.</p><span className="mt-3 inline-flex items-center gap-1 text-base font-semibold text-orange-700">Abrir apresentação <ArrowRight size={15} /></span></div>
          </Link>
        </section>
      )}
    </div>
  );
}
