// Abstract base class for all Taut plugins

import type { TautPluginConfig } from './main/plugins.cjs'
export type { TautPluginConfig } from './main/plugins.cjs'

export type TautAPI = {
  /**
   * Ask the main process to start sending plugins and configs
   */
  startPlugins: () => Promise<void>

  /**
   * Subscribe to config changes with a callback
   * @param callback - Callback to invoke on config changes
   */
  onConfigChange: (
    callback: (name: string, newConfig: TautPluginConfig) => void
  ) => void

  /**
   * Find Webpack exports matching a filter function
   * @param filter - Filter function to match exports
   * @param all - Whether to return all matches or just the first (default: false)
   */
  findExport: (
    filter: (exp: any) => boolean,
    all?: boolean
  ) => any | any[] | null

  /**
   * Find Webpack exports by their properties
   * @param props - Array of property names to match
   * @param all - Whether to return all matches or just the first (default: false)
   */
  findByProps: (props: string[], all?: boolean) => any | any[] | null

  /**
   * Find React components by their display name
   * @param name - Display name of the component
   * @param all - Whether to return all matches or just the first (default: false)
   * @param filter - Optional additional filter function
   */
  findComponent: (
    name: string,
    all?: boolean,
    filter?: (exp: any) => boolean
  ) => any | any[] | null

  /**
   * Commonly used modules exposed for plugins
   */
  commonModules: {
    React: typeof import('react')
    ReactDOM: typeof import('react-dom')
    ReactDOMClient: typeof import('react-dom/client')
  }
}

/**
 * Abstract base class that all Taut plugins must extend.
 * Plugins are instantiated in the browser context with access to the TautAPI.
 */
export abstract class TautPlugin {
  protected api: TautAPI
  protected config: TautPluginConfig

  /**
   * @param api - The TautAPI instance for plugin communication
   * @param config - The plugin's configuration from config.jsonc
   */
  constructor(api: TautAPI, config: TautPluginConfig) {
    this.api = api
    this.config = config
  }

  /**
   * Called when the plugin should start.
   * Subclasses must implement this method.
   */
  abstract start(): void

  /**
   * Called when the plugin should stop and clean up.
   * Subclasses should override this to perform cleanup.
   */
  stop(): void {
    // Default implementation does nothing
  }

  /**
   * Log a message with the plugin's name prefix.
   * @param args - Something to log
   */
  protected log(...args: any[]): void {
    console.log(`[Taut] [${this.constructor.name}]`, ...args)
  }
}

export default TautPlugin
export type TautPluginConstructor = new (
  api: TautAPI,
  config: object
) => TautPlugin
