import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flyer Generator',
  description: 'Generate for-sale flyers instantly from a photo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
