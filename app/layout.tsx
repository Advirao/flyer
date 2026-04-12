import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers'
import Toaster from '@/components/Toaster'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? 'https://flyergenerator.vercel.app'
  ),
  title: {
    default: 'Flyer Generator — AI-Powered For-Sale Flyers',
    template: '%s | Flyer Generator',
  },
  description:
    'Upload a photo, get a print-ready for-sale flyer in seconds. AI writes the title, description, and Facebook Marketplace copy for you — completely free.',
  keywords: [
    'flyer generator',
    'for sale flyer',
    'facebook marketplace',
    'AI flyer maker',
    'sell items online',
    'garage sale flyer',
    'free flyer maker',
  ],
  authors: [{ name: 'Flyer Generator' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Flyer Generator',
    title: 'Flyer Generator — AI-Powered For-Sale Flyers',
    description:
      'Upload a photo, get a print-ready for-sale flyer in seconds. Free & easy.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Flyer Generator — Create for-sale flyers with AI',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flyer Generator — AI-Powered For-Sale Flyers',
    description: 'Upload a photo, get a print-ready for-sale flyer in seconds.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
