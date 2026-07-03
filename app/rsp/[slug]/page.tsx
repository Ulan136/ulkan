import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogistPortal from '@/components/LogistPortal'
import prisma from '@/lib/prisma'

export default async function RspPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(`/login?from=/rsp/${slug}`)

  const user = await prisma.user.findUnique({ where: { slug } })
  if (!user) redirect('/')

  return <LogistPortal user={session} logistUser={user as any} />
}
