import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { connectDb } from './config/db.js'
import { env } from './config/env.js'
import { authRoutes } from './routes/authRoutes.js'
import { trendRoutes } from './routes/trendRoutes.js'
import { embedRoutes } from './routes/embedRoutes.js'

const app = express()

const allowedOrigins = env.clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server and local tools without origin header.
      if (!origin) {
        callback(null, true)
        return
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(cookieParser())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/trends', trendRoutes)
app.use('/api/embeds', embedRoutes)

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

connectDb()
  .then(() => {
    app.listen(env.port, () => {
      console.log(`API running on http://localhost:${env.port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to connect to database', error)
    process.exit(1)
  })
