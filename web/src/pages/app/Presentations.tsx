import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Presentation as PresentationIcon, Plus, Share2 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { fmtDate } from '@/lib/labels';
import type { Presentation, PresentationRow, Project } from '@/lib/types';
import { Badge, Button, Chip, DatePicker, Dialog, EmptyState, ErrorState, Field, Input, PageHeader, SimpleSelect, Skeleton } from '@/components/ui';
import { CardsSkeleton } from '@/components/skeletons';
import { toast } from '@/lib/toast';

export function PresentationsPage() {
  const { clientId } = useScope();
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['presentations', clientId], queryFn: () => api.get<PresentationRow[]>(`/presentations${qs({ clientId })}`) });
  return (
    <div>
      <PageHeader title="Apresentações executivas" lead="Geradas a partir das solicitações, entregas e evidências do período. Edite a narrativa, apresente em tela cheia ou exporte em PDF." actions={<Button icon={<Plus />} onClick={() => setOpen(true)}>Gerar apresentação</Button>} />
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.isLoading ? <CardsSkeleton variant="slide" count={3} /> : q.data?.length ? (
        <ul className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 rise-list">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link to={`/app/apresentacoes/${p.id}`} className="card block overflow-hidden card-interactive group">
                <div className="grain-dark text-paper aspect-video p-5 flex flex-col">
                  <span className="eyebrow text-orange-300">{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</span>
                  <span className="mt-auto text-2xl font-semibold tracking-tight leading-tight text-balance">{p.title}</span>
                </div>
                <div className="p-4 flex items-center gap-3 text-xs text-ink-4">
                  <span className="font-semibold text-ink-2">{p.clientName}</span><span>{p.slideCount} slides</span>
                  <span className="ml-auto">{p.status === 'compartilhada' ? <Badge tone="orange"><Share2 size={11} />no portal</Badge> : <Badge tone="neutral">rascunho</Badge>}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState icon={<PresentationIcon size={28} />} title="Nenhuma apresentação" text="Escolha cliente, projetos e período: os slides são montados com o que está no banco." action={<Button onClick={() => setOpen(true)}>Gerar a primeira</Button>} />}
      <GenerateDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export function GenerateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const nav = useNavigate();
  const { clientId: scoped } = useScope();
  const [clientId, setClientId] = useState(scoped || me.clients[0]?.id || '');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  useEffect(() => { if (open) { setClientId(scoped || me.clients[0]?.id || ''); setProjectIds([]); } }, [open, scoped, me.clients]);
  const projects = useQuery({ queryKey: ['projects', clientId], queryFn: () => api.get<Project[]>(`/projects${qs({ clientId })}`), enabled: !!clientId });
  const gen = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Presentation>('/presentations', body),
    onSuccess: (p) => { toast.ok(`Apresentação gerada com ${p.slides.length} slides.`); onClose(); nav(`/app/apresentacoes/${p.id}`); },
    onError: (e) => toast.bad(e.message),
  });
  const [to, setTo] = useState(() => new Date());
  const [from, setFrom] = useState(() => new Date(to.getFullYear(), to.getMonth() - 5, 1));
  return (
    <Dialog open={open} onClose={onClose} title="Gerar apresentação executiva" width={560}>
      <form className="grid gap-4" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); gen.mutate({ clientId, projectIds: projectIds.length ? projectIds : undefined, periodStart: new Date(String(f.get('start')) + 'T00:00:00').toISOString(), periodEnd: new Date(String(f.get('end')) + 'T23:59:59').toISOString(), title: String(f.get('title') || '') || undefined }); }}>
        <Field label="Cliente"><SimpleSelect value={clientId} onValueChange={(v) => { setClientId(v); setProjectIds([]); }} options={me.clients.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <div>
          <span className="label">Projetos <span className="font-normal text-ink-4">(nenhum marcado = todos)</span></span>
          <div className="flex flex-wrap gap-2">{projects.data?.map((p) => { const on = projectIds.includes(p.id); return <Chip key={p.id} active={on} onClick={() => setProjectIds((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}>{p.name}</Chip>; })}</div>
        </div>
        <div className="grid grid-cols-2 gap-3"><Field label="Início"><DatePicker name="start" required value={from} onChange={(d) => { setFrom(d); if (to < d) setTo(d); }} /></Field><Field label="Fim"><DatePicker name="end" required min={from} value={to} onChange={setTo} /></Field></div>
        <Field label="Título (opcional)"><Input name="title" maxLength={140} placeholder="Ex.: Resultados do semestre" /></Field>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={gen.isPending}>Gerar slides</Button></div>
      </form>
    </Dialog>
  );
}
