<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/auth'
=======
// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
import { generateProjectId } from '@/lib/ids'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

<<<<<<< HEAD
  const projects = await prisma.project.findMany({
    include: { _count: { select: { orders: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(projects)
=======
  try {
    const projects = await prisma.project.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })

<<<<<<< HEAD
  const { name, clientId, description } = await req.json()
  if (!name) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 })

  const project = await prisma.project.create({
    data: { id: generateProjectId(), name, clientId: clientId || null, description: description || '' },
  })
  return NextResponse.json(project, { status: 201 })
}
=======
  try {
    const { name, clientId, description = '' } = await req.json()
    if (!name) return NextResponse.json({ error: 'Укажите название' }, { status: 400 })

    const project = await prisma.project.create({
      data: { id: generateProjectId(), name, clientId: clientId || null, description },
    })
    return NextResponse.json(project, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
>>>>>>> 4ef01474e399896ef3605f22286c063f82e84d2b
