import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  CommentReactionParam,
  EventReactionParam,
  PostReactionParam,
} from './reactions.schema'
import {
  likeComment,
  likeEvent,
  likePost,
  unlikeComment,
  unlikeEvent,
  unlikePost,
} from './reactions.service'

export async function postEventReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventReactionParam
  const reaction = await likeEvent(request.user.sub, eventId)
  return reply.status(201).send(reaction)
}

export async function deleteEventReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { eventId } = request.params as EventReactionParam
  await unlikeEvent(request.user.sub, eventId)
  return reply.status(204).send()
}

export async function postPostReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { postId } = request.params as PostReactionParam
  const reaction = await likePost(request.user.sub, postId)
  return reply.status(201).send(reaction)
}

export async function deletePostReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { postId } = request.params as PostReactionParam
  await unlikePost(request.user.sub, postId)
  return reply.status(204).send()
}

export async function postCommentReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { commentId } = request.params as CommentReactionParam
  const reaction = await likeComment(request.user.sub, commentId)
  return reply.status(201).send(reaction)
}

export async function deleteCommentReaction(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { commentId } = request.params as CommentReactionParam
  await unlikeComment(request.user.sub, commentId)
  return reply.status(204).send()
}
