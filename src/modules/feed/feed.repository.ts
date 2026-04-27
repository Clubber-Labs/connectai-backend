import { prisma } from '../../lib/prisma'

const authorSelect = {
  id: true,
  name: true,
  lastname: true,
  username: true,
} as const

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
        orderBy: { createdAt: 'desc' },
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
  const viewerAttendances = await prisma.eventAttendance.findMany({
    where: { eventId: { in: eventIds }, userId: viewerId },
    select: { eventId: true, type: true },
  })
  const viewerAttendanceMap = new Map(viewerAttendances.map(a => [a.eventId, a.type]))

  return events.map(event => {
    const { reactions, attendances, comments, ...rest } = event as typeof event & {
      reactions: { type: string }[]
    }

    type AttendanceWithUser = { user: { id: string; name: string; lastname: string; username: string } }
    const friendAttendances = attendances as unknown as AttendanceWithUser[]

    return {
      ...rest,
      friendAttendances,
      recentComments: comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: c.author,
      })),
      userReaction: reactions.length ? reactions[0].type : null,
      userAttendance: viewerAttendanceMap.get(event.id) ?? null,
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
