import { env } from '../env.js';

export const entraEnabled = () => !!(env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET);
export const isEntraDomain = (email: string) => env.ENTRA_ALLOWED_DOMAINS.includes(email.split('@')[1] ?? '');
