import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClientApp from '@/components/ClientApp'
import prisma from '@/lib/prisma'

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()

  const user = await prisma.user.findUnique({ where: { slug } })
  if (!user) redirect('/')

  // Если не авторизован — редирект на трекинг/логин
  if (!session) redirect(`/login?from=/client/${slug}`)

  return <ClientApp user={session} clientUser={user as any} />
}
