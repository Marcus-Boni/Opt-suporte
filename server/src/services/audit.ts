import { db, schema } from '../db/index.js';
import type { Actor } from '../auth/actor.js';

export async function audit(
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string | null,
  clientId: string | null,
  meta?: Record<string, unknown>,
) {
  await db.insert(schema.auditLogs).values({
    actorLabel: actor.label, actorKind: actor.kind, action, entityType, entityId, clientId, meta,
  });
}
