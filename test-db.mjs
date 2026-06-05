import { createRequire } from 'module'
const require = createRequire(import.meta.url)
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/conectai_test'
const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@6.19.2_prism_6b2b1af085fe6797f5a5ea830937a8e3/node_modules/@prisma/client/index.js')
const p = new PrismaClient()
try {
  const r = await p.$queryRaw`SELECT current_database()`
  console.log('DB OK:', JSON.stringify(r))
} catch (e) {
  console.error('DB ERROR:', e.message)
} finally {
  await p.$disconnect()
}
