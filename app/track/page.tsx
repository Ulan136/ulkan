import { Suspense } from 'react'
import TrackingApp from '@/components/TrackingApp'

type Props = { searchParams: Promise<{ id?: string }> }

export default async function TrackPage({ searchParams }: Props) {
  const { id } = await searchParams
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#8a847c' }}>Загрузка…</div>}>
      <TrackingApp initialId={id} />
    </Suspense>
  )
}