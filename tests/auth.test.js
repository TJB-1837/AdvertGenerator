import test from 'node:test'
import assert from 'node:assert/strict'
import { getOAuthReturnError } from '../src/lib/auth.js'

test('OAuth cancellation is reported without displaying raw provider details', () => {
  const url = new URL(
    'https://adrafteo.com/#error=access_denied&error_description=private-provider-details',
  )
  assert.match(getOAuthReturnError(url), /cancelled/)
  assert.ok(!getOAuthReturnError(url).includes('private-provider-details'))
})

test('OAuth callback errors are detected in query strings and successful sessions are ignored', () => {
  assert.match(
    getOAuthReturnError(new URL('https://adrafteo.com/?error_code=oauth_failed')),
    /could not be completed/,
  )
  assert.equal(getOAuthReturnError(new URL('https://adrafteo.com/#access_token=example')), '')
  assert.equal(getOAuthReturnError(null), '')
})
