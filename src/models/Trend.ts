import { Schema, model } from 'mongoose'

export type TrendStatus = 'pending' | 'approved' | 'rejected'
export type TrendPlatform = 'instagram' | 'youtube'
export type TrendType = 'dance' | 'meme' | 'aesthetic' | 'info' | 'lipsync' | 'audio'
export type ReasonToWatch = 'audio-driven' | 'meme' | 'visual-edit' | 'pov-dialogue' | 'challenge'

export interface ITrend {
  title: string
  slug: string
  videoUrl: string
  platform: TrendPlatform
  trendType?: TrendType
  reasonToWatch?: ReasonToWatch
  thumbnailImage: string
  trendDate: Date
  description?: string
  status: TrendStatus
  submittedBy: Schema.Types.ObjectId
  rejectionReason?: string
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const trendSchema = new Schema<ITrend>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    videoUrl: { type: String, required: true, trim: true },
    platform: {
      type: String,
      enum: ['instagram', 'youtube'],
      default: 'instagram',
      index: true,
    },
    trendType: {
      type: String,
      enum: ['dance', 'meme', 'aesthetic', 'info', 'lipsync', 'audio'],
      default: 'meme',
      index: true,
    },
    reasonToWatch: {
      type: String,
      enum: ['audio-driven', 'meme', 'visual-edit', 'pov-dialogue', 'challenge'],
      default: 'meme',
      index: true,
    },
    thumbnailImage: { type: String, required: true, trim: true },
    trendDate: { type: Date, required: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rejectionReason: { type: String, trim: true },
    publishedAt: { type: Date },
  },
  { timestamps: true },
)

trendSchema.pre('save', function (next) {
  if (this.publishedAt && this.isModified('slug') && !this.isNew) {
    next(new Error('Slug cannot be changed after publish'))
    return
  }
  next()
})

trendSchema.index({ trendDate: -1, createdAt: -1 })

export const Trend = model<ITrend>('Trend', trendSchema)
