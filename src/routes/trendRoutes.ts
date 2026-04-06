import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import {
  approveTrend,
  deleteTrend,
  getAllModeration,
  getHome,
  getPendingModeration,
  getSafari,
  getTrendBySlug,
  rejectTrend,
  submitTrend,
  unapproveTrend,
} from '../controllers/trendController.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } })

export const trendRoutes = Router()

trendRoutes.get('/home', getHome)
trendRoutes.get('/safari', getSafari)

trendRoutes.get('/moderation/pending', getPendingModeration)
trendRoutes.get('/moderation/all', getAllModeration)

trendRoutes.post('/submit', requireAuth, upload.single('image'), submitTrend)

trendRoutes.post('/:id/approve', approveTrend)
trendRoutes.post('/:id/reject', rejectTrend)
trendRoutes.post('/:id/unapprove', unapproveTrend)
trendRoutes.delete('/:id', deleteTrend)

trendRoutes.get('/:slug', getTrendBySlug)
