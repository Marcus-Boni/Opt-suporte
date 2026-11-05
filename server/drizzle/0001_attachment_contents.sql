CREATE TABLE "attachment_contents" (
	"attachment_id" uuid PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "attachment_contents" ADD CONSTRAINT "attachment_contents_attachment_id_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."attachments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Imagens/PDF já vêm comprimidos: guardar fora da linha (TOAST) sem tentar comprimir de novo.
ALTER TABLE "attachment_contents" ALTER COLUMN "data" SET STORAGE EXTERNAL;