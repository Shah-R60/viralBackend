import { env } from '../config/env.js'
import { detectPlatform, isInstagramUrl } from './trendService.js'

function getYouTubeVideoId(videoUrl: string): string | null {
  try {
    const parsed = new URL(videoUrl)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/').filter(Boolean)[1]
        return id || null
      }

      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }
    }

    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    }

    return null
  } catch {
    return null
  }
}

function getYouTubeEmbedHtml(videoUrl: string): { html: string } {
  const videoId = getYouTubeVideoId(videoUrl)
  if (!videoId) {
    throw new Error('Invalid YouTube URL')
  }

  const embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=0&rel=0&playsinline=1`
  const html = `<iframe src="${embedUrl}" title="YouTube video player" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
  return { html }
}

export async function getIframelyHtml(videoUrl: string): Promise<{ html: string }> {
  const platform = detectPlatform(videoUrl)
  if (!platform) {
    throw new Error('Only Instagram and YouTube URLs are supported in v1')
  }

  if (platform === 'youtube') {
    return getYouTubeEmbedHtml(videoUrl)
  }

  if (!isInstagramUrl(videoUrl)) {
    throw new Error('Only Instagram and YouTube URLs are supported in v1')
  }

  const endpoint = new URL('https://iframe.ly/api/oembed')
  endpoint.searchParams.set('api_key', env.iframelyApiKey)
  endpoint.searchParams.set('url', videoUrl)
  endpoint.searchParams.set('iframe', '1')
  endpoint.searchParams.set('omit_script', '1')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(endpoint, { signal: controller.signal })
    const payload = await response.json()

    if (!response.ok || !payload?.html) {
      throw new Error(payload?.error ?? 'Failed to fetch embed HTML')
    }

    return { html: String(payload.html) }
  } finally {
    clearTimeout(timeout)
  }
}
