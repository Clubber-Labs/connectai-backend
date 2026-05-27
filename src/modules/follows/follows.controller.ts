import type { FastifyReply, FastifyRequest } from 'fastify'
import type {
  FollowParam,
  FollowRequestParam,
  PaginationQuery,
} from './follows.schema'
import {
  approveFollowRequest,
  followUser,
  listFollowers,
  listFollowing,
  listPendingRequests,
  rejectFollowRequest,
  removeFollower,
  unfollowUser,
} from './follows.service'

export async function postFollow(request: FastifyRequest, reply: FastifyReply) {
  const { userId: followingId } = request.params as FollowParam
  const follow = await followUser(request.user.sub, followingId)
  const message =
    follow.status === 'PENDING' ? 'Solicitação enviada' : 'Seguindo com sucesso'
  request.log.info(`User ${request.user.sub} followed user ${followingId} with status ${follow.status}`)
  return reply.status(201).send({ message, status: follow.status })
}

export async function deleteFollow(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId: followingId } = request.params as FollowParam
  await unfollowUser(request.user.sub, followingId)
  request.log.info(`User ${request.user.sub} unfollowed user ${followingId}`)
  return reply.status(204).send()
}

export async function getFollowers(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request.params as FollowParam
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listFollowers(userId, request.user.sub, limit, cursor)
  request.log.info(`User ${request.user.sub} requested followers for user ${userId}`)
  return reply.send(result)
}

export async function getFollowing(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { userId } = request.params as FollowParam
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listFollowing(userId, request.user.sub, limit, cursor)
  request.log.info(`User ${request.user.sub} requested following for user ${userId}`)
  return reply.send(result)
}

export async function deleteFollower(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { followerId } = request.params as FollowRequestParam
  await removeFollower(request.user.sub, followerId)
  request.log.info(`User ${request.user.sub} removed follower with id ${followerId}`)
  return reply.status(204).send()
}

export async function getPendingRequests(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { limit, cursor } = request.query as PaginationQuery
  const result = await listPendingRequests(request.user.sub, limit, cursor)
  request.log.info(`User ${request.user.sub} requested pending follow requests`)
  return reply.send(result)
}

export async function postApproveFollow(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { followerId } = request.params as FollowRequestParam
  await approveFollowRequest(request.user.sub, followerId)
  request.log.info(`User ${request.user.sub} approved follow request from user ${followerId}`)
  return reply.status(204).send()
}

export async function postRejectFollow(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { followerId } = request.params as FollowRequestParam
  await rejectFollowRequest(request.user.sub, followerId)
  request.log.info(`User ${request.user.sub} rejected follow request from user ${followerId}`)
  return reply.status(204).send()
}
