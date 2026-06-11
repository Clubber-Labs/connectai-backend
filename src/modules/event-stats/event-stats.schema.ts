import { z } from 'zod'

export const eventStatsParamsSchema = z.object({
  id: z.uuid(),
})

export type EventStatsParams = z.infer<typeof eventStatsParamsSchema>

export type EventStatsTotals = {
  interested: number
  confirmed: number
  notInterested: number
  reactions: number
  comments: number
  posts: number
  invitesSent: number
}

// Delta diário (não cumulativo); dias sem registro são omitidos. Como
// attendance é upsert (1 linha por user+evento), quem mudou de INTERESTED
// para CONFIRMED aparece uma única vez, no createdAt original, com o tipo
// atual — a timeline é um proxy de evolução, não um funil de transições.
export type EventStatsTimelinePoint = {
  date: string
  interested: number
  confirmed: number
}

export type EventStats = {
  eventId: string
  totals: EventStatsTotals
  // confirmed / (interested + confirmed); null quando não há base.
  confirmationRate: number | null
  timeline: EventStatsTimelinePoint[]
}
