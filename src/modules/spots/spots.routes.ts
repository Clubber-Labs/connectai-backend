import type { FastifyInstance } from 'fastify'
import {
  getSpotById,
  getSpots,
  postJoinSpot,
  postSpot,
} from './spots.controller'
import {
  createSpotSchema,
  listSpotsQuerySchema,
  spotParamSchema,
} from './spots.schema'

export async function spotsRoutes(app: FastifyInstance) {
  app.post(
    '/spots',
    { schema: { body: createSpotSchema }, onRequest: [app.authenticate] },
    postSpot,
  )

  app.get(
    '/spots',
    {
      schema: { querystring: listSpotsQuerySchema },
      onRequest: [app.authenticateOptional],
    },
    getSpots,
  )

  app.get(
    '/spots/:id',
    {
      schema: { params: spotParamSchema },
      onRequest: [app.authenticateOptional],
    },
    getSpotById,
  )

  // Entrar no spot = virar membro = participar do chat. POST cria a participação.
  app.post(
    '/spots/:id/members',
    { schema: { params: spotParamSchema }, onRequest: [app.authenticate] },
    postJoinSpot,
  )
}
