import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Inbox, PackageCheck, UserRoundX, Hourglass } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { CATEGORY, SOURCE, STATUS_ORDER, fmtDate, fmtRelative, statusLabel } from '@/lib/labels';
import type { Metrics, Paged, RequestRow, RequestCategory, RequestSource } from '@/lib/types';
import { ErrorState, PageHeader, Segmented, Skeleton, Stat, ButtonLink, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cx } from '@/components/ui';
import { RowsSkeleton } from '@/components/skeletons';
import { MonthlyTrend, Distribution } from '@/components/charts';
import { StatusPill, RequestCode, PriorityMark } from '@/components/status';

const PERIODS = [{ value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }, { value: '180', label: '6 meses' }, { value: '365', label: '12 meses' }];

export function OverviewPage() {
  const me = useMe();
  const { clientId } = useScope();
  const [days, setDays] = useState('180');
  const from = new Date(Date.now() - Number(days) * 86_400_000).toISOString();
  const metrics = useQuery({ queryKey: ['metrics', clientId, days], queryFn: () => api.get<Metrics>(`/metrics${qs({ clientId, from })}`) });
  const attention = useQuery({ queryKey: ['requests', 'attention', clientId], queryFn: () => api.get<Paged<RequestRow>>(`/requests${qs({ clientId, status: 'nova,em_triagem,aguardando_cliente', pageSize: 8 })}`) });
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const first = me.actor.label.split(' ')[0];
  const m = metrics.data;
  const scopeName = me.clients.find((c) => c.id === clientId)?.name;

  return (
    <div>
      <PageHeader
        title={<>{greet}, {first}.</>}
        lead={scopeName ? `Operação de ${scopeName} nos últimos ${days} dias, contada diretamente no banco.` : `Operação dos ${me.clients.length} clientes que você acompanha, contada diretamente no banco.`}
        actions={<Segmented value={days} onChange={setDays} options={PERIODS} />}
      />
      {metrics.isError && <ErrorState error={metrics.error} retry={() => metrics.refetch()} />}

      <section className="rise grid grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-2xl overflow-hidden border border-line">
        {metrics.isLoading || !m ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-card p-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-16 mt-3" /></div>) : (
          <>
            <div className="bg-card p-5"><Stat label="Solicitações abertas" value={m.totals.requestsOpen} sub={m.totals.unassigned ? <span className="text-ink-2 font-semibold">{m.totals.unassigned} sem responsável</span> : 'todas com responsável'} /></div>
            <div className="bg-card p-5"><Stat label="Concluídas no período" value={m.totals.requestsConcluded} trend={m.monthly.map((x) => x.concluded)} sub={m.totals.medianLeadDays !== null ? `mediana de ${m.totals.medianLeadDays.toLocaleString('pt-BR')} dias` : 'sem conclusões'} /></div>
            <div className="bg-card p-5"><Stat label="Entregas publicadas" value={m.totals.deliveriesPublished} accent trend={m.monthly.map((x) => x.published)} sub={`${m.totals.evidences} evidências registradas`} /></div>
            <div className="bg-card p-5"><Stat label="Aguardando cliente" value={m.totals.waitingClient} sub={`${m.totals.requestsCreated} criadas no período`} /></div>
          </>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6 *:min-w-0">
        <div className="card p-5 md:p-6 rise" style={{ animationDelay: '60ms' }}>
          <div className="flex items-baseline justify-between mb-4"><h2 className="text-lg font-semibold">Mês a mês</h2><span className="text-xs text-ink-4">abertas · concluídas · entregas</span></div>
          {m ? <MonthlyTrend data={m.monthly.map((x) => ({ ...x, label: monthLabel(x.month) }))} height={190} /> : <Skeleton className="h-[220px]" />}
        </div>
        <div className="card p-5 md:p-6 rise" style={{ animationDelay: '120ms' }}>
          <h2 className="text-lg font-semibold mb-4">De onde vêm os pedidos</h2>
          {m ? <Distribution items={Object.entries(m.bySource).map(([k, v]) => ({ label: SOURCE[k as RequestSource] ?? k, value: v }))} /> : <Skeleton className="h-24" />}
          <h2 className="text-lg font-semibold mt-6 mb-4">Por categoria</h2>
          {m ? <Distribution items={Object.entries(m.byCategory).map(([k, v]) => ({ label: CATEGORY[k as RequestCategory] ?? k, value: v }))} /> : <Skeleton className="h-24" />}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6 *:min-w-0">
        <div className="card p-5 md:p-6 rise" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Hourglass size={16} className="text-ink-4" />Precisa de atenção</h2>
            <Link to={`/app/solicitacoes${qs({ status: 'nova,em_triagem,aguardando_cliente' })}`} className="text-sm font-semibold text-orange-700 inline-flex items-center gap-0.5">Ver todas <ArrowUpRight size={14} /></Link>
          </div>
          {attention.isLoading ? <RowsSkeleton bare rows={4} /> : attention.data?.items.length ? (
            <ul className="divide-y divide-line">
              {attention.data.items.map((r) => (
                <li key={r.id}>
                  <Link to={`/app/solicitacoes/${r.id}`} className="flex items-center gap-3 py-2.5 group">
                    <RequestCode code={r.clientCode} number={r.number} className="w-14 shrink-0" />
                    <span className="flex-1 min-w-0 text-base font-semibold truncate group-hover:text-orange-700 transition-colors">{r.title}</span>
                    {!r.assigneeName && <UserRoundX size={14} className="text-ink-4 shrink-0" aria-label="Sem responsável" />}
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-base text-ink-4 py-6 text-center">Nada pendente de triagem ou resposta. Boa.</p>}
        </div>
        <div className="card p-5 md:p-6 rise" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><PackageCheck size={16} className="text-orange-500" />Entregas com evidência</h2>
            <Link to="/app/entregas" className="text-sm font-semibold text-orange-700 inline-flex items-center gap-0.5">Ver entregas <ArrowUpRight size={14} /></Link>
          </div>
          {!m ? <RowsSkeleton bare rows={3} code={false} /> : m.highlights.length ? (
            <ul className="grid gap-2">
              {m.highlights.map((h) => (
                <li key={h.id}>
                  <Link to={`/app/entregas/${h.id}`} className="block rounded-lg border border-line px-3.5 py-3 hover:border-orange-300 hover:bg-orange-50/40 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold truncate">{h.title}</span>
                      <span className="text-xs text-ink-4 shrink-0">{fmtDate(h.publishedAt)}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink-3 flex flex-wrap gap-x-3">
                      <span>{h.clientName}</span>
                      <span className={cx(h.evidenceCount ? 'text-ink-2 font-semibold' : '')}>{h.evidenceCount} evidência{h.evidenceCount === 1 ? '' : 's'}{h.measuredCount ? ` · ${h.measuredCount} medida${h.measuredCount === 1 ? '' : 's'}` : ''}</span>
                      <span>{h.requestCount} {h.requestCount === 1 ? 'solicitação' : 'solicitações'}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-base text-ink-4 py-6 text-center">Nenhuma entrega publicada no período.</p>}
        </div>
      </section>

      {m && m.clients.length > 1 && !clientId && (
        <section className="mt-6 card p-5 md:p-6 rise" style={{ animationDelay: '240ms' }}>
          <h2 className="text-lg font-semibold mb-3">Por cliente</h2>
          <Table className="text-base">
            <TableHeader><TableRow className="text-xs uppercase tracking-wide text-ink-4 hover:bg-transparent"><TableHead>Cliente</TableHead><TableHead className="text-right">Abertas</TableHead><TableHead className="text-right">Sem resp.</TableHead><TableHead className="text-right">Concluídas</TableHead><TableHead className="text-right">Entregas</TableHead></TableRow></TableHeader>
            <TableBody>
              {m.clients.map((c) => (
                <TableRow key={c.clientId}>
                  <TableCell><Link to={`/app/clientes/${c.clientId}`} className="font-semibold hover:text-orange-700">{c.clientName}</Link></TableCell>
                  <TableCell className="text-right tnum">{c.open}</TableCell>
                  <TableCell className={cx('text-right tnum', c.unassigned > 0 && 'text-orange-700 font-semibold')}>{c.unassigned}</TableCell>
                  <TableCell className="text-right tnum">{c.concluded}</TableCell>
                  <TableCell className="text-right tnum font-semibold">{c.published}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {m && m.totals.requestsCreated === 0 && m.totals.requestsOpen === 0 && (
        <div className="mt-6"><ButtonLink to="/app/captura" icon={<Inbox />}>Começar pela captura de mensagens</ButtonLink></div>
      )}
      <p className="mt-8 text-xs text-ink-5">Atualizado {fmtRelative(new Date())}. Status: {STATUS_ORDER.filter((k) => m?.byStatus[k]).map((k) => `${statusLabel(k, true)} ${m?.byStatus[k]}`).join(' · ') || '—'}.</p>
    </div>
  );
}

function monthLabel(m: string) { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''); }
