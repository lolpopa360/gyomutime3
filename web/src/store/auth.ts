import { create } from 'zustand'
import { auth, googleProvider } from '../lib/firebase'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  getIdTokenResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
} from 'firebase/auth'

type Role = 'user' | 'admin'

interface AuthState {
  user: any | null
  role: Role
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (name: string, email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  role: 'user',
  loading: true,
  async signIn() { await signInWithPopup(auth, googleProvider) },
  async signOut() { await signOut(auth) },
  async signInEmail(email, password) { await signInWithEmailAndPassword(auth, email, password) },
  async signUpEmail(name, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    if (name) { await updateProfile(cred.user, { displayName: name }) }
    try { await sendEmailVerification(cred.user) } catch (_) { /* ignore */ }
  },
  async resetPassword(email) { await sendPasswordResetEmail(auth, email) },
}))

onAuthStateChanged(auth, async (user) => {
  let role: Role = 'user'
  if (user) {
    const token = await getIdTokenResult(user, true)
    if (token.claims.role === 'admin') role = 'admin'
  }
  useAuth.setState({ user, role, loading: false })
})
