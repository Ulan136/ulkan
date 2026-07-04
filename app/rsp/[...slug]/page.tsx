import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogistPortal from '@/components/LogistPortal'
import prisma from '@/lib/prisma'

export default async function RspPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const full = slug.join('/')
  const last = slug[slug.length - 1]
  const session = await getSession()
  if (!session) redirect(`/login?from=/rsp/${full}`)

  // Терпимый поиск: и по полному slug со слэшем ("logist/bakyt"),
  // и по последнему сегменту ("bakyt") — чтобы портал не падал в 404
  const user = await prisma.user.findFirst({
    where: { OR: [{ slug: full }, { slug: last }] },
  })
  if (!user) redirect('/')

  return <LogistPortal user={session} logistUser={user as any} />
}
