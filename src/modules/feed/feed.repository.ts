import { prisma } from '../../lib/prisma'

const authorSelect = {
  id: true,
  name: true,
  lastname: true,
  username: true,
} as const

type FeedUser = { id: string; name: string; lastname: string; username: string }

export type FeedReason =
  | { kind: 'self_created' }
  | { kind: 'friend_created'; user: FeedUser }
  | { kind: 'friend_attending'; user: FeedUser; type: string }
  | { kind: 'friend_reacted'; user: FeedUser; type: string }
  | { kind: 'friend_commented'; user: FeedUser; preview: string }
  | { kind: 'self_interaction' }

function resolveReason(
  eventId: string,
  authorId: string,
  viewerId: string,
  followingIds: string[],
  userAttendance: string | null,
  userReaction: string | null,
  friendAttendances: { userId: string; type: string; user: FeedUser }[],
  friendReactionsByEvent: Map<string, { userId: string; type: string; user: FeedUser }[]>,
  friendCommentsByEvent: Map<string, { authorId: string; content: string; author: FeedUser }[]>,
): FeedReason {
  if (authorId === viewerId) return { kind: 'self_created' }

  if (userAttendance !== null || userReaction !== null) return { kind: 'self_interaction' }

  if (followingIds.includes(authorId)) {
    const attending = friendAttendances.find(a => a.userId === authorId)
    if (attending) return { kind: 'friend_created', user: attending.user }
    const reacted = (friendReactionsByEvent.get(eventId) ?? []).find(r => r.userId === authorId)
    if (reacted) return { kind: 'friend_created', user: reacted.user }
    const commented = (friendCommentsByEvent.get(eventId) ?? []).find(c => c.authorId === authorId)
    if (commented) return { kind: 'friend_created', user: commented.author }
    // autor é seguido mas não há interação registrada no take — fallback seguro
    return { kind: 'friend_created', user: { id: authorId, name: '', lastname: '', username: '' } }
  }

  const attending = friendAttendances[0]
  if (attending) return { kind: 'friend_attending', user: attending.user, type: attending.type }

  const reactions = friendReactionsByEvent.get(eventId) ?? []
  if (reactions[0]) return { kind: 'friend_reacted', user: reactions[0].user, type: reactions[0].type }

  const comments = friendCommentsByEvent.get(eventId) ?? []
  if (comments[0]) return { kind: 'friend_commented', user: comments[0].author, preview: comments[0].content.slice(0, 80) }

  return { kind: 'self_interaction' }
}

export async function findFeedEvents(
  viewerId: string,
  followingIds: string[],
  limit: number,
  cursor?: string,
) {
  const events = await prisma.event.findMany({
    where: {
      AND: [
        {
          OR: [
            { authorId: { in: [...followingIds, viewerId] } },
            { attendances: { some: { userId: { in: followingIds } } } },
            { reactions: { some: { userId: { in: followingIds } } } },
            { comments: { some: { authorId: { in: followingIds } } } },
          ],
        },
        {
          OR: [
            { isPublic: true },
            { authorId: viewerId },
            { invites: { some: { invitedId: viewerId } } },
          ],
        },
      ],
    },
    take: limit,
    ...(cursor && { skip: 1, cursor: { id: cursor } }),
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: authorSelect },
      attendances: {
        where: { userId: { in: followingIds } },
        include: { user: { select: authorSelect } },
        orderBy: { createdAt: 'desc' as const },
        take: 3,
      },
      reactions: {
        where: { userId: viewerId },
        select: { type: true },
        take: 1,
      },
      comments: {
        orderBy: { createdAt: 'desc' as const },
        take: 2,
        include: { author: { select: authorSelect } },
      },
      _count: {
        select: { attendances: true, comments: true, reactions: true },
      },
    },
  })

  if (events.length === 0) return []

  const eventIds = events.map(e => e.id)

  const [viewerAttendances, friendReactions, friendComments] = await Promise.all([
    prisma.eventAttendance.findMany({
      where: { eventId: { in: eventIds }, userId: viewerId },
      select: { eventId: true, type: true },
    }),
    followingIds.length > 0
      ? prisma.reaction.findMany({
          where: { eventId: { in: eventIds }, userId: { in: followingIds } },
          include: { user: { select: authorSelect } },
          orderBy: { createdAt: 'desc' as const },
          take: followingIds.length * eventIds.length,
        })
      : Promise.resolve([]),
    followingIds.length > 0
      ? prisma.comment.findMany({
          where: { eventId: { in: eventIds }, authorId: { in: followingIds } },
          include: { author: { select: authorSelect } },
          orderBy: { createdAt: 'desc' as const },
          take: followingIds.length * eventIds.length,
        })
      : Promise.resolve([]),
  ])

  const viewerAttendanceMap = new Map(viewerAttendances.map(a => [a.eventId, a.type]))

  const friendReactionsByEvent = new Map<string, typeof friendReactions>()
  for (const r of friendReactions) {
    if (!r.eventId) continue
    const list = friendReactionsByEvent.get(r.eventId) ?? []
    list.push(r)
    friendReactionsByEvent.set(r.eventId, list)
  }

  const friendCommentsByEvent = new Map<string, typeof friendComments>()
  for (const c of friendComments) {
    if (!c.eventId) continue
    const list = friendCommentsByEvent.get(c.eventId) ?? []
    list.push(c)
    friendCommentsByEvent.set(c.eventId, list)
  }

  return events.map(event => {
    type R = { type: string }
    type CommentFull = { id: string; content: string; createdAt: Date; author: FeedUser }

    const e = event as typeof event & { reactions: R[]; comments: CommentFull[] }

    const userAttendance = viewerAttendanceMap.get(event.id) ?? null
    const userReaction = e.reactions.length ? e.reactions[0].type : null

    const friendAttendances = e.attendances as unknown as { userId: string; type: string; user: FeedUser }[]

    const reason = resolveReason(
      event.id,
      event.authorId,
      viewerId,
      followingIds,
      userAttendance,
      userReaction,
      friendAttendances,
      friendReactionsByEvent as unknown as Map<string, { userId: string; type: string; user: FeedUser }[]>,
      friendCommentsByEvent as unknown as Map<string, { authorId: string; content: string; author: FeedUser }[]>,
    )

    const { reactions, attendances, comments, ...rest } = e

    return {
      ...rest,
      friendAttendances: friendAttendances.map(a => ({ user: a.user })),
      recentComments: comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
      })),
      userReaction,
      userAttendance,
      reason,
    }
  })
}

export async function findFollowingIds(userId: string) {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  })
  return follows.map((f) => f.followingId)
}
