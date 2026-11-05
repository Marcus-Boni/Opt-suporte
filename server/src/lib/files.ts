/**
 * Anexos guardados no próprio Postgres (sem storage externo por enquanto).
 * Metadados em `attachments`, bytes em `attachment_contents`; os dois gravados na mesma transação.
 * shortcut: arquivos de até 5 MB no banco; se o volume crescer muito, migrar o conteúdo para Blob Storage
 * mantendo a mesma API (storeUpload/openAttachment).
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { MultipartFile } from '@fastify/multipart';
import { db, schema } from '../db/index.js';
import { assertClient, type Actor } from '../auth/actor.js';
import { badRequest, notFound } from '../lib/errors.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
/** Tipos exibidos no navegador; o resto sempre baixa como arquivo. */
const INLINE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

const startsWith = (buf: Buffer, bytes: number[], at = 0) => bytes.every((b, i) => buf[at + i] === b);
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Confere a assinatura do arquivo: o Content-Type enviado pelo navegador não é prova do conteúdo. */
export function contentMatchesType(mime: string, buf: Buffer) {
  switch (mime) {
    case 'image/png': return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg': return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'image/gif': return startsWith(buf, [0x47, 0x49, 0x46, 0x38]);
    case 'image/webp': return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case 'application/pdf': return startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return startsWith(buf, ZIP);
    default: return !buf.subarray(0, 8192).includes(0); // texto, CSV, JSON: sem bytes nulos
  }
}

/** Nome exibível: sem caminho, sem caracteres de controle nem aspas. */
const safeFileName = (name: string) => path.basename(name).replace(/[\u0000-\u001f\u007f"\\]/g, '').trim().slice(0, 180) || 'arquivo';

export async function storeUpload(clientId: string, file: MultipartFile, uploadedByLabel: string, link: { requestId?: string; deliveryId?: string }) {
  if (!ALLOWED_MIME.has(file.mimetype)) throw badRequest(`Tipo de arquivo não permitido (${file.mimetype}). Use imagens, PDF, texto, CSV, XLSX ou DOCX.`);
  const data = await file.toBuffer(); // acima de MAX_FILE_BYTES o multipart lança FST_REQ_FILE_TOO_LARGE (413)
  if (!data.length) throw badRequest('O arquivo está vazio.');
  if (!contentMatchesType(file.mimetype, data)) throw badRequest('O conteúdo do arquivo não corresponde ao tipo informado.');
  const att = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schema.attachments).values({
      clientId, requestId: link.requestId, deliveryId: link.deliveryId, fileName: safeFileName(file.filename), mimeType: file.mimetype,
      sizeBytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), uploadedByLabel,
    }).returning();
    await tx.insert(schema.attachmentContents).values({ attachmentId: row.id, data });
    return row;
  });
  return { id: att.id, fileName: att.fileName, mimeType: att.mimeType, sizeBytes: att.sizeBytes, uploadedByLabel: att.uploadedByLabel, createdAt: att.createdAt };
}

/** Download autorizado: o anexo precisa pertencer a um cliente visível ao ator (e, para cliente, a entrega estar publicada). */
export async function openAttachment(actor: Actor, id: string) {
  const [att] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  if (!att) throw notFound('Anexo');
  assertClient(actor, att.clientId, 'Anexo');
  if (att.deliveryId && actor.role === 'cliente') {
    const [d] = await db.select({ status: schema.deliveries.status }).from(schema.deliveries).where(eq(schema.deliveries.id, att.deliveryId));
    if (d?.status !== 'publicada') throw notFound('Anexo');
  }
  const [content] = await db.select({ data: schema.attachmentContents.data }).from(schema.attachmentContents).where(eq(schema.attachmentContents.attachmentId, id));
  if (!content) throw notFound('Arquivo');
  return { meta: att, data: content.data, inline: INLINE_MIME.has(att.mimeType) };
}
