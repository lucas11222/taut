// Taut Client (the plugin manager)
// Runs in the browser page context
// Loads and manages plugins via TautBridge

import { findExport, findByProps, findComponent, commonModules } from './webpack'
import type { TautBridge } from '../preload/preload'
import type {
  TautPlugin,
  TautPluginConstructor,
  TautPluginConfig,
  TautAPI as TautAPIType,
} from '../Plugin'

const global = window as any
const TautBridge: TautBridge = global.TautBridge
if (!TautBridge) {
  throw new Error('[Taut] TautBridge is not available in the renderer context')
}

export const TautAPI: TautAPIType = {
  startPlugins: TautBridge.startPlugins,
  onConfigChange: TautBridge.onConfigChange,
  findExport,
  findByProps,
  findComponent,
  commonModules: commonModules,
}
global.TautAPI = TautAPI


/**
 * Plugin Manager - loads and manages Taut plugins
 */
class PluginManager {
  plugins = new Map<
    string,
    {
      PluginClass: TautPluginConstructor
      instance: TautPlugin
      config: TautPluginConfig
    }
  >()

  /**
   * Initialize the plugin manager - load and start all plugins
   */
  async init() {
    console.log('[Taut] PluginManager initializing...')

    TautAPI.onConfigChange((name, newConfig) => {
      this.updatePluginConfig(name, newConfig)
    })
    await TautAPI.startPlugins()
  }

  /**
   * Load a plugin
   * Called by code injected by the main process
   * @param name - Plugin name
   * @param PluginClass - Plugin class (constructor)
   * @param config - Plugin configuration
   */
  loadPlugin(
    name: string,
    PluginClass: TautPluginConstructor,
    config: TautPluginConfig
  ) {
    console.log(`[Taut] Loading plugin: ${name}`)

    const existing = this.plugins.get(name)
    if (existing && existing.config.enabled) {
      try {
        existing.instance.stop()
      } catch (err) {
        console.error(`[Taut] Error stopping existing plugin ${name}:`, err)
      }
    }

    try {
      const instance = new PluginClass(TautAPI, config)
      this.plugins.set(name, { PluginClass, instance, config })
      if (config.enabled) {
        try {
          instance.start()
          console.log(`[Taut] Plugin ${name} started successfully`)
        } catch (err) {
          console.error(`[Taut] Error starting plugin ${name}:`, err)
        }
      }
    } catch (err) {
      console.error(`[Taut] Error loading plugin ${name}:`, err)
    }
  }

  /**
   * Update a plugin's config and start/restart/stop as needed
   * @param name - Plugin name
   * @param newConfig - New plugin configuration
   */
  updatePluginConfig(name: string, newConfig: TautPluginConfig) {
    console.log(`[Taut] Updating config for plugin: ${name}`)

    const existing = this.plugins.get(name)
    if (!existing) {
      console.warn(`[Taut] Plugin ${name} not loaded, cannot update config`)
      return
    }

    if (existing.config.enabled) {
      try {
        existing.instance.stop()
      } catch (err) {
        console.error(`[Taut] Error stopping plugin ${name}:`, err)
      }
    }

    const instance = new existing.PluginClass(TautAPI, newConfig)
    this.plugins.set(name, {
      PluginClass: existing.PluginClass,
      instance,
      config: newConfig,
    })

    if (newConfig.enabled) {
      try {
        instance.start()
        console.log(
          `[Taut] Plugin ${name} started successfully with new config`
        )
      } catch (err) {
        console.error(
          `[Taut] Error starting plugin ${name} with new config:`,
          err
        )
      }
    }

    console.log(`[Taut] Plugin ${name} config updated`)
  }
}

// Create and initialize the plugin manager
const pluginManager = new PluginManager()
global.__tautPluginManager = pluginManager
pluginManager.init()
