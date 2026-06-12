import Stripe from 'stripe'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { stripe } from '../../lib/stripe'
import { makeSubscription, makeUser } from '../../test/factories'
import { testPrisma } from '../../test/prisma'
import { reconcileStaleSubscriptions } from './billing-sync.reconciler'

// O sync re-consulta o Stripe (fonte de verdade) — mock do singleton, sem
// rede em teste. `retrieve` é o único método usado pelo reconciler.
vi.mock('../../lib/stripe', () => ({
  STRIPE_API_VERSION: 'test',
  stripe: { subscriptions: { retrieve: vi.fn() } },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

const GRACE_MS = 6 * 3600_000

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000)
}

function stripeSubscriptionPayload(opts: {
  id: string
  status?: string
  periodEndSec?: number
  canceledAtSec?: number | null
}) {
  const nowSec = Math.floor(Date.now() / 1000)
  return {
    id: opts.id,
    customer: 'cus_sync',
    status: opts.status ?? 'active',
    items: {
      data: [
        {
          price: { id: 'price_test' },
          current_period_start: nowSec - 86_400,
          current_period_end: opts.periodEndSec ?? nowSec + 30 * 86_400,
        },
      ],
    },
    cancel_at_period_end: false,
    canceled_at: opts.canceledAtSec ?? null,
  }
}

describe('reconcileStaleSubscriptions', () => {
  it('webhook de cancelamento perdido: rebaixa pela verdade do Stripe', async () => {
    const user = await makeUser({ isPremium: true })
    const sub = await makeSubscription(user.id, {
      status: 'ACTIVE',
      currentPeriodEnd: hoursAgo(48),
    })
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
      stripeSubscriptionPayload({
        id: sub.stripeSubscriptionId,
        status: 'canceled',
        periodEndSec: Math.floor(hoursAgo(48).getTime() / 1000),
        canceledAtSec: Math.floor(hoursAgo(47).getTime() / 1000),
      }) as never,
    )

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result).toMatchObject({ due: 1, synced: 1, failed: 0 })
    const reloaded = await testPrisma.subscription.findUnique({
      where: { id: sub.id },
    })
    expect(reloaded?.status).toBe('CANCELED')
    expect(
      (await testPrisma.user.findUnique({ where: { id: user.id } }))?.isPremium,
    ).toBe(false)
  })

  it('webhook de renovação perdido: atualiza o período e mantém premium', async () => {
    const user = await makeUser({ isPremium: true })
    const sub = await makeSubscription(user.id, {
      status: 'ACTIVE',
      currentPeriodEnd: hoursAgo(24),
    })
    vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue(
      stripeSubscriptionPayload({
        id: sub.stripeSubscriptionId,
        status: 'active',
      }) as never,
    )

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result.synced).toBe(1)
    const reloaded = await testPrisma.subscription.findUnique({
      where: { id: sub.id },
    })
    expect(reloaded?.status).toBe('ACTIVE')
    // Período renovado: sai do WHERE — o próximo tick não a toca de novo.
    expect(reloaded?.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now())
    expect(
      (await testPrisma.user.findUnique({ where: { id: user.id } }))?.isPremium,
    ).toBe(true)
  })

  it('respeita a tolerância: vencida há menos que o grace não é tocada', async () => {
    const user = await makeUser({ isPremium: true })
    await makeSubscription(user.id, {
      status: 'ACTIVE',
      currentPeriodEnd: hoursAgo(1), // < 6h de grace — renovação em andamento
    })

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result.due).toBe(0)
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })

  it('resource_missing (subscription sumiu do gateway): cancela localmente', async () => {
    const user = await makeUser({ isPremium: true })
    const sub = await makeSubscription(user.id, {
      status: 'TRIALING',
      currentPeriodEnd: hoursAgo(12),
    })
    vi.mocked(stripe.subscriptions.retrieve).mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        message: 'No such subscription',
        code: 'resource_missing',
        // biome-ignore lint/suspicious/noExplicitAny: construtor raw do SDK
      } as any),
    )

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result.synced).toBe(1)
    const reloaded = await testPrisma.subscription.findUnique({
      where: { id: sub.id },
    })
    expect(reloaded?.status).toBe('CANCELED')
    expect(
      (await testPrisma.user.findUnique({ where: { id: user.id } }))?.isPremium,
    ).toBe(false)
  })

  it('falha em uma subscription não derruba o lote', async () => {
    const userA = await makeUser({ isPremium: true })
    const userB = await makeUser({ isPremium: true })
    // A é mais antiga (orderBy currentPeriodEnd asc) — falha primeiro.
    await makeSubscription(userA.id, {
      status: 'ACTIVE',
      currentPeriodEnd: hoursAgo(72),
    })
    const subB = await makeSubscription(userB.id, {
      status: 'ACTIVE',
      currentPeriodEnd: hoursAgo(48),
    })
    vi.mocked(stripe.subscriptions.retrieve)
      .mockRejectedValueOnce(
        new Stripe.errors.StripeAPIError({
          message: 'stripe down',
          // biome-ignore lint/suspicious/noExplicitAny: construtor raw do SDK
        } as any),
      )
      .mockResolvedValueOnce(
        stripeSubscriptionPayload({
          id: subB.stripeSubscriptionId,
          status: 'canceled',
          periodEndSec: Math.floor(hoursAgo(48).getTime() / 1000),
        }) as never,
      )

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result).toMatchObject({ due: 2, synced: 1, failed: 1 })
    // A intocada (retry no próximo tick); B rebaixada.
    expect(
      (await testPrisma.user.findUnique({ where: { id: userA.id } }))
        ?.isPremium,
    ).toBe(true)
    expect(
      (await testPrisma.user.findUnique({ where: { id: userB.id } }))
        ?.isPremium,
    ).toBe(false)
  })

  it('não toca status que não entregam valor (CANCELED não re-sincroniza)', async () => {
    const user = await makeUser({ isPremium: false })
    await makeSubscription(user.id, {
      status: 'CANCELED',
      currentPeriodEnd: hoursAgo(100),
    })

    const result = await reconcileStaleSubscriptions(GRACE_MS)

    expect(result.due).toBe(0)
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled()
  })
})
