import { findEventById } from '../events/events.repository'
import { findAttendanceByUserAndEvent } from '../attendance/attendance.repository'
import {
  createPost,
  deletePost,
  findPostById,
  findPostsByEvent,
} from './posts.repository'
import type { CreatePostBody } from './posts.schema'

export async function addPost(
  authorId: string,
  eventId: string,
  body: CreatePostBody,
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }

  const attendance = await findAttendanceByUserAndEvent(authorId, eventId)
  if (!attendance) {
    throw {
      statusCode: 403,
      message: 'Apenas participantes do evento podem postar',
    }
  }

  return createPost(authorId, eventId, body.content)
}

export async function listPostsByEvent(
  eventId: string,
  limit: number,
  cursor?: string,
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }

  const rows = await findPostsByEvent(eventId, limit, cursor)
  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null
  return { data: rows, nextCursor }
}

export async function removePost(postId: string, requesterId: string) {
  const post = await findPostById(postId)
  if (!post) {
    throw { statusCode: 404, message: 'Post não encontrado' }
  }
  if (post.authorId !== requesterId) {
    throw { statusCode: 403, message: 'Sem permissão para deletar este post' }
  }
  return deletePost(postId)
}
