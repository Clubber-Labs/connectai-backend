import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AttendanceBody, EventParams } from './attendance.schema'
import {
  cancelAttendance,
  confirmAttendance,
  listAttendances,
} from './attendance.service'

export async function postAttendance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventParams
  const { type } = request.body as AttendanceBody
  const attendance = await confirmAttendance(request.user.sub, eventId, type)
  request.log.info(`User ${request.user.sub} confirmed attendance for event ${eventId} with type ${type}`)
  return reply.status(201).send(attendance)
}

export async function removeAttendance(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventParams
  await cancelAttendance(request.user.sub, eventId)
  request.log.info(`User ${request.user.sub} cancelled attendance for event ${eventId}`)
  return reply.status(204).send()
}

export async function getAttendances(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventParams
  const attendances = await listAttendances(eventId, request.user.sub)
  request.log.info(`User ${request.user.sub} requested attendances for event ${eventId}`)
  return reply.send(attendances)
}
