import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  CreatePostBody,
  EventIdParam,
  PaginationQuery,
  PostParam,
} from './posts.schema'
import { addPost, listPostsByEvent, removePost } from './posts.service'

export async function postPost(request: FastifyRequest, reply: FastifyReply) {
  const { eventId } = request.params as EventIdParam
  const post = await addPost(
    request.user.sub,
    eventId,
    request.body as CreatePostBody,
  )
  request.log.info(`User ${request.user.sub} created a post in event ${eventId} with content: ${JSON.stringify(request.body)}`)
  return reply.status(201).send(post)
}

export async function getPosts(request: FastifyRequest, reply: FastifyReply) {
  const { eventId } = request.params as EventIdParam
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listPostsByEvent(
    eventId,
    request.user.sub,
    limit,
    cursor,
  )
  request.log.info(`User ${request.user.sub} requested posts for event ${eventId}`)
  return reply.send(result)
}

export async function deletePost(request: FastifyRequest, reply: FastifyReply) {
  const { eventId, postId } = request.params as PostParam
  await removePost(eventId, postId, request.user.sub)
  request.log.info(`User ${request.user.sub} deleted post ${postId} from event ${eventId}`)
  return reply.status(204).send()
}
