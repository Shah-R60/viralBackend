import type { CookieOptions, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { HydratedDocument } from 'mongoose'
import { User } from '../models/User.js'
import type { IUser } from '../models/User.js'
import { env } from '../config/env.js'
import { verifyFirebaseIdToken } from '../services/firebaseAdmin.js'
import type { AuthedRequest } from '../types.js'

function toMs(value: string): number {
  const normalized = value.trim().toLowerCase()
  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/)
  if (!match) return 15 * 60 * 1000

  const amount = Number(match[1])
  const unit = match[2]
  const map: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return amount * map[unit]
}

function getCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge,
  }
}

function issueTokens(user: { _id: unknown; role: string }) {
  const accessExpiresIn = env.accessTokenExpiry as jwt.SignOptions['expiresIn']
  const refreshExpiresIn = env.refreshTokenExpiry as jwt.SignOptions['expiresIn']

  const accessToken = jwt.sign({ sub: String(user._id), role: user.role }, env.accessTokenSecret, {
    expiresIn: accessExpiresIn,
  })

  const refreshToken = jwt.sign({ sub: String(user._id), role: user.role }, env.refreshTokenSecret, {
    expiresIn: refreshExpiresIn,
  })

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(Date.now() + toMs(env.accessTokenExpiry)).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + toMs(env.refreshTokenExpiry)).toISOString(),
  }
}

async function persistAndRespondWithTokens(res: Response, user: HydratedDocument<IUser>) {
  const tokens = issueTokens(user)
  user.refreshToken = tokens.refreshToken
  await user.save({ validateBeforeSave: false })

  const accessCookie = getCookieOptions(toMs(env.accessTokenExpiry))
  const refreshCookie = getCookieOptions(toMs(env.refreshTokenExpiry))

  return res
    .cookie('accessToken', tokens.accessToken, accessCookie)
    .cookie('refreshToken', tokens.refreshToken, refreshCookie)
    .json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    })
}

export async function googleLogin(req: Request, res: Response) {
  const { idToken } = req.body as { idToken?: string }

  if (!idToken) {
    res.status(400).json({ message: 'Google idToken is required' })
    return
  }

  try {
    const decoded = await verifyFirebaseIdToken(idToken)
    const email = decoded.email?.toLowerCase()

    if (!email) {
      res.status(400).json({ message: 'Google account email is required' })
      return
    }

    const displayName = decoded.name ?? email.split('@')[0]
    let user = await User.findOne({ email })

    if (!user) {
      user = await User.create({
        name: displayName,
        email,
        passwordHash: '__GOOGLE_AUTH__',
        role: 'user',
      })
    }

    await persistAndRespondWithTokens(res, user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google login failed'
    res.status(401).json({ message })
  }
}

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body as {
    name?: string
    email?: string
    password?: string
  }

  if (!name || !email || !password || password.length < 6) {
    res.status(400).json({ message: 'Name, email and password are required' })
    return
  }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) {
    res.status(409).json({ message: 'Email already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({ name, email, passwordHash, role: 'user' })

  res.status(201)
  await persistAndRespondWithTokens(res, user)
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' })
    return
  }

  const user = await User.findOne({ email: email.toLowerCase() })
  if (!user) {
    res.status(401).json({ message: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ message: 'Invalid credentials' })
    return
  }

  await persistAndRespondWithTokens(res, user)
}

export async function refresh(req: Request, res: Response) {
  const incomingRefreshToken =
    (typeof req.cookies?.refreshToken === 'string' ? req.cookies.refreshToken : '') ||
    (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : '')

  if (!incomingRefreshToken) {
    res.status(401).json({ message: 'Refresh token is required' })
    return
  }

  try {
    const decoded = jwt.verify(incomingRefreshToken, env.refreshTokenSecret) as jwt.JwtPayload
    const userId = typeof decoded.sub === 'string' ? decoded.sub : ''
    const user = await User.findById(userId)

    if (!user || !user.refreshToken || user.refreshToken !== incomingRefreshToken) {
      res.status(401).json({ message: 'Refresh token is invalid or expired' })
      return
    }

    await persistAndRespondWithTokens(res, user)
  } catch {
    res.status(401).json({ message: 'Refresh token is invalid or expired' })
  }
}

export async function logout(req: AuthedRequest, res: Response) {
  if (req.user?.sub) {
    await User.findByIdAndUpdate(req.user.sub, { $unset: { refreshToken: 1 } })
  }

  const clearOptions = {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax' as const,
  }

  res
    .clearCookie('accessToken', clearOptions)
    .clearCookie('refreshToken', clearOptions)
    .json({ message: 'Logged out successfully' })
}
