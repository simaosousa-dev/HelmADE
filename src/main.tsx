import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { verifyModelCatalogAndConfigIntegrity } from './config/modelCatalog.verify'

if (import.meta.env.DEV) {
  try {
    verifyModelCatalogAndConfigIntegrity()
  } catch (err) {
    console.error('Integrity check failed:', err)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
