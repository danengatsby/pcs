let activationToken = ''

// Capture before rendering or telemetry; keep the capability out of URLs,
// referrers, browser storage and subsequent navigation history.
export function captureAdminActivationToken(): void {
  if (window.location.pathname !== '/auth/activate') return
  const fragment = window.location.hash.slice(1)
  if (/^[A-Za-z0-9_-]{43}$/.test(fragment)) activationToken = fragment
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }
}

export function readAdminActivationToken(): string { return activationToken }
export function clearAdminActivationToken(): void { activationToken = '' }
