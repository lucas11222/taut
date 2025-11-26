// @ts-nocheck

const os = require('os')
const { join } = require('path')

function osConfigDir() {
  switch (process.platform) {
    case 'win32':
      return process.env.APPDATA || 'C:\\Program Files'

    case 'darwin': {
      const home = os.homedir() || '~'
      return join(home, 'Library', 'Preferences')
    }

    case 'linux':
    default: {
      const xdgConfigDir = process.env.XDG_CONFIG_HOME
      if (xdgConfigDir) return xdgConfigDir

      const home = os.homedir() || '~'
      return join(home, '.config')
    }
  }
}

const configDir = join(osConfigDir(), 'taut')

const injectJs = join(configDir, 'js', 'inject.js')
require(injectJs)

require('../_app.asar')
