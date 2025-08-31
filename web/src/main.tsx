import React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import './styles/global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Landing from './pages/Landing'
import AuthPage from './pages/Auth'
import AppShell from './pages/AppShell'
import Dashboard from './pages/Dashboard'

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/auth', element: <AuthPage /> },
  { path: '/app', element: <AppShell /> , children: [
    { index: true, element: <Dashboard /> },
  ]},
])

const qc = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
)
