import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL ?? 'https://flyergenerator.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
