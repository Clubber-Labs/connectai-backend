import { findEventById } from '../events/events.repository'
import {
  createAttendance,
  deleteAttendance,
  findAttendanceByUserAndEvent,
  findAttendancesByEvent,
} from './attendance.repository'

export async function confirmAttendance(
  userId: string,
  eventId: string,
  type: 'INTERESTED' | 'CONFIRMED' | 'NOT_INTERESTED',
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }

  const existing = await findAttendanceByUserAndEvent(userId, eventId)
  if (existing) {
    throw { statusCode: 409, message: 'Você já registrou uma intenção neste evento' }
  }

  return createAttendance(userId, eventId, type)
}

export async function cancelAttendance(userId: string, eventId: string) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }

  const existing = await findAttendanceByUserAndEvent(userId, eventId)

  if (!existing) {
    throw { statusCode: 404, message: 'Confirmação de presença não encontrada' }
  }

  return deleteAttendance(userId, eventId)
}

export async function listAttendances(eventId: string) {
  return findAttendancesByEvent(eventId)
}
