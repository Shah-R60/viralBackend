import type { Request, Response } from 'express'
import { Trend } from '../models/Trend.js'
import type { AuthedRequest } from '../types.js'
import { cloudinary } from '../config/cloudinary.js'
import { createUniqueSlug, detectPlatform, getAdjacentFilter } from '../services/trendService.js'

const TREND_TYPE_VALUES = ['dance', 'meme', 'aesthetic', 'info', 'lipsync', 'audio'] as const
const REASON_TO_WATCH_VALUES = ['audio-driven', 'meme', 'visual-edit', 'pov-dialogue', 'challenge'] as const

export async function getHome(_req: Request, res: Response) {
  const latest = await Trend.find({ status: 'approved' }).sort({ trendDate: -1, createdAt: -1 }).limit(12).lean()

  const hero = latest[0] ?? null
  const rails = {
    latest,
    throwback: [...latest].reverse().slice(0, 8),
  }

  res.json({ hero, rails })
}

export async function getSafari(_req: Request, res: Response) {
  const trends = await Trend.find({ status: 'approved' }).sort({ trendDate: -1, createdAt: -1 }).lean()

  const grouped = trends.reduce<Record<string, typeof trends>>((acc, trend) => {
    const key = new Date(trend.trendDate).toISOString().slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(trend)
    return acc
  }, {})

  const days = Object.entries(grouped).map(([date, items]) => ({ date, items }))
  res.json({ days })
}

export async function getPendingModeration(_req: Request, res: Response) {
  const pending = await Trend.find({ status: 'pending' }).sort({ createdAt: -1 }).lean()
  res.json({ items: pending })
}

export async function getAllModeration(_req: Request, res: Response) {
  const [pending, approved] = await Promise.all([
    Trend.find({ status: 'pending' }).sort({ createdAt: -1 }).lean(),
    Trend.find({ status: 'approved' }).sort({ trendDate: -1, createdAt: -1 }).lean(),
  ])

  res.json({ pending, approved })
}

export async function submitTrend(req: AuthedRequest, res: Response) {
  const { link, title, date, trendType, reasonToWatch } = req.body as {
    link?: string
    title?: string
    date?: string
    trendType?: string
    reasonToWatch?: string
  }

  if (!link || !title || !date || !req.file || !trendType || !reasonToWatch) {
    res.status(400).json({ message: 'Link, title, date, trend type, reason and image are required' })
    return
  }

  if (!TREND_TYPE_VALUES.includes(trendType as (typeof TREND_TYPE_VALUES)[number])) {
    res.status(400).json({ message: 'Invalid trendType value' })
    return
  }

  if (!REASON_TO_WATCH_VALUES.includes(reasonToWatch as (typeof REASON_TO_WATCH_VALUES)[number])) {
    res.status(400).json({ message: 'Invalid reasonToWatch value' })
    return
  }

  const platform = detectPlatform(link)
  if (!platform) {
    res.status(400).json({ message: 'Only Instagram and YouTube links are accepted in v1' })
    return
  }

  const trendDate = new Date(date)
  if (Number.isNaN(trendDate.getTime())) {
    res.status(400).json({ message: 'Invalid date format' })
    return
  }

  const slug = await createUniqueSlug(title)

  const uploaded = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'viralsafari/trends', resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Upload failed'))
          return
        }
        resolve({ secure_url: result.secure_url })
      },
    )

    stream.end(req.file?.buffer)
  })

  const trend = await Trend.create({
    title,
    slug,
    videoUrl: link,
    platform,
    trendType,
    reasonToWatch,
    thumbnailImage: uploaded.secure_url,
    trendDate,
    submittedBy: req.user?.sub,
    status: 'pending',
  })

  res.status(201).json({
    message: 'Submitted successfully. Pending admin approval.',
    trend: { id: String(trend._id), slug: trend.slug, status: trend.status },
  })
}

export async function approveTrend(req: Request, res: Response) {
  const trend = await Trend.findById(req.params.id)
  if (!trend) {
    res.status(404).json({ message: 'Trend not found' })
    return
  }

  trend.status = 'approved'
  trend.rejectionReason = undefined
  trend.publishedAt = new Date()
  await trend.save()

  res.json({ message: 'Approved', slug: trend.slug })
}

export async function rejectTrend(req: Request, res: Response) {
  const trend = await Trend.findById(req.params.id)
  if (!trend) {
    res.status(404).json({ message: 'Trend not found' })
    return
  }

  trend.status = 'rejected'
  trend.rejectionReason = String(req.body.reason ?? 'Rejected by moderator')
  await trend.save()

  res.json({ message: 'Rejected' })
}

export async function unapproveTrend(req: Request, res: Response) {
  const trend = await Trend.findById(req.params.id)
  if (!trend) {
    res.status(404).json({ message: 'Trend not found' })
    return
  }

  trend.status = 'pending'
  trend.rejectionReason = undefined
  trend.publishedAt = undefined
  await trend.save()

  res.json({ message: 'Moved back to pending' })
}

export async function deleteTrend(req: Request, res: Response) {
  const deleted = await Trend.findByIdAndDelete(req.params.id)
  if (!deleted) {
    res.status(404).json({ message: 'Trend not found' })
    return
  }

  res.json({ message: 'Trend deleted successfully' })
}

export async function getTrendBySlug(req: Request, res: Response) {
  const trend = await Trend.findOne({ slug: req.params.slug, status: 'approved' }).lean()

  if (!trend) {
    res.status(404).json({ message: 'Trend not found' })
    return
  }

  const filters = getAdjacentFilter({
    trendDate: new Date(trend.trendDate),
    createdAt: new Date(trend.createdAt as Date),
  })

  const next = await Trend.findOne({ status: 'approved', ...filters.next })
    .sort({ trendDate: -1, createdAt: -1 })
    .select({ slug: 1 })
    .lean()

  const previous = await Trend.findOne({ status: 'approved', ...filters.previous })
    .sort({ trendDate: 1, createdAt: 1 })
    .select({ slug: 1 })
    .lean()

  res.json({
    trend,
    navigation: {
      nextSlug: next?.slug ?? null,
      previousSlug: previous?.slug ?? null,
    },
  })
}
