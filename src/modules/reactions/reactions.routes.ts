import type { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import {
  deleteCommentReaction,
  deleteEventReaction,
  deletePostReaction,
  postCommentReaction,
  postEventReaction,
  postPostReaction,
} from './reactions.controller'
import {
  commentReactionParamSchema,
  eventReactionParamSchema,
  postReactionParamSchema,
} from './reactions.schema'

export async function reactionsRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.post(
    '/events/:eventId/reactions',
    {
      schema: { params: eventReactionParamSchema },
      onRequest: [app.authenticate],
    },
    postEventReaction,
  )

  api.delete(
    '/events/:eventId/reactions',
    {
      schema: { params: eventReactionParamSchema },
      onRequest: [app.authenticate],
    },
    deleteEventReaction,
  )

  api.post(
    '/posts/:postId/reactions',
    {
      schema: { params: postReactionParamSchema },
      onRequest: [app.authenticate],
    },
    postPostReaction,
  )

  api.delete(
    '/posts/:postId/reactions',
    {
      schema: { params: postReactionParamSchema },
      onRequest: [app.authenticate],
    },
    deletePostReaction,
  )

  api.post(
    '/comments/:commentId/reactions',
    {
      schema: { params: commentReactionParamSchema },
      onRequest: [app.authenticate],
    },
    postCommentReaction,
  )

  api.delete(
    '/comments/:commentId/reactions',
    {
      schema: { params: commentReactionParamSchema },
      onRequest: [app.authenticate],
    },
    deleteCommentReaction,
  )
}
