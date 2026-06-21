import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ClientApp from '@/components/ClientApp'

type Props = { params: Promise<{ slug: string }> }

export default async function ClientPage({ params }: Props) {
  const { slug } = await params
  const session = await getSession()
  if (!session) redirect(`/client?slug=${slug}`)
  if (!['client', 'supplier_client'].includes(session.role)) redirect('/')
  if (session.slug && session.slug !== slug) redirect(`/client/${session.slug}`)
  return <ClientApp user={session} />
}