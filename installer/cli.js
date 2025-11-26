#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  findSlackInstall,
  getSlackPaths,
  isPatched,
  patch,
  unpatch,
  getElectronBinary,
  getBinaryFuses,
  getAsarVersion,
} from 'patch'

/**
 * Main entry point for the Taut CLI installer.
 * Handles install, uninstall, and status commands for patching Slack.
 * @returns {Promise<void>}
 */
async function main() {
  const args = process.argv.slice(2)
  const action = args[0]
  const customPath = args[1]

  console.log('🔌 Taut Installer')
  console.log()

  /** @type {string | null} */
  let resourcesDir = customPath || null
  if (!resourcesDir) {
    resourcesDir = await findSlackInstall()
  }

  if (!resourcesDir) {
    console.error('❌ Could not find Slack installation.')
    console.error('   Searched paths:')
    for (const p of getSlackPaths()) {
      console.error(`   - ${p}`)
    }
    console.error('')
    console.error('   You can specify a custom path:')
    console.error('   npx taut-installer install /path/to/slack/resources')
    process.exit(1)
  }

  console.log(`📍 Found Slack at: ${resourcesDir}`)
  console.log()

  const patchedStatus = (await isPatched(resourcesDir)) ? 'Yes' : 'No'
  if (patchedStatus === 'Yes') {
    const appAsarVersion = await getAsarVersion(
      path.join(resourcesDir, 'app.asar')
    )
    if (appAsarVersion) {
      console.log(`   Patched: Yes, v${appAsarVersion.version}`)
    } else {
      console.log('   Patched: Yes (version unknown)')
    }
  } else {
    console.log(`   Patched: ${patchedStatus}`)
  }
  console.log()

  if (!action || action === 'install' || action === 'patch') {
    await patch(resourcesDir)
  } else if (action === 'uninstall' || action === 'unpatch') {
    await unpatch(resourcesDir)
  } else if (action === 'status') {
    // Already printed basic status above

    // Check asar files and their versions
    const appAsar = path.join(resourcesDir, 'app.asar')
    const backupAsar = path.join(resourcesDir, '_app.asar')

    const appAsarVersion = await getAsarVersion(appAsar)
    const backupAsarVersion = await getAsarVersion(backupAsar)

    // app.asar line
    if (appAsarVersion && appAsarVersion.name === 'taut') {
      console.log(`app.asar: ✅ Taut v${appAsarVersion.version}`)
    } else if (appAsarVersion && appAsarVersion.name === 'slack-desktop') {
      console.log(`app.asar: ✅ Slack v${appAsarVersion.version} (not patched)`)
    } else {
      console.log(`app.asar: ❌ Unknown or missing`)
    }

    // _app.asar line
    if (backupAsarVersion && backupAsarVersion.name === 'taut') {
      console.log(`_app.asar: ⚠️  Taut v${backupAsarVersion.version}`)
    } else if (
      backupAsarVersion &&
      backupAsarVersion.name === 'slack-desktop'
    ) {
      console.log(`_app.asar: ✅ Slack v${backupAsarVersion.version}`)
    } else {
      console.log(`_app.asar: ❌ Unknown or missing`)
    }

    console.log('')

    const fuses = await getBinaryFuses(getElectronBinary(resourcesDir))
    let fuseInfo = ''
    if (fuses) {
      const enabledFuses = Object.entries(fuses)
        .filter(
          ([fuse, enabled]) =>
            enabled && fuse !== 'EnableEmbeddedAsarIntegrityValidation'
        )
        .map(([fuse]) => fuse)
      if (enabledFuses.length > 0) {
        fuseInfo = `, ${enabledFuses.join(', ')}`
      }
    }

    const integrityDisabled =
      fuses && fuses.EnableEmbeddedAsarIntegrityValidation === false
    console.log(
      `Electron fuses: integrity validation ${
        integrityDisabled ? 'disabled' : 'enabled'
      }${fuseInfo}`
    )
  } else {
    console.log('Usage: npx taut-installer [command] [path]')
    console.log()
    console.log('Commands:')
    console.log('  install, patch     Install Taut (default)')
    console.log('  uninstall, unpatch Remove Taut')
    console.log('  status             Show current status')
    console.log()
    console.log('Examples:')
    console.log('  npx taut-installer')
    console.log('  npx taut-installer install')
    console.log('  npx taut-installer uninstall')
    console.log('  npx taut-installer install /custom/path/to/resources')
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  if (process.env.DEBUG) {
    console.error(err.stack)
  }
  process.exit(1)
})
