import type { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import {
  getAuditLogsHandler,
  getStatsHandler,
  getUserAuditLogsHandler,
} from './admin-consent.controller'
import {
  adminConsentAuditQuerySchema,
  adminConsentAuditResponseSchema,
  adminConsentStatsSchema,
  adminConsentUserParamSchema,
} from './admin-consent.schema'

export async function adminConsentRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.get(
    '/admin/consent/audit',
    {
      schema: {
        querystring: adminConsentAuditQuerySchema,
        response: { 200: adminConsentAuditResponseSchema },
      },
      onRequest: [app.authenticate],
    },
    getAuditLogsHandler,
  )

  api.get(
    '/admin/consent/audit/:userId',
    {
      schema: {
        params: adminConsentUserParamSchema,
        querystring: adminConsentAuditQuerySchema.omit({ userId: true }),
        response: { 200: adminConsentAuditResponseSchema },
      },
      onRequest: [app.authenticate],
    },
    getUserAuditLogsHandler,
  )

  api.get(
    '/admin/consent/stats',
    {
      schema: { response: { 200: adminConsentStatsSchema } },
      onRequest: [app.authenticate],
    },
    getStatsHandler,
  )
}
