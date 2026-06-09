import { prisma } from '../../lib/prisma'

export async function findUserByEmailForReset(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, accountStatus: true },
  })
}

/** Código vigente do usuário: não usado e não expirado, mais recente primeiro. */
export async function findActiveCodeByUser(userId: string) {
  return prisma.passwordResetCode.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Apaga os códigos não usados do usuário e cria o novo — atomicamente, para não
 * deixar o usuário sem código ativo se a criação falhar. Só um código ativo por vez.
 */
export async function replacePriorCodes(
  userId: string,
  codeHash: string,
  expiresAt: Date,
) {
  return prisma.$transaction([
    prisma.passwordResetCode.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetCode.create({ data: { userId, codeHash, expiresAt } }),
  ])
}

export async function incrementAttempts(id: string) {
  return prisma.passwordResetCode.update({
    where: { id },
    data: { attempts: { increment: 1 } },
  })
}

/**
 * Consome o código e troca a senha numa única transação. O update do código é
 * condicional a `usedAt: null` (guarda de uso único): se duas requisições
 * concorrerem com o mesmo código, só a primeira casa o WHERE — a segunda recebe
 * count 0 e retorna false (sem trocar a senha duas vezes). Fecha o TOCTOU entre
 * o compare e o markCodeUsed.
 */
export async function consumeCodeAndSetPassword(
  codeId: string,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetCode.updateMany({
      where: { id: codeId, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (consumed.count === 0) return false
    await tx.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    })
    return true
  })
}

/** Expurgo de retenção (LGPD): remove códigos já usados ou expirados. */
export async function deleteExpiredAndUsedCodes(now: Date = new Date()) {
  return prisma.passwordResetCode.deleteMany({
    where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
  })
}
