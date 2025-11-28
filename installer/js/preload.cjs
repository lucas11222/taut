// Main renderer process entrypoint
// Injected into the renderer process as a custom preload script by inject.cjs

const { ipcRenderer } = require('electron')

console.log('!!! preload loaded')

// Request and eval the original Slack preload script from the main process
;(async () => {
  const originalPreload = await ipcRenderer.invoke('taut:get-original-preload')
  if (originalPreload) {
    console.log('!!! evaluating original preload script')
    eval(originalPreload)
  }
})()
