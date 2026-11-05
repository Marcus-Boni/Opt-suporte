import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bot, Check, Code2, Copy, Download, ExternalLink, FileText, KeyRound, LifeBuoy, PanelsTopLeft, Server, Terminal, Wand2 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import type { Project } from '@/lib/types';
import { Badge, Button, ButtonLink, Card, CardContent, Field, PageHeader, Segmented, SimpleSelect, cx } from '@/components/ui';
import { Button as BaseButton } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';
import { WidgetPreview } from './integrations/widget-preview';

const SKILL_DIR = '/integracoes/skills/optsolv-suporte-widget';
const MCP_TOOLS = ['list_clients', 'list_projects', 'search_requests', 'get_request', 'create_request', 'add_request_comment', 'create_delivery', 'link_delivery_requests', 'get_value_summary', 'create_presentation'];

const fetchText = (path: string) => fetch(path).then((r) => { if (!r.ok) throw new Error(`Não foi possível carregar ${path}.`); return r.text(); });
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

/** Prompt padrão: instruções de execução + especificação publicada (fonte única, a mesma da skill). */
function buildPrompt({ origin, clientName, project, spec }: { origin: string; clientName: string; project?: Project; spec: string }) {
  const name = project?.name ?? '<nome da solução>';
  return `Você é um engenheiro de software sênior trabalhando neste repositório. Implemente o widget de suporte "Optsolv Suporte" na solução ${name} (cliente ${clientName}).

Antes de escrever código:
1. Reconheça o projeto: framework do front e do back, autenticação (de onde vem o nome da pessoa logada), design system, padrão de rotas, leitura de variáveis de ambiente e como os testes rodam.
2. Apresente o plano (arquivos a criar ou alterar, onde o widget é montado e onde fica a rota do backend) e aguarde minha confirmação.

Depois, implemente seguindo a especificação abaixo à risca. Rode testes, tipos e build, e termine com a lista de critérios de aceite, marcando o que ficou pendente.

Valores desta solução (variáveis de ambiente do servidor; nunca no código nem no navegador):
- OPTSOLV_API_URL=${origin}
- OPTSOLV_PROJECT_ID=${project?.id ?? '<id do projeto>'}
- OPTSOLV_PORTAL_URL=${origin}
- OPTSOLV_API_TOKEN=<credencial "Widget · ${name}" criada em Acessos e API, papel Usuário do cliente>

---

${spec.trim()}
`;
}

function CopyButton({ text, label = 'Copiar', what }: { text: string; label?: string; what: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = window.setTimeout(() => setDone(false), 1600); return () => window.clearTimeout(t); }, [done]);
  return (
    <Button type="button" variant="secondary" size="sm" disabled={!text} onClick={() => { navigator.clipboard?.writeText(text); setDone(true); toast.ok(`${what} copiado.`); }}
      icon={<span className="relative grid size-4 place-items-center"><Copy className={cx('absolute transition-[opacity,transform] duration-150', done && 'scale-50 opacity-0')} /><Check className={cx('absolute text-ok transition-[opacity,transform] duration-150', !done && 'scale-50 opacity-0')} /></span>}>
      {done ? 'Copiado' : label}
    </Button>
  );
}

function Code({ children, label, className }: { children: string; label?: string; className?: string }) {
  return (
    <div className="group relative">
      <pre className={cx('on-night overflow-auto rounded-xl bg-night px-4 py-3.5 font-mono text-xs leading-relaxed text-paper-3 ring-1 ring-white/5', className)}><code>{children}</code></pre>
      <Tip label={label ?? 'Copiar'}>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={label ?? 'Copiar'} onClick={() => { navigator.clipboard?.writeText(children); toast.ok('Copiado.'); }}
          className="absolute right-2 top-2 text-ink-5 opacity-0 transition-opacity hover:bg-white/10 hover:text-paper focus-visible:opacity-100 group-hover:opacity-100"><Copy /></Button>
      </Tip>
    </div>
  );
}

function Section({ id, icon, eyebrow, title, text, actions, children, delay = 0 }: { id: string; icon: ReactNode; eyebrow: string; title: string; text: ReactNode; actions?: ReactNode; children: ReactNode; delay?: number }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="rise scroll-mt-20" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="eyebrow flex items-center gap-1.5 text-orange-700">{icon}{eyebrow}</span>
          <h2 id={`${id}-t`} className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 max-w-[70ch] text-base text-ink-3">{text}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

const card = 'ring-0 shadow-card rounded-2xl py-0';

export function IntegrationsPage() {
  const me = useMe();
  const { clientId: scoped } = useScope();
  const isAdmin = me.actor.role === 'admin_optsolv';
  const origin = window.location.origin;
  const [clientId, setClientId] = useState(scoped || me.clients[0]?.id || '');
  const [projectId, setProjectId] = useState('');
  const [dark, setDark] = useState<'claro' | 'escuro'>('claro');
  const [shell, setShell] = useState<'bash' | 'powershell'>('bash');
  const client = me.clients.find((c) => c.id === clientId);
  const projects = useQuery({ queryKey: ['projects', clientId], queryFn: () => api.get<Project[]>(`/projects${qs({ clientId })}`), enabled: !!clientId });
  useEffect(() => { if (projects.data && !projects.data.some((p) => p.id === projectId)) setProjectId(projects.data[0]?.id ?? ''); }, [projects.data, projectId]);
  const project = projects.data?.find((p) => p.id === projectId);

  const spec = useQuery({ queryKey: ['integracoes', 'spec'], queryFn: () => fetchText(`${SKILL_DIR}/especificacao.md`), staleTime: Infinity });
  const skill = useQuery({ queryKey: ['integracoes', 'skill'], queryFn: () => fetchText(`${SKILL_DIR}/SKILL.md`), staleTime: Infinity });
  const prompt = useMemo(() => (spec.data ? buildPrompt({ origin, clientName: client?.name ?? '<cliente>', project, spec: spec.data }) : ''), [origin, client, project, spec.data]);

  const install = shell === 'bash'
    ? `mkdir -p .claude/skills/optsolv-suporte-widget && for f in SKILL.md especificacao.md; do\n  curl -fsSL "${origin}${SKILL_DIR}/$f" -o ".claude/skills/optsolv-suporte-widget/$f"\ndone`
    : `New-Item -ItemType Directory -Force .claude/skills/optsolv-suporte-widget | Out-Null\nforeach ($f in 'SKILL.md', 'especificacao.md') {\n  Invoke-WebRequest "${origin}${SKILL_DIR}/$f" -OutFile ".claude/skills/optsolv-suporte-widget/$f"\n}`;
  const mcpAdd = `claude mcp add --transport http optsolv-suporte ${origin}/api/v1/mcp \\\n  --header "Authorization: Bearer $OPTSOLV_API_TOKEN"`;
  const mcpJson = JSON.stringify({ mcpServers: { 'optsolv-suporte': { type: 'http', url: `${origin}/api/v1/mcp`, headers: { Authorization: 'Bearer ${OPTSOLV_API_TOKEN}' } } } }, null, 2);
  const curl = `curl -X POST ${origin}/api/v1/requests \\\n  -H "Authorization: Bearer $OPTSOLV_API_TOKEN" \\\n  -H "Idempotency-Key: $(uuidgen)" \\\n  -H "Content-Type: application/json" \\\n  -d '{"projectId":"${project?.id ?? '<id do projeto>'}","description":"Relatório de visitas não abre ao filtrar por obra.","category":"problema","priority":"alta","authorLabel":"Carla Nunes"}'`;

  const credentialCta = isAdmin
    ? <ButtonLink to="/app/acessos" variant="secondary" size="sm" icon={<KeyRound />}>Criar credencial</ButtonLink>
    : <span className="text-sm text-ink-4">Credenciais são criadas por um administrador em Acessos e API.</span>;

  return (
    <div>
      <PageHeader title="IA e integrações" lead="Leve a Optsolv Suporte para dentro das soluções: widget para quem usa o sistema, API para integrações e MCP para agentes de IA. Tudo passa pelas mesmas regras de acesso por cliente." actions={credentialCta} />

      <nav aria-label="Canais" className="rise mb-10 grid gap-3 md:grid-cols-3">
        {[
          { href: '#widget', icon: PanelsTopLeft, title: 'Widget nas soluções', text: 'Botão de suporte dentro do sistema do cliente.', meta: 'via backend da solução' },
          { href: '#mcp', icon: Bot, title: 'Agentes de IA (MCP)', text: 'Agentes registram e consultam solicitações.', meta: '/api/v1/mcp · HTTP' },
          { href: '#api', icon: Server, title: 'API REST', text: 'Integrações servidor a servidor, com OpenAPI.', meta: '/api/v1 · Bearer' },
        ].map((c) => (
          <a key={c.href} href={c.href} className="group card card-interactive flex items-start gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-700 transition-transform duration-200 group-hover:scale-105"><c.icon className="size-5" /></span>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{c.title}</span>
              <span className="block text-sm text-ink-3">{c.text}</span>
              <span className="mt-1.5 block font-mono text-2xs text-ink-4">{c.meta}</span>
            </span>
          </a>
        ))}
      </nav>

      <div className="grid gap-14">
        <Section id="widget" icon={<LifeBuoy className="size-3.5" />} eyebrow="Widget" title="Suporte dentro das soluções"
          text="Quem usa a solução abre a solicitação sem sair da tela. O widget fala com o backend da própria solução, que registra na Optsolv Suporte com uma credencial que nunca chega ao navegador.">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <WidgetPreview solution={project?.name ?? 'Sua solução'} clientCode={client?.shortCode ?? 'OPT'} dark={dark === 'escuro'} />
            <Card className={card}><CardContent className="grid gap-4 p-5">
              <Field label="Cliente"><SimpleSelect value={clientId} onValueChange={setClientId} options={me.clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Escolha o cliente" empty="Nenhum cliente cadastrado" /></Field>
              <Field label="Solução (projeto)"><SimpleSelect value={projectId} onValueChange={setProjectId} options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))} placeholder="Escolha o projeto" loading={!!clientId && projects.isLoading} empty={clientId ? 'Nenhum projeto' : 'Escolha o cliente'} /></Field>
              <div><span className="label">Tema da solução</span><Segmented value={dark} onChange={setDark} options={[{ value: 'claro', label: 'Claro' }, { value: 'escuro', label: 'Escuro' }]} /></div>
              <ol className="grid gap-3 border-t border-line pt-4 text-sm">
                {[
                  ['Widget', 'coleta o pedido, a urgência, anexos e o contexto técnico (com consentimento).'],
                  ['Backend da solução', 'confirma a sessão, identifica quem reportou e repassa com a credencial.'],
                  ['Optsolv Suporte', `registra com origem API em ${project?.name ?? 'o projeto'}, pronto para triagem.`],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-paper-3 text-xs font-semibold tnum text-ink-2">{i + 1}</span><span><b className="font-semibold text-ink">{t}</b> <span className="text-ink-3">{d}</span></span></li>
                ))}
              </ol>
              <p className="rounded-lg bg-paper-2 px-3 py-2 text-xs text-ink-4">Pré-visualização interativa: nada é gravado. Experimente enviar.</p>
            </CardContent></Card>
          </div>
        </Section>

        <Section id="prompt" icon={<Wand2 className="size-3.5" />} eyebrow="Prompt padrão" title="Peça a um agente para criar o widget" delay={60}
          text={<>Cole no Claude Code, Copilot, Cursor ou outro agente, dentro do repositório da solução. Já sai com os valores de <b className="font-semibold text-ink-2">{project?.name ?? 'a solução escolhida acima'}</b> e com a especificação completa: arquitetura, contrato da API, interface e critérios de aceite.</>}
          actions={<><CopyButton text={prompt} label="Copiar prompt" what="Prompt" /><Button variant="secondary" size="sm" icon={<Download />} disabled={!prompt} onClick={() => download(`prompt-widget-${project?.code?.toLowerCase() ?? 'solucao'}.md`, prompt)}>Baixar .md</Button></>}>
          {spec.isError ? <p className="text-sm text-bad">Não foi possível carregar a especificação.</p>
            : <Code label="Copiar prompt" className="max-h-[420px] whitespace-pre-wrap">{prompt || 'Carregando…'}</Code>}
        </Section>

        <Section id="skill" icon={<Code2 className="size-3.5" />} eyebrow="Skill" title="Skill para Claude Code" delay={120}
          text={<>Instale uma vez no repositório da solução e o Claude Code passa a saber implementar e revisar o widget sozinho. Segue o padrão <a className="link" href="https://code.claude.com/docs/en/skills" target="_blank" rel="noreferrer">Agent Skills</a>: <span className="font-mono text-sm">SKILL.md</span> enxuto e a especificação como arquivo de apoio, carregado só quando é usado.</>}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card className={card}><CardContent className="grid gap-5 p-5">
              <Step n={1} title="Instale no repositório da solução">
                <div className="mb-2"><Segmented size="sm" value={shell} onChange={setShell} options={[{ value: 'bash', label: 'Bash' }, { value: 'powershell', label: 'PowerShell' }]} /></div>
                <Code label="Copiar comando">{install}</Code>
              </Step>
              <Step n={2} title="Faça commit da pasta">
                <p className="text-sm text-ink-3">Com <span className="font-mono text-xs">.claude/skills/optsolv-suporte-widget/</span> no repositório, todo o time recebe a skill.</p>
              </Step>
              <Step n={3} title="Use no Claude Code">
                <Code label="Copiar">{'/optsolv-suporte-widget apps/web'}</Code>
                <p className="mt-2 text-sm text-ink-3">Ou só peça: “adicione o widget de suporte da Optsolv”. O Claude reconhece pela descrição da skill.</p>
              </Step>
            </CardContent></Card>
            <Card className={card}><CardContent className="grid gap-3 p-5">
              <span className="label">Arquivos da skill</span>
              {[{ name: 'SKILL.md', text: skill.data, desc: 'Fluxo e regras (carrega quando a skill é usada)' }, { name: 'especificacao.md', text: spec.data, desc: 'Contrato, interface e critérios de aceite' }].map((f) => (
                <div key={f.name} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-ink-4" />
                  <span className="min-w-0 flex-1"><span className="block font-mono text-sm font-semibold">{f.name}</span><span className="block truncate text-xs text-ink-4">{f.desc}</span></span>
                  <Tip label={`Baixar ${f.name}`}><Button variant="ghost" size="icon-sm" aria-label={`Baixar ${f.name}`} disabled={!f.text} onClick={() => f.text && download(f.name, f.text)}><Download /></Button></Tip>
                  <Tip label="Abrir"><BaseButton variant="ghost" size="icon-sm" asChild><a href={`${SKILL_DIR}/${f.name}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${f.name}`}><ExternalLink /></a></BaseButton></Tip>
                </div>
              ))}
              <Code className="max-h-[230px] whitespace-pre-wrap" label="Copiar SKILL.md">{skill.data ?? 'Carregando…'}</Code>
            </CardContent></Card>
          </div>
        </Section>

        <div className="grid gap-14 xl:grid-cols-2 xl:gap-6">
          <Section id="mcp" icon={<Bot className="size-3.5" />} eyebrow="MCP" title="Agentes de IA" delay={180}
            text="Agentes conectam pelo MCP remoto com uma credencial e passam a registrar e consultar solicitações do cliente dela, sem acesso ao banco.">
            <Card className={card}><CardContent className="grid gap-4 p-5">
              <div><span className="label flex items-center gap-1.5"><Terminal className="size-3.5" />Claude Code</span><Code label="Copiar comando">{mcpAdd}</Code></div>
              <div><span className="label">Ou no <span className="font-mono">.mcp.json</span> do projeto (o token vem do ambiente)</span><Code label="Copiar JSON">{mcpJson}</Code></div>
              <div>
                <span className="label">Ferramentas</span>
                <div className="flex flex-wrap gap-1.5">{MCP_TOOLS.map((t) => <Badge key={t} tone={t === 'create_request' ? 'orange' : 'neutral'} className="font-mono">{t}</Badge>)}</div>
              </div>
              <ul className="grid gap-1.5 text-sm text-ink-3">
                <li>• Para registrar sozinho, use <span className="font-mono text-xs">idempotencyKey</span> com o id da mensagem ou do evento de origem: repetir não duplica.</li>
                <li>• Uma credencial por cliente, papel <b className="font-semibold text-ink-2">Usuário do cliente</b>; revogar corta o acesso na hora.</li>
              </ul>
            </CardContent></Card>
          </Section>

          <Section id="api" icon={<Server className="size-3.5" />} eyebrow="API REST" title="Integrações" delay={220}
            text={<>Servidor a servidor, com contrato completo em <a className="link" href="/docs" target="_blank" rel="noreferrer">/docs</a> (OpenAPI 3.1).</>}>
            <Card className={card}><CardContent className="grid gap-4 p-5">
              <div><span className="label">Criar solicitação</span><Code label="Copiar curl" className="whitespace-pre-wrap">{curl}</Code></div>
              <ul className="grid gap-1.5 text-sm text-ink-3">
                <li>• <span className="font-mono text-xs">Idempotency-Key</span>: repetir com a mesma chave devolve a mesma solicitação (200).</li>
                <li>• <span className="font-mono text-xs">authorLabel</span>: quem reportou; fica gravado como “Nome (via Agente: credencial)”.</li>
                <li>• Limite de 120 novas a cada 10 minutos por credencial; 429 traz <span className="font-mono text-xs">Retry-After</span>.</li>
                <li>• Erros sempre em <span className="font-mono text-xs">{'{ error: { code, message, details } }'}</span>.</li>
              </ul>
            </CardContent></Card>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-orange-50 text-xs font-semibold text-orange-700 tnum">{n}</span>
      <div className="min-w-0"><h3 className="mb-2 mt-0.5 text-md font-semibold">{title}</h3>{children}</div>
    </div>
  );
}
