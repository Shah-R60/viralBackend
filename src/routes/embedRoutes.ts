import { Router } from 'express'
import { resolveEmbed } from '../controllers/embedController.js'

export const embedRoutes = Router()

embedRoutes.get('/resolve', resolveEmbed)
