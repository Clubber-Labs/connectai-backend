import type { Prisma, SubscriptionStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma'

type TxClient = Prisma.TransactionClient

const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE']

/**
 * Subscription "ativa" do user — status que entrega valor (com isPremium=true).
 * Quando há histórico (canceladas + nova ativa), retorna a mais recente por startedAt.
 */
export async function findActiveSubscriptionByUserId(userId: string) {
  return prisma.subscription.findFirst({
    where: { userId, status: { in: ACTIVE_STATUSES } },
    orderBy: { startedAt: 'desc' },
  })
}

/**
 * True se o usuário já teve qualquer subscription (ativa, expirada, cancelada).
 * Usado pra decidir se concede trial novo (não concede se já teve).
 * Mitigação parcial de trial abuse — ver "Trial abuse" no plano.
 */
export async function hasAnyPreviousSubscription(userId: string) {
  const count = await prisma.subscription.count({ where: { userId } })
  return count > 0
}

/** Busca o user por id (camada de billing — service não toca Prisma). */
export async function findUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } })
}

/**
 * Fonte de verdade de leitura do estado premium. O billing é dono do conceito
 * (escreve via recalculateUserPremiumTx); consumidores de fora — o middleware
 * requirePremium e o módulo spots — leem por aqui em vez de reimplementar a
 * query contra a coluna. Se "premium" passar a depender de mais de um sinal,
 * muda só neste ponto.
 */
export async function findUserIsPremium(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true },
  })
  return user?.isPremium ?? false
}

/** Vincula o Customer do Stripe ao user. */
export async function updateUserStripeCustomerId(
  userId: string,
  stripeCustomerId: string,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  })
}

/** Marca/desmarca o cancelamento ao fim do período numa subscription local. */
export async function setSubscriptionCancelAtPeriodEnd(
  id: string,
  cancelAtPeriodEnd: boolean,
) {
  return prisma.subscription.update({
    where: { id },
    data: { cancelAtPeriodEnd },
  })
}

/**
 * Reads tx-aware usados pelo handler do webhook dentro da $transaction.
 * Mantêm o Prisma confinado ao repository mesmo no caminho transacional — o
 * webhook orquestra, mas não toca o client direto.
 */
export async function findUserIdByStripeCustomerIdTx(
  tx: TxClient,
  stripeCustomerId: string,
) {
  const user = await tx.user.findUnique({
    where: { stripeCustomerId },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function findSubscriptionByStripeIdTx(
  tx: TxClient,
  stripeSubscriptionId: string,
) {
  return tx.subscription.findUnique({ where: { stripeSubscriptionId } })
}

export async function isEventProcessed(stripeEventId: string) {
  const row = await prisma.webhookEvent.findUnique({
    where: { stripeEventId },
    select: { id: true },
  })
  return row !== null
}

/**
 * Insere o evento como "processado". Deve rodar dentro da $transaction
 * do handler do webhook. Se duplicado, lança P2002 — o caller captura e
 * retorna 200 silencioso (idempotência via constraint do DB).
 */
export async function markEventProcessedTx(
  tx: TxClient,
  data: {
    stripeEventId: string
    type: string
    payload: Prisma.InputJsonValue
  },
) {
  return tx.webhookEvent.create({ data })
}

/**
 * Recalcula User.isPremium baseado em TODAS as subscriptions do user.
 * Necessário porque o schema permite múltiplas subscriptions (histórico
 * de canceladas + nova ativa), e atualizar isPremium a partir de UM
 * evento isolado deixa o estado incorreto quando outra subscription
 * ainda está ativa.
 *
 * isPremium = true se existe pelo menos uma subscription com status em
 * (TRIALING, ACTIVE, PAST_DUE).
 */
export async function recalculateUserPremiumTx(tx: TxClient, userId: string) {
  const activeCount = await tx.subscription.count({
    where: {
      userId,
      status: { in: ACTIVE_STATUSES },
    },
  })
  return tx.user.update({
    where: { id: userId },
    data: { isPremium: activeCount > 0 },
  })
}

type UpsertSubscriptionInput = {
  userId: string
  stripeSubscriptionId: string
  stripePriceId: string
  status: SubscriptionStatus
  trialEndsAt: Date | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
  lastSyncedAt: Date
}

export async function upsertSubscriptionTx(
  tx: TxClient,
  data: UpsertSubscriptionInput,
) {
  return tx.subscription.upsert({
    where: { stripeSubscriptionId: data.stripeSubscriptionId },
    create: data,
    update: {
      stripePriceId: data.stripePriceId,
      status: data.status,
      trialEndsAt: data.trialEndsAt,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      canceledAt: data.canceledAt,
      lastSyncedAt: data.lastSyncedAt,
    },
  })
}
