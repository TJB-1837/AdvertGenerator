export function getOAuthReturnError(location) {
  if (!location) return ''
  for (const value of [location.search, location.hash]) {
    const params = new URLSearchParams((value || '').slice(1))
    if (params.has('error') || params.has('error_code') || params.has('error_description')) {
      return params.get('error') === 'access_denied'
        ? 'Google sign-in was cancelled. You can try again or sign in with email.'
        : 'Google sign-in could not be completed. Please try again or sign in with email.'
    }
  }
  return ''
}

export function clearOAuthReturnError() {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  for (const key of ['error', 'error_code', 'error_description']) {
    url.searchParams.delete(key)
    hash.delete(key)
  }
  url.hash = hash.toString()
  window.history.replaceState(window.history.state, '', url.href)
}
