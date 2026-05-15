import { z } from 'zod'

export const eventReactionParamSchema = z.object({
  eventId: z.uuid('ID do evento inválido'),
})

export type EventReactionParam = z.infer<typeof eventReactionParamSchema>

export const postReactionParamSchema = z.object({
  postId: z.uuid('ID do post inválido'),
})

export type PostReactionParam = z.infer<typeof postReactionParamSchema>

export const commentReactionParamSchema = z.object({
  commentId: z.uuid('ID do comentário inválido'),
})

export type CommentReactionParam = z.infer<typeof commentReactionParamSchema>
