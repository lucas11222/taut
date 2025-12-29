// Taut App.asar Shim
// The app.asar shim that is patched into Slack's resources directory

const os = require('os')
const path = require('path')
const { spawnSync } = require('node:child_process')

// This function is duplicated in helpers.js, keep in sync
function osConfigDir() {
  switch (process.platform) {
    case 'win32':
      return process.env.APPDATA || 'C:\\Program Files'

    case 'darwin': {
      const home = os.homedir()
      return path.join(home, 'Library', 'Application Support')
    }

    case 'linux':
    default: {
      const user = process.env.SUDO_USER || process.env.USER
      if (!user) {
        throw new Error('Could not determine user to find config directory')
      }

      const { stdout } = spawnSync('getent', ['passwd', user], {
        encoding: 'utf8',
      })
      const home = stdout ? stdout.trim().split(':')[5] : null

      if (!home) {
        throw new Error(`Could not determine home directory for user ${user}`)
      }

      return path.join(home, '.config')
    }
  }
}

try {
  const configDir = path.join(osConfigDir(), 'taut')

  // Load the Taut main process script
  const mainJs = path.join(configDir, 'core', 'main', 'main.cjs')
  require(mainJs)
} catch (e) {
  console.error('[Taut] Failed to load Taut main process script:', e)
  // Don't throw, better to give people a non-patched Slack than a broken one
}

// Load the original Slack app
// @ts-ignore
require('../_app.asar')
