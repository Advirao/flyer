import type { Metadata } from 'next'
import FlyerApp from '@/components/FlyerApp'

export const metadata: Metadata = { title: 'Generate Flyer' }

export default function AppPage() {
  return <FlyerApp />
}
