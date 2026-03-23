import { prisma } from '../../lib/prisma'
import type { RegisterBody } from './auth.schema'

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, bio: true, avatarUrl: true },
  })
}

export async function createUser(data: RegisterBody) {
  return prisma.user.create({
    data,
    select: { id: true, name: true, email: true, createdAt: true },
  })
}
