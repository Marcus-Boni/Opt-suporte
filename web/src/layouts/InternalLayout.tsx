import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import { LayoutDashboard, Building2, MessageSquareText, Inbox, PackageCheck, Presentation, KeyRound, LogOut, Menu, Search, PanelLeftClose, PanelLeftOpen, Blocks } from 'lucide-react';
import { CommandPalette, isMac } from '@/components/command-palette';
import { ErrorBoundary } from '@/components/status-screens';
import { Logo, Symbol } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tip } from '@/components/ui/tooltip';
import { Avatar, Button, SimpleSelect, Sheet, SheetContent, SheetHeader, SheetTitle, cx } from '@/components/ui';
import { useAuth, useMe } from '@/lib/auth';
import { useScope } from '@/lib/scope';
import { ROLE } from '@/lib/labels';
import { toast } from '@/lib/toast';

const nav = [
  { to: '/app', label: 'Visão geral', icon: LayoutDashboard, end: true, group: 'Operação' },
  { to: '/app/captura', label: 'Captura WhatsApp', icon: MessageSquareText, group: 'Operação' },
  { to: '/app/solicitacoes', label: 'Solicitações', icon: Inbox, group: 'Operação', count: true },
  { to: '/app/entregas', label: 'Entregas', icon: PackageCheck, group: 'Operação' },
  { to: '/app/apresentacoes', label: 'Apresentações', icon: Presentation, group: 'Relacionamento' },
  { to: '/app/clientes', label: 'Clientes', icon: Building2, group: 'Relacionamento' },
  { to: '/app/integracoes', label: 'IA e integrações', icon: Blocks, group: 'Administração' },
  { to: '/app/acessos', label: 'Acessos e API', icon: KeyRound, admin: true, group: 'Administração' },
];

const KEY = 'optsolv-sidebar';
const MOD = isMac ? '⌘' : 'Ctrl';
const readCollapsed = () => { try { return localStorage.getItem(KEY) === 'collapsed'; } catch { return false; } };

// className em string (não função): o Tip usa Radix Slot, que concatenaria a função como texto.
function NavItem({ item: n, mini, count }: { item: (typeof nav)[number]; mini: boolean; count?: number }) {
  const active = !!useMatch({ path: n.to, end: !!n.end });
  return (
    <Tip side="right" label={<>{n.label}{count ? ` · ${count} abertas` : ''}</>} hidden={!mini}>
      <NavLink to={n.to} end={n.end} className={cx('relative z-10 flex h-9 items-center gap-3 rounded-lg text-base font-medium transition-colors duration-150', mini ? 'justify-center px-0' : 'px-3',
        active ? 'text-paper' : 'text-paper-3/65 hover:bg-white/[0.04] hover:text-paper')}>
        <n.icon size={17} className={cx('shrink-0 transition-colors duration-150', active ? 'text-orange-400' : 'text-dusk/80')} />
        <span className={mini ? 'sr-only' : 'truncate'}>{n.label}</span>
        {!!count && (mini
          ? <span aria-hidden className="absolute right-2 top-1.5 size-1.5 rounded-full bg-orange-500 ring-2 ring-[#0d0d0c]" />
          : <span className="ml-auto rounded-full bg-white/[0.07] px-1.5 text-2xs font-semibold leading-5 text-paper-3 tnum">{count}<span className="sr-only"> abertas</span></span>)}
      </NavLink>
    </Tip>
  );
}

/**
 * Menu em grupos com um realce que desliza até o item ativo (só transform, 280ms ease-out).
 * Na primeira pintura o realce já nasce no lugar, sem deslizar a partir do topo.
 */
function SideNav({ items, mini, openCount }: { items: typeof nav; mini: boolean; openCount: number }) {
  const ref = useRef<HTMLElement>(null);
  const loc = useLocation();
  const [pill, setPill] = useState<{ y: number; h: number; ready: boolean } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const a = ref.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill((p) => (a ? { y: a.offsetTop, h: a.offsetHeight, ready: !!p } : null));
    };
    measure();
    // Escondido (celular) o menu mede zero; ao voltar a aparecer, mede de novo para o realce não ficar no topo.
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [loc.pathname, mini, items.length]);
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <nav ref={ref} className="relative flex flex-col" aria-label="Principal">
      {pill && (
        <span aria-hidden className="absolute inset-x-0 top-0 rounded-lg bg-white/[0.07] ring-1 ring-inset ring-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_20px_-12px_rgba(0,0,0,0.8)] motion-reduce:!transition-none"
          style={{ height: pill.h, transform: `translateY(${pill.y}px)`, transition: pill.ready ? 'transform 280ms var(--ease-out-strong), height 280ms var(--ease-out-strong)' : 'none' }}>
          <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-orange-500 shadow-[0_0_10px_rgba(255,107,61,0.7)]" />
        </span>
      )}
      {groups.map((g, gi) => (
        <div key={g} className={cx('flex flex-col gap-0.5', gi > 0 && (mini ? 'mt-3 pt-3 border-t border-white/[0.06]' : 'mt-5'))}>
          {!mini && <div className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-dusk/60">{g}</div>}
          {items.filter((n) => n.group === g).map((n) => <NavItem key={n.to} item={n} mini={mini} count={n.count ? openCount : undefined} />)}
        </div>
      ))}
    </nav>
  );
}

export function InternalLayout() {
  const me = useMe();
  const { logout } = useAuth();
  const { clientId, setClientId } = useScope();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const loc = useLocation();
  const nav_ = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => { try { localStorage.setItem(KEY, collapsed ? 'collapsed' : 'expanded'); } catch { /* modo privado */ } }, [collapsed]);
  // Ctrl/⌘+B recolhe/expande (mesmo atalho do shadcn Sidebar).
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b' && (e.metaKey || e.ctrlKey) && !e.altKey) { e.preventDefault(); setCollapsed((c) => !c); } };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  const isAdmin = me.actor.role === 'admin_optsolv';
  const current = me.clients.find((c) => c.id === clientId);
  const signOut = async () => { await logout(); toast.info('Sessão encerrada.'); nav_('/entrar'); };
  const items = nav.filter((n) => !n.admin || isAdmin);
  const openCount = current ? current.openRequests : me.clients.reduce((a, c) => a + c.openRequests, 0);

  // `mini` = sidebar recolhida: só ícones, rótulo vira dica à direita (e continua acessível via sr-only).
  const menu = (mini: boolean) => <SideNav items={items} mini={mini} openCount={openCount} />;
  const brand = (mini: boolean) => (
    <div className={cx('flex min-h-10 items-center', mini ? 'justify-center' : 'px-2')}>
      {mini ? (
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-b from-white/[0.09] to-white/[0.02] ring-1 ring-inset ring-white/[0.08] shadow-[0_8px_24px_-8px_rgba(209,67,24,0.55)]">
          <Symbol variant="laranja" height={18} />
        </span>
      ) : (
        <div className="min-w-0">
          <Logo variant="claro" height={22} />
          <div className="mt-1.5 text-2xs font-medium uppercase tracking-widest text-dusk/70">Central de suporte</div>
        </div>
      )}
    </div>
  );

  return (
    <div className={cx('min-h-dvh md:grid transition-[grid-template-columns] duration-200 ease-(--ease-out-strong) motion-reduce:transition-none', collapsed ? 'md:grid-cols-[72px_1fr]' : 'md:grid-cols-[248px_1fr]')}>
      <aside className="sidebar-surface on-night hidden md:flex flex-col text-paper py-4 sticky top-0 h-dvh overflow-hidden px-3" aria-label="Menu lateral">
        <div className="pb-6 pt-1">{brand(collapsed)}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden -mx-3 px-3 [scrollbar-width:none]">{menu(collapsed)}</div>
        <div className="grid gap-3 pt-4">
          <div className={cx('flex items-center gap-1', collapsed ? 'flex-col' : 'justify-between px-1')}>
            {collapsed ? <ThemeToggle variant="icon" tone="night" side="right" /> : <ThemeToggle tone="night" />}
            <Tip side={collapsed ? 'right' : 'top'} label={<>{collapsed ? 'Expandir menu' : 'Recolher menu'} <kbd className="kbd ml-1.5">{MOD}</kbd> <kbd className="kbd">B</kbd></>}>
              <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-expanded={!collapsed} className="text-dusk hover:text-paper hover:bg-white/[0.06]">
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
            </Tip>
          </div>
          <div className={cx('flex items-center gap-3 rounded-xl', collapsed ? 'flex-col' : 'bg-white/[0.04] p-2 ring-1 ring-inset ring-white/[0.06]')}>
            <Tip side="right" label={<>{me.actor.label} · {ROLE[me.actor.role]}</>} hidden={!collapsed}>
              <span className="shrink-0 rounded-full" tabIndex={collapsed ? 0 : -1}><Avatar name={me.actor.label} tone="orange" /></span>
            </Tip>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{me.actor.label}</div>
                <div className="text-xs text-dusk truncate">{ROLE[me.actor.role]}</div>
              </div>
            )}
            <Tip side={collapsed ? 'right' : 'top'} label="Sair">
              <Button variant="ghost" size="icon-sm" onClick={signOut} className="text-dusk hover:text-paper hover:bg-white/[0.06]" aria-label="Sair"><LogOut /></Button>
            </Tip>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line">
          <div className="flex items-center gap-3 px-4 md:px-8 h-14">
            <Button variant="ghost" size="icon" className="md:hidden -ml-2" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></Button>
            <span className="md:hidden"><Symbol height={22} /></span>
            <div className="ml-auto md:ml-0 w-[220px]">
              <SimpleSelect aria-label="Contexto de cliente" size="sm" value={clientId} onValueChange={setClientId} className="rounded-full font-semibold" options={[{ value: '', label: 'Todos os clientes' }, ...me.clients.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
            {current && <span className="hidden lg:inline text-sm text-ink-4">{current.openRequests} abertas · {current.publishedDeliveries} entregas publicadas</span>}
            <Button variant="secondary" size="sm" onClick={() => setPalette(true)} className="hidden md:inline-flex ml-auto w-[240px] justify-start rounded-full font-normal text-ink-4 hover:text-ink" icon={<Search />}>
              Buscar ou ir para…<span className="ml-auto flex gap-0.5" aria-hidden><kbd className="kbd">{MOD}</kbd><kbd className="kbd">K</kbd></span>
            </Button>
            <Tip label="Buscar"><Button variant="ghost" size="icon" onClick={() => setPalette(true)} className="md:hidden" aria-label="Buscar"><Search /></Button></Tip>
          </div>
        </header>
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 max-w-[1280px] w-full mx-auto">
          <ErrorBoundary key={loc.pathname} inline><div className="page-enter"><Outlet /></div></ErrorBoundary>
        </main>
      </div>

      <CommandPalette pages={items} open={palette} onOpenChange={setPalette} />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="sidebar-surface on-night w-[280px] text-paper border-white/[0.06] p-4 flex flex-col [&_[data-slot=sheet-close]]:text-dusk">
          <SheetHeader className="p-0 pb-6"><SheetTitle className="text-paper">{brand(false)}</SheetTitle></SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{menu(false)}</div>
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-white/[0.06]">
            <ThemeToggle tone="night" />
            <Button variant="ghost" className="text-dusk hover:text-paper hover:bg-white/[0.06]" onClick={signOut} icon={<LogOut />}>Sair</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
