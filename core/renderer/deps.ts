// Taut Renderer Dependencies
// Bundled with Bun for use in Slack's renderer (via executeJavaScript)
// Provides Monaco editor with blob-based workers to comply with Slack's CSP

import * as monaco from 'monaco-editor'

const global = globalThis as any

// Injected by build script
declare const __EDITOR_WORKER_CODE__: string
declare const __JSON_WORKER_CODE__: string
declare const __CSS_WORKER_CODE__: string
const editorWorkerCode = __EDITOR_WORKER_CODE__
const jsonWorkerCode = __JSON_WORKER_CODE__
const cssWorkerCode = __CSS_WORKER_CODE__

// blob: is allowed as a worker-src in Slack's CSP, so this works
function createBlobWorker(code: string): Worker {
  const blob = new Blob([code], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  return new Worker(url)
}

global.MonacoEnvironment = {
  getWorker(_: unknown, label: string): Worker {
    switch (label) {
      case 'json':
        return createBlobWorker(jsonWorkerCode)
      case 'css':
        return createBlobWorker(cssWorkerCode)
      case 'editorWorkerService':
      default:
        return createBlobWorker(editorWorkerCode)
    }
  },
}

monaco.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: true,
  trailingCommas: 'ignore',
})

monaco.css.cssDefaults.setOptions({
  validate: true,
})

const rgbCsvToHex = (rgb: string) => {
  if (!rgb) return undefined

  const parts = rgb.split(',').map((v) => Number(v.trim()))
  if (parts.length !== 3 || parts.some((v) => isNaN(v))) {
    console.warn('[Taut] Invalid RGB value:', rgb)
    return undefined
  }

  const [r, g, b] = parts

  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

const updateMonacoTheme = () => {
  try {
    const bodyStyle = window.getComputedStyle(document.body)
    const colorScheme = bodyStyle.colorScheme
    const backgroundColor = rgbCsvToHex(
      bodyStyle.getPropertyValue('--sk_primary_background')
    )
    monaco.editor.defineTheme('taut', {
      base: colorScheme === 'dark' ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [],
      colors: {
        // monaco doesn't like undefined values, but you can omit them for default
        ...(backgroundColor ? { 'editor.background': backgroundColor } : {}),
      },
    })
    console.log('[Taut] Updated Monaco theme:', colorScheme, backgroundColor)
  } catch (error) {
    console.error('[Taut] Failed to update Monaco theme:', error)
  }
}

updateMonacoTheme()
monaco.editor.setTheme('taut')

const observer = new MutationObserver(updateMonacoTheme)
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'style'],
})

global.monaco = monaco
global.updateMonacoTheme = updateMonacoTheme

export { monaco, updateMonacoTheme }
