import {
  DEFAULT_RANK_WEIGHTS,
  rankEvent,
  type RankReason,
} from '../../lib/event-ranker'
import {
  findFeedCandidates,
  findFollowingIds,
  findUserPreferredCategories,
} from './feed.repository'
import type { FeedQuery } from './feed.schema'

const CANDIDATE_MULTIPLIER = 3
const CANDIDATE_CAP = 100

export async function getFeed(userId: string, query: FeedQuery) {
  const now = new Date()

  const [followingIds, preferredCategories] = await Promise.all([
    findFollowingIds(userId),
    findUserPreferredCategories(userId),
  ])

  const take = Math.min(query.limit * CANDIDATE_MULTIPLIER, CANDIDATE_CAP)
  const candidates = await findFeedCandidates(userId, followingIds, query, take)

  const scored = candidates
    .map((event) => ({
      event,
      score: rankEvent(
        event,
        {
          preferredCategories,
          reason: { kind: event.reason.kind } as RankReason,
          counts: event._count,
        },
        DEFAULT_RANK_WEIGHTS,
        now,
      ),
    }))
    .sort((a, b) => b.score - a.score)

  let startIndex = 0
  if (query.cursor) {
    const cursorIdx = scored.findIndex((s) => s.event.id === query.cursor)
    if (cursorIdx === -1) {
      return { data: [], nextCursor: null }
    }
    startIndex = cursorIdx + 1
  }
  const page = scored.slice(startIndex, startIndex + query.limit)
  const data = page.map((s) => s.event)
  const nextCursor =
    page.length === query.limit ? data[data.length - 1].id : null

  return { data, nextCursor }
}
