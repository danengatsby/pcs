// Initialize telemetry early
import { captureAdminActivationToken } from './lib/adminActivationToken'
import { captureAdminDirectLoginToken } from './lib/adminDirectLogin'
captureAdminActivationToken()
captureAdminDirectLoginToken()
import { initClientTelemetry } from './lib/telemetry'
if (!['/auth/activate', '/auth/direct', '/auth/signin'].includes(window.location.pathname)) initClientTelemetry()

import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
)
