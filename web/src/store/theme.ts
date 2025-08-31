import { create } from 'zustand'

type Theme = 'light' | 'dark'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark')
}

export const useTheme = create<{ theme: Theme, toggle: ()=>void }>((set, get) => {
  const stored = (localStorage.getItem('theme') as Theme) || 'dark'
  apply(stored)
  return {
    theme: stored,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      apply(next)
      set({ theme: next })
    }
  }
})

