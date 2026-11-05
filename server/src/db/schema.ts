import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean, jsonb, numeric, primaryKey, index, uniqueIndex, customType,
} from 'drizzle-orm/pg-core';

/** Binário do Postgres (bytea) mapeado para Buffer do Node. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const roleEnum = pgEnum('role', ['admin_optsolv', 'colaborador_optsolv', 'cliente']);
export const requestStatusEnum = pgEnum('request_status', [
  'nova', 'em_triagem', 'planejada', 'em_andamento', 'aguardando_cliente', 'concluida', 'cancelada',
]);
export const requestCategoryEnum = pgEnum('request_category', ['problema', 'melhoria', 'nova_funcionalidade', 'duvida']);
export const requestPriorityEnum = pgEnum('request_priority', ['baixa', 'media', 'alta', 'critica']);
export const requestSourceEnum = pgEnum('request_source', ['portal', 'admin', 'captura_whatsapp', 'api', 'mcp']);
export const commentVisibilityEnum = pgEnum('comment_visibility', ['public', 'internal']);
export const deliveryStatusEnum = pgEnum('delivery_status', ['rascunho', 'publicada']);
export const evidenceKindEnum = pgEnum('evidence_kind', ['observado', 'esperado', 'medido']);
export const presentationStatusEnum = pgEnum('presentation_status', ['rascunho', 'compartilhada']);

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const clients = pgTable('clients', {
  id: id(),
  slug: text('slug').notNull().unique(),
  shortCode: text('short_code').notNull(),
  name: text('name').notNull(),
  segment: text('segment'),
  description: text('description'),
  createdAt: createdAt(),
});

export const projects = pgTable('projects', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('projects_client_idx').on(t.clientId)]);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  // Identificador imutável da pessoa no Microsoft Entra (claim oid); vincula o login sem depender do e-mail.
  entraOid: text('entra_oid').unique(),
  role: roleEnum('role').notNull(),
  // cliente: tenant único. internos: ver memberships (admin enxerga todos).
  clientId: uuid('client_id').references(() => clients.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export const memberships = pgTable('memberships', {
  userId: uuid('user_id').notNull().references(() => users.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
}, (t) => [primaryKey({ columns: [t.userId, t.clientId] })]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const apiCredentials = pgTable('api_credentials', {
  id: id(),
  name: text('name').notNull(),
  prefix: text('prefix').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  role: roleEnum('role').notNull(),
  // null = todos os clientes (apenas para role admin)
  clientId: uuid('client_id').references(() => clients.id),
  createdBy: uuid('created_by').references(() => users.id),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const sourceMessages = pgTable('source_messages', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  projectId: uuid('project_id').references(() => projects.id),
  channel: text('channel').notNull().default('whatsapp'),
  rawText: text('raw_text').notNull(),
  analysisMode: text('analysis_mode').notNull().default('demo-deterministico'),
  createdByLabel: text('created_by_label').notNull(),
  createdAt: createdAt(),
});

export const requests = pgTable('requests', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: requestCategoryEnum('category').notNull().default('melhoria'),
  priority: requestPriorityEnum('priority').notNull().default('media'),
  status: requestStatusEnum('status').notNull().default('nova'),
  source: requestSourceEnum('source').notNull(),
  authorUserId: uuid('author_user_id').references(() => users.id),
  authorLabel: text('author_label').notNull(),
  assigneeUserId: uuid('assignee_user_id').references(() => users.id),
  sourceMessageId: uuid('source_message_id').references(() => sourceMessages.id),
  sourceExcerpt: text('source_excerpt'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('requests_client_number_idx').on(t.clientId, t.number),
  index('requests_client_status_idx').on(t.clientId, t.status),
]);

export const requestComments = pgTable('request_comments', {
  id: id(),
  requestId: uuid('request_id').notNull().references(() => requests.id),
  authorUserId: uuid('author_user_id').references(() => users.id),
  authorLabel: text('author_label').notNull(),
  visibility: commentVisibilityEnum('visibility').notNull().default('public'),
  body: text('body').notNull(),
  createdAt: createdAt(),
}, (t) => [index('comments_request_idx').on(t.requestId)]);

export const requestEvents = pgTable('request_events', {
  id: id(),
  requestId: uuid('request_id').notNull().references(() => requests.id),
  actorLabel: text('actor_label').notNull(),
  // criada, status, responsavel, categoria, prioridade, reaberta, anexo, entrega_vinculada, entrega_publicada
  type: text('type').notNull(),
  fromValue: text('from_value'),
  toValue: text('to_value'),
  note: text('note'),
  isPublic: boolean('is_public').notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index('events_request_idx').on(t.requestId)]);

export const attachments = pgTable('attachments', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  requestId: uuid('request_id').references(() => requests.id),
  deliveryId: uuid('delivery_id'),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  /** SHA-256 do conteúdo: integridade e ETag do download. Nulo só em anexos legados (antes do armazenamento no banco). */
  sha256: text('sha256'),
  uploadedByLabel: text('uploaded_by_label').notNull(),
  createdAt: createdAt(),
});

/**
 * Conteúdo dos anexos, em tabela própria: listar e contar anexos nunca lê os bytes.
 * Apagar o anexo apaga o conteúdo (cascade). A coluna usa STORAGE EXTERNAL (ver migração):
 * imagens e PDFs já vêm comprimidos, então o Postgres não gasta CPU tentando comprimir de novo.
 */
export const attachmentContents = pgTable('attachment_contents', {
  attachmentId: uuid('attachment_id').primaryKey().references(() => attachments.id, { onDelete: 'cascade' }),
  data: bytea('data').notNull(),
});

export const deliveries = pgTable('deliveries', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  details: text('details'),
  status: deliveryStatusEnum('status').notNull().default('rascunho'),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  ownerLabel: text('owner_label').notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('deliveries_client_idx').on(t.clientId)]);

export const deliveryRequests = pgTable('delivery_requests', {
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
  requestId: uuid('request_id').notNull().references(() => requests.id),
}, (t) => [primaryKey({ columns: [t.deliveryId, t.requestId] })]);

export const valueEvidences = pgTable('value_evidences', {
  id: id(),
  deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
  kind: evidenceKindEnum('kind').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  metricValue: numeric('metric_value'),
  metricUnit: text('metric_unit'),
  sourceLabel: text('source_label'),
  linkUrl: text('link_url'),
  attachmentId: uuid('attachment_id').references(() => attachments.id),
  createdAt: createdAt(),
}, (t) => [index('evidences_delivery_idx').on(t.deliveryId)]);

export type SlideRef = { type: 'request' | 'delivery'; id: string; label: string };
export type Slide = {
  id: string;
  kind: 'capa' | 'contexto' | 'solicitacoes' | 'entrega' | 'evolucao' | 'proximos' | 'encerramento';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  refs?: SlideRef[];
};

export const presentations = pgTable('presentations', {
  id: id(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  projectIds: jsonb('project_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  slides: jsonb('slides').$type<Slide[]>().notNull().default(sql`'[]'::jsonb`),
  status: presentationStatusEnum('status').notNull().default('rascunho'),
  createdByLabel: text('created_by_label').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: id(),
  actorLabel: text('actor_label').notNull(),
  actorKind: text('actor_kind').notNull(), // user | credential | system
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  clientId: uuid('client_id'),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: createdAt(),
}, (t) => [index('audit_client_idx').on(t.clientId, t.createdAt)]);

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').notNull(),
  actorKey: text('actor_key').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.key, t.actorKey] })]);
