import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export async function findEventForStats(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      authorId: true,
      author: { select: { isPremium: true } },
    },
  })
}

export async function countAttendanceByType(eventId: string) {
  return prisma.eventAttendance.groupBy({
    by: ['type'],
    where: { eventId },
    _count: { _all: true },
  })
}

export async function countEngagement(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      _count: {
        select: { reactions: true, comments: true, posts: true, invites: true },
      },
    },
  })
  return event._count
}

export type AttendanceTimelineRow = {
  day: Date
  type: 'INTERESTED' | 'CONFIRMED'
  count: number
}

// Coberto por @@index([eventId, createdAt]) de event_attendances.
export async function findAttendanceTimeline(eventId: string) {
  return prisma.$queryRaw<AttendanceTimelineRow[]>(Prisma.sql`
    SELECT
      DATE_TRUNC('day', a."createdAt")::date AS day,
      a.type::text AS type,
      COUNT(*)::int AS count
    FROM event_attendances a
    WHERE a."eventId" = ${eventId}
      AND a.type IN ('INTERESTED', 'CONFIRMED')
    GROUP BY 1, 2
    ORDER BY 1
  `)
}
