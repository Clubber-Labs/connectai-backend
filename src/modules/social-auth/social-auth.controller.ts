import type { FastifyReply, FastifyRequest } from 'fastify'
import type { SocialLoginBody } from './social-auth.schema'
import { socialLogin } from './social-auth.service'

export async function postSocialLogin(
  request: FastifyRequest<{ Body: SocialLoginBody }>,
  reply: FastifyReply,
) {
  const { user, profileIncomplete } = await socialLogin(request.body)
  const token = await reply.jwtSign({ sub: user.id })
  request.log.info(`User ${user.id} logged in with social provider ${request.body.provider}`)
  return reply.send({ token, user, profileIncomplete })
}
