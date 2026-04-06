import type { NextFunction, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthedRequest, JwtPayload } from '../types.js'
import { env } from '../config/env.js'

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const bearerToken = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  const cookieToken = typeof req.cookies?.accessToken === 'string' ? req.cookies.accessToken : ''
  const token = bearerToken || cookieToken

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  try {
    req.user = jwt.verify(token, env.accessTokenSecret) as JwtPayload
    next()
  } catch {
    res.status(401).json({ message: 'Invalid token' })
  }
}

export function requireRole(role: 'admin' | 'user') {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' })
      return
    }
    if (req.user.role !== role) {
      res.status(403).json({ message: 'Forbidden' })
      return
    }
    next()
  }
}
