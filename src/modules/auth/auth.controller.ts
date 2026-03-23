import type { FastifyReply, FastifyRequest } from 'fastify'
import type { LoginBody, RegisterBody } from './auth.schema'
import {
  getAuthenticatedUser,
  registerUser,
  validateLogin,
} from './auth.service'

export async function register(
  request: FastifyRequest<{ Body: RegisterBody }>,
  reply: FastifyReply,
) {
  const user = await registerUser(request.body)
  return reply.status(201).send(user)
}

export async function login(
  request: FastifyRequest<{ Body: LoginBody }>,
  reply: FastifyReply,
) {
  const user = await validateLogin(request.body)
  const token = await reply.jwtSign({ sub: user.id })
  return reply.send({ token })
}

export async function me(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(request.user.sub)
  return reply.send(user)
}
