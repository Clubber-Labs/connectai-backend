import { randomBytes, randomUUID } from 'node:crypto'
import type { SocialProvider } from '@prisma/client'
import {
  findUserByEmail,
  findUserById,
  findUserByUsername,
} from '../users/users.repository'
import { verifyFacebookToken, verifyGoogleToken } from './social-auth.providers'
import {
  createSocialAccount,
  createUserWithSocialAccount,
  findSocialAccount,
} from './social-auth.repository'
import type {
  SocialLoginBody,
  VerifiedSocialProfile,
} from './social-auth.schema'

async function verifyTokenByProvider(
  provider: SocialLoginBody['provider'],
  token: string,
): Promise<VerifiedSocialProfile> {
  if (provider === 'google') return verifyGoogleToken(token)
  return verifyFacebookToken(token)
}

function sanitizeUsernameBase(email: string) {
  const localPart = email.split('@')[0] ?? ''
  const slug = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (slug.length >= 4) return slug.slice(0, 20)
  return `${slug}_user`.slice(0, 20)
}

async function generateUniqueUsername(email: string) {
  const base = sanitizeUsernameBase(email)
  if (!(await findUserByUsername(base))) return base

  for (let i = 0; i < 5; i++) {
    const candidate = `${base}_${randomBytes(3).toString('hex')}`.slice(0, 25)
    if (!(await findUserByUsername(candidate))) return candidate
  }

  return `${base}_${randomUUID().slice(0, 8)}`.slice(0, 25)
}

async function loadUserAndDecorate(userId: string) {
  const user = await findUserById(userId)
  if (!user) {
    throw {
      statusCode: 500,
      message: 'Usuário não encontrado após autenticação social',
    }
  }
  const profileIncomplete = !user.phone || !user.birthdate
  return { user, profileIncomplete }
}

export async function socialLogin(body: SocialLoginBody) {
  const profile = await verifyTokenByProvider(body.provider, body.token)

  if (!profile.email) {
    throw { statusCode: 400, message: 'Permissão de email é obrigatória' }
  }
  if (!profile.emailVerified) {
    throw { statusCode: 400, message: 'Email não verificado pelo provider' }
  }

  const existing = await findSocialAccount(
    profile.provider,
    profile.providerUserId,
  )
  if (existing) {
    return loadUserAndDecorate(existing.userId)
  }

  const linkable = await findUserByEmail(profile.email)
  if (linkable) {
    await createSocialAccount({
      userId: linkable.id,
      provider: profile.provider as SocialProvider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    })
    return loadUserAndDecorate(linkable.id)
  }

  const username = await generateUniqueUsername(profile.email)
  const created = await createUserWithSocialAccount({
    user: {
      name: profile.firstName?.trim() || 'Usuário',
      lastname: profile.lastName?.trim() || 'Social',
      username,
      email: profile.email,
      avatarUrl: profile.pictureUrl,
    },
    social: {
      provider: profile.provider as SocialProvider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    },
  })

  return loadUserAndDecorate(created.id)
}
