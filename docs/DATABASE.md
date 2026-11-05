# Banco de dados

O Optsolv Suporte usa **PostgreSQL 15+**: localmente via Docker Compose e, em ambiente real, o **Azure Database for PostgreSQL (flexible server)**. O schema é versionado em `server/drizzle` (Drizzle ORM) e aplicado por `pnpm db:migrate`.

## Conexão

Toda a configuração fica em [`server/src/db/connection.ts`](../server/src/db/connection.ts):

| Item | Comportamento |
|---|---|
| **TLS** | Obrigatório fora do localhost, **com verificação do certificado** (`rejectUnauthorized: true`). O Azure usa cadeias DigiCert/Microsoft já confiáveis no Node. `sslmode=disable` só para uso local. |
| **Pool** | `DB_POOL_MAX` por instância (padrão 10), conexões ociosas fechadas após 30 s, timeout de conexão de 10 s, keep-alive ligado. |
| **Limites** | `statement_timeout` de 30 s (`DB_STATEMENT_TIMEOUT_MS`) e `idle_in_transaction_session_timeout` de 60 s: uma consulta travada não segura conexões. |
| **Identificação** | `application_name = optsolv-suporte`, visível em `pg_stat_activity` e nas métricas do Azure. |
| **Resiliência** | Erros em conexões ociosas (o Azure as encerra) são registrados sem derrubar o processo; `SIGTERM`/`SIGINT` fecham o servidor e o pool de forma limpa. |

Some o `DB_POOL_MAX` de todas as instâncias e mantenha abaixo de `max_connections` do servidor (deixe folga para migrações e acesso administrativo).

## Primeiro uso num banco novo

```bash
pnpm db:migrate
```
```bash
pnpm --filter server db:create-admin --email pessoa@optsolv.com.br --name "Nome Sobrenome"
```

- `db:migrate` aplica as migrações dentro de um *advisory lock*: dois deploys simultâneos não migram ao mesmo tempo.
- `db:create-admin` cria o primeiro administrador. A senha vem de `ADMIN_PASSWORD` (12+ caracteres) ou é gerada e exibida **uma única vez**. O script recusa e-mail já existente e registra a criação na auditoria.
- A partir daí, clientes, projetos e usuários são cadastrados pela própria interface (Acessos e API).

## Travas de segurança

Comandos destrutivos ou de dados de exemplo **recusam qualquer banco que não seja local**:

| Comando | Em banco local | Em banco remoto |
|---|---|---|
| `pnpm db:seed` | Grava dados de exemplo e tokens conhecidos | Recusado |
| `pnpm db:reset` | Apaga o schema e semeia de novo | Recusado (e sempre recusado com `NODE_ENV=production`) |
| `pnpm test` | Recria o banco irmão `optsolv_experience_test` | Recusado |

Para um banco remoto **descartável** (ex.: homologação), libere de propósito digitando o nome do banco: `CONFIRM_DATABASE=<nome-do-banco> pnpm db:reset`. Os testes usam `TEST_DATABASE_URL`, nunca a `DATABASE_URL` da aplicação.

## Anexos no banco

Sem storage externo por enquanto, os anexos ficam no próprio Postgres:

- **Metadados** em `attachments` (nome, tipo, tamanho, `sha256`, vínculo com solicitação/entrega) e **bytes** em `attachment_contents` (`bytea`), uma tabela separada: listar e contar anexos nunca lê o conteúdo. Apagar o anexo apaga o conteúdo (`ON DELETE CASCADE`).
- A coluna `data` usa `STORAGE EXTERNAL`: imagens e PDFs já vêm comprimidos, então o Postgres guarda fora da linha (TOAST) sem gastar CPU tentando comprimir de novo.
- Upload limitado a **5 MB**, com lista de tipos permitidos e **verificação da assinatura do arquivo** (o tipo declarado pelo navegador não basta). Metadados e bytes são gravados na mesma transação.
- Download só após checar o escopo do cliente, com `ETag` pelo SHA-256 (o navegador revalida e recebe `304` sem baixar de novo), `Cache-Control: private` e `Content-Disposition` seguro (`inline` só para imagens e PDF).

> Quando o volume crescer (muitos GB de anexos ou backups lentos), o caminho é mover o conteúdo para o Azure Blob Storage mantendo a mesma API (`storeUpload`/`openAttachment` em `server/src/lib/files.ts`).

## Boas práticas no Azure (checklist)

- **Papel de aplicação com menos privilégio.** Hoje a aplicação conecta com o administrador do servidor. Quando quiser endurecer, crie um papel próprio para a aplicação e rode as migrações com o administrador:

  ```sql
  CREATE ROLE optsolv_app LOGIN PASSWORD '<senha forte>';
  GRANT CONNECT ON DATABASE "opt-suporte" TO optsolv_app;
  GRANT USAGE ON SCHEMA public TO optsolv_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO optsolv_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO optsolv_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO optsolv_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO optsolv_app;
  ```
- **Rede:** acesso privado (VNet/Private Endpoint) para a aplicação; se usar acesso público, restrinja o firewall aos IPs necessários e remova regras temporárias de desenvolvimento.
- **Backups:** confirme a retenção (7–35 dias) e o backup geo-redundante se o requisito pedir; teste uma restauração antes do go-live.
- **Segredos:** guarde as URLs de conexão no Azure Key Vault ou nas configurações protegidas do App Service/Container Apps, nunca no repositório.
- **Monitoramento:** alertas de CPU, armazenamento e conexões; `pg_stat_statements` para consultas lentas.
