import { prisma } from '../../lib/prisma'

// A coluna é String no schema (sem enum de banco — não vale uma migration);
// o union na camada TS impede typo silencioso ('pending' não compila).
export type PushTicketStatus = 'PENDING' | 'OK' | 'ERROR'

export type NewPushTicket = {
  deviceTokenId: string
  receiptId?: string | null
  status: PushTicketStatus
  error?: string | null
}

export async function createPushTickets(tickets: NewPushTicket[]) {
  if (tickets.length === 0) return 0
  const result = await prisma.pushTicket.createMany({ data: tickets })
  return result.count
}

/**
 * Tickets PENDING com receiptId, criados antes do corte (maduros para checar o
 * receipt). Limitado para o reconciler processar em lotes.
 */
export async function findPendingReceipts(cutoff: Date, limit: number) {
  return prisma.pushTicket.findMany({
    where: {
      status: 'PENDING',
      receiptId: { not: null },
      createdAt: { lt: cutoff },
    },
    select: { id: true, receiptId: true, deviceTokenId: true },
    take: limit,
  })
}

/**
 * Atualiza o status de VÁRIOS tickets de uma vez (1 UPDATE por grupo, não por
 * ticket — o reconciler processa lotes de até 1000).
 */
export async function updatePushTicketsStatus(
  ids: string[],
  status: PushTicketStatus,
  error?: string | null,
) {
  if (ids.length === 0) return 0
  const result = await prisma.pushTicket.updateMany({
    where: { id: { in: ids } },
    data: { status, error: error ?? null },
  })
  return result.count
}

/** Expurgo de tickets antigos (já reconciliados ou obsoletos). */
export async function deletePushTicketsOlderThan(cutoff: Date) {
  const result = await prisma.pushTicket.deleteMany({
    where: { createdAt: { lt: cutoff } },
  })
  return result.count
}
