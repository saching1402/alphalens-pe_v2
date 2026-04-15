import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#131c2d',
              color: '#e2e8f5',
              border: '1px solid #1e2d44',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#131c2d' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#131c2d' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
