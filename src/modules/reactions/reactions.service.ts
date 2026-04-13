import type { ReactionType } from '@prisma/client'
import { findEventById } from '../events/events.repository'
import { findPostById } from '../posts/posts.repository'
import {
  deleteEventReaction,
  deletePostReaction,
  findEventReaction,
  findPostReaction,
  upsertEventReaction,
  upsertPostReaction,
} from './reactions.repository'

export async function reactToEvent(
  userId: string,
  eventId: string,
  type: ReactionType,
) {
  const event = await findEventById(eventId)
  if (!event) {
    throw { statusCode: 404, message: 'Evento não encontrado' }
  }
  return upsertEventReaction(userId, eventId, type)
}

export async function reactToPost(
  userId: string,
  postId: string,
  type: ReactionType,
) {
  const post = await findPostById(postId)
  if (!post) {
    throw { statusCode: 404, message: 'Post não encontrado' }
  }
  return upsertPostReaction(userId, postId, type)
}

export async function removeEventReaction(userId: string, eventId: string) {
  const reaction = await findEventReaction(userId, eventId)
  if (!reaction) {
    throw { statusCode: 404, message: 'Reação não encontrada' }
  }
  return deleteEventReaction(userId, eventId)
}

export async function removePostReaction(userId: string, postId: string) {
  const reaction = await findPostReaction(userId, postId)
  if (!reaction) {
    throw { statusCode: 404, message: 'Reação não encontrada' }
  }
  return deletePostReaction(userId, postId)
}
