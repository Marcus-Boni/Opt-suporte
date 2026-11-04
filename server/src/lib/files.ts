import { createWriteStream, mkdirSync, createReadStream, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { MultipartFile } from '@fastify/multipart';
import { env } from '../env.js';
import { db, schema } from '../db/index.js';
import { assertClient, type Actor } from '../auth/actor.js';
import { badRequest, notFound } from '../lib/errors.js';

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function storeUpload(clientId: string, file: MultipartFile, uploadedByLabel: string, link: { requestId?: string; deliveryId?: string }) {
  if (!ALLOWED_MIME.has(file.mimetype)) throw badRequest(`Tipo de arquivo não permitido (${file.mimetype}). Use imagens, PDF, texto, CSV, XLSX ou DOCX.`);
  const dir = path.resolve(env.UPLOAD_DIR, clientId);
  mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.filename).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
  const storagePath = path.join(dir, `${randomUUID()}${ext}`);
  await pipeline(file.file, createWriteStream(storagePath));
  if (file.file.truncated) { await unlink(storagePath).catch(() => {}); throw badRequest(`Arquivo maior que ${MAX_FILE_BYTES / 1024 / 1024} MB.`); }
  const sizeBytes = file.file.bytesRead;
  const [att] = await db.insert(schema.attachments).values({
    clientId, requestId: link.requestId, deliveryId: link.deliveryId, fileName: file.filename.slice(0, 180), mimeType: file.mimetype, sizeBytes, storagePath, uploadedByLabel,
  }).returning();
  return { id: att.id, fileName: att.fileName, mimeType: att.mimeType, sizeBytes: att.sizeBytes, uploadedByLabel: att.uploadedByLabel, createdAt: att.createdAt };
}

/** Download autorizado: o anexo precisa pertencer a um cliente visível ao ator. */
export async function openAttachment(actor: Actor, id: string) {
  const [att] = await db.select().from(schema.attachments).where(eq(schema.attachments.id, id));
  if (!att) throw notFound('Anexo');
  assertClient(actor, att.clientId, 'Anexo');
  if (att.deliveryId && actor.role === 'cliente') {
    const [d] = await db.select({ status: schema.deliveries.status }).from(schema.deliveries).where(eq(schema.deliveries.id, att.deliveryId));
    if (d?.status !== 'publicada') throw notFound('Anexo');
  }
  if (!existsSync(att.storagePath)) throw notFound('Arquivo');
  return { meta: att, stream: createReadStream(att.storagePath) };
}
