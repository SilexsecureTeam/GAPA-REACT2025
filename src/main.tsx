import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './services/auth'
import { CurrencyProvider } from './context/CurrencyContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CurrencyProvider>
        <App />
        </CurrencyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
