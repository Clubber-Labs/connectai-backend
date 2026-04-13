import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  FollowActionBody,
  FollowUserBody,
  FollowUserIdParam,
  PaginationQuery,
} from './follows.schema'
import {
  approveFollowRequest,
  followUser,
  listFollowers,
  listFollowing,
  rejectFollowRequest,
  unfollowUser,
} from './follows.service'

export async function postFollow(
  request: FastifyRequest<{ Body: FollowUserBody }>,
  reply: FastifyReply,
) {
  const followerId = request.user.sub
  const { followingId } = request.body

  const follow = await followUser(followerId, followingId)
  const message =
    follow.status === 'PENDING'
      ? 'Solicitação de follow enviada'
      : 'Seguindo com sucesso'
  return reply.status(201).send({ message })
}

export async function postApproveFollow(
  request: FastifyRequest<{ Body: FollowActionBody }>,
  reply: FastifyReply,
) {
  const ownerId = request.user.sub
  const { followerId } = request.body

  await approveFollowRequest(ownerId, followerId)
  return reply.status(200).send({ message: 'Solicitação aceita' })
}

export async function postRejectFollow(
  request: FastifyRequest<{ Body: FollowActionBody }>,
  reply: FastifyReply,
) {
  const ownerId = request.user.sub
  const { followerId } = request.body

  await rejectFollowRequest(ownerId, followerId)
  return reply.status(200).send({ message: 'Solicitação recusada' })
}

export async function deleteFollowHandler(
  request: FastifyRequest<{ Body: FollowUserBody }>,
  reply: FastifyReply,
) {
  const followerId = request.user.sub
  const { followingId } = request.body

  await unfollowUser(followerId, followingId)
  return reply.status(200).send({ message: 'Deixou de seguir com sucesso' })
}

export async function getFollowers(
  request: FastifyRequest<{
    Params: FollowUserIdParam
    Querystring: PaginationQuery
  }>,
  reply: FastifyReply,
) {
  const { limit, cursor } = request.query
  const requesterId = request.user?.sub
  const followers = await listFollowers(
    request.params.id,
    requesterId,
    limit,
    cursor,
  )
  return reply.send(followers)
}

export async function getFollowing(
  request: FastifyRequest<{
    Params: FollowUserIdParam
    Querystring: PaginationQuery
  }>,
  reply: FastifyReply,
) {
  const { limit, cursor } = request.query
  const requesterId = request.user?.sub
  const following = await listFollowing(
    request.params.id,
    requesterId,
    limit,
    cursor,
  )
  return reply.send(following)
}
