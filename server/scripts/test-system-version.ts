import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getCurrentVersion } from '../src/lib/system-version.js'

const directory = mkdtempSync(join(tmpdir(), 'incudal-version-'))
try {
  assert.equal(getCurrentVersion(directory, ''), 'unknown')
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.0.0' }))
  assert.equal(getCurrentVersion(directory, ''), 'v1.0.0')

  // A release tag must take precedence over unchanged workspace package versions.
  writeFileSync(join(directory, 'VERSION'), 'v1.0.2\n')
  assert.equal(getCurrentVersion(directory, ''), 'v1.0.2')
  assert.equal(getCurrentVersion(directory, ' 2.0.0 '), 'v2.0.0')
  assert.equal(getCurrentVersion(directory, 'v2.0.0'), 'v2.0.0')

  writeFileSync(join(directory, 'VERSION'), ' 1.0.3-rc.1\n')
  assert.equal(getCurrentVersion(directory, ''), 'v1.0.3-rc.1')
  writeFileSync(join(directory, 'VERSION'), '\n')
  assert.equal(getCurrentVersion(directory, ''), 'v1.0.0')
  writeFileSync(join(directory, 'package.json'), 'invalid json')
  assert.equal(getCurrentVersion(directory, ''), 'unknown')

  console.log('system version tests passed')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
