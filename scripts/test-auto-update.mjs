import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const updater = fileURLToPath(new URL('./auto-update.sh', import.meta.url))
const image = character => `sha256:${character.repeat(64)}`
const oldImage = image('a')
const newImage = image('b')
const nextImage = image('c')

// Fake Docker models image pulls, container replacement and an HTTP health probe.
// Assertions below exercise the updater's behavior without touching a real daemon.
const fakeDocker = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const path = process.env.INCUDAL_MOCK_DOCKER_STATE;
const state = JSON.parse(readFileSync(path, 'utf8'));
const args = process.argv.slice(2);
state.calls.push({args, override: process.env.INCUDAL_IMAGE || null});
let output = '', exit = 0;
if (args[0] === 'compose' && args[1] === 'ps') {
  output = state.running === false ? '' : 'app-container';
} else if (args[0] === 'compose' && args[1] === 'config') {
  output = JSON.stringify({services: {app: {image: 'ghcr.io/shane654/incudal:latest'}}});
} else if (args[0] === 'compose' && args[1] === 'pull') {
  if (state.pullFails) exit = 1;
  else state.localImage = state.availableImage;
} else if (args[0] === 'compose' && args[1] === 'up') {
  const target = process.env.INCUDAL_IMAGE || state.localImage;
  if (state.startFails && target === state.availableImage) exit = 1;
  else state.currentImage = target;
} else if (args[0] === 'inspect') {
  output = state.currentImage;
} else if (args[0] === 'image' && args[1] === 'inspect') {
  output = args[3].includes('Labels') ? 'https://github.com/shane654/incudal' : state.localImage;
} else if (args[0] === 'exec') {
  exit = state.healthyImages.includes(state.currentImage) ? 0 : 1;
} else if (args[0] === 'image' && args[1] === 'rm') {
  state.removedImages = [...(state.removedImages || []), args[2]];
} else {
  console.error('Unexpected mock Docker operation');
  exit = 99;
}
writeFileSync(path, JSON.stringify(state));
if (output) console.log(output);
process.exit(exit);
`

function fixture(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'incudal-auto-update-'))
  const bin = join(directory, 'bin')
  const statePath = join(directory, 'state.json')
  mkdirSync(bin)
  writeFileSync(join(bin, 'docker'), fakeDocker, { mode: 0o755 })
  // macOS has no flock; locking itself is verified by systemd on the deployment host.
  writeFileSync(join(bin, 'flock'), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
  writeFileSync(statePath, JSON.stringify({
    calls: [], currentImage: oldImage, localImage: oldImage,
    availableImage: newImage, healthyImages: [oldImage, newImage], ...overrides
  }))
  return {
    directory,
    state: () => JSON.parse(readFileSync(statePath, 'utf8')),
    setState: value => writeFileSync(statePath, JSON.stringify(value)),
    run: () => spawnSync('bash', [updater], {
      cwd: directory, encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, INCUDAL_IMAGE: '',
        INCUDAL_MOCK_DOCKER_STATE: statePath, INCUDAL_UPDATE_LOCK: join(directory, 'lock'),
        INCUDAL_HEALTH_ATTEMPTS: '2', INCUDAL_HEALTH_INTERVAL: '0' }
    }),
    close: () => rmSync(directory, { recursive: true, force: true })
  }
}

function replacements(state) {
  return state.calls.filter(call => call.args[0] === 'compose' && call.args[1] === 'up')
}

test('unchanged image does not restart any container', () => {
  const f = fixture({ availableImage: oldImage })
  try {
    assert.equal(f.run().status, 0)
    assert.deepEqual(replacements(f.state()), [])
  } finally { f.close() }
})

test('a new healthy image replaces only app and keeps a rollback image', () => {
  const f = fixture()
  try {
    const result = f.run()
    assert.equal(result.status, 0, result.stderr)
    assert.equal(f.state().currentImage, newImage)
    assert.deepEqual(replacements(f.state()).map(call => call.args), [['compose', 'up', '-d', '--no-deps', 'app']])
    assert.equal(readFileSync(join(f.directory, '.incudal-auto-update.previous-image'), 'utf8').trim(), oldImage)
  } finally { f.close() }
})

test('a failed pull leaves the running app intact', () => {
  const f = fixture({ pullFails: true })
  try {
    assert.notEqual(f.run().status, 0)
    assert.equal(f.state().currentImage, oldImage)
    assert.deepEqual(replacements(f.state()), [])
  } finally { f.close() }
})

for (const failure of ['health', 'start']) {
  test(`a ${failure} failure restores the old image and quarantines the failed digest`, () => {
    const f = fixture({ healthyImages: [oldImage], startFails: failure === 'start' })
    try {
      assert.notEqual(f.run().status, 0)
      const state = f.state()
      assert.equal(state.currentImage, oldImage)
      assert.equal(replacements(state).length, 2)
      assert.equal(replacements(state)[1].override, oldImage)
      assert.equal(readFileSync(join(f.directory, '.incudal-auto-update.failed-image'), 'utf8').trim(), newImage)
      assert.equal(f.run().status, 0)
      assert.equal(replacements(f.state()).length, 2, 'failed image must not trigger repeated restarts')

      f.setState({ ...f.state(), availableImage: nextImage, healthyImages: [oldImage, nextImage], startFails: false })
      assert.equal(f.run().status, 0)
      assert.equal(f.state().currentImage, nextImage)
      assert.equal(existsSync(join(f.directory, '.incudal-auto-update.failed-image')), false)
    } finally { f.close() }
  })
}

test('a stopped app is not automatically revived', () => {
  const f = fixture({ running: false })
  try {
    assert.notEqual(f.run().status, 0)
    assert.deepEqual(replacements(f.state()), [])
    assert.equal(f.state().calls.some(call => call.args[1] === 'pull'), false)
  } finally { f.close() }
})
