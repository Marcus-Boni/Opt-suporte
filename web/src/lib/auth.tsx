import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { Me } from './types';

type Auth = { me: Me | null; loading: boolean; refresh: () => Promise<unknown>; logout: () => Promise<void> };
const Ctx = createContext<Auth>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['me'],
    queryFn: async () => { try { return await api.get<Me>('/auth/me'); } catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; } },
    staleTime: 60_000, retry: false,
  });
  // Sair nunca falha do lado do cliente: mesmo com a sessão já expirada (o POST responde 401),
  // zera o usuário e descarta o cache do anterior, senão a tela fica presa em "Autenticação necessária".
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    await qc.cancelQueries();
    resetSession(qc);
  };
  return <Ctx.Provider value={{ me: q.data ?? null, loading: q.isLoading, refresh: () => q.refetch(), logout }}>{children}</Ctx.Provider>;
}

/** Sem sessão: `me` = null (as rotas protegidas mandam para /entrar) e nenhum dado do usuário anterior fica em cache. */
export function resetSession(qc: QueryClient) {
  qc.setQueryData(['me'], null);
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
}

export const useAuth = () => useContext(Ctx);
export const useMe = () => {
  const { me } = useAuth();
  if (!me) throw new Error('useMe fora de sessão');
  return me;
};
export const isInternalRole = (role?: string) => role === 'admin_optsolv' || role === 'colaborador_optsolv';
