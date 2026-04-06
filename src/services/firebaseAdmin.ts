import admin from 'firebase-admin'

let initialized = false

function getRequired(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing Firebase env var: ${name}`)
  }
  return value
}

function initFirebaseAdmin(): void {
  if (initialized) return

  const projectId = getRequired('FIREBASE_PROJECT_ID')
  const clientEmail = getRequired('FIREBASE_CLIENT_EMAIL')
  const privateKey = getRequired('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })

  initialized = true
}

export async function verifyFirebaseIdToken(idToken: string) {
  initFirebaseAdmin()
  return admin.auth().verifyIdToken(idToken)
}
