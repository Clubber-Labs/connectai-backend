import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  CreateCommentBody,
  EventCommentIdParam,
  EventCommentParam,
  PaginationQuery,
  PostCommentIdParam,
  PostCommentParam,
} from './comments.schema'
import {
  addCommentToEvent,
  addCommentToPost,
  listEventComments,
  listPostComments,
  removeComment,
} from './comments.service'

export async function postEventComment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventCommentParam
  const comment = await addCommentToEvent(
    request.user.sub,
    eventId,
    request.body as CreateCommentBody,
  )
  request.log.info(`User ${request.user.sub} added a comment to event ${eventId} with comment id ${comment.id}, with content: ${JSON.stringify(request.body)}`)
  return reply.status(201).send(comment)
}

export async function getEventComments(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventCommentParam
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listEventComments(
    eventId,
    request.user.sub,
    limit,
    cursor,
  )
  request.log.info(`User ${request.user.sub} requested comments for event ${eventId}`)
  return reply.send(result)
}

export async function deleteEventComment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId, commentId } = request.params as EventCommentIdParam
  await removeComment(commentId, request.user.sub, eventId)
  request.log.info(`User ${request.user.sub} deleted comment ${commentId} from event ${eventId}`)
  return reply.status(204).send()
}

export async function postPostComment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { postId } = request.params as PostCommentParam
  const comment = await addCommentToPost(
    request.user.sub,
    postId,
    request.body as CreateCommentBody,
  )
  request.log.info(`User ${request.user.sub} added a comment to post ${postId} with comment id ${comment.id}, with content: ${JSON.stringify(request.body)}`)
  return reply.status(201).send(comment)
}

export async function getPostComments(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { postId } = request.params as PostCommentParam
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listPostComments(postId, request.user.sub, limit, cursor)
  request.log.info(`User ${request.user.sub} requested comments for post ${postId}`)
  return reply.send(result)
}

export async function deletePostComment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { postId, commentId } = request.params as PostCommentIdParam
  await removeComment(commentId, request.user.sub, postId)
  request.log.info(`User ${request.user.sub} deleted comment ${commentId} from post ${postId}`)
  return reply.status(204).send()
}
