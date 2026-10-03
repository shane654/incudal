import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Both source and compiled modules live three directories below the app root.
const APP_DIRECTORY = fileURLToPath(new URL('../../../', import.meta.url))

function normalizeVersion(value: string | undefined): string | null {
  const version = value?.trim()
  return version ? (version.startsWith('v') ? version : `v${version}`) : null
}

export function getCurrentVersion(
  appDirectory = APP_DIRECTORY,
  configuredVersion = process.env.INCUDAL_VERSION
): string {
  const configured = normalizeVersion(configuredVersion)
  if (configured) return configured

  try {
    // Releases and Docker images bake their tag into this file. Do not infer
    // the running version from a floating image tag or a remote latest release.
    const releaseVersion = normalizeVersion(readFileSync(join(appDirectory, 'VERSION'), 'utf8'))
    if (releaseVersion) return releaseVersion
  } catch {
    // Source checkouts do not have release metadata.
  }

  try {
    const packageJson = JSON.parse(readFileSync(join(appDirectory, 'package.json'), 'utf8')) as { version?: unknown }
    if (typeof packageJson.version === 'string') {
      return normalizeVersion(packageJson.version) || 'unknown'
    }
  } catch {
    // Missing metadata is shown as unknown for manual verification.
  }
  return 'unknown'
}
