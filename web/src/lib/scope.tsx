import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';

/** Contexto de cliente escolhido no backoffice ("" = todos os clientes visíveis). Nunca é prova de permissão: o servidor valida. */
type Scope = { clientId: string; setClientId: (id: string) => void };
const Ctx = createContext<Scope>({ clientId: '', setClientId: () => {} });
const KEY = 'osx.scope.clientId';

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [stored, setClientIdState] = useState(() => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } });
  // Valor armazenado só vale se ainda for um cliente visível (ex.: após reseed o id muda).
  const clientId = me && stored && !me.clients.some((c) => c.id === stored) ? '' : stored;
  useEffect(() => { if (stored !== clientId) setClientIdState(clientId); }, [stored, clientId]);
  const value = useMemo<Scope>(() => ({
    clientId,
    setClientId: (id) => { setClientIdState(id); try { localStorage.setItem(KEY, id); } catch { /* sem persistência */ } },
  }), [clientId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useScope = () => useContext(Ctx);
