import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Home, Inbox, Sparkles, BarChart3, LogOut, Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/status-screens';
import { Logo } from '@/components/logo';
import { Avatar, Button, ButtonLink, cx } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tip } from '@/components/ui/tooltip';
import { toast } from '@/lib/toast';
import { useAuth, useMe } from '@/lib/auth';

const nav = [
  { to: '/portal', label: 'Início', icon: Home, end: true },
  { to: '/portal/solicitacoes', label: 'Solicitações', icon: Inbox },
  { to: '/portal/novidades', label: 'Novidades', icon: Sparkles },
  { to: '/portal/resultados', label: 'Resultados', icon: BarChart3 },
];

export function PortalLayout() {
  const me = useMe();
  const { logout } = useAuth();
  const nav_ = useNavigate();
  const loc = useLocation();
  const client = me.clients[0];
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line">
        <div className="max-w-[1080px] mx-auto px-4 md:px-6 h-16 flex items-center gap-4">
          <Logo height={22} />
          <span className="hidden sm:block h-5 w-px bg-line-2" aria-hidden />
          <span className="hidden sm:block text-base font-semibold text-ink-3 truncate">{client?.name}</span>
          <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Portal">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('pressable rounded-full px-3.5 h-9 inline-flex items-center text-base font-semibold', isActive ? 'bg-ink text-paper' : 'text-ink-3 hover:bg-paper-2 hover:text-ink')}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ButtonLink to="/portal/solicitacoes/nova" size="sm" className="hidden sm:inline-flex rounded-full h-9 px-4 text-base" icon={<Plus />}>Nova solicitação</ButtonLink>
            <ThemeToggle variant="icon" side="bottom" />
            <Tip side="bottom" label={me.actor.label}><span className="rounded-full" tabIndex={0}><Avatar name={me.actor.label} tone="orange" /></span></Tip>
            <Tip side="bottom" label="Sair"><Button variant="ghost" size="icon" className="rounded-full text-ink-4" onClick={async () => { await logout(); toast.info('Sessão encerrada.'); nav_('/entrar'); }} aria-label="Sair"><LogOut /></Button></Tip>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1080px] mx-auto px-4 md:px-6 py-6 md:py-10 pb-24 md:pb-10">
        <ErrorBoundary key={loc.pathname} inline><div className="page-enter"><Outlet /></div></ErrorBoundary>
      </main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-line grid grid-cols-5" aria-label="Portal">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-2xs font-semibold', isActive ? 'text-orange-700' : 'text-ink-4')}><n.icon size={20} />{n.label}</NavLink>
        ))}
        <NavLink to="/portal/solicitacoes/nova" className="flex flex-col items-center gap-0.5 py-2 text-2xs font-semibold text-ink-4"><span className="grid place-items-center size-5 rounded-full bg-primary text-primary-foreground"><Plus size={14} /></span>Nova</NavLink>
      </nav>
    </div>
  );
}
