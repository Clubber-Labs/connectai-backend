import type { FastifyInstance } from 'fastify'
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  deleteFollow,
  getFollowers,
  getFollowing,
  getPendingRequests,
  postApproveFollow,
  postFollow,
} from './follows.controller'
import { followParamSchema, followRequestParamSchema, paginationSchema } from './follows.schema'

export async function followsRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  // Seguir usuário
  api.post(
    '/users/:userId/follow',
    { schema: { params: followParamSchema }, onRequest: [app.authenticate] },
    postFollow,
  )

  // Deixar de seguir
  api.delete(
    '/users/:userId/follow',
    { schema: { params: followParamSchema }, onRequest: [app.authenticate] },
    deleteFollow,
  )

  // Solicitações pendentes (conta privada)
  api.get(
    '/users/me/follow-requests',
    { onRequest: [app.authenticate] },
    getPendingRequests,
  )

  // Aceitar solicitação
  api.post(
    '/users/me/follow-requests/:followerId/accept',
    { schema: { params: followRequestParamSchema }, onRequest: [app.authenticate] },
    postApproveFollow,
  )

  // Recusar solicitação
  api.delete(
    '/users/me/follow-requests/:followerId',
    { schema: { params: followRequestParamSchema }, onRequest: [app.authenticate] },
    postRejectFollow,
  )

  // Listar seguidores de um usuário
  api.get(
    '/users/:userId/followers',
    { schema: { params: followParamSchema, querystring: paginationSchema } },
    getFollowers,
  )

  // Listar quem um usuário segue
  api.get(
    '/users/:userId/following',
    { schema: { params: followParamSchema, querystring: paginationSchema } },
    getFollowing,
  )

  // Listar solicitações de follow pendentes do usuário autenticado
  api.get(
    '/users/me/follow-requests',
    { onRequest: [app.authenticate] },
    getFollowRequests,
  )

  // Aceitar solicitação de follow
  api.post(
    '/users/me/follow-requests/:followerId/accept',
    {
      schema: { params: followerIdParamSchema },
      onRequest: [app.authenticate],
    },
    postApproveFollowRequest,
  )

  // Rejeitar solicitação de follow
  api.delete(
    '/users/me/follow-requests/:followerId',
    {
      schema: { params: followerIdParamSchema },
      onRequest: [app.authenticate],
    },
    deleteFollowRequest,
  )
}
