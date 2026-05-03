import { cache } from '../../lib/cache'
import { findFeedEvents, findFollowingIds } from './feed.repository'

export async function getFeed(userId: string, limit: number, cursor?: string) {
  const cacheKey = cache.key('feed', userId, limit, cursor)
  const cached =
    await cache.get<Awaited<ReturnType<typeof buildFeedResult>>>(cacheKey)
  if (cached) return cached

  const result = await buildFeedResult(userId, limit, cursor)
  await cache.set(cacheKey, result, 60)

  return result
}

async function buildFeedResult(userId: string, limit: number, cursor?: string) {
  const followingIds = await findFollowingIds(userId)
  const events = await findFeedEvents(userId, followingIds, limit, cursor)
  const nextCursor =
    events.length === limit ? events[events.length - 1].id : null
  return { data: events, nextCursor }
}
