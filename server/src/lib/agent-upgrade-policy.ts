/** Automatic root-level Agent upgrades require an explicit operator opt-in. */
export function shouldOfferAgentUpgrade(input: {
  currentVersion: string | null
  targetVersion: string
  hasPendingRequest: boolean
  force: boolean
  autoUpdateEnabled: boolean
}): boolean {
  if (!input.hasPendingRequest && !input.autoUpdateEnabled) return false
  return input.currentVersion !== input.targetVersion || (input.hasPendingRequest && input.force)
}
