import type { FastifyInstance } from 'fastify'
import {
  deleteSpot,
  getSpotById,
  getSpots,
  patchSpot,
  postJoinSpot,
  postSpot,
} from './spots.controller'
import {
  createSpotSchema,
  listSpotsQuerySchema,
  spotParamSchema,
  updateSpotSchema,
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

  app.patch(
    '/spots/:id',
    {
      schema: { params: spotParamSchema, body: updateSpotSchema },
      onRequest: [app.authenticate],
    },
    patchSpot,
  )

  app.delete(
    '/spots/:id',
    { schema: { params: spotParamSchema }, onRequest: [app.authenticate] },
    deleteSpot,
  )

  // Entrar no spot = virar membro = participar do chat. POST cria a participação.
  app.post(
    '/spots/:id/members',
    { schema: { params: spotParamSchema }, onRequest: [app.authenticate] },
    postJoinSpot,
  )
}
