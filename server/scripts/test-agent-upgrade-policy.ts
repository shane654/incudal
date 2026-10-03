import assert from 'node:assert/strict'
import { shouldOfferAgentUpgrade } from '../src/lib/agent-upgrade-policy.js'

const defaults = {
  currentVersion: 'v0.0.6', targetVersion: 'v0.0.7',
  hasPendingRequest: false, force: false, autoUpdateEnabled: false
}
assert.equal(shouldOfferAgentUpgrade(defaults), false)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, currentVersion: null }), false)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, force: true }), false)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, hasPendingRequest: true }), true)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, autoUpdateEnabled: true }), true)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, currentVersion: defaults.targetVersion, hasPendingRequest: true }), false)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, currentVersion: defaults.targetVersion, hasPendingRequest: true, force: true }), true)
assert.equal(shouldOfferAgentUpgrade({ ...defaults, currentVersion: defaults.targetVersion, autoUpdateEnabled: true, force: true }), false)
console.log('agent upgrade policy: ok')
