import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

<<<<<<< HEAD
export const prisma = globalForPrisma.prisma || new PrismaClient()
=======
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? [] : [],
  })
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma