import type { FastifyInstance } from 'fastify'
import fastifyRawBody from 'fastify-raw-body'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import {
  getSubscriptionHandler,
  postCancel,
  postCheckout,
  postPaymentMethod,
  postResume,
  postWebhook,
} from './billing.controller'
import { createCheckoutBodySchema } from './billing.schema'

/**
 * Rotas autenticadas — body parsing JSON normal.
 */
export async function billingRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.post(
    '/billing/checkout',
    {
      schema: { body: createCheckoutBodySchema },
      onRequest: [app.authenticate],
      // Cria Stripe Customer + Checkout Session — chamadas externas pagas.
      // 10/min por chave (IP por default) é generoso pra UX legítima
      // (user retentando após erro) e bloqueia abuse.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    postCheckout,
  )

  api.get(
    '/billing/subscription',
    { onRequest: [app.authenticate] },
    getSubscriptionHandler,
  )

  api.post('/billing/cancel', { onRequest: [app.authenticate] }, postCancel)

  api.post('/billing/resume', { onRequest: [app.authenticate] }, postResume)

  api.post(
    '/billing/payment-method',
    { onRequest: [app.authenticate] },
    postPaymentMethod,
  )
}

/**
 * Rota do webhook — registrada em plugin escopado para ativar raw body
 * APENAS nela (resto do app continua com parser JSON). Sem auth — proteção
 * é via verificação de assinatura HMAC do Stripe.
 */
export async function billingWebhookRoutes(app: FastifyInstance) {
  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
  })

  app.post(
    '/webhooks/stripe',
    {
      config: {
        rawBody: true,
        // Stripe envia tipicamente <10 req/s pra um único endpoint.
        // 200/min cobre picos legítimos com folga e bloqueia flood:
        // requisições inválidas ainda gastariam CPU verificando signature.
        rateLimit: { max: 200, timeWindow: '1 minute' },
      },
    },
    postWebhook,
  )
}
