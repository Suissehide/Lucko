import type { MetadataRoute } from 'next'
import { siteUrl } from './site'

// Pages ville, lieux et événements à ajouter ici quand elles existeront
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'weekly', priority: 1 },
    ...['/about', '/help'].map((path) => ({
      url: siteUrl + path,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...['/terms', '/privacy', '/legal-notice'].map((path) => ({
      url: siteUrl + path,
      changeFrequency: 'yearly' as const,
      priority: 0.1,
    })),
  ]
}
