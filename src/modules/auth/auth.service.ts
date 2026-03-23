import bcrypt from 'bcrypt'
import { createUser, findUserByEmail, findUserById } from './auth.repository'
import type { LoginBody, RegisterBody } from './auth.schema'

export async function registerUser(data: RegisterBody) {
  const existing = await findUserByEmail(data.email)
  if (existing) {
    throw { statusCode: 409, message: 'Email already in use' }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10)

  return createUser({ ...data, password: hashedPassword })
}

export async function validateLogin(data: LoginBody) {
  const user = await findUserByEmail(data.email)
  if (!user) {
    throw { statusCode: 401, message: 'Invalid credentials' }
  }

  const valid = await bcrypt.compare(data.password, user.password)
  if (!valid) {
    throw { statusCode: 401, message: 'Invalid credentials' }
  }

  return user
}

export async function getAuthenticatedUser(id: string) {
  const user = await findUserById(id)
  if (!user) {
    throw { statusCode: 404, message: 'User not found' }
  }

  return user
}
