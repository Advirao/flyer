import { MetadataRoute } from 'next'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXTAUTH_URL ?? 'https://flyergenerator.vercel.app'
  return [
    {
      url: base,
      lastModified: new Date('2026-04-11'),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${base}/app`,
      lastModified: new Date('2026-04-11'),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ]
}
