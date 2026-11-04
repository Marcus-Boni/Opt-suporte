import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageSquareText, Sparkles, CopyCheck, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { CATEGORY, PRIORITY, fmtDateTime } from '@/lib/labels';
import type { IntakePreview, Project, RequestCategory, RequestPriority, RequestRow, Suggestion } from '@/lib/types';
import { Badge, Button, Card, CardContent, Checkbox, Field, Input, PageHeader, SimpleSelect, Textarea, cx } from '@/components/ui';
import { toast } from '@/lib/toast';

const SAMPLE = `[03/11/2026, 08:10:00] Carlos Mendes: Bom dia pessoal
[03/11/2026, 08:11:00] Carlos Mendes: O relatório de visitas por engenheiro não abre quando filtro por obra, dá erro 500
[03/11/2026, 08:30:00] Patrícia Nunes: Seria bom poder exportar a agenda de visitas em PDF para a diretoria
[03/11/2026, 08:31:00] Patrícia Nunes: 👍
[03/11/2026, 09:00:00] Carlos Mendes: urgente: ninguém consegue abrir a tela de aprovação hoje
[03/11/2026, 09:05:00] Patrícia Nunes: Como faço para cadastrar um novo engenheiro no app?`;

type Draft = Suggestion & { include: boolean };
const CATEGORY_OPTIONS = Object.entries(CATEGORY).map(([value, label]) => ({ value, label }));
const PRIORITY_OPTIONS = Object.entries(PRIORITY).map(([value, label]) => ({ value, label }));

export function IntakePage() {
  const me = useMe();
  const { clientId: scoped, setClientId: setScoped } = useScope();
  const [clientId, setClientId] = useState(scoped || me.clients[0]?.id || '');
  const [projectId, setProjectId] = useState('');
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [mode, setMode] = useState('');
  const [done, setDone] = useState<RequestRow[] | null>(null);
  const projects = useQuery({ queryKey: ['projects', clientId], queryFn: () => api.get<Project[]>(`/projects${qs({ clientId })}`), enabled: !!clientId });
  useEffect(() => { if (projects.data?.length && !projects.data.some((p) => p.id === projectId)) setProjectId(projects.data[0].id); }, [projects.data, projectId]);

  const preview = useMutation({
    mutationFn: () => api.post<IntakePreview>('/intake/whatsapp-preview', { clientId, projectId: projectId || undefined, text }),
    onSuccess: (r) => { setMode(r.mode); setDrafts(r.suggestions.map((s) => ({ ...s, include: !s.ignored && !s.duplicateOf }))); setDone(null); const n = r.suggestions.filter((s) => !s.ignored).length; if (n) toast.info(`${n} ${n === 1 ? 'sugestão encontrada' : 'sugestões encontradas'}. Revise antes de criar.`); else toast.info('Nenhuma solicitação encontrada nas mensagens.'); },
    onError: (e) => toast.bad(e.message),
  });
  const commit = useMutation({
    mutationFn: () => api.post<{ created: RequestRow[] }>('/intake/whatsapp-commit', {
      clientId, projectId, rawText: text,
      items: (drafts ?? []).filter((d) => d.include).map((d) => ({ title: d.title, description: d.description, category: d.category, priority: d.priority, sender: d.sender, sentAt: d.sentAt, excerpt: d.excerpt })),
    }),
    onSuccess: (r) => { setDone(r.created); setDrafts(null); setText(''); setScoped(clientId); toast.ok(`${r.created.length} solicitação(ões) registradas.`); },
    onError: (e) => toast.bad(e.message),
  });
  const selected = useMemo(() => (drafts ?? []).filter((d) => d.include), [drafts]);
  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds!.map((d) => (d.index === i ? { ...d, ...patch } : d)));

  return (
    <div>
      <PageHeader title="Captura de mensagens" lead="Cole a conversa exportada do WhatsApp. A plataforma separa as mensagens em sugestões revisáveis; nada é gravado antes da sua confirmação." />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6 items-start">
        <Card className="rise ring-0 shadow-card rounded-2xl py-0">
          <CardContent className="p-5 md:p-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Cliente"><SimpleSelect value={clientId} onValueChange={(v) => { setClientId(v); setDrafts(null); }} options={me.clients.map((c) => ({ value: c.id, label: c.name }))} /></Field>
              <Field label="Projeto"><SimpleSelect value={projectId} onValueChange={setProjectId} disabled={!projects.data?.length} placeholder="Sem projetos" options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} /></Field>
            </div>
            <Field label="Mensagens copiadas" className="mt-4" hint="Formatos aceitos: “[dd/mm/aaaa, hh:mm:ss] Nome: texto” ou “dd/mm/aaaa hh:mm - Nome: texto”.">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE.split('\n').slice(0, 2).join('\n') + '\n…'} className="font-mono text-sm leading-relaxed min-h-[280px]" />
            </Field>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => preview.mutate()} loading={preview.isPending} disabled={!text.trim() || !clientId} icon={<Sparkles />}>Analisar mensagens</Button>
              <Button variant="ghost" onClick={() => setText(SAMPLE)}>Usar exemplo fictício</Button>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-ink-4"><span className="size-1.5 rounded-full bg-ok" />modo demonstração determinístico · sem IA externa</span>
            </div>
          </CardContent>
        </Card>

        <section className="min-w-0">
          {done ? (
            <Card className="rise ring-0 shadow-card rounded-2xl py-0"><CardContent className="p-6">
              <div className="flex items-center gap-3 text-ok"><span className="grid place-items-center size-9 rounded-full bg-ok-soft"><Check size={18} /></span><h2 className="text-xl font-semibold text-ink">{done.length} {done.length === 1 ? 'solicitação registrada' : 'solicitações registradas'}</h2></div>
              <ul className="mt-4 divide-y divide-line">
                {done.map((r) => (
                  <li key={r.id}><Link to={`/app/solicitacoes/${r.id}`} className="flex items-center gap-3 py-2.5 group"><span className="font-mono text-xs text-ink-4">{r.clientCode}-{r.number}</span><span className="flex-1 font-semibold text-base group-hover:text-orange-700">{r.title}</span><ArrowRight size={16} className="text-ink-5" /></Link></li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-4">O texto original foi preservado como mensagem de origem e cada solicitação guarda seu trecho.</p>
            </CardContent></Card>
          ) : drafts ? (
            <div className="rise">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div><h2 className="text-xl font-semibold">{drafts.filter((d) => !d.ignored).length} sugestões</h2><p className="text-sm text-ink-4">{drafts.length} blocos de mensagem · análise <span className="font-mono">{mode}</span></p></div>
                <Button onClick={() => commit.mutate()} loading={commit.isPending} disabled={!selected.length || !projectId} icon={<CopyCheck />}>{selected.length ? `Registrar ${selected.length} ${selected.length === 1 ? 'solicitação' : 'solicitações'}` : 'Registrar solicitações'}</Button>
              </div>
              <ul className="grid gap-3 rise-list">
                {drafts.map((d) => (
                  <li key={d.index}>
                    <Card className={cx('ring-0 shadow-card rounded-2xl py-0 transition-opacity', d.ignored && 'opacity-55', !d.include && !d.ignored && 'opacity-70')}>
                      <CardContent className="p-4 flex items-start gap-3">
                        <Checkbox className="mt-1" checked={d.include} disabled={!!d.ignored} onCheckedChange={(v) => update(d.index, { include: v === true })} aria-label="Incluir sugestão" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4"><span className="font-semibold text-ink-2 inline-flex items-center gap-1"><MessageSquareText size={13} />{d.sender}</span>{d.sentAt && <span>{fmtDateTime(d.sentAt)}</span>}</div>
                          <blockquote className="mt-1.5 text-sm text-ink-3 border-l-2 border-paper-3 pl-3 whitespace-pre-wrap">{d.excerpt}</blockquote>
                          {d.ignored ? <p className="mt-2 text-sm text-ink-4">{d.ignored}</p> : (
                            <div className="mt-3 grid gap-3">
                              {d.duplicateOf && <div className="flex items-start gap-2 rounded-lg bg-warn-soft text-warn px-3 py-2 text-sm"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>Possível repetida de <Link className="font-semibold underline" to={`/app/solicitacoes/${d.duplicateOf.requestId}`}>#{d.duplicateOf.number} {d.duplicateOf.title}</Link> ({Math.round(d.duplicateOf.score * 100)}% de termos em comum). Desmarcada por padrão.</span></div>}
                              {d.similarTo && <div className="text-sm text-ink-3">Parecida com a sugestão {d.similarTo.index + 1} ({Math.round(d.similarTo.score * 100)}%).</div>}
                              <Field label="Título"><Input value={d.title} onChange={(e) => update(d.index, { title: e.target.value })} /></Field>
                              <div className="grid grid-cols-2 gap-3">
                                <Field label="Categoria"><SimpleSelect value={d.category} onValueChange={(v) => update(d.index, { category: v as RequestCategory })} options={CATEGORY_OPTIONS} /></Field>
                                <Field label="Prioridade"><SimpleSelect value={d.priority} onValueChange={(v) => update(d.index, { priority: v as RequestPriority })} options={PRIORITY_OPTIONS} /></Field>
                              </div>
                              <Badge tone={d.confidence >= 0.8 ? 'ok' : 'neutral'}>confiança da heurística {Math.round(d.confidence * 100)}%</Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line-2 bg-paper-2/60 p-8 text-center rise">
              <Sparkles size={26} className="mx-auto text-orange-500" />
              <h2 className="mt-3 text-xl font-semibold">As sugestões aparecem aqui</h2>
              <p className="mt-1 text-base text-ink-3 max-w-[44ch] mx-auto">Cada bloco de mensagens vira uma proposta com título, categoria e prioridade. Repetidas de solicitações abertas são sinalizadas para você decidir.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
