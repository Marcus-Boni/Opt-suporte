export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') =>
  new HttpError(404, 'not_found', `${what}: não existe ou está fora do seu escopo de acesso.`);
export const forbidden = (msg = 'Você não tem permissão para esta operação.') => new HttpError(403, 'forbidden', msg);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'bad_request', msg, details);
export const unauthorized = (msg = 'Autenticação necessária.') => new HttpError(401, 'unauthorized', msg);
