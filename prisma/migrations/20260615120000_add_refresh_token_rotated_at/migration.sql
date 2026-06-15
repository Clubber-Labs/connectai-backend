-- Distingue revogação por ROTAÇÃO de revogação intencional (logout/reset/MFA).
-- Setado atomicamente no claim da rotação; habilita a janela de carência para
-- reuso benigno (refresh concorrente / retry de resposta perdida) sem derrubar
-- a sessão. Nullable: rotações antigas e revogações intencionais ficam NULL.
ALTER TABLE "refresh_tokens" ADD COLUMN "rotatedAt" TIMESTAMP(3);
