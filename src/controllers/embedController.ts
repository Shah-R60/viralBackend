import type { Request, Response } from 'express'
import { getIframelyHtml } from '../services/embedService.js'

export async function resolveEmbed(req: Request, res: Response) {
  const url = String(req.query.url ?? '')
  if (!url) {
    res.status(400).json({ message: 'url query param is required' })
    return
  }

  try {
    const result = await getIframelyHtml(url)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resolve embed'
    res.status(422).json({ message })
  }
}
