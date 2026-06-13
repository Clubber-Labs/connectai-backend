import type { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import {
  login,
  postMfaDisable,
  postMfaEnable,
  postMfaSetup,
} from './auth.controller'
import { loginBodySchema, mfaCodeSchema } from './auth.schema'

export async function authRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.post(
    '/auth/login',
    {
      schema: { body: loginBodySchema },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    login,
  )

  // ── MFA (TOTP) — todas autenticadas (a conta já logada gerencia o próprio MFA)
  api.post('/auth/mfa/setup', { onRequest: [app.authenticate] }, postMfaSetup)

  api.post(
    '/auth/mfa/enable',
    { schema: { body: mfaCodeSchema }, onRequest: [app.authenticate] },
    postMfaEnable,
  )

  api.post(
    '/auth/mfa/disable',
    { schema: { body: mfaCodeSchema }, onRequest: [app.authenticate] },
    postMfaDisable,
  )
}
