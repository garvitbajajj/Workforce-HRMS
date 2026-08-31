import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { HRMSProvider } from './store.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HRMSProvider>
      <App />
    </HRMSProvider>
  </React.StrictMode>
)
