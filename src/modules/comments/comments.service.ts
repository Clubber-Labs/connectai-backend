import { findEventById } from '../events/events.repository'
import { findPostById } from '../posts/posts.repository'
import {
  createComment,
  deleteComment,
  findCommentById,
  findCommentsByEvent,
  findCommentsByPost,
} from './comments.repository'
import type { CreateCommentBody } from './comments.schema'

export async function addCommentToEvent(
  authorId: string,
  eventId: string,
  body: CreateCommentBody,
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }
  return createComment(authorId, body.content, { eventId })
}

export async function addCommentToPost(
  authorId: string,
  postId: string,
  body: CreateCommentBody,
) {
  const post = await findPostById(postId)
  if (!post) {
    throw { statusCode: 404, message: 'Post não encontrado' }
  }
  return createComment(authorId, body.content, { postId })
}

export async function listEventComments(
  eventId: string,
  limit: number,
  cursor?: string,
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }
  const rows = await findCommentsByEvent(eventId, limit, cursor)
  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null
  return { data: rows, nextCursor }
}

export async function listPostComments(
  postId: string,
  limit: number,
  cursor?: string,
) {
  const post = await findPostById(postId)
  if (!post) {
    throw { statusCode: 404, message: 'Post não encontrado' }
  }
  const rows = await findCommentsByPost(postId, limit, cursor)
  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null
  return { data: rows, nextCursor }
}

export async function removeComment(commentId: string, requesterId: string) {
  const comment = await findCommentById(commentId)
  if (!comment) {
    throw { statusCode: 404, message: 'Comentário não encontrado' }
  }
  if (comment.authorId !== requesterId) {
    throw { statusCode: 403, message: 'Sem permissão para deletar este comentário' }
  }
  return deleteComment(commentId)
}
