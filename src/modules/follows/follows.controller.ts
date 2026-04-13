import type { FastifyReply, FastifyRequest } from 'fastify'
import type { FollowParam, FollowRequestParam, PaginationQuery } from './follows.schema'
import {
  approveFollowRequest,
  followUser,
  listFollowers,
  listFollowing,
  listPendingRequests,
  rejectFollowRequest,
  unfollowUser,
} from './follows.service'

export async function postFollow(request: FastifyRequest, reply: FastifyReply) {
  const { userId: followingId } = request.params as FollowParam
  const follow = await followUser(request.user.sub, followingId)
  const message = follow.status === 'PENDING' ? 'Solicitação enviada' : 'Seguindo com sucesso'
  return reply.status(201).send({ message, status: follow.status })
}

export async function deleteFollow(request: FastifyRequest, reply: FastifyReply) {
  const { userId: followingId } = request.params as FollowParam
  await unfollowUser(request.user.sub, followingId)
  return reply.status(204).send()
}

export async function postApproveFollow(request: FastifyRequest, reply: FastifyReply) {
  const { followerId } = request.params as FollowRequestParam
  await approveFollowRequest(request.user.sub, followerId)
  return reply.send({ message: 'Solicitação aceita' })
}

export async function postRejectFollow(request: FastifyRequest, reply: FastifyReply) {
  const { followerId } = request.params as FollowRequestParam
  await rejectFollowRequest(request.user.sub, followerId)
  return reply.send({ message: 'Solicitação recusada' })
}

export async function getPendingRequests(request: FastifyRequest, reply: FastifyReply) {
  const requests = await listPendingRequests(request.user.sub)
  return reply.send(requests)
}

export async function getFollowers(request: FastifyRequest, reply: FastifyReply) {
  const { userId } = request.params as FollowParam
  const { limit, cursor } = request.query as PaginationQuery
  const followers = await listFollowers(userId, limit, cursor)
  return reply.send(followers)
}

export async function getFollowing(request: FastifyRequest, reply: FastifyReply) {
  const { userId } = request.params as FollowParam
  const { limit, cursor } = request.query as PaginationQuery
  const following = await listFollowing(userId, limit, cursor)
  return reply.send(following)
}

export async function getFollowRequests(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requests = await listPendingFollowRequests(request.user.sub)
  return reply.send(requests)
}

export async function postApproveFollowRequest(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { followerId } = request.params as FollowerIdParam
  await approveFollowRequest(request.user.sub, followerId)
  return reply.send({ message: 'Solicitação aceita' })
}

export async function deleteFollowRequest(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { followerId } = request.params as FollowerIdParam
  await rejectFollowRequest(request.user.sub, followerId)
  return reply.status(204).send()
}
