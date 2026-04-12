import { MetadataRoute } from 'next'

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
      url: `${base}/auth/signin`,
      lastModified: new Date('2026-04-11'),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${base}/auth/signup`,
      lastModified: new Date('2026-04-11'),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ]
}
