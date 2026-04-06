import type { Request } from 'express'

export type UserRole = 'user' | 'admin'

export interface JwtPayload {
  sub: string
  role: UserRole
}

export interface AuthedRequest extends Request {
  user?: JwtPayload
}
