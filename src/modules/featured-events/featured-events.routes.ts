import type { FastifyInstance } from 'fastify'
import { requirePremium } from '../../lib/require-premium'
import {
  deleteFeaturedEvent,
  postFeaturedEvent,
} from './featured-events.controller'
import {
  createFeaturedEventBodySchema,
  featuredEventFeatureParamsSchema,
  featuredEventParamsSchema,
} from './featured-events.schema'

export async function featuredEventsRoutes(app: FastifyInstance) {
  app.post(
    '/events/:id/featured',
    {
      schema: {
        params: featuredEventParamsSchema,
        body: createFeaturedEventBodySchema,
      },
      // requirePremium = defesa em profundidade (o service já checa
      // event.author.isPremium). DELETE não exige premium (quem fez downgrade
      // ainda cancela o destaque que criou).
      onRequest: [app.authenticate, requirePremium],
    },
    postFeaturedEvent,
  )

  app.delete(
    '/events/:id/featured/:featureId',
    {
      schema: { params: featuredEventFeatureParamsSchema },
      onRequest: [app.authenticate],
    },
    deleteFeaturedEvent,
  )
}
