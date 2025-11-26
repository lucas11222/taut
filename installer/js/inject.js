const Module = require('module')
const electron = require('electron')

/**
 * The script we inject into the Slack window to signal that Taut is active.
 * @returns {void}
 */
function injected() {
  alert('Hello from Taut!')
}

/**
 * Hold the primary Slack BrowserWindow so we can inject scripts once ready.
 * @type {electron.BrowserWindow | undefined}
 */
let BROWSER

/**
 * List of module name patterns to intercept and wrap.
 * @type {RegExp[]}
 */
const modules = [/^electron.*$/]

/**
 * Map of function paths to their redirect handlers.
 * Keys are in the format '<module>.ClassName.<constructor>' or '<module>.ClassName.methodName'.
 * @type {Map<string, Function>}
 */
const redirected = new Map([
  [
    '<electron>.BrowserWindow.<constructor>',
    /**
     * Redirect for BrowserWindow constructor to inject our script.
     * @param {typeof electron.BrowserWindow} target - The original BrowserWindow constructor
     * @param {[electron.BrowserWindowConstructorOptions?]} args - Constructor arguments
     * @param {Function} newTarget - The new.target value
     * @returns {electron.BrowserWindow} The constructed BrowserWindow instance
     */
    (target, args, newTarget) => {
      if (typeof args[0] === 'object' && args[0]?.webPreferences) {
        args[0].webPreferences.devTools = true
        args[0].autoHideMenuBar = false
      }

      BROWSER = Reflect.construct(target, args, newTarget)
      if (!BROWSER) {
        throw new Error('Failed to create BrowserWindow')
      }

      // Run our injected script once the window has finished loading.
      BROWSER.webContents.on('dom-ready', async () => {
        await BROWSER?.webContents.executeJavaScript(
          `;(${injected.toString()})()`
        )
      })

      return BROWSER
    },
  ],
])

/** Marker that allows us to detect and unwrap our Proxy instances. */
const PROXIED = Symbol('taut:proxied')
/**
 * Detects if a value is a Proxy created by our wrap function.
 * @param {any} val
 * @returns {boolean}
 */
function isProxied(val) {
  if (!(typeof val === 'object' || typeof val === 'function')) return false
  const prototype = Reflect.getPrototypeOf(val)
  return (
    Reflect.has(val, PROXIED) && !(prototype && Reflect.has(prototype, PROXIED))
  )
}
/**
 * Unwraps a value if it is a Proxy created by our wrap function.
 * @param {any} val
 * @returns {any}
 */
function unproxy(val) {
  return isProxied(val) ? val[PROXIED] : val
}
/**
 * Converts a property key to a string for logging.
 * @param {string|symbol} p
 * @returns {string}
 */
function prop(p) {
  return typeof p === 'symbol' ? p.toString() : p
}

/**
 * Recursively wraps objects in a Proxy, keeping track of the access path in `log`.
 * Based on the access path, function calls and constructors can be redirected.
 * @template T
 * @param {T} obj - The object or function to wrap
 * @param {string} module - The name of the module being wrapped
 * @param {string} log - The current access path for logging and redirect lookup
 * @returns {T} The wrapped proxy or the original value if not wrappable
 */
function wrap(obj, module, log) {
  if (typeof obj !== 'object' && typeof obj !== 'function') {
    return obj
  }

  // @ts-ignore - Proxy typing is complex with generics
  return new Proxy(obj, {
    get(target, p, receiver) {
      const newLog = `${log}.${prop(p)}`

      try {
        if (p === PROXIED) return target

        receiver = unproxy(receiver)
        const val = Reflect.get(target, p, receiver)
        const desc = Reflect.getOwnPropertyDescriptor(target, p)
        if (desc && desc.configurable === false && desc.writable === false) {
          return val
        }

        return wrap(val, module, newLog)
      } catch (err) {
        console.warn(`taut loader get ${newLog} failed`, err)
      }
    },

    has(target, p) {
      try {
        if (p === PROXIED) return true
        return Reflect.has(target, p)
      } catch (err) {
        console.warn(`taut loader has ${log} failed`, err)
      }
    },

    set(target, p, newValue, receiver) {
      try {
        return Reflect.set(target, p, newValue, unproxy(receiver))
      } catch (err) {
        console.warn(`taut loader set ${log}.${prop(p)} failed`, err)
      }
    },

    apply(target, thisArg, argArray) {
      try {
        const handler = redirected.get(log)
        const normalizedThis = unproxy(thisArg)
        if (handler) {
          // @ts-ignore - handler types are dynamic
          return handler(target, normalizedThis, argArray)
        }
        // @ts-ignore - target is known to be callable at this point
        return Reflect.apply(target, normalizedThis, argArray)
      } catch (err) {
        console.warn(`taut loader call ${log} failed`, err)
      }
    },

    construct(target, argArray, newTarget) {
      try {
        const constructorLog = `${log}.<constructor>`
        if (redirected.has(constructorLog)) {
          const handler = redirected.get(constructorLog)
          if (handler) {
            // @ts-ignore - handler types are dynamic
            return handler(target, argArray, newTarget)
          }
        }
        // @ts-ignore - target is known to be constructable at this point
        return Reflect.construct(target, argArray, newTarget)
      } catch (err) {
        console.warn(`taut loader construct ${log} failed`, err)
      }
    },
  })
}

// // Hide our proxies from util.types.isProxy to avoid detection.
// redirected.set('<node:util>.types.isProxy', (target, ts, args) => {
//   if (isProxied(args[0])) {
//     return false
//   }
//   return Reflect.apply(target, ts, args)
// })

// @ts-ignore - Module._load is an internal Node.js API
const oldLoad = Module._load

/**
 * Override for Module._load to wrap electron modules before they are exposed.
 * @param {string} request - The module request string.
 * @param {NodeJS.Module} parent - The parent module.
 * @param {boolean} isMain - Whether this is the main module.
 * @returns {any} The module exports, potentially wrapped.
 */
function _load(request, parent, isMain) {
  // @ts-ignore - using arguments for proper this binding
  const exports = oldLoad.apply(this, arguments)
  if (modules.some((x) => x.test(request))) {
    return wrap(exports, request, `<${request}>`)
  }
  return exports
}

// @ts-ignore - Module._load is an internal Node.js API
Module._load = _load
