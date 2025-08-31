import { initializeApp, getApps } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const cfgRaw = import.meta.env.VITE_FIREBASE_CONFIG
if (!cfgRaw) console.warn('VITE_FIREBASE_CONFIG missing')
const config = cfgRaw ? JSON.parse(cfgRaw) : {}

export const app = getApps().length ? getApps()[0] : initializeApp(config)
export const auth = getAuth(app)
auth.languageCode = 'ko'
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
export const db = getFirestore(app)
