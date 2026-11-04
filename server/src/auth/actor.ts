import { notFound, forbidden } from '../lib/errors.js';

export type Role = 'admin_optsolv' | 'colaborador_optsolv' | 'cliente';

/** Identidade autenticada já resolvida: o escopo de clientes vem do banco, nunca do navegador. */
export type Actor = {
  kind: 'user' | 'credential';
  id: string;
  userId: string | null;
  label: string;
  role: Role;
  clientIds: 'all' | string[];
};

export const isInternal = (a: Actor) => a.role !== 'cliente';
export const isAdmin = (a: Actor) => a.role === 'admin_optsolv';

export function canAccessClient(a: Actor, clientId: string) {
  return a.clientIds === 'all' || a.clientIds.includes(clientId);
}

/** 404 (e não 403) para não revelar a existência de dados de outro tenant. */
export function assertClient(a: Actor, clientId: string | null | undefined, what = 'Recurso') {
  if (!clientId || !canAccessClient(a, clientId)) throw notFound(what);
}

export function assertInternal(a: Actor, msg?: string) {
  if (!isInternal(a)) throw forbidden(msg ?? 'Operação restrita à equipe Optsolv.');
}

export function assertAdmin(a: Actor) {
  if (!isAdmin(a)) throw forbidden('Operação restrita a administradores Optsolv.');
}

/** Lista de clientes visíveis; `null` significa "todos". */
export function visibleClientIds(a: Actor): string[] | null {
  return a.clientIds === 'all' ? null : a.clientIds;
}

export const actorKey = (a: Actor) => `${a.kind}:${a.id}`;
