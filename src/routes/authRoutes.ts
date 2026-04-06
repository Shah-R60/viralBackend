import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { googleLogin, login, logout, refresh, register } from '../controllers/authController.js'

export const authRoutes = Router()

authRoutes.post('/google', googleLogin)
authRoutes.post('/register', register)
authRoutes.post('/login', login)
authRoutes.post('/refresh', refresh)
authRoutes.post('/logout', requireAuth, logout)
