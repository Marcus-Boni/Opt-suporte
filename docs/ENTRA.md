# Login da equipe com Microsoft Entra ID

A equipe Optsolv entra com a conta corporativa da Microsoft. Clientes do portal continuam com e-mail e senha.

## Como funciona

1. **Entrar com a Microsoft** (`GET /api/v1/auth/entra/login`) gera PKCE (S256), `state` e `nonce`, guarda os três num cookie assinado de 10 minutos e redireciona ao Entra ID.
2. A Microsoft autentica (com a autenticação multifator e as políticas da Optsolv) e volta para `GET /api/v1/auth/entra/callback`.
3. O servidor troca o código pelo ID token com a biblioteca `openid-client`, que valida assinatura (chaves públicas do tenant), emissor, audiência, validade, `nonce` e `state`. O navegador nunca vê tokens.
4. Regras da plataforma:
   - só o tenant `ENTRA_TENANT_ID` e e-mails dos domínios `ENTRA_ALLOWED_DOMAINS` (padrão `optsolv.com.br`);
   - convidados (B2B) de outros tenants são recusados (claim `idp` de outro emissor ou UPN com `#EXT#`);
   - a pessoa é vinculada pelo `oid` (identificador imutável do Entra). Conta existente de **colaborador** é vinculada pelo e-mail no primeiro acesso. Contas de **admin, cliente ou admin de emergência nunca são vinculadas sozinhas** (evita que um e-mail alterado no diretório tome a conta): a pessoa entra com a senha e usa **Vincular conta Microsoft** em Acessos e API (`/auth/entra/login?link=1` com a sessão aberta);
   - quem não existe vira **colaborador sem clientes** (menor privilégio). Um admin libera os clientes e, se for o caso, promove a admin em **Acessos e API → Editar acesso**;
   - conta desativada na plataforma não entra; conta desativada ou removida no Entra não consegue autenticar.
5. A sessão é a mesma do login por senha (cookie `osx_session`, 7 dias, revogável ao desativar a pessoa).

Com o Entra configurado, e-mails desses domínios **não entram com senha** (`403 use_microsoft`), exceto os listados em `EMERGENCY_ADMIN_EMAILS` (acesso de emergência, se a Microsoft estiver fora do ar).

Recusas voltam para `/entrar?erro=<motivo>` (`tenant`, `convidado`, `dominio`, `inativo`, `conta`, `vincular`, `sessao`, `consentimento`, `cancelado`, `indisponivel`, `falha`) com mensagem em português. Toda entrada, criação e vínculo fica na auditoria.

## Registro do app no Entra

| Item | Valor |
|---|---|
| Nome | Optsolv Suporte |
| Tipo de conta | Somente este diretório organizacional (single tenant) |
| Plataforma | Web |
| Redirect URIs | `http://localhost:4000/api/v1/auth/entra/callback` (dev) e `https://<domínio>/api/v1/auth/entra/callback` (produção) |
| Permissões | Microsoft Graph delegadas: `openid`, `profile`, `email` (sem acesso a e-mails, arquivos ou Teams) |
| Segredo | client secret de até 6 meses; trocar antes de vencer |

Se o tenant exigir aprovação de administrador, a tela mostra o motivo `consentimento`: um admin global concede em **Entra ID → Enterprise applications → Optsolv Suporte → Permissions → Grant admin consent**. São só as permissões de login acima.

## Configuração (`server/.env`)

```
ENTRA_TENANT_ID=<Directory (tenant) ID>
ENTRA_CLIENT_ID=<Application (client) ID>
ENTRA_CLIENT_SECRET=<client secret>
ENTRA_REDIRECT_URI=https://<domínio>/api/v1/auth/entra/callback   # padrão: http://localhost:<PORT>/api/v1/auth/entra/callback
APP_URL=https://<domínio>                                          # para onde o login volta (padrão http://localhost:5173)
EMERGENCY_ADMIN_EMAILS=pessoa@optsolv.com.br                       # entram com senha mesmo com o Entra ligado
# ENTRA_ALLOWED_DOMAINS=optsolv.com.br
```

Sem as três primeiras, o botão não aparece e todos entram com senha. Em produção, prefira guardar o segredo no Key Vault ou trocar por certificado/identidade federada.

## Testes

`server/test/entra.test.ts` sobe um provedor OIDC simulado (HTTP real, chaves RSA, PKCE conferido) e cobre o fluxo completo, as recusas, o bloqueio de senha, o acesso de emergência e a gestão de papel e clientes.
