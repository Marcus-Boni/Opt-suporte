import { Fragment, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/logo';
import { Avatar, Button, Field, Input, cx } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { isInternalRole, useAuth } from '@/lib/auth';
import { toast } from '@/lib/toast';

const DEMO = [
  { email: 'admin@optsolv.demo', name: 'Helena Prado', role: 'Admin Optsolv · todos os clientes' },
  { email: 'ana@optsolv.demo', name: 'Ana Ribeiro', role: 'Colaboradora · Cidade + Marca' },
  { email: 'joao@cidadeengenharia.demo', name: 'João Pereira', role: 'Cliente · Cidade Engenharia' },
  { email: 'otavio@marcaambiental.demo', name: 'Otávio Reis', role: 'Cliente · Marca Ambiental' },
];

// Atalhos e senha das contas demo só em desenvolvimento ou em um ambiente de demonstração explícito (repositório público).
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_DEMO_LOGIN === 'true';

const HEADLINE = ['Do', 'pedido', 'no', 'WhatsApp', 'ao', 'resultado', 'apresentado.'];

export function LoginPage() {
  const { me, loading, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(SHOW_DEMO ? 'optsolv2026' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && me) return <Navigate to={isInternalRole(me.actor.role) ? '/app' : '/portal'} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ user: { role: string } }>('/auth/login', { email, password });
      await refresh();
      toast.ok('Sessão iniciada.');
      const from = (loc.state as { from?: string } | null)?.from;
      nav(from && from !== '/entrar' ? from : isInternalRole(res.user.role) ? '/app' : '/portal', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative grain-dark aurora text-paper px-8 py-10 md:px-14 md:py-14 flex flex-col overflow-hidden">
        <div className="rise"><Logo variant="claro" height={28} /></div>
        <div className="my-auto max-w-[560px] py-16">
          <h1 className="blur-in text-[clamp(40px,5.2vw,68px)] leading-[1.02] font-semibold tracking-tighter" aria-label={HEADLINE.join(' ')}>
            {HEADLINE.map((w, i) => <Fragment key={i}>{i > 0 && ' '}<span aria-hidden style={{ '--i': i } as CSSProperties} className={i === 4 || i === 5 ? 'text-orange-400' : undefined}>{w}</span></Fragment>)}
          </h1>
          <p className="rise mt-6 text-xl leading-relaxed text-paper-3/80 max-w-[46ch]" style={{ animationDelay: '200ms' }}>
            Solicitações, entregas e evidências de cada cliente em um só lugar — com números calculados, nunca inventados.
          </p>
          <ol className="rise mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-dusk font-medium" style={{ animationDelay: '280ms' }}>
            {['solicitação', 'trabalho', 'entrega', 'evidência', 'valor comunicado'].map((s, i, arr) => (
              <li key={s} className="flex items-center gap-6"><span className={i === arr.length - 1 ? 'text-orange-400' : ''}>{s}</span>{i < arr.length - 1 && <span className="text-night-3">→</span>}</li>
            ))}
          </ol>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-dusk"><span>{SHOW_DEMO ? 'Ambiente de demonstração · dados fictícios' : 'Acesso exclusivo para clientes e equipe Optsolv'}</span><Link to="/" className="font-medium text-paper-3 underline-offset-4 hover:text-paper hover:underline">Conheça o Optsolv Suporte →</Link></div>
      </section>

      <section className="px-6 py-10 md:px-14 md:py-14 flex items-center">
        <form onSubmit={submit} className="w-full max-w-[400px] mx-auto rise" style={{ animationDelay: '160ms' }}>
          <h2 className="text-4xl font-semibold tracking-tight">Entrar</h2>
          <p className="mt-1 text-base text-ink-3">{SHOW_DEMO ? 'Use uma conta de demonstração ou digite seu e-mail.' : 'Use o e-mail e a senha do seu acesso.'}</p>
          {SHOW_DEMO && <div className="mt-6 grid gap-2" role="group" aria-label="Contas de demonstração">
            {DEMO.map((d) => (
              <Button type="button" key={d.email} variant="secondary" onClick={() => setEmail(d.email)} aria-pressed={email === d.email}
                className={cx('h-auto justify-start text-left rounded-xl px-4 py-3 gap-3 font-normal', email === d.email ? 'border-orange-500 bg-orange-50 hover:bg-orange-50' : '')}>
                <Avatar name={d.name} size={36} />
                <span className="min-w-0"><span className="block text-base font-semibold">{d.name}</span><span className="block text-xs text-ink-4 truncate">{d.role}</span></span>
              </Button>
            ))}
          </div>}
          <div className="mt-5 grid gap-4">
            <Field label="E-mail"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" /></Field>
            <Field label="Senha" hint={SHOW_DEMO ? 'Senha das contas de demonstração: optsolv2026' : undefined}><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          </div>
          {error && <p role="alert" className="mt-4 text-base text-bad bg-bad-soft rounded-lg px-3.5 py-2.5">{error}</p>}
          <Button type="submit" size="lg" loading={busy} className="mt-6 w-full" icon={<ArrowRight />}>Entrar</Button>
        </form>
      </section>
    </div>
  );
}
