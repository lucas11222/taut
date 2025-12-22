// Taut Client (the plugin manager)
// Runs in the browser page context
// Loads and manages plugins via TautBridge

import { findExport, findByProps, commonModules } from './webpack'
import { findComponent, patchComponent } from './react'
import { addSettingsTab } from './settings'
import { setStyle, removeStyle } from './css'
import { TautBridge, TypedEventTarget } from './helpers'

import {
  TautPlugin,
  type TautPluginConstructor,
  type TautPluginConfig,
} from '../Plugin'

const global = globalThis as any
global.TautPlugin = TautPlugin

export const TautAPI = {
  setStyle,
  removeStyle,
  findExport,
  findByProps,
  findComponent,
  patchComponent,
  commonModules,
}
export type TautAPI = typeof TautAPI
global.TautAPI = TautAPI

/**
 * Plugin Manager - loads and manages Taut plugins
 */
export class PluginManager extends TypedEventTarget<{
  pluginInfoChanged: PluginInfo
}> {
  plugins = new Map<
    string,
    {
      PluginClass: TautPluginConstructor
      instance: TautPlugin | null
      config: TautPluginConfig
    }
  >()

  /**
   * Initialize the plugin manager - load and start all plugins
   */
  async init() {
    console.log('[Taut] PluginManager initializing...')

    TautBridge.onConfigChange((name, newConfig) => {
      this.updatePluginConfig(name, newConfig)
    })
    await TautBridge.startPlugins()
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

    if (
      typeof PluginClass !== 'function' ||
      !(PluginClass.prototype instanceof TautPlugin)
    ) {
      console.error(`[Taut] Plugin class ${name} does not extend TautPlugin`)
      return
    }

    const existing = this.plugins.get(name)
    if (existing && existing.instance) {
      try {
        existing.instance.stop()
      } catch (err) {
        console.error(`[Taut] Error stopping existing plugin ${name}:`, err)
      }
    }

    let instance: TautPlugin | null = null

    if (config.enabled) {
      try {
        instance = new PluginClass(TautAPI, config)
        instance.start()
        console.log(`[Taut] Plugin ${name} started successfully`)
      } catch (err) {
        console.error(`[Taut] Error starting plugin ${name}:`, err)
      }
    }

    this.plugins.set(name, { PluginClass, instance, config })
    this.emit('pluginInfoChanged', this.getPluginInfo())
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

    if (existing.instance) {
      try {
        existing.instance.stop()
      } catch (err) {
        console.error(`[Taut] Error stopping plugin ${name}:`, err)
      }
      existing.instance = null
    }

    let instance: TautPlugin | null = null

    if (newConfig.enabled) {
      try {
        instance = new existing.PluginClass(TautAPI, newConfig)
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

    this.plugins.set(name, {
      PluginClass: existing.PluginClass,
      instance,
      config: newConfig,
    })

    this.emit('pluginInfoChanged', this.getPluginInfo())
    console.log(`[Taut] Plugin ${name} config updated`)
  }

  getPluginInfo() {
    return [...this.plugins.entries()].map(([id, plugin]) => ({
      id,
      name: plugin.PluginClass.pluginName,
      description: plugin.PluginClass.description,
      authors: plugin.PluginClass.authors,
      enabled: plugin.config.enabled,
    }))
  }
}
export type PluginInfo = ReturnType<PluginManager['getPluginInfo']>

export function initialize() {
  // Create and initialize the plugin manager
  const pluginManager = new PluginManager()
  global.__tautPluginManager = pluginManager
  pluginManager.init()

  // Add Taut settings tab
  addSettingsTab(pluginManager)
}
