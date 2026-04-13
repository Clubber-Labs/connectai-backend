import type { FastifyInstance } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import {
  deleteUserHandler,
  getUser,
  getUsers,
  postUser,
  putUser,
} from './users.controller'
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from './users.schema'

export async function usersRoutes(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const api = app.withTypeProvider<ZodTypeProvider>()

  api.get('/users', getUsers)

  api.get('/users/:id', { schema: { params: userIdParamSchema } }, getUser)

  api.post('/users', { schema: { body: createUserSchema } }, postUser)

  api.put(
    '/users/:id',
    { schema: { params: userIdParamSchema, body: updateUserSchema } },
    putUser,
  )

  api.delete(
    '/users/:id',
    { schema: { params: userIdParamSchema } },
    deleteUserHandler,
  )
}
