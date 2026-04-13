import { z } from 'zod'

export const followUserSchema = z.object({
  followingId: z.string().uuid('ID do usuário a seguir inválido'),
})

export type FollowUserBody = z.infer<typeof followUserSchema>

export const followResponseSchema = z.object({
  id: z.string(),
  followerId: z.string(),
  followingId: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED']),
  createdAt: z.date(),
})

export type FollowResponse = z.infer<typeof followResponseSchema>

export const followUserIdParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
})

export type FollowUserIdParam = z.infer<typeof followUserIdParamSchema>

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().uuid().optional(),
})

export type PaginationQuery = z.infer<typeof paginationSchema>

export const followActionSchema = z.object({
  followerId: z.string().uuid('ID do seguidor inválido'),
})

export type FollowActionBody = z.infer<typeof followActionSchema>
