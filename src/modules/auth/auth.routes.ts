import type { FastifyInstance } from 'fastify'
import { login, me, register } from './auth.controller'
import { loginBodySchema, registerBodySchema } from './auth.schema'

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', { schema: { body: registerBodySchema } }, register)

  app.post('/auth/login', { schema: { body: loginBodySchema } }, login)

  app.get('/auth/me', { onRequest: [app.authenticate] }, me)
}
