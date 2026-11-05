import type { Slide } from '@server/db/schema';
export type { Slide };

export type Role = 'admin_optsolv' | 'colaborador_optsolv' | 'cliente';
export type RequestStatus = 'nova' | 'em_triagem' | 'planejada' | 'em_andamento' | 'aguardando_cliente' | 'concluida' | 'cancelada';
export type RequestCategory = 'problema' | 'melhoria' | 'nova_funcionalidade' | 'duvida';
export type RequestPriority = 'baixa' | 'media' | 'alta' | 'critica';
export type RequestSource = 'portal' | 'admin' | 'captura_whatsapp' | 'api' | 'mcp';
export type EvidenceKind = 'observado' | 'esperado' | 'medido';

export type Me = {
  actor: { kind: 'user' | 'credential'; id: string; label: string; role: Role; clientIds: 'all' | string[] };
  user: { id: string; email: string; name: string; role: Role; clientId: string | null } | null;
  clients: Client[];
};

export type Client = { id: string; slug: string; shortCode: string; name: string; segment: string | null; description: string | null; createdAt: string; projectCount: number; openRequests: number; publishedDeliveries: number };
export type Project = { id: string; clientId: string; code: string; name: string; description: string | null; isActive: boolean; createdAt: string; clientName?: string };
export type ClientDetail = Client & { projects: Project[]; users: { id: string; name: string; email: string; role: Role; isActive: boolean }[] };
export type TeamMember = { id: string; name: string; email: string; role: Role };

export type RequestRow = {
  id: string; number: number; title: string; description: string; category: RequestCategory; priority: RequestPriority; status: RequestStatus; source: RequestSource;
  authorLabel: string; createdAt: string; updatedAt: string; closedAt: string | null;
  clientId: string; clientName: string; clientCode: string; projectId: string; projectName: string;
  assigneeUserId: string | null; assigneeName: string | null; commentCount: number; attachmentCount: number; deliveryCount: number;
};
export type Comment = { id: string; requestId: string; authorLabel: string; visibility: 'public' | 'internal'; body: string; createdAt: string };
export type RequestEvent = { id: string; type: string; actorLabel: string; fromValue: string | null; toValue: string | null; note: string | null; isPublic: boolean; createdAt: string };
export type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number; uploadedByLabel: string; createdAt: string };
export type DeliveryLite = { id: string; title: string; summary: string; status: 'rascunho' | 'publicada'; deliveredAt: string; publishedAt: string | null };
export type RequestDetail = RequestRow & { comments: Comment[]; events: RequestEvent[]; attachments: Attachment[]; deliveries: DeliveryLite[]; sourceExcerpt: string | null; sourceMessageId: string | null };
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type DeliveryRow = {
  id: string; title: string; summary: string; details: string | null; status: 'rascunho' | 'publicada'; ownerLabel: string; ownerUserId: string | null;
  deliveredAt: string; publishedAt: string | null; createdAt: string; updatedAt: string; clientId: string; clientName: string; clientCode: string; projectId: string; projectName: string;
  requestCount: number; evidenceCount: number;
};
export type Evidence = { id: string; deliveryId: string; kind: EvidenceKind; title: string; description: string | null; metricValue: string | null; metricUnit: string | null; sourceLabel: string | null; linkUrl: string | null; attachmentId: string | null; createdAt: string };
export type DeliveryDetail = DeliveryRow & { requests: { id: string; number: number; title: string; status: RequestStatus; category: RequestCategory; source: RequestSource }[]; evidences: Evidence[]; attachments: Attachment[] };

export type Metrics = {
  period: { from: string; to: string };
  totals: { requestsCreated: number; requestsConcluded: number; requestsOpen: number; unassigned: number | null; waitingClient: number; deliveriesPublished: number; evidences: number; medianLeadDays: number | null };
  byStatus: Record<string, number>; byCategory: Record<string, number>; bySource: Record<string, number>;
  monthly: { month: string; created: number; concluded: number; published: number }[];
  highlights: { id: string; title: string; summary: string; publishedAt: string | null; clientId: string; clientName: string; projectName: string; evidenceCount: number; measuredCount: number; requestCount: number }[];
  clients: { clientId: string; clientName: string; clientCode: string; open: number; concluded: number; published: number; unassigned: number }[];
};

export type PresentationRow = { id: string; title: string; status: 'rascunho' | 'compartilhada'; periodStart: string; periodEnd: string; clientId: string; clientName: string; createdByLabel: string; generatedAt: string; updatedAt: string; slideCount: number };
export type Presentation = Omit<PresentationRow, 'slideCount'> & { projectIds: string[]; slides: Slide[]; projects: { id: string; name: string }[] };

export type Suggestion = {
  index: number; sender: string; sentAt: string | null; excerpt: string; title: string; description: string; category: RequestCategory; priority: RequestPriority; confidence: number;
  analyzedBy: 'ia' | 'heuristica'; notice?: string;
  ignored?: string; duplicateOf?: { requestId: string; number: number; title: string; score: number }; similarTo?: { index: number; score: number };
};
/** `mode`: "heuristica" ou "ia:<implantação>"; `ai` diz qual modelo analisou ou por que caiu para as regras. */
export type IntakePreview = { mode: string; ai: { model: string; promptVersion: string; ms: number; tokens: number } | { fallbackReason: string }; messageCount: number; suggestions: Suggestion[] };

export type UserRow = { id: string; name: string; email: string; role: Role; clientId: string | null; isActive: boolean; createdAt: string; clientIds: string[]; microsoft: boolean };
export type Credential = { id: string; name: string; prefix: string; role: Role; clientId: string | null; clientName: string | null; lastUsedAt: string | null; revokedAt: string | null; createdAt: string };
export type AuditRow = { id: string; actorLabel: string; actorKind: string; action: string; entityType: string; entityId: string | null; clientId: string | null; meta: Record<string, unknown> | null; createdAt: string };
