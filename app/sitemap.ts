import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://malanacopa.com.br';
  const lastModified = new Date();
  return [
    { url: base, lastModified, priority: 1, changeFrequency: 'weekly' },
    {
      url: `${base}/login`,
      lastModified,
      priority: 0.8,
      changeFrequency: 'monthly',
    },
    {
      url: `${base}/termos`,
      lastModified,
      priority: 0.5,
      changeFrequency: 'yearly',
    },
    {
      url: `${base}/privacidade`,
      lastModified,
      priority: 0.5,
      changeFrequency: 'yearly',
    },
  ];
}
