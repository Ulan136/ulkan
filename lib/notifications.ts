<<<<<<< HEAD
import { prisma } from './prisma'

export async function notify(userId: string, text: string, cardId?: string) {
  await prisma.notification.create({
    data: { userId, text, cardId },
  })
}

export async function notifyAdmins(text: string, cardId?: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'super_admin', active: true },
  })
  for (const admin of admins) {
    await notify(admin.id, text, cardId)
  }
}

export async function notifyBookkeepers(text: string) {
  const bookkeepers = await prisma.user.findMany({
    where: { role: 'bookkeeper', active: true },
  })
  for (const b of bookkeepers) {
    await notify(b.id, text)
  }
}
=======
// lib/notifications.ts
import { prisma } from './prisma'

export async function notify(userId: string, text: string, cardId?: string) {
  try {
    await prisma.notification.create({ data: { userId, text, cardId } })
  } catch {}
}

export async function notifyAdmins(text: string, cardId?: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'super_admin', active: true },
      select: { id: true }
    })
    await Promise.all(admins.map(a => notify(a.id, text, cardId)))
  } catch {}
}

export async function notifyBookkeepers(text: string) {
  try {
    const bks = await prisma.user.findMany({
      where: { role: 'bookkeeper', active: true },
      select: { id: true }
    })
    await Promise.all(bks.map(b => notify(b.id, text)))
  } catch {}
}

export async function notifyUser(userId: string | null | undefined, text: string, cardId?: string) {
  if (!userId) return
  await notify(userId, text, cardId)
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
