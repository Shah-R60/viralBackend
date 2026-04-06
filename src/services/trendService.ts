import { Trend } from '../models/Trend.js'
import { baseSlug } from '../utils/slugify.js'

export async function createUniqueSlug(title: string): Promise<string> {
  const root = baseSlug(title) || 'trend'
  let candidate = root
  let count = 2

  while (await Trend.exists({ slug: candidate })) {
    candidate = `${root}-${count}`
    count += 1
  }

  return candidate
}

export function isInstagramUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      (parsed.hostname.endsWith('instagram.com') || parsed.hostname.endsWith('instagr.am')) &&
      parsed.protocol.startsWith('http')
    )
  } catch {
    return false
  }
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (!parsed.protocol.startsWith('http')) return false

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/').filter(Boolean)[1]
        return Boolean(id)
      }

      if (parsed.pathname === '/watch') {
        return Boolean(parsed.searchParams.get('v'))
      }

      return false
    }

    if (host === 'youtu.be') {
      return Boolean(parsed.pathname.split('/').filter(Boolean)[0])
    }

    return false
  } catch {
    return false
  }
}

export function detectPlatform(url: string): 'instagram' | 'youtube' | null {
  if (isInstagramUrl(url)) return 'instagram'
  if (isYouTubeUrl(url)) return 'youtube'
  return null
}

export function getAdjacentFilter(current: { trendDate: Date; createdAt: Date }) {
  return {
    next: {
      $or: [
        { trendDate: { $lt: current.trendDate } },
        {
          trendDate: current.trendDate,
          createdAt: { $lt: current.createdAt },
        },
      ],
    },
    previous: {
      $or: [
        { trendDate: { $gt: current.trendDate } },
        {
          trendDate: current.trendDate,
          createdAt: { $gt: current.createdAt },
        },
      ],
    },
  }
}
