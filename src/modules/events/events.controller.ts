import type { FastifyReply, FastifyRequest } from 'fastify'
import { assertImageMimetype } from '../../lib/uploads'
import type {
  CreateEventBody,
  EventParams,
  ListEventsQuery,
  MapEventsQuery,
  UpdateEventBody,
  UserEventsParams,
  UserEventsQuery,
} from './events.schema'
import {
  addEvent,
  addEventImage,
  editEvent,
  getEventById,
  listEvents,
  listEventsForMap,
  listUserEvents,
  removeEvent,
} from './events.service'

export async function getEvents(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as ListEventsQuery
  const viewerId = (request.user as { sub: string } | undefined)?.sub
  const result = await listEvents(query, viewerId)
  request.log.info(`User ${viewerId} requested events with filters: ${JSON.stringify(query)}`)
  return reply.send(result)
}

export async function getEventsMap(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = request.query as MapEventsQuery
  const points = await listEventsForMap(query, request.user?.sub)
  request.log.info(`User ${request.user?.sub} requested events for map with filters: ${JSON.stringify(query)}`)
  return reply.send(points)
}

export async function getEvent(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as EventParams
  const event = await getEventById(id, request.user?.sub)
  request.log.info(`User ${request.user?.sub} requested event with id: ${id}`)
  return reply.send(event)
}

export async function getUserEvents(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request.params as UserEventsParams
  const { limit, cursor } = request.query as UserEventsQuery
  const viewerId = (request.user as { sub: string } | undefined)?.sub
  const result = await listUserEvents(userId, limit, viewerId, cursor)
  request.log.info(`User ${viewerId} requested events for user ${userId}`)
  return reply.send(result)
}

export async function postEvent(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as CreateEventBody
  const event = await addEvent(body, request.user.sub)
  request.log.info({ eventId: event.id, authorId: event.authorId, isPublic: event.isPublic }, 'Event created')
  return reply.status(201).send(event)
}

export async function putEvent(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as EventParams
  const body = request.body as UpdateEventBody
  const event = await editEvent(id, body, request.user.sub)
  request.log.info(`User ${request.user.sub} updated event with id: ${event.id}`)
  return reply.send(event)
}

export async function deleteEventHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as EventParams
  await removeEvent(id, request.user.sub, request.log)
  request.log.info(`User ${request.user.sub} deleted event with id: ${id}`)
  return reply.status(204).send()
}

export async function uploadEventImageHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = request.params as EventParams
  const data = await request.file()
  if (!data) {
    throw { statusCode: 400, message: 'Nenhuma imagem foi enviada' }
  }
  assertImageMimetype(data.mimetype)

  const buffer = await data.toBuffer()
  const eventImage = await addEventImage(
    id,
    buffer,
    request.user.sub,
    request.log,
  )
  request.log.info(`User ${request.user.sub} uploaded image for event with id: ${id}`)
  return reply.status(201).send(eventImage)
}
