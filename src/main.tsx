import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startRouter } from './lib/router'
import { SUNRULE_CSS } from './components/SunRule'
import './styles/app.css'

const style = document.createElement('style')
style.textContent = SUNRULE_CSS
document.head.appendChild(style)

startRouter()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
