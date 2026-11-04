import type { EvidenceKind, RequestCategory, RequestPriority, RequestSource, RequestStatus, Role } from './types';

export const STATUS: Record<RequestStatus, { label: string; labelInternal?: string; tone: 'neutral' | 'info' | 'warn' | 'ok' | 'bad' | 'orange' | 'ink'; hint: string }> = {
  nova: { label: 'Nova', tone: 'ink', hint: 'Recebida e ainda não avaliada pela equipe.' },
  em_triagem: { label: 'Em triagem', tone: 'info', hint: 'A equipe está entendendo e classificando o pedido.' },
  planejada: { label: 'Planejada', tone: 'info', hint: 'Aceita e programada para execução.' },
  em_andamento: { label: 'Em andamento', tone: 'info', hint: 'Alguém está trabalhando nisso agora.' },
  aguardando_cliente: { label: 'Aguardando você', labelInternal: 'Aguardando cliente', tone: 'warn', hint: 'Precisamos de uma resposta sua para continuar.' },
  concluida: { label: 'Concluída', tone: 'ok', hint: 'Entregue. Pode ser reaberta se necessário.' },
  cancelada: { label: 'Cancelada', tone: 'neutral', hint: 'Encerrada sem execução.' },
};
/** Rótulo do status na voz certa: o portal fala com o cliente ("Aguardando você"), o backoffice fala da equipe ("Aguardando cliente"). */
export const statusLabel = (s: RequestStatus, internal: boolean) => (internal && STATUS[s].labelInternal) || STATUS[s].label;
export const SLIDE_KIND: Record<string, string> = { capa: 'Capa', contexto: 'Números do período', solicitacoes: 'Solicitações', entrega: 'Entrega', evolucao: 'Evolução', proximos: 'Próximos passos', encerramento: 'Encerramento' };
export const STATUS_ORDER: RequestStatus[] = ['nova', 'em_triagem', 'planejada', 'em_andamento', 'aguardando_cliente', 'concluida', 'cancelada'];

export const CATEGORY: Record<RequestCategory, string> = { problema: 'Problema', melhoria: 'Melhoria', nova_funcionalidade: 'Nova funcionalidade', duvida: 'Dúvida' };
export const PRIORITY: Record<RequestPriority, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
export const SOURCE: Record<RequestSource, string> = { portal: 'Portal', admin: 'Equipe Optsolv', captura_whatsapp: 'Captura WhatsApp', api: 'API', mcp: 'Agente MCP' };
export const ROLE: Record<Role, string> = { admin_optsolv: 'Administrador Optsolv', colaborador_optsolv: 'Colaborador Optsolv', cliente: 'Usuário do cliente' };
export const EVIDENCE: Record<EvidenceKind, { label: string; hint: string }> = {
  observado: { label: 'Benefício observado', hint: 'Algo visto funcionando, relatado ou demonstrado.' },
  esperado: { label: 'Benefício esperado', hint: 'Ganho previsto, ainda sem medição.' },
  medido: { label: 'Impacto medido', hint: 'Número verificável, com fonte.' },
};
export const EVENT_LABEL: Record<string, (e: { fromValue: string | null; toValue: string | null; note: string | null }) => string> = {
  criada: (e) => `Solicitação criada (${SOURCE[e.toValue as RequestSource] ?? e.toValue})`,
  status: (e) => `Status: ${STATUS[e.fromValue as RequestStatus]?.label ?? e.fromValue} → ${STATUS[e.toValue as RequestStatus]?.label ?? e.toValue}`,
  reaberta: (e) => `Reaberta (${STATUS[e.fromValue as RequestStatus]?.label ?? e.fromValue} → ${STATUS[e.toValue as RequestStatus]?.label ?? e.toValue})`,
  responsavel: (e) => `Responsável: ${e.toValue}`,
  categoria: (e) => `Categoria: ${CATEGORY[e.fromValue as RequestCategory] ?? e.fromValue} → ${CATEGORY[e.toValue as RequestCategory] ?? e.toValue}`,
  prioridade: (e) => `Prioridade: ${PRIORITY[e.fromValue as RequestPriority] ?? e.fromValue} → ${PRIORITY[e.toValue as RequestPriority] ?? e.toValue}`,
  anexo: (e) => `Anexo adicionado: ${e.toValue}`,
  entrega_vinculada: (e) => `Vinculada à entrega “${e.toValue}”`,
  entrega_publicada: (e) => `Entrega publicada: “${e.toValue}”`,
};

export const fmtDate = (d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('pt-BR', opts) : '—';
export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export function fmtRelative(d: string | Date) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 30) return `há ${Math.floor(diff / 86400)} d`;
  return fmtDate(d, { day: '2-digit', month: 'short' });
}
export const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
export const toInputDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromInputDate = (s: string) => new Date(`${s}T12:00:00`);
