// Taut App.asar Shim
// The app.asar shim that is patched into Slack's resources directory

const os = require('os')
const path = require('path')
const { execSync } = require('node:child_process')

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
      const homeOutput = execSync('getent passwd ${SUDO_USER:-$USER} | cut -d: -f6', { shell: true, encoding: "utf8" }).trim();
      return homeOutput + "/.config";
    }
  }
}
const configDir = path.join(osConfigDir(), 'taut')

// Load the Taut main process script
const mainJs = path.join(configDir, 'core', 'main', 'main.cjs')
require(mainJs)

// Load the original Slack app
// @ts-ignore
require('../_app.asar')
