/**
 * Telas de exceção com a marca: 404 e erro inesperado. O símbolo Optsolv fica no centro de uma órbita
 * lenta (decorativa: tela rara, sem movimento com prefers-reduced-motion).
 * Importa o Button do shadcn direto (não de ./ui) porque ui.tsx usa estas telas no ErrorState.
 */
import { Component, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ChevronDown, Home, RotateCw } from 'lucide-react';
import { Collapsible } from 'radix-ui';
import { Button } from './ui/button';
import { Symbol } from './logo';
import { cn } from '@/lib/utils';

export function Orbit() {
  return (
    <div className="relative grid size-28 place-items-center" aria-hidden>
      <span className="absolute inset-3 rounded-full bg-orange-500/15 blur-2xl" />
      <span className="absolute inset-0 rounded-full border border-line-2" />
      <span className="absolute inset-0 rounded-full orbit"><span className="absolute -top-[3px] left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-500 shadow-[0_0_10px_2px_rgba(255,107,61,0.55)]" /></span>
      <span className="absolute inset-5 rounded-full border border-dashed border-line" />
      <Symbol height={40} />
    </div>
  );
}

export function StatusScreen({ code, title, text, actions, inline, children }: { code: string; title: string; text: string; actions?: ReactNode; inline?: boolean; children?: ReactNode }) {
  const Tag = inline ? 'section' : 'main'; // dentro do layout já existe um <main>
  return (
    <Tag className={cn('relative isolate grid place-items-center overflow-hidden px-6 text-center', inline ? 'py-16' : 'min-h-dvh bg-paper')}>
      {!inline && <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(255,107,61,0.14),transparent_70%)]" />}
      <div className="rise flex max-w-md flex-col items-center">
        <Orbit />
        <p className="mt-8 bg-gradient-to-b from-ink to-ink/35 bg-clip-text text-[clamp(64px,12vw,112px)] font-semibold leading-none tracking-tighter text-transparent tnum">{code}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-md text-ink-3">{text}</p>
        {actions && <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>}
        {children}
      </div>
    </Tag>
  );
}

export function NotFoundPage({ inline }: { inline?: boolean }) {
  const nav = useNavigate();
  return (
    <StatusScreen inline={inline} code="404" title="Página não encontrada" text="O endereço pode ter mudado ou o link estar incompleto. Nada foi perdido."
      actions={<>
        <Button variant="secondary" onClick={() => nav(-1)}><ArrowLeft />Voltar</Button>
        <Button asChild><Link to="/"><Home />Ir para o início</Link></Button>
      </>} />
  );
}

/** Registro não encontrado ou fora do escopo (API 404): mesma linguagem, dentro do layout. */
export function MissingRecord({ message }: { message?: string }) {
  return (
    <StatusScreen inline code="404" title="Não encontramos este registro" text={message ?? 'Ele pode ter sido removido ou não estar no seu escopo de acesso.'}
      actions={<Button asChild variant="secondary"><Link to="/"><Home />Ir para o início</Link></Button>} />
  );
}

/**
 * Captura erros de renderização. `inline` mantém o menu (usado em volta do Outlet, com key por rota:
 * trocar de página limpa o erro); sem `inline`, ocupa a tela (falha geral, ex.: chunk que não carregou).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; inline?: boolean }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <StatusScreen inline={this.props.inline} code="Ops." title="Algo saiu do lugar" text="Um erro inesperado interrompeu esta tela. Recarregar costuma resolver; se persistir, envie o detalhe abaixo ao suporte."
        actions={<>
          <Button onClick={() => location.reload()}><RotateCw />Recarregar página</Button>
          <Button asChild variant="secondary"><a href="/"><Home />Ir para o início</a></Button>
        </>}>
        <Collapsible.Root className="mt-6 w-full rounded-xl border border-line bg-card text-left text-sm text-ink-3">
          <Collapsible.Trigger className="group flex w-full items-center justify-between px-4 py-3 font-medium text-ink-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 rounded-xl">
            Detalhe técnico<ChevronDown className="size-4 text-ink-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </Collapsible.Trigger>
          <Collapsible.Content className="px-4 pb-3"><code className="block break-words font-mono text-xs">{error.message}</code></Collapsible.Content>
        </Collapsible.Root>
      </StatusScreen>
    );
  }
}
