import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FeedQuery } from './feed.schema'
import { getFeed } from './feed.service'

export async function getMainFeed(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const result = await getFeed(request.user.sub, request.query as FeedQuery)
  request.log.info(`User ${request.user.sub} requested main feed with query: ${JSON.stringify(request.query)}`)
  return reply.send(result)
}
