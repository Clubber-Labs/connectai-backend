-- Reactions: simplificar para binário (Instagram-style)
ALTER TABLE "reactions" DROP COLUMN IF EXISTS "type";
ALTER TABLE "reactions" DROP COLUMN IF EXISTS "updatedAt";
DROP TYPE IF EXISTS "ReactionType";

-- Comment reactions: novo modelo binário
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "comment_reactions_user_comment_unique"
    ON "comment_reactions"("userId", "commentId");

CREATE INDEX "comment_reactions_commentId_idx"
    ON "comment_reactions"("commentId");

ALTER TABLE "comment_reactions"
    ADD CONSTRAINT "comment_reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comment_reactions"
    ADD CONSTRAINT "comment_reactions_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "comments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
