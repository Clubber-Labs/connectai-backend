import type { FastifyReply, FastifyRequest } from 'fastify'
import { resolveLocale } from '../../lib/event-categories'
import { listCategoriesWithSubcategories } from '../../lib/subcategories'

export async function getCategories(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const locale = resolveLocale(request.headers['accept-language'])
  // Duas camadas: cada categoria leva suas subcategorias aninhadas (rotuladas).
  return reply.send({ locale, data: listCategoriesWithSubcategories(locale) })
}
