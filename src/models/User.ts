import { Schema, model } from 'mongoose'

export interface IUser {
  name: string
  email: string
  passwordHash: string
  role: 'user' | 'admin'
  refreshToken?: string
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    refreshToken: { type: String },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', userSchema)
