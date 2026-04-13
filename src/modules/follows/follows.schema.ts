import { z } from 'zod'

export const followParamSchema = z.object({
  userId: z.uuid('ID inválido'),
})

export type FollowParam = z.infer<typeof followParamSchema>

export const followRequestParamSchema = z.object({
  followerId: z.uuid('ID inválido'),
})

export type FollowRequestParam = z.infer<typeof followRequestParamSchema>

export const followerIdParamSchema = z.object({
  followerId: z.uuid('ID do seguidor inválido'),
})

export type FollowerIdParam = z.infer<typeof followerIdParamSchema>

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.uuid().optional(),
})

export type PaginationQuery = z.infer<typeof paginationSchema>
