import { findUserById } from '../users/users.repository'
import {
  acceptFollowRequest,
  createFollow,
  deleteFollow,
  findFollow,
  findFollowers,
  findFollowing,
} from './follows.repository'

export async function followUser(followerId: string, followingId: string) {
  if (followerId === followingId) {
    throw { statusCode: 400, message: 'Você não pode seguir a si mesmo' }
  }

  const targetUser = await findUserById(followingId)
  if (!targetUser) {
    throw { statusCode: 404, message: 'Usuário a ser seguido não encontrado' }
  }

  const alreadyFollowing = await findFollow(followerId, followingId)
  if (alreadyFollowing) {
    const msg =
      alreadyFollowing.status === 'PENDING'
        ? 'Solicitação de follow já enviada'
        : 'Você já segue este usuário'
    throw { statusCode: 400, message: msg }
  }

  const status = targetUser.isPrivate ? 'PENDING' : 'ACCEPTED'

  return createFollow(followerId, followingId, status)
}

export async function approveFollowRequest(
  ownerId: string,
  followerId: string,
) {
  const follow = await findFollow(followerId, ownerId)
  if (!follow || follow.status !== 'PENDING') {
    throw { statusCode: 400, message: 'Solicitação não encontrada' }
  }

  return acceptFollowRequest(follow.id)
}

export async function rejectFollowRequest(ownerId: string, followerId: string) {
  const follow = await findFollow(followerId, ownerId)
  if (!follow || follow.status !== 'PENDING') {
    throw { statusCode: 400, message: 'Solicitação não encontrada' }
  }

  return deleteFollow(followerId, ownerId)
}

export async function unfollowUser(followerId: string, followingId: string) {
  const follow = await findFollow(followerId, followingId)
  if (!follow) {
    throw { statusCode: 400, message: 'Você não segue este usuário' }
  }

  return deleteFollow(followerId, followingId)
}

export async function listFollowers(
  userId: string,
  limit?: number,
  cursor?: string,
) {
  const user = await findUserById(userId)
  if (!user) {
    throw { statusCode: 404, message: 'Usuário não encontrado' }
  }
  const followers = await findFollowers(userId, limit, cursor)
  return followers.map((f) => f.follower)
}

export async function listFollowing(
  userId: string,
  limit?: number,
  cursor?: string,
) {
  const user = await findUserById(userId)
  if (!user) {
    throw { statusCode: 404, message: 'Usuário não encontrado' }
  }
  const following = await findFollowing(userId, limit, cursor)
  return following.map((f) => f.following)
}
