/**
 * Cliente do Microsoft Foundry (Azure OpenAI, API v1) com autenticação Entra ID, sem chaves.
 * - Desenvolvimento: DefaultAzureCredential (usa o `az login` de quem está rodando).
 * - Produção: ManagedIdentityCredential (identidade gerenciada; AZURE_CLIENT_ID para identidade atribuída pelo usuário).
 * Papel necessário na conta Foundry: "Cognitive Services OpenAI User" (ou "Azure AI User").
 */
import OpenAI from 'openai';
import { DefaultAzureCredential, ManagedIdentityCredential, getBearerTokenProvider, type TokenCredential } from '@azure/identity';
import { env } from '../env.js';

export type AiUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type JsonRequest = { instructions: string; input: string; schemaName: string; schema: Record<string, unknown>; maxOutputTokens: number };
export type JsonResult = { json: unknown; model: string; usage: AiUsage; ms: number };
/** Contrato mínimo de um modelo que devolve JSON; os testes injetam uma implementação falsa. */
export type JsonModel = (req: JsonRequest) => Promise<JsonResult>;

export const aiEnabled = () => env.AI_INTAKE_ENABLED && !!env.AZURE_OPENAI_ENDPOINT;
export const aiDeployment = () => env.AZURE_OPENAI_DEPLOYMENT;

/** Aceita o endpoint da conta (https://<conta>.openai.azure.com/) e completa o caminho da API v1. */
export function v1BaseUrl(endpoint: string) {
  const base = endpoint.trim().replace(/\/+$/, '');
  return /\/openai\/v1$/.test(base) ? `${base}/` : `${base}/openai/v1/`;
}

function credential(): TokenCredential {
  if (env.NODE_ENV !== 'production') return new DefaultAzureCredential();
  return process.env.AZURE_CLIENT_ID ? new ManagedIdentityCredential({ clientId: process.env.AZURE_CLIENT_ID }) : new ManagedIdentityCredential();
}

let client: OpenAI | undefined;
function getClient() {
  client ??= new OpenAI({
    baseURL: v1BaseUrl(env.AZURE_OPENAI_ENDPOINT),
    apiKey: getBearerTokenProvider(credential(), 'https://cognitiveservices.azure.com/.default'),
    timeout: env.AI_TIMEOUT_MS,
    maxRetries: 2, // o SDK repete 429/5xx com backoff exponencial
  });
  return client;
}

/** Chamada à Responses API com saída em JSON Schema estrito (o modelo não consegue fugir do formato). */
export const foundryJson: JsonModel = async ({ instructions, input, schemaName, schema, maxOutputTokens }) => {
  const started = Date.now();
  const res = await getClient().responses.create({
    model: aiDeployment(),
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    store: false, // não guardar o conteúdo das conversas no serviço
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } },
  });
  if (res.status !== 'completed') throw new Error(`Resposta do modelo incompleta (${res.status}${res.incomplete_details?.reason ? `: ${res.incomplete_details.reason}` : ''}).`);
  return {
    json: JSON.parse(res.output_text),
    model: res.model,
    usage: { inputTokens: res.usage?.input_tokens ?? 0, outputTokens: res.usage?.output_tokens ?? 0, totalTokens: res.usage?.total_tokens ?? 0 },
    ms: Date.now() - started,
  };
};
