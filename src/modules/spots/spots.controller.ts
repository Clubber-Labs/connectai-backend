import type { FastifyReply, FastifyRequest } from 'fastify'
import type { CreateSpotBody, ListSpotsQuery, SpotParam } from './spots.schema'
import { createSpot, getSpot, joinSpot, listSpotsOnMap } from './spots.service'

export async function postSpot(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as CreateSpotBody
  const spot = await createSpot(request.user.sub, body)
  return reply.status(201).send(spot)
}

export async function getSpots(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as ListSpotsQuery
  const spots = await listSpotsOnMap(request.user?.sub ?? null, query)
  return reply.send(spots)
}

export async function getSpotById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as SpotParam
  const spot = await getSpot(request.user?.sub ?? null, id)
  return reply.send(spot)
}

export async function postJoinSpot(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as SpotParam
  const result = await joinSpot(request.user.sub, id)
  return reply.send(result)
}
