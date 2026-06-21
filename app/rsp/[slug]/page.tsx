import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LogistPortal from '@/components/LogistPortal'

type Props = { params: Promise<{ slug: string }> }

export default async function RspPage({ params }: Props) {
  const session = await getSession()
  const { slug } = await params
  if (!session) redirect(`/login?from=/rsp/${slug}`)
  if (session.role !== 'logist') redirect('/')
  if (session.slug && session.slug !== slug) redirect(`/rsp/${session.slug}`)
  return <LogistPortal user={session} />
}