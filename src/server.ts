import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { usersRoutes } from './modules/users/users.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { eventsRoutes } from './modules/events/events.routes'

const app = Fastify({ logger: true })

async function bootstrap() {
  await app.register(cors, { origin: true })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await app.register(multipart)

  await app.register(swagger, {
    openapi: {
      info: { title: 'ConnectAI API', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  })

  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(usersRoutes, { prefix: '/users' })
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(eventsRoutes, { prefix: '/events' })

  const port = Number(process.env.PORT) || 3333
  await app.listen({ port, host: '0.0.0.0' })
}

bootstrap()
