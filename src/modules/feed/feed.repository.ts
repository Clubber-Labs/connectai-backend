import { prisma } from '../../lib/prisma'

const authorSelect = {
  id: true,
  name: true,
  lastname: true,
  username: true,
} as const

export async function findFeedEvents(
  followingIds: string[],
  limit: number,
  cursor?: string,
) {
  return prisma.event.findMany({
    where: {
      OR: [
        // Eventos criados por quem você segue
        { authorId: { in: followingIds } },
        // Eventos em que alguém que você segue confirmou presença ou interesse
        {
          attendances: {
            some: { userId: { in: followingIds } },
          },
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
        take: 3,
      },
      _count: {
        select: { attendances: true, comments: true, reactions: true },
      },
    },
  })
}

export async function findFollowingIds(userId: string) {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  })
  return follows.map((f) => f.followingId)
}
